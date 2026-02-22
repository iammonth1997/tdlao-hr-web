/** TDLAO HR - Language Manager */

const LANG = {
  lo: {
    title:         "TDLAO HR Portal",
    menu_day:      "1. ກວດວັນເຮັດວຽກ",
    menu_ot:       "2. ກວດຊົ່ວໂມງ OT",
    menu_salary:   "3. ສະລິບເງິນເດືອນ",
    menu_ot_slip:  "4. ສະລິບ OT + ຄ່າຈູງໃຈ",
    choose_month:  "ເລືອກເດືອນ / ປີ",
    month_label:   "ເດືອນ",
    year_label:    "ປີ",
    daywork_title: "ວັນເຮັດວຽກ",
    ot_title:      "ຊົ່ວໂມງ OT",
    salary_title:  "ສະລິບເງິນເດືອນ",
    otslip_title:  "ສະລິບ OT + ຄ່າຈູງໃຈ",
    loading:       "ກຳລັງໂຫລດ...",
    login_title:   "ເຂົ້າສູ່ລະບົບ",
    emp_id:        "ລະຫັດພະນັກງານ",
    pin:           "PIN 6 ຕົວເລກ",
    login_btn:     "ເຂົ້າສູ່ລະບົບ",
    logout:        "ອອກຈາກລະບົບ",
    error_auth:    "ລະຫັດພະນັກງານ ຫຼື PIN ບໍ່ຖືກຕ້ອງ",
    next:          "ຕໍ່ໄປ →",
    download_pdf:  "ດາວໂຫລດ PDF",
    workdays:      "ວັນເຮັດວຽກ",
    late:          "ມາສາຍ",
    absent:        "ຂາດວຽກ",
    annual_leave:  "ລາພັກປະຈຳປີ",
    sick_leave:    "ລາເຈັບປ່ວຍ",
    personal_leave:"ລາກິດ"
  },
  th: {
    title:         "TDLAO HR Portal",
    menu_day:      "1. ตรวจวันทำงาน",
    menu_ot:       "2. ตรวจชั่วโมง OT",
    menu_salary:   "3. สลิปเงินเดือน",
    menu_ot_slip:  "4. สลิป OT + ค่าจูงใจ",
    choose_month:  "เลือกเดือน / ปี",
    month_label:   "เดือน",
    year_label:    "ปี",
    daywork_title: "วันทำงาน",
    ot_title:      "ชั่วโมง OT",
    salary_title:  "สลิปเงินเดือน",
    otslip_title:  "สลิป OT + ค่าจูงใจ",
    loading:       "กำลังโหลด...",
    login_title:   "เข้าสู่ระบบ",
    emp_id:        "รหัสพนักงาน",
    pin:           "PIN 6 หลัก",
    login_btn:     "เข้าสู่ระบบ",
    logout:        "ออกจากระบบ",
    error_auth:    "รหัสพนักงาน หรือ PIN ไม่ถูกต้อง",
    next:          "ถัดไป →",
    download_pdf:  "ดาวน์โหลด PDF",
    workdays:      "วันทำงาน",
    late:          "มาสาย",
    absent:        "ขาดงาน",
    annual_leave:  "ลาพักร้อน",
    sick_leave:    "ลาป่วย",
    personal_leave:"ลากิจ"
  },
  en: {
    title:         "TDLAO HR Portal",
    menu_day:      "1. Check Work Days",
    menu_ot:       "2. Check OT Hours",
    menu_salary:   "3. Salary Slip",
    menu_ot_slip:  "4. OT + Incentive Slip",
    choose_month:  "Select Month / Year",
    month_label:   "Month",
    year_label:    "Year",
    daywork_title: "Work Days",
    ot_title:      "OT Hours",
    salary_title:  "Salary Slip",
    otslip_title:  "OT + Incentive Slip",
    loading:       "Loading...",
    login_title:   "Login",
    emp_id:        "Employee ID",
    pin:           "PIN (6 digits)",
    login_btn:     "Login",
    logout:        "Logout",
    error_auth:    "Invalid Employee ID or PIN",
    next:          "Next →",
    download_pdf:  "Download PDF",
    workdays:      "Work Days",
    late:          "Late",
    absent:        "Absent",
    annual_leave:  "Annual Leave",
    sick_leave:    "Sick Leave",
    personal_leave:"Personal Leave"
  }
};

function t(key) {
  const lang = localStorage.getItem("lang") || "lo";
  return (LANG[lang]?.[key]) || (LANG.en?.[key]) || key;
}

function setLang(code) {
  localStorage.setItem("lang", code);
  applyLang();
}

function applyLang() {
  document.querySelectorAll("[data-lang]").forEach(el => {
    el.textContent = t(el.dataset.lang);
  });
}

document.addEventListener("DOMContentLoaded", applyLang);