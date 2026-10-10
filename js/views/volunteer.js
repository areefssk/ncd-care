/* หน้าของ อสม.: หน้าแรก, รายชื่อ, งานติดตาม, ส่งต่อ (ฟังก์ชัน panel ใช้ซ้ำในหน้าแอดมิน) */
import { api, homeOnce } from '../api.js';
import { cached, invalidate } from '../store.js';
import { h, icon, fmt, greeting, countUp, skel, empty, errorBox, initial, openSheet, toast, debounce, ring, seg, levelPill } from '../ui.js';
import { LEVELS, MSG, fromServer, classifyHT, classifyDM, REFERRAL_STATUS, REFERRAL_NEXT, isClosedFollow, isClosedRef } from '../rules.js';
import { go, openProfile, loadAreas, areaLabel, setBadge, canInstall, installApp, user } from '../shell.js';

/* ---------- ตัวโหลดข้อมูล (แคช + โหลดใหม่เบื้องหลัง) ---------- */
export const loadPeople = (onData, o = {}) => cached('people', () => homeOnce().then(d => d.people), { onData, ...o });
export const loadFollows = (onData, areaId = '', o = {}) => cached('follow:' + areaId, () => (areaId ? api.followUps({ areaId }) : homeOnce().then(d => d.followUps)), { onData, ...o });
export const loadRefs = (onData, areaId = '', o = {}) => cached('ref:' + areaId, () => (areaId ? api.referrals({ areaId }) : homeOnce().then(d => d.referrals)), { onData, ...o });
const openFollows = d => (d?.followUps || []).filter(f => !isClosedFollow(f.FollowUp_Status));
const openRefs = d => (d?.referrals || []).filter(r => !isClosedRef(r.Referral_Status));

const FU_TONE = { 'เกินกำหนด': 'urg', 'ใกล้ครบกำหนด': 'risk', 'รอติดตาม': 'none', 'ดำเนินการแล้ว': 'ok' };
const FU_ORDER = { 'เกินกำหนด': 0, 'ใกล้ครบกำหนด': 1, 'รอติดตาม': 2, 'ดำเนินการแล้ว': 3 };
const statusPill = (text, tone) => h('span', { class: 'pill p-' + tone }, text);
const dueText = f => { const d = fmt.daysLeft(f.Due_Date); return 'ครบกำหนด ' + fmt.date(f.Due_Date) + (d == null ? '' : d >= 0 ? ` (อีก ${d} วัน)` : ` (เกิน ${-d} วัน)`); };

function personRow(p, status, onClick) {
  const pill = status === 'todo' ? statusPill('ยังไม่คัดกรอง', 'none') : status === 'follow' ? statusPill('รอติดตาม', 'sus') : statusPill('คัดกรองแล้ว', 'ok');
  return h('button', { class: 'row-card rise', type: 'button', onclick: onClick },
    h('div', { class: 'av' }, initial(p['ชื่อ–นามสกุล'])),
    h('div', { class: 'grow' }, h('b', {}, p['ชื่อ–นามสกุล'] || '—'), h('small', {}, `อายุ ${p['อายุ'] || '—'} · HN ${p.HN || '—'}`)), pill);
}
function followRow(f, onClick) {
  const tone = FU_TONE[f.Display_Status] || 'none';
  return h('button', { class: 'row-card rise', type: 'button', onclick: onClick },
    h('div', { class: 'av ' + (f.Disease === 'HT' ? 'ht' : 'dm') }, icon(f.Disease === 'HT' ? 'pulse' : 'drop')),
    h('div', { class: 'grow' }, h('b', {}, f.Name || f.Person_ID), h('small', {}, `${f.Disease} · ${LEVELS[fromServer(f.Initial_Status)].label} · ${f.Initial_Value || ''}`), h('small', {}, dueText(f))),
    statusPill(f.Display_Status || 'รอติดตาม', tone));
}
const failBox = (root, e, retry) => root.replaceChildren(h('div', { class: 'page' }, errorBox(e.message, retry)));

