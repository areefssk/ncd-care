/* ตั้งค่าแอป — แก้ที่ไฟล์นี้ไฟล์เดียว */
export const CONFIG = {
  // URL ของ Apps Script Web App (ลงท้าย /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycby8zASHAdvCSNq9EPFIV-8kE91a106O_5cnuLr8DiDOFddjQeVvL3_Kq1LXL1pjZz6-/exec',
  // true = บังคับโหมดสาธิต (ข้อมูลสมมติ ไม่เชื่อมฐานข้อมูลจริง) ทดสอบได้โดยเปิด ?demo ท้าย URL
  DEMO: false,
  HOSPITAL: 'โรงพยาบาลศรีสาคร',
  VERSION: '3.3.0',
  TIMEOUT_MS: 20000,
  CACHE_TTL_MS: 60000
};
