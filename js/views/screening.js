/* ฟอร์มคัดกรอง 4 ขั้น: ความดัน → น้ำตาล → น้ำหนัก/ส่วนสูง → สรุปและบันทึก
   ผลที่ขึ้นระหว่างกรอกเป็น "พรีวิว" ผลจริงมาจาก Backend หลังกดบันทึก */
import { api } from '../api.js';
import { invalidate, draft } from '../store.js';
import { h, icon, fmt, toast, openSheet, confetti, empty, errorBox, skel, initial, seg, levelPill } from '../ui.js';
import { LEVELS, MSG, ADVICE, classifyHT, classifyDM, needsThird, meanBP, bmi as calcBmi, fromServer } from '../rules.js';
import { go } from '../shell.js';
import { loadPeople } from './volunteer.js';

const STEP_NAMES = ['ความดัน', 'น้ำตาล', 'น้ำหนัก/สูง', 'สรุปผล'];
const SYMPTOMS = ['เจ็บหน้าอก', 'หายใจลำบาก', 'อ่อนแรงหรือชาครึ่งซีก', 'พูดไม่ชัด สับสน'];
const okSvg = () => { const t = document.createElement('template'); t.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return t.content.firstElementChild; };

export function screeningView(ctx) {
  const id = decodeURIComponent(ctx.params[0]);
  const root = h('div', { class: 'wiz' }, h('div', { class: 'wiz-body' }, skel(3)));
  loadPeople(d => {
    if (root.__dead || root.dataset.built) return;
    const p = (d.people || []).find(x => x.Person_ID === id);
    root.dataset.built = '1';
    if (!p) return root.replaceChildren(h('div', { class: 'wiz-body' }, empty('ไม่พบรายชื่อ', 'ไม่พบบุคคลนี้ในพื้นที่ของคุณ', 'users'), h('button', { class: 'cta', onclick: () => go('#/people') }, 'กลับไปรายชื่อ')));
    if (p.Screening_Status !== 'ยังไม่คัดกรอง') return root.replaceChildren(h('div', { class: 'wiz-body' }, empty('คัดกรองแล้ว', p['ชื่อ–นามสกุล'] + ' มีผลคัดกรองปีนี้แล้ว', 'check'), h('button', { class: 'cta', onclick: () => go('#/people') }, 'กลับไปรายชื่อ')));
    wizard(root, p, d);
  }).catch(e => root.replaceChildren(h('div', { class: 'wiz-body' }, errorBox(e.message, () => go('#/people')))));
  return root;
}

