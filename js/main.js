/* จุดเริ่มต้นแอป: ตัวสลับหน้า (router) + โครงหน้า (เมนูข้าง/เมนูล่าง) + เอฟเฟกต์สลับหน้า */
import { CONFIG } from './config.js';
import { applyFx } from './fx.js';
applyFx();
import { session, isDemo, setAuthHandler } from './api.js';
import { clearAll } from './store.js';
import { h, $, icon, toast, reduceMotion, initial } from './ui.js';
import { go, user, openProfile, installApp, canInstall } from './shell.js';
import { loginView } from './views/login.js';
import { homeView, peopleView, followView, followWorkView, referralsView } from './views/volunteer.js';
import { screeningView } from './views/screening.js';
import { adminDashView, adminAreasView, adminAreaView, adminFollowView, adminRefView } from './views/admin.js';
import { adminReportView } from './views/reports.js';

const V = 'VOLUNTEER', A = 'ADMIN';
const NAV = {
  [V]: [['#/home', 'home', 'หน้าแรก'], ['#/people', 'users', 'รายชื่อ'], ['#/follow', 'calendar', 'ติดตาม'], ['#/referrals', 'send', 'ส่งต่อ']],
  [A]: [['#/admin', 'chart', 'ภาพรวม'], ['#/admin/areas', 'map', 'พื้นที่'], ['#/admin/follow', 'calendar', 'งานติดตาม'], ['#/admin/referrals', 'send', 'ส่งต่อ'], ['#/admin/reports', 'download', 'รายงาน']]
};
const ROUTES = [
  [/^#\/login$/, { view: loginView, shell: 'none', pub: 1, depth: 0 }],
  [/^#\/home$/, { view: homeView, role: V, nav: 0, title: 'หน้าแรก', hideTop: 1, depth: 0 }],
  [/^#\/people$/, { view: peopleView, role: V, nav: 1, title: 'รายชื่อประชาชน', depth: 1 }],
  [/^#\/follow$/, { view: followView, role: V, nav: 2, title: 'งานติดตาม', depth: 1 }],
  [/^#\/follow\/([^/?]+)$/, { view: followWorkView, role: V, nav: 2, title: 'บันทึกผลติดตาม', depth: 2, parent: '#/follow' }],
  [/^#\/referrals$/, { view: referralsView, role: V, nav: 3, title: 'การส่งต่อ', depth: 1 }],
  [/^#\/screen\/([^/?]+)$/, { view: screeningView, role: V, nav: 1, focus: 1, depth: 3, parent: '#/people' }],
  [/^#\/admin$/, { view: adminDashView, role: A, nav: 0, title: 'ภาพรวม', depth: 0 }],
  [/^#\/admin\/areas$/, { view: adminAreasView, role: A, nav: 1, title: 'พื้นที่', depth: 1 }],
  [/^#\/admin\/area\/([^/?]+)$/, { view: adminAreaView, role: A, nav: 1, title: 'รายละเอียดพื้นที่', depth: 2, parent: '#/admin/areas' }],
  [/^#\/admin\/follow$/, { view: adminFollowView, role: A, nav: 2, title: 'งานติดตาม', depth: 1 }],
  [/^#\/admin\/referrals$/, { view: adminRefView, role: A, nav: 3, title: 'การส่งต่อ', depth: 1 }],
  [/^#\/admin\/reports$/, { view: adminReportView, role: A, nav: 4, title: 'รายงาน', depth: 1 }]
];
const homeOf = role => (role === A ? '#/admin' : '#/home');
const roleOf = () => session.get()?.user?.role === A ? A : session.get()?.user?.role === V ? V : null;

let shellKey = '', prev = null, seq = 0;

function buildShell(role) {
  const items = NAV[role];
  const link = (cls) => items.map(([href, ic, label], i) => h('a', { href, 'data-nav': i, class: cls }, icon(ic), h('span', {}, label)));
  const u = user();
  const side = h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('img', { src: 'assets/logo.png', alt: '' }), h('div', {}, h('b', {}, 'NCD Care'), h('small', {}, CONFIG.HOSPITAL))),
    link(''), h('div', { class: 'spacer' }),
    h('div', { class: 'me' }, h('div', { class: 'av2' }, initial(u?.displayName)), h('div', {}, h('b', {}, u?.displayName || ''), h('small', {}, role === A ? 'เจ้าหน้าที่ รพ.' : 'อสม. ' + (u?.areaId || ''))),
      h('button', { 'aria-label': 'บัญชีผู้ใช้', onclick: openProfile }, icon('user'))),
    h('div', { class: 'sidenote' }, 'เวอร์ชัน ' + CONFIG.VERSION + (isDemo() ? ' · โหมดสาธิต' : '')));
  const top = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', id: 'backBtn', 'aria-label': 'ย้อนกลับ', hidden: true }, icon('back')),
    h('img', { class: 'only-mobile', id: 'topLogo', src: 'assets/logo.png', alt: '', width: 34, height: 34, style: { borderRadius: '50%' } }),
    h('h1', { id: 'topTitle' }, 'NCD Care'),
    h('button', { class: 'avatar', 'aria-label': 'บัญชีผู้ใช้', onclick: openProfile }, initial(u?.displayName)));
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'เมนูหลัก', style: { '--cols': items.length } }, link(''));
  const app = h('div', { class: 'app has-side', 'data-role': role }, side, h('div', { class: 'main' }, top, h('main', { id: 'view', tabindex: '-1' })), nav);
  app.append();
  return app;
}

function ensureShell(kind, role) {
  const key = kind === 'none' ? 'none' : role;
  if (shellKey === key) return false;
  shellKey = key;
  const app = $('#app');
  app.replaceChildren(kind === 'none' ? h('main', { id: 'view' }) : buildShell(role));
  return true;
}

function decorate(route, role) {
  const app = $('.app');
  if (!app) return;
  app.dataset.hidetop = route.hideTop ? '1' : '0';
  app.dataset.hidenav = route.focus ? '1' : '0';
  app.dataset.focus = route.focus ? '1' : '0';
  const idx = route.nav ?? 0;
  const nav = $('.bottom-nav'); nav?.style.setProperty('--idx', idx);
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (Number(a.dataset.nav) === idx) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#topTitle').textContent = route.title || 'NCD Care';
  const back = $('#backBtn'); back.hidden = !route.parent;
  back.onclick = () => (route.parent ? go(route.parent) : null);
  $('#topLogo').hidden = !!route.parent;
  document.title = (route.title ? route.title + ' · ' : '') + 'NCD Care';
}

function swap(node, dir, animate) {
  const view = $('#view');
  const old = view.firstElementChild; if (old) old.__dead = true;
  view.replaceChildren(node); window.scrollTo(0, 0);
  document.documentElement.dataset.dir = dir;
  // เอฟเฟกต์สลับหน้าแบบเบา (ใช้เฉพาะ transform/opacity) — ไม่ใช้ View Transitions เพราะกระตุก/กระพริบบนมือถือ
  if (animate && !reduceMotion()) {
    node.classList.add('view-enter', dir === 'back' ? 'back' : dir === 'fade' ? 'fade' : 'fwd');
    node.addEventListener('animationend', e => { if (e.target === node) node.classList.remove('view-enter', 'back', 'fade', 'fwd'); });
  }
}

async function render() {
  const my = ++seq;
  const hash = location.hash || '';
  const [path, qs] = hash.split('?');
  const role = roleOf();
  if (!path) return go(role ? homeOf(role) : '#/login');
  let found = null, params = [];
  for (const [re, r] of ROUTES) { const m = path.match(re); if (m) { found = r; params = m.slice(1); break; } }
  if (!found) return go(role ? homeOf(role) : '#/login');
  if (!role && !found.pub) return go('#/login');
  if (role && found.pub) return go(homeOf(role));
  if (found.role && found.role !== role) return go(homeOf(role));

  const rebuilt = ensureShell(found.shell || 'app', role);
  if (found.shell !== 'none') decorate(found, role);
  const ctx = { params, query: new URLSearchParams(qs || '') };
  const node = found.view(ctx);
  if (my !== seq) return;
  const dir = !prev || rebuilt ? 'fwd' : found.depth > prev.depth ? 'fwd' : found.depth < prev.depth ? 'back' : 'fade';
  swap(node, dir, !!prev || rebuilt);
  prev = found;
  const boot = $('#boot'); if (boot && !boot.classList.contains('done')) { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); }
}

setAuthHandler(() => { toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error'); clearAll(); prev = null; go('#/login'); });
window.addEventListener('hashchange', render);

/* สถานะออฟไลน์ */
function netBar() {
  let bar = $('.offline-bar');
  if (navigator.onLine === false && !bar) $('#layer').append(h('div', { class: 'offline-bar', role: 'status' }, icon('offline'), 'ไม่มีสัญญาณอินเทอร์เน็ต ข้อมูลที่เห็นอาจไม่เป็นปัจจุบัน'));
  if (navigator.onLine !== false && bar) bar.remove();
}
window.addEventListener('online', () => { netBar(); toast('กลับมาออนไลน์แล้ว', 'ok'); });
window.addEventListener('offline', netBar);
netBar();

render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !isDemo()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
