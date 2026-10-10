/* แผนที่พื้นที่ (Admin) — ขอบเขตหมู่จริงจาก Google My Maps · กดเลือกหมู่ · สลับตัวชี้วัด · แผนผัง/แผนที่จริง
 * เอฟเฟกต์: ลอยเข้าทีละหมู่, ยกตัวเมื่อชี้, โฟกัสหมู่ที่เลือก (เส้นประวิ่ง + แสงเรือง), คลื่นเมื่อกด,
 * จุดเตือนกะพริบ, เอียงตามเมาส์, แสงกวาดผ่านแผนที่, ตัวเลข/วงแหวนนับขึ้น */
import { h, icon, fmt, countUp } from './ui.js';
import { GEO, GEO_META as META } from './areageo.js';
import { isLite } from './fx.js';

const rm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = o => Object.values(o || {}).reduce((n, v) => n + (+v || 0), 0);
const abn = a => (a.ht ? a.ht.risk + a.ht.suspected + a.ht.urgent : 0), dab = a => (a.dm ? a.dm.risk + a.dm.suspected : 0);
const METRICS = {
  cov: { n: 'ความครอบคลุม', v: a => a.coverage / 100, f: v => Math.round(v * 100) + '%', fixed: 1, pal: ['#e4f4ea', '#0b7a57'] },
  ht: { n: 'ความดันผิดปกติ', v: a => (a.screened ? abn(a) / a.screened : 0), f: v => Math.round(v * 100) + '%', pal: ['#fff1d6', '#c2410c'], risk: 1 },
  dm: { n: 'เบาหวานผิดปกติ', v: a => (a.screened ? dab(a) / a.screened : 0), f: v => Math.round(v * 100) + '%', pal: ['#efe9ff', '#6d28d9'], risk: 1 },
  fu: { n: 'งานติดตามค้าง', v: a => a.followOpen || 0, f: v => v + ' ราย', pal: ['#fde8dc', '#b91c1c'], risk: 1 }
};
const mix = (a, b, t) => { const p = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };
const cssEsc = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
const MS = { metric: 'cov', view: 'svg', sel: null };   // จำสถานะไว้ตอนวาดหน้าใหม่

let leafP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafP) return leafP;
  document.head.append(h('link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css' }));
  return (leafP = new Promise((ok, no) => document.head.append(h('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', onload: () => ok(window.L), onerror: () => { leafP = null; no(new Error('โหลดแผนที่จริงไม่ได้ (ต้องต่ออินเทอร์เน็ต)')); } }))));
}

