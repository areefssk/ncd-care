/* NCD Care V2.1 — App shell (Phase 2): Login · Home · รายชื่อ · ติดตาม · ส่งต่อ (อ่านอย่างเดียว) */
(() => {
const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IC = { home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2 .6 3.3 2.3 3.6 5"/>',
  fu: '<rect x="4" y="4" width="16" height="17" rx="3"/><path d="M9 2v4M15 2v4M8 13h8M8 17h5"/>', ref: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  out: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10"/>', re: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', gear: '<path d="M17 20v-1a4 4 0 00-4-4h-2a4 4 0 00-4 4v1"/><circle cx="12" cy="8" r="3.5"/>' };
const svg = n => `<svg class="i" viewBox="0 0 24 24">${IC[n]}</svg>`;
const S = { tab: 'home', data: null, at: 0, q: '', f: 'all', n: 40 };
const TABS = [['home', 'หน้าแรก', 'home'], ['people', 'รายชื่อ', 'users'], ['fu', 'ติดตาม', 'fu'], ['ref', 'ส่งต่อ', 'ref']];
const ATABS = [['ov', 'ภาพรวม', 'home'], ['rp', 'รายงาน', 'chart'], ['us', 'ผู้ใช้งาน', 'gear']];
const tabsOf = () => ((NCD_API.user() || {}).role === 'ADMIN' ? ATABS : TABS);

let tt; function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => t.className = '', 3200); }
const thDate = v => { const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); };
const hhmm = t => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const pname = p => p['ชื่อ–นามสกุล'] || p['ชื่อ-นามสกุล'] || p['ชื่อ-สกุล'] || p.name || p.Name || '';
const initial = n => (String(n).replace(/^(นางสาว|นาย|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)\s*/, '').trim()[0]) || '•';
const DONE = /^(COMPLETED|DONE|CLOSED|CANCELLED|CANCELED)$/i;

