/* งานติดตาม / การส่งต่อ ของ Admin — แยกโรค ความดัน (HT) กับ เบาหวาน (DM) · ทุกพื้นที่ในคำขอเดียว */
import { api } from '../api.js';
import { cached, invalidate } from '../store.js';
import { h, icon, fmt, countUp, skel, empty, errorBox } from '../ui.js';
import { REFERRAL_STATUS, isClosedFollow, isClosedRef, LEVELS, fromServer } from '../rules.js';
import { loadAreas, areaLabel } from '../shell.js';
import { openReferral } from './volunteer.js';

const DZ = { HT: { name: 'ความดันโลหิต', icon: 'pulse' }, DM: { name: 'เบาหวาน', icon: 'drop' } };
const loadCases = (onData, force) => cached('cases', () => api.cases(), { onData, force, ttl: 60 * 1000 });
const ST = { follow: { dz: 'ALL', area: '', f: 'open' }, ref: { dz: 'ALL', area: '', f: 'open' } };   // จำตัวกรองไว้ตอนวาดใหม่
const FU = [['late', 'เกินกำหนด', 'bad'], ['soon', 'ใกล้ครบกำหนด', 'warn'], ['wait', 'รอติดตาม', 'info']];
const fuKey = f => (isClosedFollow(f.FollowUp_Status) ? 'done' : f.Display_Status === 'เกินกำหนด' ? 'late' : f.Display_Status === 'ใกล้ครบกำหนด' ? 'soon' : 'wait');
const fuTone = { late: 'urg', soon: 'risk', wait: 'none', done: 'ok' };
const RF_FLOW = ['OPEN', 'REFERRED', 'ARRIVED', 'ASSESSED'];
const dzOf = r => (String(r.Disease).toUpperCase() === 'DM' ? 'DM' : 'HT');
const daysText = d => { const n = fmt.daysLeft(d); return 'ครบกำหนด ' + fmt.date(d) + (n == null ? '' : n >= 0 ? ` (อีก ${n} วัน)` : ` (เกิน ${-n} วัน)`); };