export function areaMap({ areas, labelOf, title = 'ความครอบคลุมรายพื้นที่', sub = 'กดที่หมู่เพื่อดูรายละเอียด · เปลี่ยนตัวชี้วัดได้' }) {
  const rows = (areas || []).filter(a => GEO[a.areaId]);
  if (!rows.length) return null;
  const by = Object.fromEntries(rows.map(a => [a.areaId, a])), risk = rows.some(a => a.ht && a.dm);
  if (!risk && MS.metric !== 'cov') MS.metric = 'cov';
  if (!MS.sel || !by[MS.sel]) MS.sel = rows.slice().sort((a, b) => (b.ht?.urgent || 0) - (a.ht?.urgent || 0) || b.target - a.target)[0].areaId;
  const lbl = id => labelOf(id) || id, tamb = id => (id.startsWith('SAKO') ? 1 : 2), short = id => lbl(id).replace(/^ต\.\S+\s*/, '');
  const scale = m => { const M = METRICS[m]; if (M.fixed) return 1; return Math.max(m === 'fu' ? 1 : 0.05, ...rows.map(a => M.v(a))); };
  const color = (a, m = MS.metric) => { const M = METRICS[m]; return mix(M.pal[0], M.pal[1], Math.min(1, M.v(a) / scale(m))); };
  const alerts = a => (a.ht?.urgent || 0) + (a.followLate || 0);

  /* ---------- โครง ---------- */
  const seg = h('div', { class: 'am-seg', role: 'tablist', 'aria-label': 'มุมมองแผนที่' });
  const chips = h('div', { class: 'am-chips', role: 'group', 'aria-label': 'ตัวชี้วัด' });
  const wrapSvg = h('div', { class: 'am-svgwrap' }), leaf = h('div', { class: 'am-leaf', hidden: true }), tip = h('div', { class: 'am-tip' });
  const fit = h('button', { class: 'am-fit', type: 'button', hidden: true, onclick: () => fitAll() }, icon('map'), 'ดูทั้งหมด');
  const legend = h('div', { class: 'am-leg' }), panel = h('aside', { class: 'am-panel' });
  const tilt = h('div', { class: 'am-tilt' }, wrapSvg, leaf, fit, tip);
  const stage = h('div', { class: 'am-stage' }, h('i', { class: 'am-mesh' }), h('i', { class: 'am-dots' }), tilt, h('i', { class: 'am-sheen' }), legend);
  const root = h('section', { class: 'panel amap rise' }, h('div', { class: 'am-head' }, h('div', {}, h('h3', {}, title), h('p', { class: 'sub' }, sub)), seg), chips, h('div', { class: 'am-body' }, stage, panel));

  /* ---------- SVG ---------- */
  const W = META.W, H = META.H, km = META.pxkm;
  const chipOf = (a, i) => {
    const g = GEO[a.areaId], w = 64, hh = 40;
    return `<g class="chip" data-id="${esc(a.areaId)}" transform="translate(${g.lx} ${g.ly})" style="--i:${i}"><g class="pin"><rect x="${-w / 2}" y="${-hh / 2}" width="${w}" height="${hh}" rx="12"/><text class="t1" y="-3">${esc(short(a.areaId))}</text><text class="t2" y="13"></text>${alerts(a) ? `<circle class="al-p" cx="${w / 2 - 4}" cy="${-hh / 2 + 4}" r="6"/><circle class="al" cx="${w / 2 - 4}" cy="${-hh / 2 + 4}" r="5.5"/>` : ''}</g></g>`;
  };
  wrapSvg.innerHTML = `<svg class="am-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="แผนที่หมู่บ้านและความคืบหน้า">
    <defs><radialGradient id="am-shine" cx="30%" cy="22%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient>
      <filter id="am-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <g class="shapes">${rows.map((a, i) => `<g class="vg t${tamb(a.areaId)}" style="--i:${i}"><path id="am-p-${esc(a.areaId)}" class="shape" data-id="${esc(a.areaId)}" tabindex="0" role="button" aria-label="${esc(lbl(a.areaId))}" d="${GEO[a.areaId].d}"/><path class="gloss" d="${GEO[a.areaId].d}"/></g>`).join('')}</g>
    <g class="top"><path class="hov" d=""/><path class="halo" d=""/><path class="ants" d=""/></g>
    <g class="chips">${rows.map(chipOf).join('')}</g><g class="rips"></g>
    <g class="deco"><path d="M${W - 34 - km * 2},${H - 24} h${km * 2}" class="sc"/><path d="M${W - 34 - km * 2},${H - 29} v10 M${W - 34},${H - 29} v10" class="sc"/><text class="sct" x="${W - 34 - km}" y="${H - 33}" text-anchor="middle">2 กม.</text><g transform="translate(${W - 36},38)"><path d="M0,-20 L9,9 L0,3 L-9,9Z" class="na"/><text class="sct" y="24" text-anchor="middle">N</text></g></g></svg>`;
  const svg = wrapSvg.firstChild, $s = q => svg.querySelector(q);
  const hov = $s('.hov'), halo = $s('.halo'), ants = $s('.ants'), rips = $s('.rips');

  /* ---------- ซ้อนทับ: ชี้ / เลือก ---------- */
  const dOf = id => GEO[id].d;
  function setHover(id) { if (!id) { hov.setAttribute('d', ''); return; } hov.setAttribute('d', dOf(id)); hov.style.fill = color(by[id]); }
  function setSel() { const d = dOf(MS.sel); halo.setAttribute('d', d); ants.setAttribute('d', d); }
  const tipText = a => `${lbl(a.areaId)} · ${METRICS[MS.metric].n} ${METRICS[MS.metric].f(METRICS[MS.metric].v(a))}${alerts(a) ? ` · ⚠ ${a.ht?.urgent ? 'เร่งด่วน ' + a.ht.urgent : ''}${a.ht?.urgent && a.followLate ? ' / ' : ''}${a.followLate ? 'ติดตามเกินกำหนด ' + a.followLate : ''}` : ''}`;
  function ripple(e) {
    if (rm()) return;
    try { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'rip'); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 8); c.addEventListener('animationend', () => c.remove()); rips.append(c); } catch { /* ไม่รองรับ */ }
  }
  svg.addEventListener('pointermove', e => {
    const t = e.target.closest?.('.shape'), r = tilt.getBoundingClientRect();
    if (!t) { setHover(null); tip.classList.remove('on'); return; }
    setHover(t.dataset.id); tip.textContent = tipText(by[t.dataset.id]); tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px'; tip.classList.add('on');
  });
  svg.addEventListener('pointerleave', () => { setHover(null); tip.classList.remove('on'); });
  svg.addEventListener('click', e => { const t = e.target.closest?.('.shape'); if (t) { ripple(e); pick(t.dataset.id); } });
  svg.addEventListener('keydown', e => { const t = e.target.closest?.('.shape'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(t.dataset.id); } });
  function pick(id) { if (id === MS.sel) return; MS.sel = id; paint(true); if (map) focusMap(id); }

  /* เอียงตามเมาส์ (เฉพาะจอที่มีเมาส์) */
  if (!rm() && matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove', e => { if (isLite()) return; const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; tilt.style.transform = `perspective(1200px) rotateX(${(-y * 3.2).toFixed(2)}deg) rotateY(${(x * 4.2).toFixed(2)}deg)`; });
    stage.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  /* ---------- แผนที่จริง (Leaflet) ---------- */
  let map = null, polys = {}, loading = false;
  const allLL = () => rows.flatMap(a => GEO[a.areaId].ll);
  function fitAll() { if (map) map.flyToBounds(window.L.latLngBounds(allLL()), { padding: [18, 18], duration: 0.9 }); }
  function focusMap(id) { if (map && polys[id]) map.flyToBounds(polys[id].getBounds(), { padding: [46, 46], duration: 0.9, maxZoom: 15 }); }
  function ensureMap() {
    if (map || loading) return; loading = true;
    leaf.replaceChildren(h('div', { class: 'am-msg' }, h('span', { class: 'spin' }), ' กำลังโหลดแผนที่…'));
    loadLeaflet().then(L => {
      leaf.replaceChildren(); map = L.map(leaf, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
      rows.forEach(a => { const p = L.polygon(GEO[a.areaId].ll, { weight: 2.5, color: tamb(a.areaId) === 1 ? '#0a4f3a' : '#1d5f86', fillOpacity: 0.62 }).addTo(map); p.on('click', () => pick(a.areaId)); p.on('mouseover', () => p.setStyle({ fillOpacity: 0.85 })); p.on('mouseout', () => p.setStyle({ fillOpacity: 0.62 })); p.bindTooltip('', { permanent: true, direction: 'center', className: 'am-lab', opacity: 1 }); polys[a.areaId] = p; });
      map.fitBounds(L.latLngBounds(allLL()), { padding: [18, 18] }); loading = false; paint();
    }).catch(err => { loading = false; leaf.replaceChildren(h('div', { class: 'am-msg' }, err.message, h('button', { class: 'btn small', type: 'button', onclick: () => { MS.view = 'svg'; paint(); } }, 'กลับไปแผนผัง'))); });
  }

  /* ---------- วาดตามสถานะ ---------- */
  const barW = (el, pct) => { el.style.width = '0%'; requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = pct + '%'; })); };
  function drawPanel(anim) {
    const a = by[MS.sel], ht = a.ht || {}, dm = a.dm || {}, scr = a.screened || 0;
    const stack = (parts, tot) => h('div', { class: 'am-stack' }, parts.map(([l, v, c]) => { const i = h('i', { style: { background: c }, title: `${l} ${v}` }); barW(i, tot ? v / tot * 100 : 0); return i; }));
    const leg = parts => h('div', { class: 'am-pl' }, parts.map(([l, v, c]) => h('em', { style: { '--c': c } }, `${l} ${fmt.n(v)}`)));
    const hp = [['ปกติ', ht.normal || 0, 'var(--ok,#1b8f5f)'], ['เสี่ยง', ht.risk || 0, 'var(--risk,#d99a1e)'], ['สงสัย', ht.suspected || 0, 'var(--sus,#d4560f)'], ['เร่งด่วน', ht.urgent || 0, 'var(--urg,#c62828)']];
    const dp = [['ปกติ', dm.normal || 0, 'var(--ok,#1b8f5f)'], ['เสี่ยง', dm.risk || 0, 'var(--risk,#d99a1e)'], ['สงสัย', dm.suspected || 0, 'var(--sus,#d4560f)']];
    const num = (v, cls = '') => { const b = h('b', { class: cls }, '0'); countUp(b, v, {}); return b; };
    const ring = h('div', { class: 'am-ring' });
    ring.innerHTML = '<svg viewBox="0 0 80 80"><circle class="tr" cx="40" cy="40" r="33"/><circle class="pg" cx="40" cy="40" r="33" pathLength="100"/></svg><b>0%</b>';
    const pg = ring.querySelector('.pg'); pg.style.strokeDasharray = '100'; pg.style.strokeDashoffset = '100';
    requestAnimationFrame(() => requestAnimationFrame(() => { pg.style.strokeDashoffset = String(100 - Math.min(100, a.coverage)); })); countUp(ring.querySelector('b'), a.coverage, { decimals: 1, suffix: '%' });
    panel.className = 'am-panel' + (anim ? ' swap' : '');
    panel.replaceChildren(
      h('div', { class: 'am-ph' }, h('div', {}, h('h4', {}, lbl(a.areaId)), h('small', {}, `${a.areaId} · ${GEO[a.areaId].km2} ตร.กม.`)), alerts(a) ? h('span', { class: 'am-badge' }, icon('alert'), 'ต้องติดตาม') : null),
      h('div', { class: 'am-pr' }, ring, h('div', {}, h('div', { class: 'am-line' }, num(scr), h('span', {}, ` / ${fmt.n(a.target)} คน`)), h('small', {}, `คัดกรองแล้ว · เหลือ ${fmt.n(Math.max(0, a.target - scr))} คน`))),
      risk ? h('div', { class: 'am-sec' }, h('b', {}, 'ผลความดัน (HT)'), stack(hp, sum(ht)), leg(hp), h('b', {}, 'ผลเบาหวาน (DM)'), stack(dp, sum(dm)), leg(dp)) : h('p', { class: 'muted small' }, 'ต้องอัปเดต Backend เพื่อดูผล HT/DM รายหมู่'),
      h('div', { class: 'am-kp' }, h('div', {}, num(a.followOpen || 0), h('span', {}, 'ติดตามค้าง')), h('div', { class: (a.followLate ? 'bad' : '') }, num(a.followLate || 0), h('span', {}, 'เกินกำหนด')), h('div', { class: (a.referralOpen ? 'bad' : '') }, num(a.referralOpen || 0), h('span', {}, 'ส่งต่อเปิดอยู่'))),
      h('a', { class: 'btn am-go', href: '#/admin/area/' + encodeURIComponent(a.areaId) }, 'ดูรายละเอียดหมู่นี้ ', icon('chevron')));
  }
  function paint(anim) {
    const M = METRICS[MS.metric];
    seg.replaceChildren(...[['svg', 'แผนผัง'], ['map', 'แผนที่จริง']].map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(MS.view === k), onclick: () => { MS.view = k; paint(); } }, l)));
    seg.style.setProperty('--n', 2); seg.style.setProperty('--idx', MS.view === 'map' ? 1 : 0);
    chips.replaceChildren(...Object.entries(METRICS).filter(([k, m]) => !m.risk || risk).map(([k, m]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(MS.metric === k), onclick: () => { MS.metric = k; paint(); } }, m.n)));
    // สี + ตัวเลขบนป้าย
    rows.forEach((a, i) => { const p = svg.querySelector(`#am-p-${cssEsc(a.areaId)}`); if (p) { p.style.transitionDelay = (i * 40) + 'ms'; p.setAttribute('fill', color(a)); } const t2 = svg.querySelector(`.chip[data-id="${cssEsc(a.areaId)}"] .t2`); if (t2) { t2.textContent = M.f(M.v(a)); t2.style.fill = mix(M.pal[0], M.pal[1], 1); } });
    svg.querySelectorAll('.chip').forEach(c => c.classList.toggle('sel', c.dataset.id === MS.sel)); setSel();
    legend.replaceChildren(h('span', { class: 'am-lg' }, h('b', {}, M.n), ' น้อย ', h('i', { class: 'gb', style: { background: `linear-gradient(90deg,${M.pal[0]},${M.pal[1]})` } }), ' มาก'), h('span', {}, h('i', { class: 'sw s1' }), 'ต.ซากอ'), h('span', {}, h('i', { class: 'sw s2' }), 'ต.ศรีสาคร'), rows.some(a => alerts(a)) ? h('span', { class: 'am-lgal' }, h('i', { class: 'al-d' }), 'มีเรื่องต้องติดตาม') : null);
    const real = MS.view === 'map'; wrapSvg.hidden = real; leaf.hidden = !real; fit.hidden = !real;
    if (real) { ensureMap(); if (map) { setTimeout(() => map.invalidateSize(), 30); rows.forEach(a => { const p = polys[a.areaId]; if (!p) return; p.setStyle({ fillColor: color(a), weight: a.areaId === MS.sel ? 5 : 2.5 }); p.setTooltipContent(`${short(a.areaId)} · ${M.f(M.v(a))}`); if (a.areaId === MS.sel) p.bringToFront(); }); } }
    drawPanel(anim);
  }
  paint();
  return root;
}