/* ================= หน้าแรก ================= */
export function homeView() {
  const root = h('div', { class: 'home' }, h('div', { class: 'skel hero-s' }), h('div', { class: 'page overlap' }, skel(3, 'tall')));
  const st = {}; let drawn = false, failed = false;
  const draw = () => {
    if (root.__dead || !st.people) return;
    const first = !drawn; drawn = true; root.classList.toggle('no-anim', !first);
    root.replaceChildren(...build(st, first).filter(Boolean));
    const od = openFollows(st.follows).filter(f => f.Display_Status === 'เกินกำหนด').length; setBadge(2, od);
  };
  const start = () => {
    failed = false;
    loadPeople(d => { st.people = d; draw(); }).catch(e => { if (!drawn) failBox(root, e, () => { root.replaceChildren(h('div', { class: 'skel hero-s' })); start(); }); });
    loadFollows(d => { st.follows = d; draw(); }).catch(() => {});
    loadRefs(d => { st.refs = d; draw(); }).catch(() => {});
    loadAreas().then(a => { st.areas = a; draw(); }).catch(() => {});
  };
  start();
  return root;
}
function build(st, first) {
  const u = user(), people = st.people.people || [], total = st.people.total || people.length, screened = st.people.screenedCount || 0;
  const todo = people.filter(p => p.Screening_Status === 'ยังไม่คัดกรอง'), unscreened = Math.max(0, total - screened);
  const fu = openFollows(st.follows).sort((a, b) => (FU_ORDER[a.Display_Status] ?? 9) - (FU_ORDER[b.Display_Status] ?? 9) || new Date(a.Due_Date) - new Date(b.Due_Date));
  const overdue = fu.filter(f => f.Display_Status === 'เกินกำหนด').length, refOpen = openRefs(st.refs).length;
  const pct = fmt.pct(screened, total);
  const nDone = h('span', { class: 'big' }, first ? '0' : fmt.n(screened)); if (first) countUp(nDone, screened);
  const nextOne = () => { const p = todo[0]; if (!p) return toast('คัดกรองครบทุกคนในพื้นที่แล้ว', 'ok'); go('#/screen/' + encodeURIComponent(p.Person_ID)); };
  const tile = (n, label, cls, href) => h('a', { class: 'tile rise ' + cls, href }, h('b', {}, fmt.n(n)), h('span', {}, label));

  const hero = h('section', { class: 'hero' }, h('div', { class: 'row' },
    h('div', {}, h('small', {}, greeting()), h('b', {}, u?.displayName || 'อสม.'), h('small', {}, areaLabel(st.areas, u?.areaId))),
    h('img', { class: 'logo-chip', src: 'assets/logo.png', alt: '', width: 52, height: 52 })));

  const colA = h('div', { class: 'col' },
    h('div', { class: 'card rise' }, h('div', { class: 'prog' }, ring(pct, { animate: first }),
      h('div', {}, h('h2', { style: { fontSize: '16px' } }, 'ความคืบหน้าปี ' + (st.people.screeningYear || '')), h('p', { class: 'muted' }, nDone, ' จาก ', fmt.n(total), ' คน'), h('p', { class: 'small muted' }, 'คัดกรองแล้ว ' + pct + '%')))),
    h('div', { class: 'tiles' }, tile(unscreened, 'ยังไม่คัดกรอง', '', '#/people?f=todo'), tile(fu.length, overdue ? `งานติดตาม (เกิน ${overdue})` : 'งานติดตาม', overdue ? 'warn' : '', '#/follow'), tile(refOpen, 'ส่งต่อที่เปิดอยู่', refOpen ? 'alert' : 'ok', '#/referrals')),
    h('button', { class: 'cta rise', type: 'button', onclick: nextOne }, icon('plus'), 'เริ่มคัดกรองคนถัดไป'),
    canInstall() ? h('div', { class: 'card flat rise row-card', style: { cursor: 'default' } }, h('img', { src: 'assets/logo.png', alt: '', width: 44, height: 44, style: { borderRadius: '50%' } }), h('div', { class: 'grow' }, h('b', {}, 'ติดตั้งแอปลงเครื่อง'), h('small', {}, 'เปิดได้เร็ว ใช้เต็มจอเหมือนแอปทั่วไป')), h('button', { class: 'btn small', onclick: installApp }, 'ติดตั้ง')) : null);

  const colB = h('div', { class: 'col' },
    h('div', { class: 'sec' }, h('h2', {}, 'คนถัดไปในหมู่ของคุณ'), h('a', { href: '#/people?f=todo' }, 'ดูทั้งหมด')),
    todo.length ? h('div', { class: 'list' }, todo.slice(0, 4).map(p => personRow(p, 'todo', () => go('#/screen/' + encodeURIComponent(p.Person_ID))))) : empty('คัดกรองครบแล้ว', 'ทุกคนในพื้นที่ของคุณมีผลคัดกรองปีนี้แล้ว'),
    h('div', { class: 'sec' }, h('h2', {}, 'งานติดตามที่ต้องทำ'), h('a', { href: '#/follow' }, 'ดูทั้งหมด')),
    fu.length ? h('div', { class: 'list' }, fu.slice(0, 3).map(f => followRow(f, () => go('#/follow/' + encodeURIComponent(f.FollowUp_ID))))) : empty('ไม่มีงานค้าง', 'ยังไม่มีงานติดตามที่ต้องดำเนินการ', 'calendar'));

  return [hero, h('div', { class: 'page overlap' }, h('div', { class: 'home-grid' }, colA, colB))];
}

