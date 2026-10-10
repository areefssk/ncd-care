/* โหมดเอฟเฟกต์ภาพ: อัตโนมัติ / เต็ม / ประหยัด — เครื่องช้าจะได้ไม่กระตุก (ตั้งได้ที่เมนูบัญชีผู้ใช้) */
const KEY = 'ncd.fx';
export const fxPref = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
const lowEnd = () => (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
export function applyFx() {
  const p = fxPref(), lite = p === 'lite' || (p === 'auto' && !!lowEnd());
  document.documentElement.dataset.fx = lite ? 'lite' : 'full';
  return lite;
}
export function setFx(v) { try { localStorage.setItem(KEY, v); } catch { /* ไม่ได้ */ } applyFx(); }
export const isLite = () => document.documentElement.dataset.fx === 'lite';
