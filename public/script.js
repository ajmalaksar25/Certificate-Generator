document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const csvData = document.getElementById("csvData");
  const tableBody = document.getElementById("tableBody");

  form.addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent the default form submission

    const formData = new FormData(form);

    const response = await fetch("/students", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      // Check the content type before parsing as JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();

        if (data.certificates && data.certificates.length > 0) {
          // window.location.href = "/students";

          // Display CSV Data
          csvData.style.display = "block";
          tableBody.innerHTML = ""; // Clear existing table rows

          data.certificates.forEach((certificate) => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${certificate.name}</td>
              <td><a href="file:///download/${certificate.registerno}" target="_blank">Download</a></td>
            `;
            console.log(certificate);
            tableBody.appendChild(row);
          });

          // Hide the form
          form.style.display = "none";
        } else {
          alert("No certificates were generated.");
        }
      } else {
        alert("Response is not valid JSON.");
      }
    } else {
      alert("An error occurred while processing the request.");
    }
  });
});