/* ================= รายชื่อ ================= */
export function peopleView(ctx) {
  const filter0 = ctx.query.get('f') || 'all';
  const root = h('div', { class: 'page' }, skel(6));
  const st = { f: filter0, q: '', shown: 40 };
  let data = null, follows = null;
  const statusOf = p => (p.Screening_Status === 'ยังไม่คัดกรอง' ? 'todo' : (follows && follows.has(p.Person_ID)) ? 'follow' : 'done');
  const build2 = () => {
    if (root.__dead || !data) return;
    const people = data.people || [];
    const counts = { all: people.length, todo: 0, done: 0, follow: 0 };
    people.forEach(p => { counts[statusOf(p)]++; });
    counts.done += counts.follow;
    const match = p => {
      const s = statusOf(p);
      if (st.f === 'todo' && s !== 'todo') return false;
      if (st.f === 'done' && s === 'todo') return false;
      if (st.f === 'follow' && s !== 'follow') return false;
      const q = st.q.trim().toLowerCase();
      return !q || (p['ชื่อ–นามสกุล'] || '').toLowerCase().includes(q) || String(p.HN || '').includes(q);
    };
    const list = h('div', { class: 'people-grid' });
    const rows = people.filter(match);
    const renderRows = () => {
      list.replaceChildren(...rows.slice(0, st.shown).map(p => personRow(p, statusOf(p), () => openPerson(p, statusOf(p)))));
      if (!rows.length) list.replaceChildren(empty('ไม่พบรายชื่อ', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง', 'search'));
      if (rows.length > st.shown) list.append(h('button', { class: 'btn', style: { gridColumn: '1/-1' }, onclick: () => { st.shown += 40; renderRows(); } }, `แสดงเพิ่ม (เหลือ ${rows.length - st.shown} คน)`));
    };
    const input = h('input', { type: 'search', id: 'q', placeholder: 'ค้นหาชื่อหรือ HN', value: st.q, autocomplete: 'off', 'aria-label': 'ค้นหาชื่อหรือ HN', oninput: debounce(e => { st.q = e.target.value; st.shown = 40; build2.keepFocus = true; redraw(); }, 160) });
    const chip = (key, label) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st.f === key), onclick: () => { st.f = key; st.shown = 40; redraw(); } }, label, h('em', {}, fmt.n(counts[key])));
    const redraw = () => { root.classList.add('no-anim'); build2(); const q = root.querySelector('#q'); if (build2.keepFocus && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); build2.keepFocus = false; } };
    root.replaceChildren(
      h('div', { class: 'sticky-tools' }, h('label', { class: 'search' }, icon('search'), input), h('div', { class: 'chips', role: 'group', 'aria-label': 'กรองรายชื่อ' }, chip('all', 'ทั้งหมด'), chip('todo', 'ยังไม่คัดกรอง'), chip('done', 'คัดกรองแล้ว'), chip('follow', 'รอติดตาม'))),
      list);
    renderRows();
  };
  loadPeople(d => { data = d; build2(); }).catch(e => failBox(root, e, () => go('#/people')));
  loadFollows(d => { follows = new Set(openFollows(d).map(f => f.Person_ID)); build2(); }).catch(() => {});
  return root;
}
function openPerson(p, status) {
  const sheet = openSheet({
    title: p['ชื่อ–นามสกุล'],
    body: h('div', { class: 'sheet-body' }, h('dl', { class: 'kv' }, h('dt', {}, 'HN'), h('dd', {}, p.HN || '—'), h('dt', {}, 'อายุ'), h('dd', {}, (p['อายุ'] || '—') + ' ปี'), h('dt', {}, 'เพศ'), h('dd', {}, p['เพศ'] || '—'), h('dt', {}, 'สถานะปีนี้'), h('dd', {}, status === 'todo' ? 'ยังไม่คัดกรอง' : status === 'follow' ? 'รอติดตาม' : 'คัดกรองแล้ว'))),
    actions: [
      status === 'todo' ? h('button', { class: 'cta', onclick: () => { sheet.close(); go('#/screen/' + encodeURIComponent(p.Person_ID)); } }, icon('plus'), 'เริ่มคัดกรอง') : null,
      status === 'follow' ? h('button', { class: 'cta', onclick: () => { sheet.close(); go('#/follow'); } }, icon('calendar'), 'ไปที่งานติดตาม') : null,
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'ปิด')]
  });
}

