const LANG = {
  lo: {
    title: "TDLAO HR Portal",
    menu_day: "1. Check Work Days",
    menu_ot: "2. Check OT Hours",
    menu_salary: "3. Salary Slip",
    menu_ot_slip: "4. OT + Incentive Slip",
    choose_month: "Select Month / Year",
    month_label: "Month",
    year_label: "Year",
    daywork_title: "Work Days",
    ot_title: "OT Hours",
    salary_title: "Salary Slip",
    otslip_title: "OT + Incentive Slip",
    loading: "Loading..."
  },
  th: {
    title: "TDLAO HR Portal",
    menu_day: "1. Check Work Days",
    menu_ot: "2. Check OT Hours",
    menu_salary: "3. Salary Slip",
    menu_ot_slip: "4. OT + Incentive Slip",
    choose_month: "Select Month / Year",
    month_label: "Month",
    year_label: "Year",
    daywork_title: "Work Days",
    ot_title: "OT Hours",
    salary_title: "Salary Slip",
    otslip_title: "OT + Incentive Slip",
    loading: "Loading..."
  },
  en: {
    title: "TDLAO HR Portal",
    menu_day: "1. Check Work Days",
    menu_ot: "2. Check OT Hours",
    menu_salary: "3. Salary Slip",
    menu_ot_slip: "4. OT + Incentive Slip",
    choose_month: "Select Month / Year",
    month_label: "Month",
    year_label: "Year",
    daywork_title: "Work Days",
    ot_title: "OT Hours",
    salary_title: "Salary Slip",
    otslip_title: "OT + Incentive Slip",
    loading: "Loading..."
  }
};

function t(key) {
  const lang = localStorage.getItem("lang") || "en";
  if (LANG[lang] && LANG[lang][key]) {
    return LANG[lang][key];
  }
  if (LANG.en[key]) {
    return LANG.en[key];
  }
  return key;
}

function setLang(code) {
  localStorage.setItem("lang", code);
  applyLang();
}

function applyLang() {
  document.querySelectorAll("[data-lang]").forEach((el) => {
    el.textContent = t(el.dataset.lang);
  });
}

document.addEventListener("DOMContentLoaded", applyLang);
