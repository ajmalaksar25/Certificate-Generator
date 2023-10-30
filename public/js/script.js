// Display CSV data in a table
function displayCSVData(csvData) {
  const csvTableBody = document.getElementById("csvTableBody");

  for (const student of csvData) {
    const row = document.createElement("tr");

    const registrationNumberCell = document.createElement("td");
    registrationNumberCell.textContent = student.registerno;
    row.appendChild(registrationNumberCell);

    const fullNameCell = document.createElement("td");
    fullNameCell.textContent = student.fullname;
    row.appendChild(fullNameCell);

    csvTableBody.appendChild(row);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const csvDataSection = document.getElementById("csvData");
  const csvTable = document.getElementById("csvTable");

  // Hide the CSV data section initially
  csvDataSection.style.display = "none";

  const form = document.querySelector("form");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    try {
      const response = await fetch("/students", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const csvData = await response.json();

        // Display CSV data in a table
        displayCSVData(csvData);

        // Show the CSV data section
        csvDataSection.style.display = "block";
        csvTable.style.display = "table";
      } else {
        console.error("Error processing the request");
      }
    } catch (error) {
      console.error(error);
    }
  });
});