/* ================= งานติดตาม ================= */
export function followPanel({ areaId = '', onOpen, adminView = false } = {}) {
  const root = h('div', { class: 'col' }, skel(4));
  const st = { f: 'all' }; let data = null;
  const draw = () => {
    if (root.__dead || !data) return;
    const all = (data.followUps || []).slice().sort((a, b) => (FU_ORDER[a.Display_Status] ?? 9) - (FU_ORDER[b.Display_Status] ?? 9) || new Date(a.Due_Date) - new Date(b.Due_Date));
    const tabs = [['all', 'ทั้งหมด', f => !isClosedFollow(f.FollowUp_Status)], ['เกินกำหนด', 'เกินกำหนด', f => f.Display_Status === 'เกินกำหนด'], ['ใกล้ครบกำหนด', 'ใกล้ครบกำหนด', f => f.Display_Status === 'ใกล้ครบกำหนด'], ['รอติดตาม', 'รอติดตาม', f => f.Display_Status === 'รอติดตาม'], ['done', 'เสร็จสิ้น', f => isClosedFollow(f.FollowUp_Status)]];
    const cur = tabs.find(t => t[0] === st.f)[2], rows = all.filter(cur);
    root.classList.add('no-anim');
    root.replaceChildren(
      h('div', { class: 'chips', role: 'group' }, tabs.map(([k, l, fn]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st.f === k), onclick: () => { st.f = k; draw(); } }, l, h('em', {}, all.filter(fn).length)))),
      rows.length ? h('div', { class: 'people-grid' }, rows.map(f => followRow(f, () => onOpen(f)))) : empty('ไม่มีรายการ', 'ไม่มีงานติดตามในหมวดนี้', 'calendar'));
  };
  loadFollows(d => { data = d; draw(); }, areaId).catch(e => root.replaceChildren(errorBox(e.message, () => root.replaceChildren(skel(4)))));
  return root;
}
export function followView() {
  const root = h('div', { class: 'page' }, followPanel({ onOpen: f => go('#/follow/' + encodeURIComponent(f.FollowUp_ID)) }));
  return root;
}
const num = (el, lo, hi) => { const v = Number(String(el.value).trim()); return el.value.trim() !== '' && Number.isFinite(v) && v > lo && v < hi ? v : null; };

