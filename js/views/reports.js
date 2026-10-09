/* รายงานการคัดกรอง (Admin) — เลือกช่วงเวลา/พื้นที่/อสม./กลุ่มผล แล้วดูสรุป ดาวน์โหลด Excel/CSV หรือพิมพ์เป็น PDF */
import { api } from '../api.js';
import { h, icon, fmt, skel, errorBox, toast, seg } from '../ui.js';

const GROUPS = [['NORMAL', 'ปกติ'], ['RISK', 'กลุ่มเสี่ยง'], ['SUSPECTED', 'สงสัย'], ['URGENT', 'เร่งด่วน']];
const LBL = Object.fromEntries(GROUPS);
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const be = s => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${+s.slice(0, 4) + 543}` : '');
const maskCid = c => (c && c.length === 13 ? `${c[0]}-${c.slice(1, 5)}-xxxxx-xx-${c[12]}` : '');
const areaText = a => `ต.${a['ตำบล']} หมู่ ${a['หมู่']}`;

function quickRange(k) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  if (k === 'all') return ['', ''];
  if (k === 'today') return [iso(t), iso(t)];
  if (k === '7d') { const s = new Date(t); s.setDate(s.getDate() - 6); return [iso(s), iso(t)]; }
  if (k === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
  if (k === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  const fy = m >= 9 ? y : y - 1; // ปีงบประมาณเริ่ม 1 ต.ค.
  return [iso(new Date(fy, 9, 1)), iso(new Date(fy + 1, 8, 30))];
}

/* ---------- ไฟล์ส่งออก ---------- */
function columns(withCid) {
  const c = [['date', 'วันที่คัดกรอง', r => be(r.date)], ['time', 'เวลา', r => r.time], ['tambon', 'ตำบล', r => r.tambon], ['moo', 'หมู่', r => String(r.moo ?? '')], ['areaId', 'รหัสพื้นที่', r => r.areaId], ['hn', 'HN', r => r.hn]];
  if (withCid) c.push(['cid', 'เลขบัตรประชาชน', r => r.cid || '']);
  return c.concat([['name', 'ชื่อ-นามสกุล', r => r.name], ['age', 'อายุ', r => r.age], ['sex', 'เพศ', r => r.sex], ['sbp', 'ความดันตัวบน', r => r.sbp], ['dbp', 'ความดันตัวล่าง', r => r.dbp],
    ['ht', 'ผลความดัน', r => LBL[r.htGroup] || r.htGroup], ['gt', 'ชนิดน้ำตาล', r => r.glucoseType], ['glu', 'น้ำตาล (mg/dL)', r => r.glucose], ['dm', 'ผลเบาหวาน', r => LBL[r.dmStatus] || r.dmStatus],
    ['bmi', 'BMI', r => r.bmi], ['w', 'น้ำหนัก (กก.)', r => r.weight], ['hh', 'ส่วนสูง (ซม.)', r => r.height], ['vol', 'อสม.ผู้คัดกรอง', r => r.volunteerName], ['vid', 'รหัส อสม.', r => r.volunteerId],
    ['fh', 'นัดติดตาม HT', r => be(r.fuHtDue)], ['fhs', 'สถานะติดตาม HT', r => r.fuHtStatus], ['fd', 'นัดติดตาม DM', r => be(r.fuDmDue)], ['fds', 'สถานะติดตาม DM', r => r.fuDmStatus]]);
}
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`; };
function save(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
function csv(rep) {
  const cols = columns(!!rep.filters.includeCid), q = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return '\uFEFF' + [cols.map(c => q(c[1])).join(',')].concat(rep.rows.map(r => cols.map(c => q(c[2](r))).join(','))).join('\r\n');
}
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, no) => { const s = h('script', { src: XLSX_URL, onload: () => ok(window.XLSX), onerror: () => no(new Error('โหลดตัวสร้างไฟล์ Excel ไม่ได้ (ต้องต่ออินเทอร์เน็ต) ลองดาวน์โหลดแบบ CSV แทน')) }); document.head.append(s); });
}
function filterText(f, ctx) {
  const parts = [`ช่วงเวลา: ${f.from || f.to ? `${be(f.from) || 'เริ่มต้น'} – ${be(f.to) || 'ปัจจุบัน'}` : 'ทั้งหมด'}`,
    `พื้นที่: ${f.areas.length ? f.areas.map(id => ctx.areaTxt(id)).join(', ') : 'ทุกพื้นที่'}`, `อสม.: ${f.volunteers.length ? ctx.volTxt(f.volunteers[0]) : 'ทุกคน'}`,
    `กลุ่มผล: ${f.groups.length ? f.groups.map(g => LBL[g]).join(', ') + (f.disease === 'ANY' ? ' (HT หรือ DM)' : ' (เฉพาะ ' + f.disease + ')') : 'ทุกกลุ่ม'}`];
  return parts;
}
async function xlsx(rep, ctx) {
  const X = await loadXlsx(), f = rep.filters, cols = columns(!!f.includeCid), S = rep.summary;
  const zero = g => g.map(k => 0);
  const sum = [['รายงานผลการคัดกรอง NCD (HT / DM)'], ['สร้างเมื่อ', new Date(rep.generatedAt).toLocaleString('th-TH')], ...filterText(f, ctx).map(t => [t]), [], ['จำนวนที่คัดกรอง (รายการ)', rep.total], [],
    ['ผลความดัน (HT)', 'ปกติ', 'กลุ่มเสี่ยง', 'สงสัย', 'เร่งด่วน'], ['จำนวน', S.ht.NORMAL, S.ht.RISK, S.ht.SUSPECTED, S.ht.URGENT], [],
    ['ผลเบาหวาน (DM)', 'ปกติ', 'กลุ่มเสี่ยง', 'สงสัย'], ['จำนวน', S.dm.NORMAL, S.dm.RISK, S.dm.SUSPECTED], [],
    ['สรุปรายหมู่', 'รหัสพื้นที่', 'รวม', 'HT ปกติ', 'HT เสี่ยง', 'HT สงสัย', 'HT เร่งด่วน', 'DM ปกติ', 'DM เสี่ยง', 'DM สงสัย']]
    .concat(S.byArea.map(a => [`ต.${a.tambon} หมู่ ${a.moo}`, a.areaId, a.total, a.ht.NORMAL, a.ht.RISK, a.ht.SUSPECTED, a.ht.URGENT, a.dm.NORMAL, a.dm.RISK, a.dm.SUSPECTED]))
    .concat([[], ['สรุปรายอสม.', 'รหัส', 'จำนวนที่คัดกรอง']], S.byVolunteer.map(v => [v.name, v.id, v.total]));
  if (!f.includeCid) sum.push([], ['หมายเหตุ: ไฟล์นี้ไม่มีเลขบัตรประชาชน']);
  const body = [cols.map(c => c[1])].concat(rep.rows.map(r => cols.map(c => { const v = c[2](r); return v === undefined || v === null ? '' : typeof v === 'number' && !['age', 'sbp', 'dbp', 'glu', 'bmi', 'w', 'hh'].includes(c[0]) ? String(v) : v; })));
  const wb = X.utils.book_new(), s1 = X.utils.aoa_to_sheet(sum), s2 = X.utils.aoa_to_sheet(body);
  s1['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  s2['!cols'] = cols.map(c => ({ wch: c[0] === 'name' || c[0] === 'vol' ? 26 : c[0] === 'cid' ? 18 : 14 }));
  X.utils.book_append_sheet(wb, s1, 'สรุป'); X.utils.book_append_sheet(wb, s2, 'รายชื่อ');
  X.writeFile(wb, `NCD_report_${stamp()}.xlsx`);
}

/* ---------- หน้ารายงาน ---------- */
export function adminReportView() {
  const root = h('div', { class: 'adm-page rpt' }, skel(2, 'tall'));
  const st = { from: '', to: '', areas: [], vol: '', groups: [], disease: 'ANY', cid: true, quick: 'all' };
  let meta = null, rep = null, busy = false;
  const out = h('div', { class: 'rpt-out' });

  const areaTxt = id => { const a = (meta?.areas || []).find(x => x.Area_ID === id); return a ? areaText(a) : id; };
  const volTxt = id => { const v = (meta?.volunteers || []).find(x => x.id === id); return v ? v.name : id; };
  const ctx = { areaTxt, volTxt };
  const dFrom = h('input', { class: 'input', type: 'date', 'aria-label': 'วันที่เริ่มต้น', oninput: e => { st.from = e.target.value; st.quick = ''; markQuick(); } });
  const dTo = h('input', { class: 'input', type: 'date', 'aria-label': 'วันที่สิ้นสุด', oninput: e => { st.to = e.target.value; st.quick = ''; markQuick(); } });
  const quickBtns = [['all', 'ทั้งหมด'], ['today', 'วันนี้'], ['7d', '7 วันล่าสุด'], ['month', 'เดือนนี้'], ['last', 'เดือนที่แล้ว'], ['fy', 'ปีงบประมาณนี้']].map(([k, l]) => h('button', { class: 'chip', type: 'button', 'data-q': k, onclick: () => { [st.from, st.to] = quickRange(k); st.quick = k; dFrom.value = st.from; dTo.value = st.to; markQuick(); } }, l));
  const markQuick = () => quickBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === st.quick)));
  const areaWrap = h('div', { class: 'chips wrapchips', role: 'group', 'aria-label': 'เลือกพื้นที่' });
  const volSel = h('select', { class: 'input', 'aria-label': 'เลือก อสม.', onchange: e => { st.vol = e.target.value; } });
  const grpWrap = h('div', { class: 'chips wrapchips', role: 'group', 'aria-label': 'กลุ่มผลคัดกรอง' }, GROUPS.map(([k, l]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: e => { const on = !st.groups.includes(k); st.groups = on ? st.groups.concat(k) : st.groups.filter(x => x !== k); e.currentTarget.setAttribute('aria-pressed', String(on)); } }, l)));
  const diseaseSeg = seg([['ANY', 'HT หรือ DM'], ['HT', 'เฉพาะ HT'], ['DM', 'เฉพาะ DM']], st.disease, v => { st.disease = v; });
  const cidBox = h('input', { type: 'checkbox', checked: true, id: 'cidbox', onchange: e => { st.cid = e.target.checked; cidNote.hidden = !st.cid; } });
  const cidNote = h('p', { class: 'rpt-warn' }, icon('alert'), 'ไฟล์จะมีเลขบัตรประชาชน — เก็บรักษาและลบคอลัมน์นี้ก่อนส่งต่อให้ผู้อื่น');
  const goBtn = h('button', { class: 'btn', type: 'button', onclick: () => run() }, 'สร้างรายงาน');

  function drawAreas() {
    areaWrap.replaceChildren(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!st.areas.length), onclick: () => { st.areas = []; drawAreas(); drawVols(); } }, 'ทุกพื้นที่'),
      ...(meta.areas || []).map(a => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(st.areas.includes(a.Area_ID)), onclick: () => { st.areas = st.areas.includes(a.Area_ID) ? st.areas.filter(x => x !== a.Area_ID) : st.areas.concat(a.Area_ID); drawAreas(); drawVols(); } }, areaText(a))));
  }
  function drawVols() {
    const list = (meta.volunteers || []).filter(v => !st.areas.length || st.areas.includes(v.areaId));
    if (st.vol && !list.some(v => v.id === st.vol)) st.vol = '';
    volSel.replaceChildren(h('option', { value: '' }, `ทุกคน (${list.length})`), ...list.map(v => h('option', { value: v.id }, `${v.name} · ${v.areaId}`)));
    volSel.value = st.vol;
  }
  const field = (label, ...kids) => h('div', { class: 'field' }, h('label', {}, label), ...kids);

  async function run() {
    if (busy) return;
    if (st.from && st.to && st.from > st.to) { toast('วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด', 'error'); return; }
    busy = true; goBtn.disabled = true; goBtn.replaceChildren(h('span', { class: 'spin' }), 'กำลังสร้างรายงาน...'); out.replaceChildren(skel(2, 'tall'));
    try {
      rep = await api.report({ from: st.from, to: st.to, areas: st.areas.join(','), volunteers: st.vol, groups: st.groups.join(','), disease: st.disease, includeCid: st.cid });
      drawOut();
    } catch (e) { out.replaceChildren(errorBox(e.message, run)); } finally { busy = false; goBtn.disabled = false; goBtn.replaceChildren('สร้างรายงาน'); }
  }

  const table = (head, rows, cls = '') => h('div', { class: 'rtable ' + cls }, h('table', {}, h('thead', {}, h('tr', {}, head.map(x => h('th', {}, x)))), h('tbody', {}, rows.map(r => h('tr', {}, r.map((x, i) => h('td', { class: i ? 'num' : '' }, x)))))));
  function drawOut() {
    const f = rep.filters, S = rep.summary, ex = async (kind) => {
      try {
        if (kind === 'xlsx') await xlsx(rep, ctx); else if (kind === 'csv') save(new Blob([csv(rep)], { type: 'text/csv;charset=utf-8' }), `NCD_report_${stamp()}.csv`); else { window.print(); }
        api.reportExportLog({ format: kind, count: rep.total, includeCid: !!f.includeCid }).catch(() => {});
      } catch (e) { toast(e.message, 'error'); }
    };
    if (!rep.total) { out.replaceChildren(h('div', { class: 'card empty-rpt' }, h('b', {}, 'ไม่พบข้อมูลตามเงื่อนไขนี้'), h('p', {}, 'ลองขยายช่วงเวลา หรือเอาตัวกรองบางอย่างออก'))); return; }
    const kp = (t, o, keys) => h('div', { class: 'card rpt-k' }, h('b', {}, t), h('div', { class: 'rpt-kr' }, keys.map(k => h('div', {}, h('span', {}, LBL[k]), h('strong', { class: 'k-' + k }, fmt.n(o[k] || 0))))));
    const pv = rep.rows.slice(0, 20), cols = columns(false).filter(c => ['date', 'moo', 'hn', 'name', 'age', 'sbp', 'dbp', 'ht', 'glu', 'dm', 'vol'].includes(c[0]));
    out.replaceChildren(
      h('div', { class: 'rpt-print-h' }, h('h2', {}, 'รายงานผลการคัดกรอง NCD · โรงพยาบาลศรีสาคร'), ...filterText(f, ctx).map(t => h('p', {}, t))),
      h('div', { class: 'card rpt-head' }, h('div', {}, h('b', { class: 'rpt-n' }, fmt.n(rep.total)), h('span', {}, ' รายการที่ตรงเงื่อนไข'), h('p', { class: 'muted small' }, filterText(f, ctx).join(' · '))),
        h('div', { class: 'rpt-dl noprint' }, h('button', { class: 'btn small', type: 'button', onclick: () => ex('xlsx') }, icon('download'), 'Excel (.xlsx)'), h('button', { class: 'btn small', type: 'button', onclick: () => ex('csv') }, icon('download'), 'CSV'), h('button', { class: 'btn small', type: 'button', onclick: () => ex('pdf') }, 'พิมพ์ / PDF'))),
      rep.truncated ? h('p', { class: 'rpt-warn' }, icon('alert'), `แสดง/ส่งออกเฉพาะ ${fmt.n(rep.maxRows)} รายการแรก (ทั้งหมด ${fmt.n(rep.total)}) — แบ่งช่วงเวลาให้สั้นลงเพื่อได้ครบ`) : null,
      f.includeCid ? h('p', { class: 'rpt-warn noprint' }, icon('alert'), 'ไฟล์ที่ดาวน์โหลดมีเลขบัตรประชาชน ใช้เฉพาะงานคีย์ข้อมูล และลบคอลัมน์นี้ก่อนส่งให้ผู้อื่น') : null,
      h('div', { class: 'rpt-ks' }, kp('ผลความดัน (HT)', S.ht, ['NORMAL', 'RISK', 'SUSPECTED', 'URGENT']), kp('ผลเบาหวาน (DM)', S.dm, ['NORMAL', 'RISK', 'SUSPECTED'])),
      h('div', { class: 'card' }, h('b', {}, 'สรุปรายหมู่'), table(['หมู่', 'รวม', 'HT ปกติ', 'HT เสี่ยง', 'HT สงสัย', 'HT เร่งด่วน', 'DM ปกติ', 'DM เสี่ยง', 'DM สงสัย'], S.byArea.map(a => [`ต.${a.tambon} หมู่ ${a.moo}`, a.total, a.ht.NORMAL, a.ht.RISK, a.ht.SUSPECTED, a.ht.URGENT, a.dm.NORMAL, a.dm.RISK, a.dm.SUSPECTED]))),
      h('div', { class: 'card' }, h('b', {}, `สรุปรายอสม. (${S.byVolunteer.length} คน)`), table(['อสม.', 'จำนวนที่คัดกรอง'], S.byVolunteer.map(v => [v.name || v.id, v.total]), 'scroll')),
      h('div', { class: 'card noprint' }, h('b', {}, `ตัวอย่างรายชื่อ (${pv.length} จาก ${fmt.n(rep.total)} รายการ)`), h('p', { class: 'muted small' }, 'ในไฟล์ที่ดาวน์โหลดจะมีครบทุกคอลัมน์ รวมถึง HN นัดติดตาม และเลขบัตรตามที่เลือก'), table(cols.map(c => c[1]), pv.map(r => cols.map(c => c[2](r) ?? '')), 'scroll')));
  }

  Promise.resolve().then(() => api.reportMeta()).then(m => {
    meta = m; drawAreas(); drawVols(); markQuick();
    root.replaceChildren(
      h('div', { class: 'ph' }, h('div', {}, h('h1', {}, 'รายงานการคัดกรอง'), h('p', {}, 'เลือกเงื่อนไข สร้างรายงาน แล้วดาวน์โหลดเป็น Excel หรือ CSV'))),
      h('div', { class: 'card rpt-form noprint' },
        field('ช่วงเวลา', h('div', { class: 'chips wrapchips', role: 'group', 'aria-label': 'ช่วงเวลาลัด' }, quickBtns), h('div', { class: 'rpt-dates' }, h('label', {}, 'ตั้งแต่', dFrom), h('label', {}, 'ถึง', dTo))),
        field('พื้นที่ (เลือกได้หลายหมู่)', areaWrap), field('อสม.', volSel),
        field('กลุ่มผลคัดกรอง (ไม่เลือก = ทุกกลุ่ม)', grpWrap, diseaseSeg, h('p', { class: 'muted small' }, '“เร่งด่วน” คือความดันสูงมาก (HT) ซึ่งแยกออกจาก “สงสัย” ถ้าต้องการทั้งสองให้เลือกคู่กัน')),
        h('label', { class: 'rpt-chk', for: 'cidbox' }, cidBox, h('span', {}, 'รวมเลขบัตรประชาชนในไฟล์')), cidNote, goBtn),
      out);
  }).catch(e => root.replaceChildren(errorBox(e.message, () => location.reload())));
  return root;
}
