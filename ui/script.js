document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const reportPath = urlParams.get("report_path");

    if (reportPath) {
        document.getElementById("path").innerHTML = reportPath;

        fetch(reportPath)
            .then((response) => response.json())
            .then((data) => {
                const accordionContainer =
                    document.getElementById("accordionContainer");
                data.forEach((report, index) => {
                    const accordionItem = document.createElement("div");
                    accordionItem.classList.add("accordion-item");
                    accordionItem.classList.add("mb-6");

                    accordionItem.innerHTML = `
              <div class="accordion-header " id="heading${index}">
                <button class="accordion-button">Issue Type: ${report.issue_type}</button>
              </div>
              <div class="accordion-content">
                <div class="accordion-body">
                <div class="mb-2">
                <strong>Code Snippet:</strong>
                <textarea disabled style="width:100%;min-height:150px;overflow:scroll;">${report.code[0]}</textarea>
                </div>
                  <strong>Suggestions:</strong>
                  <textarea readonly style="width:100%;min-height:350px;overflow:scroll;">${report.llm_suggestions}</textarea>
                </div>
              </div>
            `;

                    const accordionButton =
                        accordionItem.querySelector(".accordion-button");
                    const accordionContent =
                        accordionItem.querySelector(".accordion-content");

                    accordionButton.addEventListener("click", function () {
                        accordionContent.style.display =
                            accordionContent.style.display === "none"
                                ? "block"
                                : "none";
                    });

                    accordionContainer.appendChild(accordionItem);
                });
            })
            .catch((error) => console.error("Error loading JSON data:", error));
    } else {
        console.error("Report path not provided in URL query parameters.");
    }
});