export function followWorkView(ctx) {
  const id = decodeURIComponent(ctx.params[0]);
  const root = h('div', { class: 'page' }, skel(3));
  loadFollows(d => {
    if (root.__dead || root.dataset.built) return;
    const f = (d.followUps || []).find(x => x.FollowUp_ID === id);
    root.dataset.built = '1';
    if (!f) return root.replaceChildren(empty('ไม่พบงานติดตาม', 'รายการนี้อาจถูกปิดหรือถูกลบแล้ว', 'calendar'));
    buildWork(root, f);
  }).catch(e => failBox(root, e, () => go('#/follow')));
  return root;
}
function buildWork(root, f) {
  const done = isClosedFollow(f.FollowUp_Status), ht = f.Disease === 'HT';
  let gType = 'FBS', busy = false;
  const res = h('div', { class: 'result r-wait' }, h('div', { class: 'sw' }, '–'), h('div', {}, h('b', {}, 'กรอกค่าที่วัดได้'), h('span', {}, '')));
  const set = (level, big, note) => { res.className = 'result pop r-' + LEVELS[level].tone; res.firstChild.textContent = big; res.lastChild.firstChild.textContent = LEVELS[level].label; res.lastChild.lastChild.textContent = note; };
  const wait = t => { res.className = 'result r-wait'; res.firstChild.textContent = '–'; res.lastChild.firstChild.textContent = t; res.lastChild.lastChild.textContent = ''; };
  const sbp = h('input', { class: 'num', id: 'sbp', inputmode: 'numeric', placeholder: 'บน', 'aria-label': 'ความดันตัวบน' }), dbp = h('input', { class: 'num', id: 'dbp', inputmode: 'numeric', placeholder: 'ล่าง', 'aria-label': 'ความดันตัวล่าง' });
  const glu = h('input', { class: 'num', id: 'glu', inputmode: 'numeric', placeholder: 'mg/dL', 'aria-label': 'ค่าน้ำตาล' });
  const btn = h('button', { class: 'cta', type: 'button', disabled: true }, icon('check'), 'บันทึกผลติดตาม');
  const upd = () => {
    if (ht) { const s = num(sbp, 40, 300), d = num(dbp, 20, 200); if (s == null || d == null) { btn.disabled = true; return wait('กรอกค่าให้ครบ'); } const l = classifyHT(s, d); set(l, s + '/' + d, MSG[l]); btn.disabled = false; }
    else { const v = num(glu, 0, 700); if (v == null) { btn.disabled = true; return wait('กรอกค่าให้ครบ'); } const r = classifyDM(v, gType === 'FBS'); set(r.level, String(v), MSG[r.level]); btn.disabled = false; }
  };
  [sbp, dbp, glu].forEach(i => i.addEventListener('input', upd));
  btn.onclick = async () => {
    if (busy) return; busy = true; btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), 'กำลังบันทึก...');
    try {
      const body = { followUpId: f.FollowUp_ID, ...(ht ? { sbp: Number(sbp.value), dbp: Number(dbp.value) } : { glucoseType: gType, glucoseValue: Number(glu.value) }) };
      const r = await api.saveFollowUp(body); invalidate('follow');
      const lv = fromServer(r.result);
      const sh = openSheet({
        body: h('div', { class: 'sheet-body center' }, h('div', { class: 'ok-badge' }, okSvg()), h('h2', {}, 'บันทึกผลติดตามแล้ว'), h('div', { class: 'result r-' + LEVELS[lv].tone, style: { textAlign: 'left' } }, h('div', { class: 'sw' }, LEVELS[lv].label), h('div', {}, h('b', {}, 'ผลครั้งนี้: ' + LEVELS[lv].label), h('span', {}, MSG[lv]))), lv === 'risk' || lv === 'suspected' || lv === 'urgent' ? h('p', { class: 'small muted' }, 'โปรดแจ้งเจ้าหน้าที่เพื่อพิจารณาขั้นตอนต่อไป') : null),
        actions: [h('button', { class: 'cta', onclick: () => { sh.close(); go('#/follow'); } }, 'กลับไปรายการติดตาม')], onClose: () => go('#/follow')
      });
    } catch (e) { toast(e.message || 'บันทึกไม่สำเร็จ', 'error'); btn.disabled = false; }
    finally { busy = false; btn.replaceChildren(icon('check'), 'บันทึกผลติดตาม'); }
  };
  const gSeg = seg([['FBS', 'อดอาหาร (FBS)'], ['RBS', 'ไม่อดอาหาร (RBS)']], 'FBS', v => { gType = v; upd(); });
  root.replaceChildren(
    h('div', { class: 'row-card rise', style: { cursor: 'default' } }, h('div', { class: 'av ' + (ht ? 'ht' : 'dm') }, icon(ht ? 'pulse' : 'drop')), h('div', { class: 'grow' }, h('b', {}, f.Name || f.Person_ID), h('small', {}, `HN ${f.HN || '—'} · ${ht ? 'ความดันโลหิตสูง (HT)' : 'เบาหวาน (DM)'}`)), statusPill(f.Display_Status || '', FU_TONE[f.Display_Status] || 'none')),
    h('div', { class: 'card rise' }, h('dl', { class: 'kv' }, h('dt', {}, 'ผลตอนคัดกรอง'), h('dd', {}, `${LEVELS[fromServer(f.Initial_Status)].label} · ${f.Initial_Value || ''}`), h('dt', {}, 'ติดตามครั้งที่'), h('dd', {}, f.FollowUp_Round || 1), h('dt', {}, 'กำหนดติดตาม'), h('dd', {}, fmt.date(f.Due_Date)))),
    ...(done ? [empty('ดำเนินการแล้ว', 'งานติดตามนี้ถูกบันทึกผลเรียบร้อย', 'check')] : [
      h('div', { class: 'card rise', style: { '--i': 1, display: 'flex', flexDirection: 'column', gap: '14px' } },
        h('h2', { style: { fontSize: '18px' } }, ht ? 'วัดความดันซ้ำ' : 'ตรวจน้ำตาลซ้ำ'),
        ht ? h('div', { class: 'bpgrid', style: { gridTemplateColumns: '1fr 1fr' } }, h('div', { class: 'hd' }, 'บน (SBP)'), h('div', { class: 'hd' }, 'ล่าง (DBP)'), sbp, dbp) : [gSeg, glu],
        res),
      btn]));
}
const okSvg = () => { const t = document.createElement('template'); t.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return t.content.firstElementChild; };

