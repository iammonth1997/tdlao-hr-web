const titleEl = document.getElementById("title");
if (titleEl) {
  titleEl.innerText = t("otslip_title");
}

async function loadOTSlip() {
  const resultEl = document.getElementById("result");
  if (!resultEl) {
    return;
  }

  try {
    const month = document.getElementById("month")?.value;
    const year = document.getElementById("year")?.value;

    resultEl.innerHTML = t("loading");

    const data = await callAPI("otslip", { month, year });
    if (!data || data.error) {
      resultEl.innerHTML = "Error loading OT slip";
      return;
    }

    resultEl.innerHTML = `
      <div class="slip">
        <h2>${t("otslip_title")}</h2>
        <p>OT Hours: ${data.ot_hours ?? "-"}</p>
        <p>OT Amount: ${data.ot_amount ?? "-"}</p>
        <p>Incentive: ${data.incentive ?? "-"}</p>
      </div>
    `;
  } catch (err) {
    resultEl.innerHTML = "Error loading OT slip";
  }
}
