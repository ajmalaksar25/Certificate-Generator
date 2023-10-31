const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const certifMaker = require("./CertifNode");
const http = require("http");
const io = require("socket.io");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const { check, validationResult } = require("express-validator");
const fsExtra = require("fs-extra");
const archiver = require("archiver");
const { createReadStream } = require("fs");
const stream = require("stream");

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 10000;

// Set the views directory
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["your-secret-key"],
  })
);

const socketIO = io(server);
app.io = socketIO; // Attach Socket.IO to your Express app

// Serve the Socket.IO client script
app.get("/socket.io/socket.io.js", (req, res) => {
  res.sendFile(__dirname + "/node_modules/socket.io-client/dist/socket.io.js");
});

// Define the directory paths
const uploadDir = "./uploads";
const outputDir = "./download";
const generatedCertificates = []; // Declare generatedCertificates as an array

// Create or clear the "uploads" directory
fsExtra.emptyDirSync(uploadDir);

// Create or clear the "Outputs" directory
fsExtra.emptyDirSync(outputDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Use the "uploads" directory for file storage
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Use the original file name
  },
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.render("index", { certificates: [] });
});

const processCSV = (csvFilePath, templatePdf, eventName, eventDate, res) => {
  const results = [];
  const certificates = [];
  try {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        const totalStudents = results.length;
        let completedStudents = 0;

        const generateCertificate = (student, res) => {
          const registrationNumber = student.registerno;
          const studentName = student.fullname;

          certifMaker.createCertificate(
            templatePdf,
            eventName,
            studentName,
            registrationNumber,
            eventDate,
            (certificateFile) => {
              if (certificateFile) {
                console.log(
                  `Certificate generated for ${studentName}`,
                  completedStudents
                );
                generatedCertificates.push({
                  name: `${studentName}.pdf`,
                  path: certificateFile,
                  registerno: registrationNumber,
                });
              } else {
                console.error(`Certificate failed for ${studentName}`);
              }
              completedStudents++;

              if (completedStudents === totalStudents) {
                // If all certificates are generated, redirect to /students
                res.redirect("/students");
              }
            }
          );
        };

        for (const student of results) {
          generateCertificate(student, res);
        }
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  return certificates;
};

app.post(
  "/students",
  upload.fields([
    { name: "csvFile", maxCount: 1 },
    { name: "templatePdf", maxCount: 1 },
  ]),
  [check("eventName").notEmpty(), check("eventDate", "Invalid date").isDate()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.files || !req.files.csvFile || !req.files.templatePdf) {
      return res
        .status(400)
        .json({ error: "CSV and/or template PDF files not provided" });
    }

    const csvFile = req.files.csvFile[0];
    const templatePdf = req.files.templatePdf[0];
    const csvFilePath = csvFile.path;

    const eventName = req.body.eventName;
    const eventDate = req.body.eventDate;

    const generatedCertificates = await processCSV(
      csvFilePath,
      templatePdf.path,
      eventName,
      eventDate,
      res
    );
  }
);

app.get("/students", (req, res) => {
  // Instead of rendering the students.ejs template, return certificates as JSON
  const certificates = generatedCertificates.map((certificate) => ({
    name: certificate.name,
    path: certificate.path,
    registerno: certificate.registerno,
  }));
  res.json({ certificates });
});

app.get("/download/all-certificates.zip", (req, res) => {
  const zip = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level
  });

  // Send the zip as a response
  res.attachment("all-certificates.zip"); // Set the filename for download
  zip.pipe(res);

  // Read and add each certificate file to the zip
  generatedCertificates.forEach((certificate) => {
    zip.append(createReadStream(certificate.path), {
      name: certificate.name,
    });
  });

  // Finalize the zip and send it
  zip.finalize();
});

app.get("/download/certificates.zip", (req, res) => {
  const zip = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level
  });

  // Send the zip as a response
  res.attachment("certificates.zip"); // Set the filename for download
  zip.pipe(res);

  // Read and add each certificate file to the zip
  generatedCertificates.forEach((certificate) => {
    zip.append(createReadStream(certificate.path), {
      name: certificate.name,
    });
  });

  // Finalize the zip and send it
  zip.finalize();
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
