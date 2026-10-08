/* ตัวช่วยสร้างหน้าจอ: DOM, ไอคอน, toast, bottom sheet, เอฟเฟกต์ */
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- DOM ---------- */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- icons (ข้อความคงที่ ไม่ใช่ข้อมูลผู้ใช้) ---------- */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 5a3.5 3.5 0 010 6.5M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  send: '<path d="M4 12h13M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17v.5"/>',
  logout: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  map: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  drop: '<path d="M12 3s6 6.2 6 10.5a6 6 0 01-12 0C6 9.2 12 3 12 3z"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9a5 5 0 017 0M12 12.5l2-2.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  offline: '<path d="M3 3l18 18"/><path d="M8.5 15a5 5 0 017 0M5 11.5a10 10 0 013.2-2M12 19.5v.1M19 11.5a10 10 0 00-6-2.8"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M11 18.5h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>'
};
export function icon(name, cls = '') {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return t.content.firstElementChild;
}

/* ---------- format ---------- */
const thDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const thDateTime = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmt = {
  n: x => Number(x || 0).toLocaleString('th-TH'),
  pct: (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0),
  date: v => { const d = new Date(v); return isNaN(d) ? '—' : thDate.format(d); },
  dateTime: v => { const d = new Date(v); return isNaN(d) ? '—' : thDateTime.format(d); },
  daysLeft: v => { const d = new Date(v); return isNaN(d) ? null : Math.ceil((d - Date.now()) / 86400000); },
  moo: v => Number(v) || v
};
export function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}
export const debounce = (fn, ms = 180) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- toast ---------- */
export function toast(msg, type = 'info') {
  const layer = $('#layer');
  let box = $('.toasts', layer);
  if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); layer.append(box); }
  const t = h('div', { class: 'toast ' + type }, icon(type === 'error' ? 'alert' : type === 'ok' ? 'check' : 'pulse'), h('span', {}, msg));
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 320); }, type === 'error' ? 5200 : 3000);
}

/* ---------- bottom sheet ---------- */
export function openSheet({ title, body, actions = [], onClose, tall = false }) {
  const layer = $('#layer');
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'backdrop' });
  const panel = h('div', { class: 'sheet' + (tall ? ' tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'รายละเอียด' },
    h('div', { class: 'grab' }),
    title ? h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'ปิด', onclick: () => close() }, icon('close'))) : null,
    h('div', { class: 'sheet-body' }, body),
    actions.length ? h('div', { class: 'sheet-actions' }, actions) : null);
  const wrap = h('div', { class: 'sheet-wrap' }, back, panel);
  layer.append(wrap);
  document.body.classList.add('lock');
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  function close(result) {
    if (closed) return; closed = true;
    wrap.classList.remove('in');
    document.body.classList.remove('lock');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { wrap.remove(); prevFocus?.focus?.(); onClose?.(result); }, reduceMotion() ? 0 : 280);
  }
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', () => close());
  setTimeout(() => (panel.querySelector('input,button.primary,button') || panel).focus?.({ preventScroll: true }), 60);
  return { close, el: panel };
}

/* ---------- เอฟเฟกต์ ---------- */
export function countUp(el, to, { dur = 900, decimals = 0, suffix = '' } = {}) {
  const f = v => (decimals ? v.toFixed(decimals) : fmt.n(Math.round(v))) + suffix;
  to = Number(to) || 0;
  if (reduceMotion() || !to) { el.textContent = f(to); return; }
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = f(to * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = f(to);
  };
  requestAnimationFrame(step);
}

export function confetti() {
  if (reduceMotion()) return;
  const c = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  $('#layer').append(c);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const colors = ['#0b7a57', '#17a672', '#3ccb90', '#f4b740', '#ffffff'];
  const P = Array.from({ length: 70 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.55, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4,
    s: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0]
  }));
  const t0 = performance.now();
  (function frame(t) {
    const k = (t - t0) / 1500;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) {
      p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ripple บนปุ่ม */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest?.('.btn,.cta,.chip,.tab-btn,[data-ripple]');
  if (!b || b.disabled || reduceMotion()) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const span = h('span', { class: 'ripple', style: { width: s + 'px', height: s + 'px', left: e.clientX - r.left - s / 2 + 'px', top: e.clientY - r.top - s / 2 + 'px' } });
  b.append(span);
  span.addEventListener('animationend', () => span.remove());
}, { passive: true });

/* ---------- ส่วนประกอบซ้ำ ---------- */
export const skel = (n = 3, cls = '') => h('div', { class: 'skel-list ' + cls }, Array.from({ length: n }, (_, i) => h('div', { class: 'skel', style: { '--i': i } })));
export const empty = (title, text, ico = 'check') => h('div', { class: 'empty' }, h('div', { class: 'empty-ico' }, icon(ico)), h('b', {}, title), text ? h('p', {}, text) : null);
export const errorBox = (msg, retry) => h('div', { class: 'errbox' }, icon('alert'), h('div', {}, h('b', {}, 'โหลดข้อมูลไม่สำเร็จ'), h('p', {}, msg)), retry ? h('button', { class: 'btn small', onclick: retry }, icon('refresh'), 'ลองอีกครั้ง') : null);
export const initial = name => (String(name || '').replace(/^(นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|น\.ส\.)/, '').trim()[0]) || 'อ';
export const stagger = (el, base = 0) => { [...el.children].forEach((c, i) => c.style.setProperty('--i', i + base)); return el; };

/* ---------- วงแหวนความคืบหน้า / ตัวเลือกแบบเลื่อน / ป้ายระดับ ---------- */
import { LEVELS } from './rules.js';
export function ring(pct, { animate = true } = {}) {
  const id = 'rg' + Math.random().toString(36).slice(2, 7), C = 2 * Math.PI * 40, p = Math.max(0, Math.min(100, Number(pct) || 0));
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="ความคืบหน้า ${Math.round(p)} เปอร์เซ็นต์"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b7a57"/><stop offset="1" stop-color="#3ccb90"/></linearGradient></defs><circle class="trk" cx="50" cy="50" r="40" fill="none" stroke-width="11"/><circle class="arc" cx="50" cy="50" r="40" fill="none" stroke="url(#${id})" stroke-width="11" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="0 ${C}"/><text x="50" y="57" text-anchor="middle" style="font:700 21px Sarabun,sans-serif;fill:#10302a">${Math.round(p)}%</text></svg>`;
  const svg = t.content.firstElementChild, arc = svg.querySelector('.arc'), v = `${(C * p) / 100} ${C}`;
  if (animate && !reduceMotion()) requestAnimationFrame(() => requestAnimationFrame(() => arc.setAttribute('stroke-dasharray', v)));
  else arc.setAttribute('stroke-dasharray', v);
  return svg;
}
export function seg(options, value, onChange) {
  const el = h('div', { class: 'seg', role: 'tablist', style: { '--n': options.length, '--idx': Math.max(0, options.findIndex(o => o[0] === value)) } });
  const btns = options.map(([v, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === value), onclick: () => select(v, true) }, label));
  function select(v, fire) {
    btns.forEach((b, i) => { const on = options[i][0] === v; b.setAttribute('aria-selected', String(on)); if (on) el.style.setProperty('--idx', i); });
    if (fire) onChange?.(v);
  }
  el.append(...btns); el.set = v => select(v, false);
  return el;
}
export const levelPill = (level, text) => h('span', { class: 'pill p-' + (LEVELS[level]?.tone || 'none') }, text || LEVELS[level]?.label || '—');
