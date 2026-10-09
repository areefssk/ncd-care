/* ตัวเชื่อม Backend (Apps Script) — มี timeout, retry เฉพาะการอ่าน, และไม่ทำให้ผู้ใช้หลุดเพราะเน็ตสะดุด */
import { CONFIG } from './config.js';
import * as demo from './demo-api.js';

export class ApiError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}
export const isDemo = () => CONFIG.DEMO || new URLSearchParams(location.search).has('demo');

const SK = 'ncd.session';
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem(SK, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(SK); } catch {} },
  token() { return this.get()?.token || ''; }
};
let onAuthError = () => {};
export const setAuthHandler = fn => { onAuthError = fn; };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const configured = () => /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(CONFIG.API_URL);

async function once(method, action, params) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CONFIG.TIMEOUT_MS);
  try {
    let res;
    if (method === 'GET') {
      const u = new URL(CONFIG.API_URL); u.searchParams.set('action', action);
      for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
      res = await fetch(u, { signal: ctl.signal, redirect: 'follow' });
    } else {
      res = await fetch(CONFIG.API_URL, { method: 'POST', signal: ctl.signal, redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...params }) });
    }
    let payload;
    try { payload = await res.json(); } catch { throw new ApiError('BAD_RESPONSE', 'เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ กรุณาแจ้งผู้ดูแลระบบ'); }
    if (!payload || payload.ok !== true) {
      const e = payload?.error || {};
      throw new ApiError(e.code || 'API_ERROR', e.message || 'เกิดข้อผิดพลาดจากระบบ', { requestId: payload?.requestId });
    }
    return payload.data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError('TIMEOUT', 'ระบบตอบกลับช้า กรุณาลองอีกครั้ง');
    throw new ApiError('NETWORK', navigator.onLine === false ? 'ไม่มีสัญญาณอินเทอร์เน็ต' : 'เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง');
  } finally { clearTimeout(timer); }
}

async function call(method, action, params = {}, { retries = method === 'GET' ? 2 : 0 } = {}) {
  if (!configured()) throw new ApiError('NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า API_URL ในไฟล์ js/config.js');
  let attempt = 0;
  for (;;) {
    try { return await once(method, action, params); }
    catch (e) {
      if (['UNAUTHORIZED', 'SESSION_EXPIRED'].includes(e.code)) { session.clear(); onAuthError(e); throw e; }
      if (attempt < retries && ['NETWORK', 'TIMEOUT'].includes(e.code)) { await sleep(600 * (attempt + 1) ** 2); attempt++; continue; }
      throw e;
    }
  }
}

const t = () => ({ token: session.token() });
const real = {
  volunteerLogin: cid => call('POST', 'volunteerLogin', { cid }),
  adminLogin: (username, password) => call('POST', 'adminLogin', { username, password }),
  logout: () => (session.token() ? call('POST', 'logout', t()).catch(() => {}) : Promise.resolve()),
  me: () => call('GET', 'me', t()),
  home: () => call('GET', 'home', t()),
  areas: () => call('GET', 'areas', t()),
  people: (o = {}) => call('GET', 'people', { ...t(), ...o }),
  followUps: (o = {}) => call('GET', 'followUps', { ...t(), ...o }),
  referrals: (o = {}) => call('GET', 'referrals', { ...t(), ...o }),
  dashboardSummary: (o = {}) => call('GET', 'dashboardSummary', { ...t(), ...o }),
  createScreening: p => call('POST', 'createScreening', { ...t(), ...p }),
  saveFollowUp: p => call('POST', 'saveFollowUp', { ...t(), ...p }),
  createReferral: p => call('POST', 'createReferral', { ...t(), ...p }),
  saveReferral: p => call('POST', 'saveReferral', { ...t(), ...p }),
  reportMeta: () => call('POST', 'reportMeta', t()),
  report: p => call('POST', 'report', { ...t(), ...p }),
  reportExportLog: p => call('POST', 'reportExportLog', { ...t(), ...p })
};
export const api = new Proxy({}, { get: (_, k) => (isDemo() ? demo.api[k] : real[k]) });

/* หน้าแรกของ อสม. ใช้ข้อมูลหลายชุดพร้อมกัน (รายชื่อ/งานติดตาม/ส่งต่อ/พื้นที่) — รวมเป็นคำขอเดียวไปที่ Backend (endpoint home)
   ถ้ามีหลายส่วนขอพร้อมกัน จะแชร์คำขอเดียวกัน */
let homeFlight = null;
export function homeOnce() {
  if (!homeFlight) homeFlight = api.home().finally(() => { setTimeout(() => { homeFlight = null; }, 0); });
  return homeFlight;
}
