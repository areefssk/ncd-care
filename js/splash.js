/* เอฟเฟกต์ต้อนรับหลังกด "เข้าสู่ระบบ" — แสดงระหว่างรอ Backend และโหลดข้อมูลหน้าแรก
 * ใช้กับ อสม. และ Admin ปิดเองเมื่อข้อมูลหน้าแรกมาถึง (หรือครบเวลาสูงสุด) */
import { h } from './ui.js';

const TIPS = [
  'ลดหวาน มัน เค็ม เพิ่มผักและผลไม้ ช่วยลดความเสี่ยงโรคเรื้อรัง',
  'วัดความดันขณะนั่งพักอย่างน้อย 5 นาที ค่าที่ได้จะแม่นยำกว่า',
  'ออกกำลังกายอย่างน้อย 150 นาทีต่อสัปดาห์ เดินเร็วก็นับ',
  'ผลคัดกรองเป็นการประเมินเบื้องต้น ไม่ใช่การวินิจฉัยโรค',
  'ข้อมูลสุขภาพของประชาชนเป็นความลับ ใช้เพื่อการดูแลเท่านั้น'
];
const STEPS = ['ตรวจสอบบัญชีผู้ใช้', 'เตรียมข้อมูลพื้นที่', 'เปิดหน้าหลัก'];
const MIN_MS = 1400, MAX_MS = 25000, SKIP_MS = 6000;
let cur = null;

export function welcome() {
  if (cur) cur.cancel(true);
  const t0 = Date.now();
  let pct = 4, target = 22, step = 1, waiting = false, finished = false, tipI = Math.floor(Math.random() * TIPS.length);
  const pctEl = h('i', {}), tip = h('p', { class: 'wl-tip' }, TIPS[tipI]);
  const title = h('h2', { class: 'wl-hi' }, 'กำลังเข้าสู่ระบบ'), sub = h('p', { class: 'wl-sub' }, 'NCD Care · โรงพยาบาลศรีสาคร');
  const lis = STEPS.map(s => h('li', {}, h('b', {}), h('span', {}, s)));
  const skip = h('button', { class: 'wl-skip', type: 'button', hidden: true, onclick: () => finish() }, 'เข้าหน้าหลักก่อน');
  const el = h('div', { class: 'welcome', role: 'status', 'aria-live': 'polite' },
    h('i', { class: 'wl-orb a' }), h('i', { class: 'wl-orb b' }),
    h('div', { class: 'wl-core' }, h('div', { class: 'wl-ring' }), h('div', { class: 'wl-logo' }, h('img', { src: 'assets/logo.png', alt: '', width: 96, height: 96 }))),
    title, sub, h('ul', { class: 'wl-steps' }, ...lis), h('div', { class: 'wl-bar' }, pctEl), tip, skip);
  document.body.appendChild(el);
  const mark = () => lis.forEach((li, i) => { li.className = i + 1 < step ? 'done' : i + 1 === step ? 'on' : ''; });
  mark();
  const tick = setInterval(() => { pct += (target - pct) * 0.07; pctEl.style.width = pct.toFixed(1) + '%'; }, 90);
  const rot = setInterval(() => { tipI = (tipI + 1) % TIPS.length; tip.classList.add('sw'); setTimeout(() => { tip.textContent = TIPS[tipI]; tip.classList.remove('sw'); }, 280); }, 3600);
  const showSkip = setTimeout(() => { skip.hidden = false; }, SKIP_MS), cap = setTimeout(() => finish(), MAX_MS);

  const onData = e => { if (e.detail && e.detail.key === 'areas') return; finish(); };
  function listen() { if (waiting) return; waiting = true; document.addEventListener('ncd:data', onData); document.addEventListener('ncd:data-error', onData); }
  function cleanup() { clearInterval(tick); clearInterval(rot); clearTimeout(showSkip); clearTimeout(cap); document.removeEventListener('ncd:data', onData); document.removeEventListener('ncd:data-error', onData); if (cur === api) cur = null; }
  function finish() {
    if (finished) return; finished = true;
    const wait = Math.max(0, MIN_MS - (Date.now() - t0));
    setTimeout(() => {
      step = 4; mark(); target = 100; pct = 100; pctEl.style.width = '100%'; cleanup();
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 650); }, 280);
    }, wait);
  }
  const api = {
    step(n) { step = n; target = n === 1 ? 22 : n === 2 ? 60 : 78; mark(); },
    user(name) { if (name) { title.textContent = 'สวัสดี ' + name; sub.textContent = 'กำลังเตรียมข้อมูลให้คุณ'; } },
    waitData() { step = 3; target = 90; mark(); listen(); },
    cancel(quick) { if (finished) return; finished = true; cleanup(); el.classList.add(quick ? 'gone' : 'out'); setTimeout(() => el.remove(), quick ? 0 : 450); }
  };
  cur = api; return api;
}
