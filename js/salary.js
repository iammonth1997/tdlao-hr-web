const titleEl = document.getElementById("title");
if (titleEl) {
  titleEl.innerText = t("salary_title");
}

async function loadSalary() {
  const resultEl = document.getElementById("result");
  if (!resultEl) {
    return;
  }

  try {
    const month = document.getElementById("month")?.value;
    const year = document.getElementById("year")?.value;

    resultEl.innerHTML = t("loading");

    const data = await callAPI("salary", { month, year });
    if (!data || data.error) {
      resultEl.innerHTML = "Error loading salary slip";
      return;
    }

    resultEl.innerHTML = `
      <div class="slip">
        <h2>${t("salary_title")}</h2>
        <p>Name: ${data.name ?? "-"}</p>
        <p>Position: ${data.position ?? "-"}</p>
        <p>Salary: ${data.salary ?? "-"}</p>
        <p>Net: ${data.netpay ?? data.net ?? "-"}</p>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = "Error loading salary slip";
  }
}
