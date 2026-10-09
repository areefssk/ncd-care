/* หน้าของเจ้าหน้าที่ รพ.: ภาพรวม, พื้นที่, รายละเอียดพื้นที่, งานติดตาม, ส่งต่อ */
import { api } from '../api.js';
import { cached, invalidate } from '../store.js';
import { h, icon, fmt, countUp, skel, empty, errorBox, openSheet, ring, levelPill } from '../ui.js';
import { LEVELS, fromServer } from '../rules.js';
import { CONFIG } from '../config.js';
import { go, loadAreas, areaName, areaLabel, setBadge } from '../shell.js';
import { followPanel, referralPanel } from './volunteer.js';
import { areaMap } from '../areamap.js';

const mapOf = (d, areas, title, sub) => areaMap({ areas: d.areas, labelOf: id => areaLabel(areas, id), title, sub });
const loadDash = (onData, force = false) => cached('dash', () => api.dashboardSummary(), { onData, force, ttl: 60000 });
const FISCAL = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8], MONTHS = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];
const grow = el => requestAnimationFrame(() => requestAnimationFrame(() => el.querySelectorAll('[data-w]').forEach(x => (x.style.width = x.dataset.w))));
const head = (title, sub, ...extra) => h('div', { class: 'ph' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', {}, extra));

/* ---------- ภาพรวม ---------- */
export function adminDashView() {
  const root = h('div', { class: 'adm-page' }, skel(2, 'tall'), skel(3, 'tall'));
  let data = null, areas = null, drawn = false;
  const draw = () => {
    if (root.__dead || !data) return;
    const first = !drawn; drawn = true; root.classList.toggle('no-anim', !first);
    root.replaceChildren(...build(data, areas, first, () => { drawn = true; load(true); }).filter(Boolean));
    grow(root); setBadge(3, data.referral?.open || 0);
  };
  const load = force => {
    loadDash(d => { data = d; draw(); }, force).catch(e => { if (!drawn) root.replaceChildren(errorBox(e.message, () => { root.replaceChildren(skel(2, 'tall')); load(true); })); });
  };
  load(false); loadAreas().then(a => { areas = a; draw(); }).catch(() => {});
  return root;
}
function build(d, areas, first, refresh) {
  const P = d.population || {};
  const kpi = (label, val, small, cls = '', ic = 'users', href) => {
    const b = h('b', {}, first ? '0' : fmt.n(val)); if (first) countUp(b, val, { decimals: String(val).includes('.') ? 1 : 0 });
    return h(href ? 'a' : 'div', { class: 'kpi rise ' + cls, href, style: { textDecoration: 'none', color: cls ? '#fff' : 'inherit' } }, h('span', {}, icon(ic), label), b, h('small', {}, small));
  };
  const cov = h('b', {}, first ? '0%' : (P.coverage || 0) + '%'); if (first) countUp(cov, P.coverage || 0, { decimals: 1, suffix: '%' });
  const covKpi = h('div', { class: 'kpi hl rise' }, h('span', {}, icon('chart'), 'ความครอบคลุม'), cov, h('small', {}, 'คัดกรองแล้วเทียบกับเป้าหมาย'));

  const areaRows = (d.areas || []).map(a => h('a', { class: 'area-row', href: '#/admin/area/' + encodeURIComponent(a.areaId) },
    h('code', {}, a.areaId), h('div', { class: 'bar', role: 'img', 'aria-label': `${a.areaId} ${a.coverage}%` }, h('i', { 'data-w': a.coverage + '%' })), h('span', { class: 'v' }, `${fmt.n(a.screened)}/${fmt.n(a.target)} · ${a.coverage}%`)));

  const mix = (title, parts) => {
    const tot = parts.reduce((n, x) => n + x[1], 0) || 1;
    return h('div', {}, h('div', { class: 'lbl' }, h('b', {}, title), h('span', { class: 'muted small' }, fmt.n(parts.reduce((n, x) => n + x[1], 0)) + ' คน')),
      h('div', { class: 'seg-bar' }, parts.map(x => h('i', { 'data-w': (x[1] / tot * 100) + '%', style: { background: x[2] }, title: `${x[0]} ${x[1]}` }))),
      h('div', { class: 'legend' }, parts.map(x => h('em', { style: { '--c': x[2] } }, `${x[0]} ${fmt.n(x[1])} (${fmt.pct(x[1], tot)}%)`))));
  };
  const ht = d.ht || {}, dm = d.dm || {};

  return [
    head('ภาพรวมการคัดกรอง', `ปี ${d.year} · ${CONFIG.HOSPITAL}`, h('button', { class: 'btn small', onclick: refresh }, icon('refresh'), d.cache?.hit ? 'ข้อมูลจากแคช · โหลดใหม่' : 'โหลดข้อมูลใหม่')),
    h('div', { class: 'kpis' }, kpi('เป้าหมาย', P.target || 0, 'คนใน ' + (d.areas || []).length + ' พื้นที่', '', 'users'), kpi('คัดกรองแล้ว', P.screened || 0, 'คน', '', 'check'), kpi('ยังไม่คัดกรอง', P.unscreened || 0, 'คน', '', 'clock'), covKpi,
      kpi('งานติดตามค้าง', d.followUp?.open || 0, 'ทุกพื้นที่', '', 'calendar', '#/admin/follow'), kpi('ส่งต่อที่เปิดอยู่', d.referral?.open || 0, 'ทุกพื้นที่', '', 'send', '#/admin/referrals')),
    mapOf(d, areas) || h('section', { class: 'panel rise', style: { '--i': 1 } }, h('h3', {}, 'ความครอบคลุมรายพื้นที่'), h('p', { class: 'sub' }, 'คัดกรองแล้วเทียบกับเป้าหมาย กดดูรายละเอียดแต่ละหมู่'), areaRows.length ? areaRows : empty('ยังไม่มีข้อมูลพื้นที่')),
    h('div', { class: 'grid2' },
      h('section', { class: 'panel rise', style: { '--i': 2 } }, h('h3', {}, 'ผลคัดกรอง HT และ DM'), h('p', { class: 'sub' }, 'สัดส่วนจากผู้ที่คัดกรองแล้ว'),
        h('div', { class: 'mix' }, mix('ความดันโลหิต (HT)', [['ปกติ', ht.normal || 0, 'var(--ok)'], ['เสี่ยง', ht.risk || 0, 'var(--risk)'], ['สงสัย', ht.suspected || 0, 'var(--sus)'], ['เร่งด่วน', ht.urgent || 0, 'var(--urg)']]), mix('เบาหวาน (DM)', [['ปกติ', dm.normal || 0, 'var(--ok)'], ['เสี่ยง', dm.risk || 0, 'var(--risk)'], ['สงสัย', dm.suspected || 0, 'var(--sus)']]))),
      h('section', { class: 'panel rise', style: { '--i': 4 } }, h('h3', {}, 'ศูนย์จัดการงาน'), h('p', { class: 'sub' }, 'รายการที่ต้องดำเนินการ'),
        h('div', { class: 'need' },
          h('a', { class: 'row-card', href: '#/admin/follow' }, h('div', { class: 'av ht' }, icon('calendar')), h('div', { class: 'grow' }, h('b', {}, 'งานติดตามที่ค้าง'), h('small', {}, 'ตรวจรายการเกินกำหนดและใกล้ครบกำหนด')), h('span', { class: 'pill p-sus' }, fmt.n(d.followUp?.open || 0))),
          h('a', { class: 'row-card', href: '#/admin/referrals' }, h('div', { class: 'av ht' }, icon('send')), h('div', { class: 'grow' }, h('b', {}, 'การส่งต่อที่เปิดอยู่'), h('small', {}, 'อัปเดตสถานะและบันทึกผลประเมิน')), h('span', { class: 'pill ' + (d.referral?.open ? 'p-urg' : 'p-ok') }, fmt.n(d.referral?.open || 0))),
          h('a', { class: 'row-card', href: '#/admin/areas' }, h('div', { class: 'av' }, icon('map')), h('div', { class: 'grow' }, h('b', {}, 'ดูรายพื้นที่'), h('small', {}, 'เปรียบเทียบความคืบหน้าแต่ละหมู่')), icon('chevron'))))),
    h('section', { class: 'panel rise', style: { '--i': 3 } }, h('h3', {}, 'จำนวนผู้คัดกรองรายเดือน'), h('p', { class: 'sub' }, 'เรียงตามปีงบประมาณ ตุลาคมถึงกันยายน'), monthly(d.monthly || []))
  ];
}
function monthly(calendar) {
  const vals = FISCAL.map(i => Number(calendar[i]) || 0), top = Math.max(10, ...vals), max = Math.ceil(top / 20) * 20 || 20;
  const W = 560, H = 230, L = 36, B = 28, T = 16, ch = H - B - T, bw = (W - L - 6) / 12;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'chart'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'กราฟแท่งจำนวนผู้คัดกรองรายเดือนตามปีงบประมาณ');
  let g = '<defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ccb90"/><stop offset="1" stop-color="#065f46"/></linearGradient></defs>';
  [0, 1, 2, 3, 4].forEach(k => { const v = max * k / 4, y = T + ch - ch * k / 4; g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="#d8e8df" stroke-width="1"/><text x="${L - 7}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`; });
  vals.forEach((v, i) => {
    const hh = ch * v / max, x = L + i * bw + bw * .16, w = bw * .68, y = T + ch - hh;
    if (v > 0) g += `<rect class="b" style="--i:${i}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="url(#mg)"/><text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" style="fill:#10302a;font-weight:600">${v}</text>`;
    g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${MONTHS[i]}</text>`;
  });
  svg.innerHTML = g; // ข้อความคงที่และตัวเลขที่คำนวณเอง ไม่มีข้อมูลจากผู้ใช้
  return svg;
}

/* ---------- พื้นที่ ---------- */
export function adminAreasView() {
  const root = h('div', { class: 'adm-page' }, skel(3, 'tall'));
  let d = null, areas = null, drawn = false;
  const draw = () => {
    if (root.__dead || !d) return; const first = !drawn; drawn = true; root.classList.toggle('no-anim', !first);
    root.replaceChildren(head('พื้นที่รับผิดชอบ', `${(d.areas || []).length} หมู่บ้าน · เรียงตามรหัสพื้นที่`),
      mapOf(d, areas, 'แผนที่หมู่บ้าน', 'กดที่หมู่เพื่อดูสรุป · ข้อมูลรายหมู่อยู่ด้านล่าง'),
      h('div', { class: 'area-grid' }, (d.areas || []).map((a, i) => h('a', { class: 'area-card rise', style: { '--i': i }, href: '#/admin/area/' + encodeURIComponent(a.areaId) },
        h('div', { class: 'top' }, h('div', {}, h('b', {}, areaLabel(areas, a.areaId)), h('small', { class: 'muted', style: { display: 'block' } }, a.areaId)), h('span', { class: 'pct' }, a.coverage + '%')),
        h('div', { class: 'bar' }, h('i', { 'data-w': a.coverage + '%' })),
        h('div', { class: 'small muted', style: { display: 'flex', justifyContent: 'space-between' } }, h('span', {}, `คัดกรองแล้ว ${fmt.n(a.screened)} คน`), h('span', {}, `เป้าหมาย ${fmt.n(a.target)}`))))));
    grow(root);
  };
  loadDash(x => { d = x; draw(); }).catch(e => root.replaceChildren(errorBox(e.message)));
  loadAreas().then(a => { areas = a; draw(); }).catch(() => {});
  return root;
}
export function adminAreaView(ctx) {
  const id = decodeURIComponent(ctx.params[0]);
  const root = h('div', { class: 'adm-page' }, skel(2, 'tall'));
  let d = null, areas = null, drawn = false;
  const draw = () => {
    if (root.__dead || !d || drawn) return; drawn = true;
    const a = (d.areas || []).find(x => x.areaId === id);
    if (!a) return root.replaceChildren(empty('ไม่พบพื้นที่', id, 'map'));
    root.replaceChildren(
      head(areaLabel(areas, id), 'รหัสพื้นที่ ' + id),
      h('div', { class: 'grid2' },
        h('section', { class: 'panel rise' }, h('div', { class: 'prog' }, ring(a.coverage), h('div', {}, h('h3', {}, 'ความคืบหน้า'), h('p', { class: 'big', style: { fontSize: '26px' } }, fmt.n(a.screened) + ' / ' + fmt.n(a.target)), h('p', { class: 'muted small' }, `ยังไม่คัดกรอง ${fmt.n(a.unscreened)} คน`)))),
        h('section', { class: 'panel rise', style: { '--i': 1 } }, h('h3', {}, 'การส่งต่อของพื้นที่นี้'), h('p', { class: 'sub' }, 'กดรายการเพื่ออัปเดตสถานะ'), referralPanel({ areaId: id, canEdit: true }))),
      h('section', { class: 'panel rise', style: { '--i': 2 } }, h('h3', {}, 'งานติดตามของพื้นที่นี้'), h('p', { class: 'sub' }, 'เรียงตามความเร่งด่วน'), followPanel({ areaId: id, onOpen: followDetail })));
  };
  loadDash(x => { d = x; draw(); }).catch(e => root.replaceChildren(errorBox(e.message)));
  loadAreas().then(a => { areas = a; if (drawn) return; draw(); }).catch(() => {});
  return root;
}
function followDetail(f) {
  const sh = openSheet({
    title: f.Name || f.Person_ID,
    body: h('dl', { class: 'kv' }, h('dt', {}, 'HN'), h('dd', {}, f.HN || '—'), h('dt', {}, 'โรค'), h('dd', {}, f.Disease), h('dt', {}, 'ผลตอนคัดกรอง'), h('dd', {}, `${LEVELS[fromServer(f.Initial_Status)].label} · ${f.Initial_Value || ''}`),
      h('dt', {}, 'ครั้งที่'), h('dd', {}, f.FollowUp_Round || 1), h('dt', {}, 'เปิดงาน'), h('dd', {}, fmt.date(f.Open_Date)), h('dt', {}, 'กำหนดติดตาม'), h('dd', {}, fmt.date(f.Due_Date)), h('dt', {}, 'สถานะ'), h('dd', {}, f.Display_Status || f.FollowUp_Status)),
    actions: [h('button', { class: 'btn', onclick: () => sh.close() }, 'ปิด')]
  });
}

/* ---------- งานติดตาม / ส่งต่อ (เลือกพื้นที่ก่อน) ---------- */
function withAreaPicker(build, titleText, sub) {
  const root = h('div', { class: 'adm-page' }, head(titleText, sub), skel(1));
  let areas = null, cur = null, holder = h('div', { class: 'panel' });
  const draw = () => {
    if (root.__dead || !areas) return;
    cur = cur || areas[0]?.Area_ID;
    const picker = h('div', { class: 'chips', role: 'group', 'aria-label': 'เลือกพื้นที่' }, areas.map(a => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(a.Area_ID === cur), onclick: () => { cur = a.Area_ID; draw(); } }, areaName(a))));
    holder = h('div', { class: 'panel' }, build(cur));
    root.replaceChildren(head(titleText, sub), picker, holder);
  };
  loadAreas().then(a => { areas = a; draw(); }).catch(e => root.replaceChildren(errorBox(e.message)));
  return root;
}
export const adminFollowView = () => withAreaPicker(id => followPanel({ areaId: id, onOpen: followDetail }), 'งานติดตาม', 'เลือกพื้นที่เพื่อดูงานติดตามของ อสม. ในหมู่นั้น');
export const adminRefView = () => withAreaPicker(id => referralPanel({ areaId: id, canEdit: true }), 'การส่งต่อ', 'อัปเดตสถานะการส่งต่อและบันทึกผลการประเมิน');
