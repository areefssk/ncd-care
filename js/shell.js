/* ส่วนกลางที่ทุกหน้าใช้ร่วมกัน: เปลี่ยนหน้า, โปรไฟล์/ออกจากระบบ, ชื่อพื้นที่, ติดตั้งแอป */
import { api, session, homeOnce } from './api.js';
import { cached, clearAll } from './store.js';
import { CONFIG } from './config.js';
import { h, $, icon, openSheet, toast, initial, fmt } from './ui.js';

export const user = () => session.get()?.user || null;
export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

/* พื้นที่ */
export const loadAreas = () => cached('areas', () => (user()?.role === 'VOLUNTEER' ? homeOnce().then(d => d.areas) : api.areas()), { ttl: 10 * 60 * 1000 });
export const areaName = r => (r ? `ต.${r['ตำบล']} หมู่ ${fmt.moo(r['หมู่'])}` : '');
export const areaLabel = (areas, id) => areaName((areas || []).find(a => a.Area_ID === id)) || id || '';

/* ป้ายตัวเลขบนเมนู */
export function setBadge(navIndex, n) {
  document.querySelectorAll(`[data-nav="${navIndex}"] .nbadge`).forEach(b => b.remove());
  if (!n) return;
  document.querySelectorAll(`.bottom-nav [data-nav="${navIndex}"]`).forEach(a => a.append(h('span', { class: 'nbadge' }, n > 99 ? '99+' : n)));
  document.querySelectorAll(`.side [data-nav="${navIndex}"]`).forEach(a => a.append(h('span', { class: 'nbadge side-b' }, n > 99 ? '99+' : n)));
}

/* ติดตั้งแอป (PWA) */
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { deferred = null; });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const canInstall = () => !isStandalone() && (!!deferred || isIOS());
export async function installApp() {
  if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; return; }
  openSheet({
    title: 'ติดตั้งแอปบน iPhone',
    body: h('div', { class: 'advice' },
      h('div', {}, h('b', {}, '1'), 'กดปุ่ม "แชร์" ที่แถบล่างของ Safari'),
      h('div', {}, h('b', {}, '2'), 'เลื่อนลงแล้วเลือก "เพิ่มไปยังหน้าจอโฮม"'),
      h('div', {}, h('b', {}, '3'), 'กด "เพิ่ม" จะได้ไอคอน NCD Care บนหน้าจอ'))
  });
}

/* โปรไฟล์ */
export async function logout() {
  await api.logout();
  session.clear(); clearAll();
  go('#/login');
}
export function openProfile() {
  const u = user(); if (!u) return;
  const roleLabel = u.role === 'VOLUNTEER' ? 'อาสาสมัครสาธารณสุข (อสม.)' : 'เจ้าหน้าที่โรงพยาบาล';
  const sheet = openSheet({
    title: 'บัญชีผู้ใช้',
    body: h('div', { class: 'sheet-body' },
      h('div', { class: 'row-card', style: { cursor: 'default' } }, h('div', { class: 'av' }, initial(u.displayName)), h('div', { class: 'grow' }, h('b', {}, u.displayName), h('small', {}, roleLabel))),
      h('dl', { class: 'kv' }, h('dt', {}, 'โรงพยาบาล'), h('dd', {}, CONFIG.HOSPITAL), u.areaId ? [h('dt', {}, 'พื้นที่'), h('dd', {}, u.areaId)] : null, h('dt', {}, 'เวอร์ชัน'), h('dd', {}, CONFIG.VERSION))),
    actions: [
      canInstall() ? h('button', { class: 'btn', onclick: () => { sheet.close(); installApp(); } }, icon('download'), 'ติดตั้งแอปบนเครื่องนี้') : null,
      h('button', { class: 'btn danger', onclick: async e => { e.currentTarget.disabled = true; sheet.close(); await logout(); toast('ออกจากระบบแล้ว', 'ok'); } }, icon('logout'), 'ออกจากระบบ')
    ]
  });
}