function wizard(root, p, list) {
  const S = draft.get(p.Person_ID) || { r: [['', ''], ['', ''], ['', '']], sym: [false, false, false, false], gType: 'FBS', g: '', w: '', ht: '', step: 0 };
  const save = () => draft.set(p.Person_ID, S);
  let step = Math.min(S.step || 0, 3), busy = false;

  /* ----- ค่าที่ตรวจสอบแล้ว ----- */
  const rd = i => { const s = parseInt(S.r[i][0], 10), d = parseInt(S.r[i][1], 10); return s > 0 && s < 300 && d > 0 && d < 200 ? { sbp: s, dbp: d } : null; };
  const bp = () => {
    const a = rd(0), b = rd(1), c = rd(2), need3 = !!(a && b && needsThird(a.sbp, b.sbp));
    const readings = [a, b, c].filter(Boolean);
    return { need3, ok: !!(a && b && (!need3 || c)), readings, mean: a && b ? meanBP(readings) : null };
  };
  const glu = () => { const v = Number(S.g); return S.g !== '' && v > 0 && v < 700 ? v : null; };
  const body = () => { const w = Number(S.w), ht = Number(S.ht); return S.w !== '' && S.ht !== '' && w > 20 && w < 300 && ht > 100 && ht < 230 ? { w, ht, bmi: calcBmi(w, ht) } : null; };
  const valid = [() => bp().ok, () => glu() != null, () => !!body(), () => true];

  /* ----- ส่วนประกอบซ้ำ ----- */
  const resultCard = () => {
    const el = h('div', { class: 'result r-wait', 'aria-live': 'polite' }, h('div', { class: 'sw' }, '–'), h('div', {}, h('b', {}, 'กรอกค่าเพื่อดูผลเบื้องต้น'), h('span', {}, '')));
    el.show = (level, big, note) => { el.className = 'result pop r-' + LEVELS[level].tone; el.firstChild.textContent = big; el.lastChild.firstChild.textContent = LEVELS[level].label; el.lastChild.lastChild.textContent = note; };
    el.wait = (t, n = '') => { el.className = 'result r-wait'; el.firstChild.textContent = '–'; el.lastChild.firstChild.textContent = t; el.lastChild.lastChild.textContent = n; };
    return el;
  };
  const numInput = (id, label, val, onIn, mode = 'numeric', ph = '–') => { const i = h('input', { class: 'num', id, inputmode: mode, placeholder: ph, value: val, 'aria-label': label, autocomplete: 'off' }); i.addEventListener('input', () => { onIn(i.value); save(); refresh(); }); return i; };

  /* ----- แต่ละขั้น ----- */
  const steps = [stepBP, stepGlu, stepBody, stepSummary];
  let refresh = () => {};
  const bodyEl = h('div', { class: 'wiz-body' });
  const backBtn = h('button', { class: 'btn', type: 'button', onclick: () => move(step - 1) }, icon('back'), 'ย้อนกลับ');
  const nextBtn = h('button', { class: 'cta', type: 'button', onclick: () => (step === 3 ? submit() : move(step + 1)) });
  const bars = h('div', { class: 'steps' }, [0, 1, 2, 3].map(() => h('i', {})));
  const labels = h('div', { class: 'steps-l' }, STEP_NAMES.map(n => h('span', {}, n)));
  const head = h('header', { class: 'wiz-head' },
    h('div', { class: 'who' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'ออกจากการคัดกรอง (ร่างจะถูกเก็บไว้)', onclick: () => go('#/people') }, icon('close')),
      h('div', {}, h('b', {}, p['ชื่อ–นามสกุล']), h('small', { class: 'muted' }, `อายุ ${p['อายุ'] || '—'} · HN ${p.HN || '—'}`)),
      levelPill('normal', 'คัดกรองปีนี้')), bars, labels);
  root.replaceChildren(head, bodyEl, h('footer', { class: 'wiz-foot' }, backBtn, nextBtn));

  function move(n, first) {
    const dir = n < step; step = Math.max(0, Math.min(3, n)); S.step = step; save();
    bodyEl.className = 'wiz-body' + (dir ? ' back' : '');
    bodyEl.replaceChildren(...steps[step]().filter(Boolean));
    [...bars.children].forEach((b, i) => b.classList.toggle('on', i <= step));
    [...labels.children].forEach((l, i) => l.classList.toggle('on', i === step));
    backBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
    nextBtn.replaceChildren(...(step === 3 ? [icon('check'), 'บันทึกผลคัดกรอง'] : ['ถัดไป: ' + STEP_NAMES[step + 1], icon('chevron')]));
    refresh(); if (!first) window.scrollTo({ top: 0 });
  }
  function gate() { nextBtn.disabled = busy || !valid[step](); }

  function stepBP() {
    const res = resultCard(), third = h('div', { class: 'note-box note-risk', hidden: true }, 'SBP สองครั้งแรกต่างกันเกิน 5 mmHg กรุณาวัดครั้งที่ 3'), warn = h('div', { class: 'small', style: { color: 'var(--risk)' }, hidden: true }, 'ค่าที่กรอกผิดปกติมาก กรุณาตรวจสอบการวัดอีกครั้ง');
    const emerg = h('div', { class: 'note-box note-urg', hidden: true }, h('b', {}, 'มีอาการเตือน '), 'ให้หยุดคัดกรองตามปกติ ประเมินและส่งต่อเร่งด่วนตามระบบฉุกเฉินของหน่วยบริการทันที');
    const rows = [0, 1, 2].map(i => [numInput(`s${i}`, `SBP ครั้งที่ ${i + 1}`, S.r[i][0], v => (S.r[i][0] = v)), numInput(`d${i}`, `DBP ครั้งที่ ${i + 1}`, S.r[i][1], v => (S.r[i][1] = v))]);
    const symp = h('details', { class: 'symp' }, h('summary', {}, 'มีอาการเตือนหรือไม่'), SYMPTOMS.map((t, i) => h('label', {}, h('input', { type: 'checkbox', checked: S.sym[i] || null, onchange: e => { S.sym[i] = e.target.checked; save(); refresh(); } }), t)));
    if (S.sym.some(Boolean)) symp.open = true;
    refresh = () => {
      const b = bp();
      third.hidden = !(b.need3 && !rd(2));
      rows[2].forEach(x => x.classList.toggle('need', b.need3 && !rd(2)));
      const out = S.r.flat().some(v => v !== '' && (Number(v) < 30 || Number(v) > 260));
      warn.hidden = !out; emerg.hidden = !S.sym.some(Boolean);
      if (b.mean && b.ok) { const l = classifyHT(b.mean.sbp, b.mean.dbp); res.show(l, `${b.mean.sbp}/${b.mean.dbp}`, MSG[l]); }
      else res.wait(b.need3 ? 'รอการวัดครั้งที่ 3' : 'กรอกค่าความดันอย่างน้อย 2 ครั้ง');
      gate();
    };
    return [h('h2', {}, 'วัดความดันโลหิต'), h('p', { class: 'help' }, 'วัดอย่างน้อย 2 ครั้ง ถ้า SBP ต่างกันเกิน 5 ให้วัดครั้งที่ 3'),
      h('div', { class: 'bpgrid' }, h('span', {}), h('span', { class: 'hd' }, 'บน (SBP)'), h('span', { class: 'hd' }, 'ล่าง (DBP)'),
        h('span', { class: 'lab' }, 'ครั้งที่ 1'), rows[0], h('span', { class: 'lab' }, 'ครั้งที่ 2'), rows[1],
        h('span', { class: 'lab' }, 'ครั้งที่ 3'), ...rows[2]), third, warn, symp, emerg, res];
  }
  function stepGlu() {
    const res = resultCard(), note = h('div', { class: 'note-box note-risk', hidden: true }, 'ค่าต่ำกว่า 70 ขณะอดอาหาร ระบบจัดเป็นกลุ่มเสี่ยงชั่วคราวและสร้างงานติดตาม เกณฑ์ข้อนี้รอเจ้าหน้าที่ยืนยัน');
    const t = seg([['FBS', 'อดอาหาร (FBS)'], ['RBS', 'ไม่อดอาหาร (RBS)']], S.gType, v => { S.gType = v; save(); refresh(); });
    const inp = numInput('glu', 'ค่าน้ำตาลในเลือด', S.g, v => (S.g = v), 'numeric', 'mg/dL');
    refresh = () => {
      const v = glu();
      if (v == null) res.wait('กรอกค่าน้ำตาล (mg/dL)');
      else { const r = classifyDM(v, S.gType === 'FBS'); res.show(r.level, String(v), MSG[r.level]); note.hidden = !r.low; }
      if (v == null) note.hidden = true; gate();
    };
    return [h('h2', {}, 'ตรวจน้ำตาลในเลือด'), h('p', { class: 'help' }, 'เลือกชนิดการตรวจให้ตรงกับที่ตรวจจริง'), t, h('div', { class: 'field' }, h('label', { for: 'glu' }, 'ค่าน้ำตาล (mg/dL)'), inp), note, res];
  }
  function stepBody() {
    const chip = h('div', { class: 'result r-wait' }, h('div', { class: 'sw' }, '–'), h('div', {}, h('b', {}, 'ดัชนีมวลกาย (BMI)'), h('span', {}, 'กรอกน้ำหนักและส่วนสูง')));
    const w = numInput('w', 'น้ำหนัก กิโลกรัม', S.w, v => (S.w = v), 'decimal', 'กก.'), ht = numInput('ht', 'ส่วนสูง เซนติเมตร', S.ht, v => (S.ht = v), 'decimal', 'ซม.');
    refresh = () => { const b = body(); if (b) { chip.className = 'result pop r-ok'; chip.firstChild.textContent = b.bmi; chip.lastChild.firstChild.textContent = 'BMI ' + b.bmi + ' กก./ตร.ม.'; chip.lastChild.lastChild.textContent = 'บันทึกค่าไว้กับผลคัดกรอง'; } else { chip.className = 'result r-wait'; chip.firstChild.textContent = '–'; chip.lastChild.firstChild.textContent = 'ดัชนีมวลกาย (BMI)'; chip.lastChild.lastChild.textContent = 'กรอกน้ำหนักและส่วนสูง'; } gate(); };
    return [h('h2', {}, 'น้ำหนักและส่วนสูง'), h('p', { class: 'help' }, 'ใช้คำนวณดัชนีมวลกายโดยอัตโนมัติ'),
      h('div', { class: 'bpgrid', style: { gridTemplateColumns: '1fr 1fr' } }, h('span', { class: 'hd' }, 'น้ำหนัก (กก.)'), h('span', { class: 'hd' }, 'ส่วนสูง (ซม.)'), w, ht), chip];
  }
  function stepSummary() {
    const b = bp(), v = glu(), bd = body();
    const hl = classifyHT(b.mean.sbp, b.mean.dbp), dl = classifyDM(v, S.gType === 'FBS').level;
    const card = (title, level, big) => h('div', { class: 'result r-' + LEVELS[level].tone }, h('div', { class: 'sw' }, big), h('div', {}, h('b', {}, `${title}: ${LEVELS[level].label}`), h('span', {}, MSG[level])));
    refresh = gate;
    return [h('h2', {}, 'ตรวจสอบก่อนบันทึก'),
      h('div', { class: 'card flat' }, [['ความดัน', b.readings.map(r => `${r.sbp}/${r.dbp}`).join(', ') + ' (เฉลี่ย ' + b.mean.sbp + '/' + b.mean.dbp + ')'], ['น้ำตาล', (S.gType === 'FBS' ? 'อดอาหาร ' : 'ไม่อดอาหาร ') + v + ' mg/dL'], ['น้ำหนัก / ส่วนสูง', `${bd.w} กก. / ${bd.ht} ซม.`], ['BMI', bd.bmi]].map(([k, val]) => h('div', { class: 'sum-row' }, h('span', {}, k), h('b', {}, val)))),
      card('ความดัน (HT)', hl, b.mean.sbp + '/' + b.mean.dbp), card('น้ำตาล (DM)', dl, String(v)),
      S.sym.some(Boolean) ? h('div', { class: 'note-box note-urg' }, h('b', {}, 'มีอาการเตือน: '), SYMPTOMS.filter((_, i) => S.sym[i]).join(', '), ' กรุณาส่งต่อฉุกเฉินก่อน (ระบบยังไม่เก็บอาการเตือนลงฐานข้อมูล)') : null,
      h('p', { class: 'small muted' }, 'ผลข้างต้นเป็นผลเบื้องต้น ผลที่บันทึกจริงคำนวณโดยระบบหลังบ้านและไม่ใช่การวินิจฉัยโรค')];
  }

  /* ----- บันทึก ----- */
  async function submit() {
    if (busy) return; busy = true; nextBtn.disabled = true; nextBtn.replaceChildren(h('span', { class: 'spin' }), 'กำลังบันทึก...');
    const b = bp(), bd = body();
    try {
      const r = await api.createScreening({ personId: p.Person_ID, bpReadings: b.readings, glucoseType: S.gType, glucoseValue: glu(), weightKg: bd.w, heightCm: bd.ht });
      draft.clear(p.Person_ID);
      p.Screening_Status = 'คัดกรองแล้ว'; list.screenedCount = (list.screenedCount || 0) + 1;
      invalidate('follow', 'ref', 'dash');
      success(r);
    } catch (e) {
      if (e.code === 'ALREADY_SCREENED') { p.Screening_Status = 'คัดกรองแล้ว'; draft.clear(p.Person_ID); toast(e.message, 'error'); return go('#/people'); }
      toast(e.message || 'บันทึกไม่สำเร็จ', 'error');
    } finally { busy = false; nextBtn.replaceChildren(icon('check'), 'บันทึกผลคัดกรอง'); gate(); }
  }
  function success(r) {
    const urgent = !!r.referral, hl = fromServer(r.htStatus, { urgent }), dl = fromServer(r.dmStatus);
    const worst = ['normal', 'risk', 'suspected', 'urgent'].indexOf(hl) >= ['normal', 'risk', 'suspected', 'urgent'].indexOf(dl) ? hl : dl;
    const nextP = (list.people || []).find(x => x.Screening_Status === 'ยังไม่คัดกรอง' && x.Person_ID !== p.Person_ID);
    const line = (t, level, big) => h('div', { class: 'result r-' + LEVELS[level].tone, style: { textAlign: 'left' } }, h('div', { class: 'sw' }, big), h('div', {}, h('b', {}, `${t}: ${LEVELS[level].label}`), h('span', {}, MSG[level])));
    const sh = openSheet({
      tall: true,
      body: h('div', { class: 'sheet-body' },
        h('div', { class: 'center' }, h('div', { class: 'ok-badge' }, okSvg()), h('h2', { style: { marginTop: '12px' } }, 'บันทึกผลคัดกรองแล้ว'), h('p', { class: 'muted' }, p['ชื่อ–นามสกุล'])),
        line('ความดัน (HT)', hl, `${r.finalBP.sbp}/${r.finalBP.dbp}`), line('น้ำตาล (DM)', dl, 'DM'),
        urgent ? h('div', { class: 'note-box note-urg' }, h('b', {}, 'สร้างรายการส่งต่อเร่งด่วนแล้ว '), 'กรุณาประสานโรงพยาบาลทันที') : null,
        (r.followUps || []).length ? h('div', { class: 'card flat' }, h('b', {}, 'งานติดตามที่สร้างให้'), (r.followUps || []).map(f => h('div', { class: 'sum-row' }, h('span', {}, f.disease === 'HT' ? 'ความดัน (HT)' : 'เบาหวาน (DM)'), h('b', {}, 'ภายใน ' + fmt.date(f.dueDate))))) : null,
        worst !== 'normal' ? h('div', { class: 'card flat' }, h('b', {}, 'คำแนะนำ 3อ 2ส'), h('div', { class: 'advice', style: { marginTop: '10px' } }, ADVICE.map(([k, t]) => h('div', {}, h('b', {}, k), t)))) : null,
        r.clinicalRulePending ? h('p', { class: 'small muted center' }, 'เกณฑ์การแปลผลยังเป็นเวอร์ชันทดสอบ (PENDING_FINAL)') : null),
      actions: [nextP ? h('button', { class: 'cta', onclick: () => { sh.close(); go('#/screen/' + encodeURIComponent(nextP.Person_ID)); } }, icon('plus'), 'คัดกรองคนถัดไป') : null, h('button', { class: 'btn', onclick: () => { sh.close(); go('#/home'); } }, 'กลับหน้าแรก')],
      onClose: () => go('#/home')
    });
    if (worst !== 'urgent') confetti();
  }
  move(step, true);
}