/* ---------- Login ---------- */
function showLogin(msg, admin) {
  document.body.classList.remove('in');
  app.innerHTML = `<div class="login"><form class="lcard" id="lf" novalidate>
    <div class="logo"><img src="assets/logo-192.png" alt="โรงพยาบาลศรีสาคร"></div>
    <h1>NCD Care</h1><p>ระบบคัดกรองโรคไม่ติดต่อเรื้อรัง<br>โรงพยาบาลศรีสาคร</p>
    ${admin ? `<div class="fld"><label for="u">ชื่อผู้ใช้</label><input class="inp txt" id="u" autocomplete="username" autocapitalize="off"></div>
      <div class="fld"><label for="p">รหัสผ่าน</label><input class="inp txt" id="p" type="password" autocomplete="current-password"></div>`
    : `<div class="fld"><label for="c">เลขบัตรประชาชน 13 หลัก</label><input class="inp" id="c" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="x xxxx xxxxx xx x"><span class="cnt" id="cc">0/13</span></div><div style="clear:both"></div>`}
    <div class="err" id="er" role="alert">${esc(msg || '')}</div>
    <button class="btn" id="go" type="submit"><span class="sp"></span>เข้าสู่ระบบ</button>
    <button class="lnk" type="button" id="sw">${admin ? '← เข้าสำหรับ อสม.' : 'สำหรับเจ้าหน้าที่ (Admin)'}</button>
    <div class="foot">ข้อมูลสุขภาพเป็นความลับ ใช้เพื่อการดูแลสุขภาพชุมชนเท่านั้น</div></form></div>`;
  const f = $('#lf'), er = $('#er'), go = $('#go');
  const bad = m => { er.textContent = m; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); };
  if (!admin) { const c = $('#c'); c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 13); $('#cc').textContent = c.value.length + '/13'; er.textContent = ''; }); c.focus(); }
  $('#sw').onclick = () => showLogin('', !admin);
  f.onsubmit = async e => {
    e.preventDefault();
    let job;
    if (admin) { const u = $('#u').value.trim(), p = $('#p').value; if (!u || !p) return bad('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); job = () => NCD_API.adminLogin(u, p); }
    else { const c = $('#c').value; if (!/^\d{13}$/.test(c)) return bad('กรุณากรอกเลขบัตรประชาชน 13 หลักให้ครบ'); job = () => NCD_API.volunteerLogin(c); }
    go.disabled = true; er.textContent = '';
    try { const d = await job(); NCD_API.clearSession(); NCD_API.saveSession(d); S.data = null; S.tab = 'home'; location.hash = '#/home'; showShell(); }
    catch (x) { go.disabled = false; bad(x.message); }
  };
}

/* ---------- Shell ---------- */
function showShell() {
  const u = NCD_API.user() || {}, admin = u.role === 'ADMIN', tabs = admin ? ATABS : TABS;
  document.body.classList.add('in');
  app.innerHTML = `<header class="top"><img src="assets/logo-96.png" alt=""><div class="t"><b><span class="m">NCD Care</span><span class="d" id="ttl"></span></b><small id="sb">${esc(u.displayName || '')}</small></div>
    ${admin ? '' : `<button class="ib" id="rf" aria-label="รีเฟรช">${svg('re')}</button>`}<button class="ib" id="lo" aria-label="ออกจากระบบ">${svg('out')}</button></header>
    <main><div id="view" class="view"></div></main>
    <nav class="tabs" id="tb" style="--cnt:${tabs.length}"><div class="brand"><img src="assets/logo-96.png" alt=""><div><b>NCD Care</b><small>โรงพยาบาลศรีสาคร</small></div></div>
      <div class="items">${tabs.map(([k, l, ic]) => `<a href="#/${k}" data-k="${k}">${svg(ic)}${l}</a>`).join('')}</div>
      <div class="usr"><div class="av2">${esc(initial(u.displayName || ''))}</div><div class="nm"><b>${esc(u.displayName || '')}</b><small>${admin ? 'ผู้ดูแลระบบ' : 'อสม.'}</small></div><button class="ib" id="lo2" aria-label="ออกจากระบบ">${svg('out')}</button></div></nav>`;
  $('#lo').onclick = logout; $('#lo2').onclick = logout;
  if (admin) { $('#sb').textContent = 'ผู้ดูแลระบบ'; route(true); return; }
  $('#rf').onclick = () => load(true);
  const c = NCD_API.cacheGet(); if (c && c.d && c.d.user && c.d.user.actorId === u.actorId) { S.data = c.d; S.at = c.at; }
  route(true); load(false);
}
function logout() { NCD_API.logout(); NCD_API.clearSession(); S.data = null; showLogin(); }
window.addEventListener('ncd:expired', () => { NCD_API.clearSession(); S.data = null; showLogin('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); });

/* ---------- Data ---------- */
async function load(manual) {
  const rf = $('#rf'); if (rf) rf.classList.add('spin');
  try {
    const d = await NCD_API.home(); S.data = d; S.at = Date.now(); NCD_API.cachePut(d);
    paint(); if (manual) toast('อัปเดตข้อมูลแล้ว');
  } catch (e) {
    if (e.code === 'UNAUTHORIZED' || e.code === 'SESSION_EXPIRED') return;
    if (S.data) toast(e.message + ' (แสดงข้อมูลล่าสุด)', true); else $('#view') && ($('#view').innerHTML = `<div class="fail"><div class="big">📡</div><p>${esc(e.message)}</p><button class="btn" id="rt">ลองใหม่</button></div>`, $('#rt').onclick = () => { skel(); load(true); });
  } finally { if ($('#rf')) $('#rf').classList.remove('spin'); }
}
const skel = () => { $('#view').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>'; };

/* ---------- Router ---------- */
function route(first) {
  const tabs = tabsOf(), k = (location.hash.match(/^#\/(\w+)/) || [])[1], t = (tabs.find(x => x[0] === k) || tabs[0])[0];
  const v = $('#view'); if (!v) return;
  const go = () => {
    S.tab = t; const i = tabs.findIndex(x => x[0] === t), tb = $('#tb');
    if (tb) { tb.style.setProperty('--i', i); tb.querySelectorAll('a').forEach(x => x.classList.toggle('on', x.dataset.k === t)); }
    const ttl = $('#ttl'); if (ttl) ttl.textContent = tabs[i][1]; paint(true);
  };
  if (first) return go();
  v.classList.add('out'); setTimeout(go, 140);
}
window.addEventListener('hashchange', () => { if (document.body.classList.contains('in') && $('#tb')) route(false); });

function paint(animate) {
  const v = $('#view'); if (!v) return;
  if (tabsOf() === ATABS) { v.className = 'view'; v.innerHTML = aPage(); return; }
  if (!S.data) { skel(); return; }
  if (S.at && $('#sb')) $('#sb').textContent = (areaLabel() ? areaLabel() + ' · ' : '') + 'อัปเดต ' + hhmm(S.at);
  v.className = 'view'; if (animate) { void v.offsetWidth; }
  v.innerHTML = { home: pHome, people: pPeople, fu: pFu, ref: pRef }[S.tab]();
  const b = $('#tb'); if (b) { b.querySelectorAll('em').forEach(e => e.remove()); const n = fuCounts().late; if (n) b.querySelector('[data-k="fu"]').insertAdjacentHTML('beforeend', `<em>${n}</em>`); }
  bind();
}
const areaLabel = () => { const a = (S.data.areas || [])[0]; return a ? `หมู่ ${a['หมู่']} ต.${a['ตำบล']}` : ''; };
const fuList = () => (S.data.followUps && S.data.followUps.followUps) || [];
const refList = () => (S.data.referrals && S.data.referrals.referrals) || [];
function fuCounts() { const o = { late: 0, soon: 0, wait: 0, done: 0 }; fuList().forEach(f => { const s = f.Display_Status; if (s === 'เกินกำหนด') o.late++; else if (s === 'ใกล้ครบกำหนด') o.soon++; else if (s === 'ดำเนินการแล้ว') o.done++; else o.wait++; }); return o; }

/* ---------- Pages ---------- */
function pHome() {
  const d = S.data, p = d.people || {}, tot = p.total || 0, sc = p.screenedCount || 0, pct = tot ? Math.round(sc / tot * 100) : 0, c = fuCounts();
  const openRef = refList().filter(r => !DONE.test(String(r.Referral_Status || ''))).length, u = d.user || {};
  const pending = d.bootstrap && d.bootstrap.clinicalRulesReady === false;
  return `<div class="hi">สวัสดี ${esc(u.displayName || '')} 👋</div><p class="sub">${esc(areaLabel())} · ปีคัดกรอง ${esc(p.screeningYear || '')}</p>
  <div class="card hero"><div class="ring"><svg viewBox="0 0 112 112"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ba66f"/><stop offset="1" stop-color="#1b6b4a"/></linearGradient></defs><circle class="tr" cx="56" cy="56" r="46"/><circle class="pg" cx="56" cy="56" r="46" data-p="${pct}"/></svg><b><i data-n="${pct}" style="font-style:normal">0</i><span>%</span></b></div>
  <div style="position:relative"><h3>ความคืบหน้าการคัดกรอง</h3><p>คัดกรองแล้ว <b>${sc.toLocaleString()}</b> จาก ${tot.toLocaleString()} คน</p></div></div>
  <div class="grid">
   <button class="card stat" data-go="people" data-f="todo"><b data-n="${Math.max(0, tot - sc)}">0</b><span>ยังไม่คัดกรอง</span></button>
   <button class="card stat red" data-go="fu"><b data-n="${c.late}">0</b><span>ติดตามเกินกำหนด</span></button>
   <button class="card stat amb" data-go="fu"><b data-n="${c.soon}">0</b><span>ใกล้ครบกำหนด</span></button>
   <button class="card stat grn" data-go="ref"><b data-n="${openRef}">0</b><span>ส่งต่อที่ยังค้างอยู่</span></button></div>
  ${pending ? '<div class="card note">⚠️ เกณฑ์คลินิกยังอยู่ระหว่างอนุมัติ (PENDING_FINAL) ผลคัดกรองเป็นข้อมูลเบื้องต้น</div>' : ''}
  <div class="card note info">ℹ️ หน้านี้เป็นเวอร์ชันใหม่ (Phase 2) ฟอร์มบันทึกคัดกรองและบันทึกผลติดตามจะมาใน Phase 3</div>`;
}
function pPeople() {
  const t = S.data.people || {};
  return `<div class="bar"><input class="srch" id="q" type="search" placeholder="ค้นหาชื่อ / HN / รหัส" value="${esc(S.q)}" autocomplete="off"></div>
  <div class="chips" id="ch">${[['all', 'ทั้งหมด'], ['todo', 'ยังไม่คัดกรอง'], ['done', 'คัดกรองแล้ว']].map(([k, l]) => `<button class="chip${S.f === k ? ' on' : ''}" data-f="${k}">${l}</button>`).join('')}</div><div id="pl" class="lst"></div>`;
}
function plist() {
  const q = S.q.trim().toLowerCase(), all = ((S.data.people && S.data.people.people) || []).filter(p => (S.f === 'all' || (S.f === 'todo') === (p.Screening_Status !== 'คัดกรองแล้ว')) && (!q || (pname(p) + ' ' + p.HN + ' ' + p.Person_ID).toLowerCase().includes(q)));
  const el = $('#pl'); if (!el) return;
  if (!all.length) { el.innerHTML = '<div class="empty"><div class="big">🔎</div>ไม่พบรายชื่อที่ตรงกัน</div>'; return; }
  el.innerHTML = all.slice(0, S.n).map((p, i) => { const ok = p.Screening_Status === 'คัดกรองแล้ว';
    return `<div class="card row" style="--n:${Math.min(i, 10)}"><div class="av${ok ? ' g' : ''}">${esc(initial(pname(p)))}</div><div class="rb"><b>${esc(pname(p))}</b><small>HN ${esc(p.HN || '-')} · ${esc(p['อายุ'] || '-')} ปี · ${esc(p['เพศ'] || '')}</small></div><span class="pill ${ok ? 'ok' : ''}">${ok ? 'คัดกรองแล้ว' : 'ยังไม่คัดกรอง'}</span></div>`; }).join('')
    + (all.length > S.n ? `<button class="more" id="mo">แสดงเพิ่ม (อีก ${all.length - S.n} คน)</button>` : '');
  const m = $('#mo'); if (m) m.onclick = () => { S.n += 40; plist(); };
}
const FUP = { 'เกินกำหนด': ['bad', 0], 'ใกล้ครบกำหนด': ['warn', 1], 'รอติดตาม': ['info', 2], 'ดำเนินการแล้ว': ['ok', 3] };
function pFu() {
  const l = fuList().slice().sort((a, b) => ((FUP[a.Display_Status] || [0, 9])[1] - (FUP[b.Display_Status] || [0, 9])[1]) || (new Date(a.Due_Date) - new Date(b.Due_Date)));
  if (!l.length) return '<div class="empty"><div class="big">✅</div>ยังไม่มีรายการที่ต้องติดตาม</div>';
  return `<div class="hi">ติดตามผล</div><p class="sub">${l.length} รายการ · เกินกำหนด ${fuCounts().late}</p><div class="lst">` + l.map((f, i) => `<div class="card row" style="--n:${Math.min(i, 10)}"><div class="rb"><b>${esc(f.Name || f.Person_ID)}</b><small><span class="dz ${f.Disease === 'DM' ? 'dm' : ''}">${esc(f.Disease)}</span>ค่าแรก ${esc(f.Initial_Value || '-')} · ครบกำหนด ${thDate(f.Due_Date)}</small></div><span class="pill ${(FUP[f.Display_Status] || ['', 0])[0]}">${esc(f.Display_Status)}</span></div>`).join('') + '</div>';
}
function pRef() {
  const l = refList().slice().sort((a, b) => DONE.test(a.Referral_Status) - DONE.test(b.Referral_Status) || new Date(b.Referral_Date) - new Date(a.Referral_Date));
  if (!l.length) return '<div class="empty"><div class="big">📨</div>ยังไม่มีรายการส่งต่อ</div>';
  return `<div class="hi">การส่งต่อ</div><p class="sub">${l.length} รายการ</p><div class="lst">` + l.map((r, i) => { const d = DONE.test(String(r.Referral_Status || ''));
    return `<div class="card row" style="--n:${Math.min(i, 10)}"><div class="rb"><b>${esc(r.Name || r.Person_ID)}</b><small><span class="dz ${r.Disease === 'DM' ? 'dm' : ''}">${esc(r.Disease)}</span>${esc(r.Destination || 'รอระบุปลายทาง')} · ${thDate(r.Referral_Date)}</small></div><span class="pill ${d ? 'ok' : 'warn'}">${esc(r.Referral_Status || '-')}</span></div>`; }).join('') + '</div>';
}
const AINFO = { ov: ['ภาพรวมระบบ', '📊', 'ความคืบหน้าการคัดกรองรายพื้นที่ และกลุ่มเสี่ยงทั้งอำเภอ'], rp: ['รายงานและส่งออก', '🗂️', 'สรุปรายเดือน/รายพื้นที่ และส่งออกไฟล์ Excel'], us: ['ผู้ใช้งาน', '👥', 'จัดการ อสม. สิทธิ์การเข้าถึง และประวัติการใช้งาน (Audit Log)'] };
function aPage() {
  const u = NCD_API.user() || {}, x = AINFO[S.tab] || AINFO.ov;
  return `<div class="hi">${S.tab === 'ov' ? 'สวัสดี ' + esc(u.displayName || '') : esc(x[0])}</div><p class="sub">${esc(x[0])}</p>
  <div class="card empty"><div class="big">${x[1]}</div><b>กำลังพัฒนา (Phase 4)</b><p>${esc(x[2])}</p><p>ระหว่างนี้ผู้ดูแลระบบใช้ระบบเดิมไปก่อน</p></div>`;
}

/* ---------- Interactions ---------- */
function bind() {
  document.querySelectorAll('[data-n]').forEach(el => { const to = +el.dataset.n, t0 = performance.now(); (function s(t) { const k = Math.min(1, (t - t0) / 800); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1) requestAnimationFrame(s); })(t0); });
  const pg = document.querySelector('.ring .pg'); if (pg) requestAnimationFrame(() => requestAnimationFrame(() => pg.style.strokeDashoffset = 289 * (1 - (+pg.dataset.p) / 100)));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { if (b.dataset.f) { S.f = b.dataset.f; S.n = 40; } location.hash = '#/' + b.dataset.go; });
  if (S.tab === 'people') {
    plist(); let h; $('#q').oninput = e => { clearTimeout(h); h = setTimeout(() => { S.q = e.target.value; S.n = 40; plist(); }, 150); };
    $('#ch').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; S.f = b.dataset.f; S.n = 40; $('#ch').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); plist(); };
  }
}

/* ---------- Boot ---------- */
if (NCD_API.token() && NCD_API.user()) showShell(); else showLogin();
})();