/* ================= การส่งต่อ ================= */
export function referralPanel({ areaId = '', canEdit = false } = {}) {
  const root = h('div', { class: 'col' }, skel(3));
  let data = null; const st = { f: 'open' };
  const draw = () => {
    if (root.__dead || !data) return;
    const all = (data.referrals || []).slice().sort((a, b) => new Date(b.Referral_Date) - new Date(a.Referral_Date));
    const rows = all.filter(r => (st.f === 'open') === !isClosedRef(r.Referral_Status));
    root.classList.add('no-anim');
    root.replaceChildren(
      h('div', { class: 'chips' }, [['open', 'ที่เปิดอยู่'], ['closed', 'ปิดแล้ว']].map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st.f === k), onclick: () => { st.f = k; draw(); } }, l, h('em', {}, all.filter(r => (k === 'open') === !isClosedRef(r.Referral_Status)).length)))),
      rows.length ? h('div', { class: 'people-grid' }, rows.map(r => {
        const [label, tone] = REFERRAL_STATUS[String(r.Referral_Status).toUpperCase()] || [r.Referral_Status, 'none'];
        return h('button', { class: 'row-card rise', type: 'button', onclick: () => openReferral(r, canEdit, areaId, () => { invalidate('ref'); draw(); load(true); }) },
          h('div', { class: 'av ht' }, icon('send')), h('div', { class: 'grow' }, h('b', {}, r.Name || r.Person_ID), h('small', {}, `${r.Disease} · ${r.Note || ''}`), h('small', {}, fmt.date(r.Referral_Date))), h('span', { class: 'pill p-' + tone }, label));
      })) : empty('ไม่มีรายการ', st.f === 'open' ? 'ไม่มีรายการส่งต่อที่เปิดอยู่' : 'ยังไม่มีรายการที่ปิดแล้ว', 'send'));
  };
  const load = force => loadRefs(d => { data = d; draw(); }, areaId, { force }).catch(e => root.replaceChildren(errorBox(e.message)));
  load(false);
  return root;
}
const STEPS = ['OPEN', 'REFERRED', 'ARRIVED', 'ASSESSED', 'COMPLETED'];
export function openReferral(r, canEdit, areaId, after) {
  const cur = String(r.Referral_Status).toUpperCase(), idx = STEPS.indexOf(cur), next = REFERRAL_NEXT[cur];
  const [label, tone] = REFERRAL_STATUS[cur] || [cur, 'none'];
  const note = h('textarea', { class: 'textarea', rows: 3, placeholder: 'บันทึกเพิ่มเติม (ถ้ามี)', 'aria-label': 'บันทึกเพิ่มเติม' });
  const sheet = openSheet({
    title: r.Name || r.Person_ID,
    body: h('div', { class: 'sheet-body' },
      h('div', { class: 'stepper' }, STEPS.map((s, i) => h('div', { class: 's' + (i <= idx ? ' on' : '') }, h('i', {}, i <= idx ? icon('check') : null), REFERRAL_STATUS[s][0]))),
      h('dl', { class: 'kv' }, h('dt', {}, 'โรค'), h('dd', {}, r.Disease), h('dt', {}, 'สถานะ'), h('dd', {}, h('span', { class: 'pill p-' + tone }, label)), h('dt', {}, 'ปลายทาง'), h('dd', {}, r.Destination || '—'), h('dt', {}, 'วันที่ส่งต่อ'), h('dd', {}, fmt.date(r.Referral_Date)), h('dt', {}, 'เหตุผล'), h('dd', {}, r.Note || '—')),
      canEdit && next ? note : null, !canEdit ? h('p', { class: 'small muted' }, 'ผลการประเมินและการปิดเคสบันทึกโดยเจ้าหน้าที่โรงพยาบาล') : null),
    actions: [
      canEdit && next ? h('button', { class: 'cta', onclick: async e => { const b = e.currentTarget; b.disabled = true; try { await api.saveReferral({ referralId: r.Referral_ID, referralStatus: next, caseStatus: next === 'COMPLETED' ? 'CLOSED' : 'ACTIVE', ...(note.value.trim() ? { note: note.value.trim() } : {}), ...(['ASSESSED', 'COMPLETED'].includes(next) && note.value.trim() ? { assessmentResult: note.value.trim() } : {}) }); toast('อัปเดตเป็น "' + REFERRAL_STATUS[next][0] + '" แล้ว', 'ok'); sheet.close(); after(); } catch (x) { toast(x.message, 'error'); b.disabled = false; } } }, icon('check'), 'ขยับเป็น "' + REFERRAL_STATUS[next][0] + '"') : null,
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'ปิด')]
  });
}
export function referralsView() { return h('div', { class: 'page' }, referralPanel({})); }
