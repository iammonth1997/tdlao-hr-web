const titleEl = document.getElementById("title");
if (titleEl) {
  titleEl.innerText = t("daywork_title");
}

async function loadData() {
  const resultEl = document.getElementById("result");
  if (!resultEl) {
    return;
  }

  try {
    const month = document.getElementById("month")?.value;
    const year = document.getElementById("year")?.value;

    resultEl.innerHTML = t("loading");

    const data = await callAPI("daywork", { month, year });
    if (!data || data.error) {
      resultEl.innerHTML = "Error loading data";
      return;
    }

    resultEl.innerHTML = `
      <div class="box">
        <h3>${t("daywork_title")}</h3>
        <p>Workdays: ${data.days ?? "-"}</p>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = "Error loading data";
  }
}
