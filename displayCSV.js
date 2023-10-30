const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const certifMaker = require("./CertifNode");
const http = require("http");
const io = require("socket.io");

const app = express();
const port = process.env.PORT || 10000;
app.set("view engine", "ejs");
app.use(express.static("public"));

// Create the "uploads" directory if it doesn't exist
const uploadDir = "./uploads"; // Define the directory path
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const server = http.createServer(app);
const socketIO = io(server);
app.io = socketIO; // Attach Socket.IO to your Express app

// Set up file upload using Multer
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
  res.render("index");
});

app.post(
  "/students",
  upload.fields([
    { name: "csvFile", maxCount: 1 },
    { name: "templatePdf", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // Check if the request contains the CSV and PDF files
      if (!req.files || !req.files.csvFile || !req.files.templatePdf) {
        return res
          .status(400)
          .json({ error: "CSV and/or template PDF files not provided" });
      }

      // Get the uploaded CSV and PDF files
      const csvFile = req.files.csvFile[0];
      const templatePdf = req.files.templatePdf[0];
      const csvFilePath = csvFile.path;

      // Read and parse the CSV file
      const results = [];
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          const eventName = req.body.eventName; // Get the event name from the form
          const eventDate = req.body.eventDate; // Get the event date from the form

          // Initialize progress variables
          let totalStudents = results.length;
          let completedStudents = 0;

          // Create an array to store the generated certificates
          const generatedCertificates = [];

          // Process each record in the CSV data
          for (const student of results) {
            const registrationNumber = student.registerno;
            const studentName = student.fullname;

            // Generate the certificate for the current student
            certifMaker.createCertificate(
              templatePdf.path,
              eventName,
              studentName,
              registrationNumber,
              eventDate,
              (certificateFile) => {
                // Do something with the certificate file, like sending it to the student
                console.log(`Certificate generated for ${studentName}`);
                generatedCertificates.push(certificateFile);

                // Update progress
                completedStudents++;
                const progress = (completedStudents / totalStudents) * 100;
                const progressLog = Math.floor(progress / 10) * 10; // Progress in steps of 10
                console.log(`Progress: ${progressLog}%`);

                // Send progress to the client
                res.io.emit("progress", { progress });

                // If all certificates are generated, respond with success
                if (completedStudents === totalStudents) {
                  res.status(200).json({ message: "Certificates generated" });
                }
              }
            );
          }
        });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