export function caseBoard({ kind, onOpenFollow }) {
  const S = ST[kind], isF = kind === 'follow';
  const root = h('div', { class: 'cb' }, skel(3));
  let data = null, areas = [], first = true;
  const atxt = id => areaLabel(areas, id);

  const items = () => ((isF ? data.followUps : data.referrals) || []).filter(r => !S.area || r.Area_ID === S.area);
  const isOpen = r => (isF ? !isClosedFollow(r.FollowUp_Status) : !isClosedRef(r.Referral_Status));
  const stat = dz => {
    const rows = items().filter(r => dzOf(r) === dz), open = rows.filter(isOpen);
    if (isF) { const c = { late: 0, soon: 0, wait: 0 }; open.forEach(f => { c[fuKey(f)]++; }); return { rows, open, c, closed: rows.length - open.length }; }
    const c = {}; open.forEach(r => { const k = String(r.Referral_Status).toUpperCase(); c[k] = (c[k] || 0) + 1; });
    return { rows, open, c, closed: rows.length - open.length };
  };

  function card(dz, s) {
    const segs = isF ? FU.map(([k, l]) => [l, s.c[k], k]) : RF_FLOW.map(k => [REFERRAL_STATUS[k][0], s.c[k] || 0, k]);
    const tot = segs.reduce((n, x) => n + x[1], 0) || 1, num = h('b', {}, '0');
    if (first) countUp(num, s.open.length, {}); else num.textContent = fmt.n(s.open.length);
    return h('button', { class: `dz-card ${dz.toLowerCase()}` + (S.dz === dz ? ' sel' : ''), type: 'button', 'aria-pressed': String(S.dz === dz), onclick: () => { S.dz = S.dz === dz ? 'ALL' : dz; draw(); } },
      h('div', { class: 'dz-top' }, h('span', { class: 'dz-ic' }, icon(DZ[dz].icon)), h('div', {}, h('small', {}, DZ[dz].name), h('em', {}, dz))),
      h('div', { class: 'dz-n' }, num, h('span', {}, isF ? ' งานที่ยังเปิดอยู่' : ' ที่ยังเปิดอยู่')),
      h('div', { class: 'dz-bar' }, segs.map(([l, v, k]) => h('i', { class: 'seg-' + k, title: `${l} ${v}`, style: { flex: String(v) } }))),
      h('div', { class: 'dz-chips' }, segs.filter(x => x[1]).map(([l, v]) => h('span', {}, `${l} ${v}`)), s.closed ? h('span', { class: 'dim' }, `ปิดแล้ว ${s.closed}`) : null));
  }

  function row(r) {
    const dz = dzOf(r);
    if (isF) {
      const k = fuKey(r);
      return h('button', { class: 'row-card rise', type: 'button', 'data-dz': dz, onclick: () => onOpenFollow(r) },
        h('div', { class: 'av ' + dz.toLowerCase() }, icon(DZ[dz].icon)),
        h('div', { class: 'grow' }, h('b', {}, r.Name || r.Person_ID), h('small', {}, `${LEVELS[fromServer(r.Initial_Status)].label} · ${r.Initial_Value || ''}`), h('small', {}, `${atxt(r.Area_ID)} · ${daysText(r.Due_Date)}`)),
        h('span', { class: 'pill p-' + fuTone[k] }, k === 'done' ? 'ดำเนินการแล้ว' : r.Display_Status || 'รอติดตาม'));
    }
    const [label, tone] = REFERRAL_STATUS[String(r.Referral_Status).toUpperCase()] || [r.Referral_Status, 'none'];
    return h('button', { class: 'row-card rise', type: 'button', 'data-dz': dz, onclick: () => openReferral(r, true, r.Area_ID, () => { invalidate('cases'); invalidate('ref'); invalidate('dash'); load(true); }) },
      h('div', { class: 'av ' + dz.toLowerCase() }, icon('send')),
      h('div', { class: 'grow' }, h('b', {}, r.Name || r.Person_ID), h('small', {}, r.Note || r.Destination || 'ส่งต่อ'), h('small', {}, `${atxt(r.Area_ID)} · ${fmt.date(r.Referral_Date)}`)),
      h('span', { class: 'pill p-' + tone }, label));
  }

  const pass = r => (isF ? (S.f === 'open' ? isOpen(r) : S.f === 'done' ? !isOpen(r) : isOpen(r) && fuKey(r) === S.f) : (S.f === 'open') === isOpen(r));
  const sortF = (a, b) => (isF ? ['late', 'soon', 'wait', 'done'].indexOf(fuKey(a)) - ['late', 'soon', 'wait', 'done'].indexOf(fuKey(b)) || new Date(a.Due_Date) - new Date(b.Due_Date) : new Date(b.Referral_Date) - new Date(a.Referral_Date));
  function column(dz) {
    const rows = items().filter(r => dzOf(r) === dz && pass(r)).sort(sortF);
    return h('section', { class: `cb-col ${dz.toLowerCase()}` },
      h('div', { class: 'cb-ch' }, icon(DZ[dz].icon), h('b', {}, DZ[dz].name), h('em', {}, fmt.n(rows.length))),
      rows.length ? h('div', { class: 'people-grid' }, rows.map(row)) : empty('ไม่มีรายการ', 'ไม่มีรายการในหมวดนี้', isF ? 'calendar' : 'send'));
  }

  function draw() {
    if (root.__dead || !data) return;
    const hs = stat('HT'), ds = stat('DM'), all = items(), pill = (txt, on, fn) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), onclick: fn }, txt);
    const stF = isF ? [['open', 'ที่เปิดอยู่', all.filter(isOpen).length], ['late', 'เกินกำหนด'], ['soon', 'ใกล้ครบกำหนด'], ['wait', 'รอติดตาม'], ['done', 'เสร็จสิ้น', all.filter(r => !isOpen(r)).length]] : [['open', 'ที่เปิดอยู่', all.filter(isOpen).length], ['closed', 'ปิดแล้ว', all.filter(r => !isOpen(r)).length]];
    const cnt = k => (k === 'late' || k === 'soon' || k === 'wait' ? all.filter(r => isOpen(r) && fuKey(r) === k).length : null);
    const sel = S.dz !== 'ALL';
    root.replaceChildren(
      h('div', { class: 'cb-cards' + (sel ? ' has-sel' : '') }, card('HT', hs), card('DM', ds)),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'พื้นที่' }, pill('ทุกพื้นที่', !S.area, () => { S.area = ''; draw(); }), ...areas.map(a => pill(areaLabel(areas, a.Area_ID), S.area === a.Area_ID, () => { S.area = a.Area_ID; draw(); }))),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'สถานะ' }, stF.map(([k, l, n]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.f === k), onclick: () => { S.f = (isF ? S.f === k && k !== 'open' ? 'open' : k : k === 'closed' ? 'closed' : 'open'); draw(); } }, l, h('em', {}, n ?? cnt(k))))),
      h('div', { class: 'cb-cols' + (sel ? ' one' : '') }, sel ? column(S.dz) : [column('HT'), column('DM')]));
    first = false;
  }
  const load = force => loadCases(d => { data = d; draw(); }, force).catch(e => root.replaceChildren(errorBox(e.message, () => { root.replaceChildren(skel(3)); load(true); })));
  loadAreas().then(a => { areas = a || []; load(false); }).catch(e => root.replaceChildren(errorBox(e.message)));
  return root;
}
