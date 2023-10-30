const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

async function createCertificate(
  templatePath,
  eventName,
  studentName,
  registrationNumber,
  date
) {
  // Convert registrationNumber to uppercase
  registrationNumber = registrationNumber.toUpperCase();

  const templateBuffer = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBuffer);
  const [page] = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fontSize = 20;
  const textColor = rgb(0, 0, 0);

  const studentNameWidth = font.widthOfTextAtSize(studentName, fontSize);
  const eventNameWidth = font.widthOfTextAtSize(eventName, fontSize);
  const dateWidth = font.widthOfTextAtSize(date, fontSize);

  const xStudentName = 415 - studentNameWidth / 2;
  const xEventName = 477 - eventNameWidth / 2;
  const xDate = 560 - dateWidth / 2;

  page.drawText(studentName, {
    x: xStudentName,
    y: 342,
    size: fontSize,
    font: font,
    color: textColor,
  });

  page.drawText(eventName, {
    x: xEventName,
    y: 292,
    size: fontSize,
    font: font,
    color: textColor,
  });

  page.drawText(date, {
    x: xDate,
    y: 222,
    size: fontSize,
    font: font,
    color: textColor,
  });

  const outputFolder = "Outputs";
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }

  const outputFile = path.join(outputFolder, `${registrationNumber}.pdf`);
  fs.writeFileSync(outputFile, await pdfDoc.save());

  return outputFile;
}

module.exports = {
  createCertificate,
};
