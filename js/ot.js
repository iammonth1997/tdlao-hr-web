const titleEl = document.getElementById("title");
if (titleEl) {
  titleEl.innerText = t("ot_title");
}

async function loadOT() {
  const resultEl = document.getElementById("result");
  if (!resultEl) {
    return;
  }

  try {
    const month = document.getElementById("month")?.value;
    const year = document.getElementById("year")?.value;

    resultEl.innerHTML = t("loading");

    const data = await callAPI("ot", { month, year });
    if (!data || data.error) {
      resultEl.innerHTML = "Error loading OT";
      return;
    }

    resultEl.innerHTML = `
      <div class="box">
        <h3>${t("ot_title")}</h3>
        <p>OT Hours: ${data.ot_hours ?? "-"}</p>
        <p>Incentive: ${data.incentive ?? "-"}</p>
      </div>
    `;
  } catch (e) {
    resultEl.innerHTML = "Error loading OT";
  }
}
