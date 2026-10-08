/* เกณฑ์สำหรับ "พรีวิวบนหน้าจอ" เท่านั้น — ผลที่บันทึกจริงมาจาก Backend เสมอ
   ค่าตัวเลขตรงกับชีต Settings (NCD-CARE-2570-V1) ซึ่งรอผู้รับผิดชอบทางคลินิกยืนยัน */
export const LEVELS = {
  normal: { label: 'ปกติ', tone: 'ok' },
  risk: { label: 'เสี่ยง', tone: 'risk' },
  suspected: { label: 'สงสัย', tone: 'sus' },
  urgent: { label: 'เร่งด่วน', tone: 'urg' }
};
export function classifyHT(s, d) {
  if (s >= 180 || d >= 110) return 'urgent';
  if (s >= 140 || d >= 90) return 'suspected';
  if (s >= 130 || d >= 85) return 'risk';
  return 'normal';
}
export function classifyDM(v, fasting) {
  if (fasting) {
    if (v < 70) return { level: 'risk', low: true };
    if (v >= 126) return { level: 'suspected' };
    if (v >= 100) return { level: 'risk' };
    return { level: 'normal' };
  }
  if (v >= 200) return { level: 'suspected' };
  if (v >= 140) return { level: 'risk' };
  return { level: 'normal' };
}
export const needsThird = (a, b) => Math.abs(a - b) > 5;
export function meanBP(rs) {
  const v = rs.filter(Boolean);
  if (!v.length) return null;
  return { sbp: Math.round(v.reduce((n, x) => n + x.sbp, 0) / v.length), dbp: Math.round(v.reduce((n, x) => n + x.dbp, 0) / v.length) };
}
export const bmi = (w, h) => (w > 0 && h > 0 ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null);

export const MSG = {
  normal: 'อยู่ในเกณฑ์ปกติ ส่งเสริมพฤติกรรมสุขภาพและคัดกรองตามรอบ',
  risk: 'กลุ่มเสี่ยง ให้คำแนะนำและนัดติดตามภายในระบบ',
  suspected: 'สงสัย ไม่ใช่การวินิจฉัย ต้องประเมินยืนยันโดยบุคลากรทางการแพทย์',
  urgent: 'เร่งด่วน ประเมินอาการทันทีและส่งต่อตามระบบของหน่วยบริการ'
};
export const ADVICE = [
  ['อาหาร', 'ลดเค็ม หวาน มัน เพิ่มผักและผลไม้'],
  ['ออกกำลังกาย', 'เคลื่อนไหวร่างกายอย่างสม่ำเสมอ'],
  ['อารมณ์', 'ผ่อนคลายความเครียด นอนหลับให้พอ'],
  ['ไม่สูบบุหรี่', 'ลดและเลิกการสูบบุหรี่'],
  ['ไม่ดื่มสุรา', 'งดหรือลดการดื่มสุรา']
];
export function fromServer(status, { urgent = false } = {}) {
  if (urgent) return 'urgent';
  const s = String(status || '').toUpperCase();
  return { NORMAL: 'normal', RISK: 'risk', SUSPECTED: 'suspected', URGENT: 'urgent' }[s] || 'normal';
}
export const REFERRAL_STATUS = {
  OPEN: ['รอส่งต่อ', 'sus'], REFERRED: ['ส่งต่อแล้ว', 'risk'], ARRIVED: ['ถึงหน่วยบริการ', 'risk'],
  ASSESSED: ['ประเมินแล้ว', 'ok'], COMPLETED: ['เสร็จสิ้น', 'ok'], CLOSED: ['ปิดเคส', 'ok'], CANCELLED: ['ยกเลิก', 'muted']
};
export const REFERRAL_NEXT = { OPEN: 'REFERRED', REFERRED: 'ARRIVED', ARRIVED: 'ASSESSED', ASSESSED: 'COMPLETED' };
export const isClosedRef = s => ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(String(s || '').toUpperCase());
export const isClosedFollow = s => ['COMPLETED', 'DONE', 'CLOSED', 'CANCELLED'].includes(String(s || '').toUpperCase());
