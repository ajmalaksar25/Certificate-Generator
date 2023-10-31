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

const app = express();
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

// Define the directory paths
const uploadDir = "./uploads";
const outputDir = "./Outputs";

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

const processCSV = (csvFilePath, templatePdf, eventName, eventDate) => {
  const results = [];
  try {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        const totalStudents = results.length;
        let completedStudents = 0;
        // Create an array to store the generated certificates
        const generatedCertificates = [];

        // Process each record in the CSV data
        for (const student of results) {
          const registrationNumber = student.registerno;
          const studentName = student.fullname;

          try {
            const certificate = certifMaker.createCertificate(
              templatePdf,
              eventName,
              studentName,
              registrationNumber,
              eventDate,
              (certificateFile) => {
                console.log(`Certificate generated for ${studentName}`);
              }
            );
          } catch (error) {
            console.error(error);
          }
          generatedCertificates.push(certificate);
          completedStudents++;

          if (completedStudents === totalStudents) {
            res.status(200).json({ message: "Certificates generated" });
          }
        }
      });
  } catch (error) {
    console.error(error);
  }
};

app.post(
  "/students",
  upload.fields([
    { name: "csvFile", maxCount: 1 },
    { name: "templatePdf", maxCount: 1 },
  ]),
  [check("eventName").notEmpty(), check("eventDate", "Invalid date").isDate()],
  (req, res) => {
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

    try {
      const generatedCertificates = processCSV(
        csvFilePath,
        templatePdf.path,
        eventName,
        eventDate
      );

      if (generatedCertificates.length > 0) {
        req.session.certificatesGenerated = true;
        res
          .status(200)
          .json({ success: true, certificates: generatedCertificates });
      } else {
        req.session.certificatesGenerated = false;
        res
          .status(200)
          .json({ success: false, message: "No certificates were generated." });
      }
    } catch (error) {
      console.error(error);
      req.session.certificatesGenerated = false;
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

app.get("/students", (req, res) => {
  if (req.session.certificatesGenerated) {
    req.session.certificatesGenerated = false;
    res.render("students");
  } else {
    res.send("Certificates were not successfully generated.");
  }
});

const server = http.createServer(app);
const socketIO = io(server);
app.io = socketIO; // Attach Socket.IO to your Express app

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
