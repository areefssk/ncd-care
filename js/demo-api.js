/* โหมดสาธิต: ข้อมูลสมมติทั้งหมด ไม่เชื่อมฐานข้อมูลจริง ใช้ทดลองหน้าจอเท่านั้น (เปิดด้วย ?demo) */
const wait = (ms = 280) => new Promise(r => setTimeout(r, ms + Math.random() * 280));
const ApiErr = (code, message) => Object.assign(new Error(message), { code });

const F = ['สมศรี', 'มาลี', 'ปราณี', 'สุดา', 'วิไล', 'นภา', 'รัตนา', 'อรุณ', 'จันทร์เพ็ญ', 'พิมพ์ใจ', 'ศิริพร', 'กัลยา', 'บุษบา', 'ละออง'];
const M = ['สมชาย', 'ประเสริฐ', 'วิชัย', 'สมปอง', 'บุญมี', 'อนันต์', 'ธนา', 'สุเทพ', 'ประยูร', 'สมหมาย', 'วีระ', 'ชัยยา'];
const L = ['ตัวอย่าง', 'ทดสอบ', 'สาธิต', 'ใจดี', 'รักสุข', 'มั่นคง', 'สุขใจ', 'แสนดี', 'เจริญ', 'พึ่งบุญ'];
const AREAS = [['SAKO-01', 'ซากอ', 1, 373], ['SAKO-02', 'ซากอ', 2, 579], ['SAKO-03', 'ซากอ', 3, 417], ['SRI-01', 'ศรีสาคร', 1, 343],
  ['SRI-02', 'ศรีสาคร', 2, 293], ['SRI-05', 'ศรีสาคร', 5, 290], ['SRI-08', 'ศรีสาคร', 8, 180], ['SRI-10', 'ศรีสาคร', 10, 139]];
const SCREENED = { 'SAKO-01': 142, 'SAKO-02': 188, 'SAKO-03': 97, 'SRI-01': 120, 'SRI-02': 64, 'SRI-05': 71, 'SRI-08': 52, 'SRI-10': 30 };

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = a => a[Math.floor(rnd() * a.length)];
const daysFrom = n => new Date(Date.now() + n * 86400000).toISOString();

const S = {
  role: null, areaId: 'SAKO-01',
  people: Array.from({ length: 96 }, (_, i) => {
    const female = rnd() > 0.45;
    return { Person_ID: 'D' + String(i + 1).padStart(5, '0'), HN: String(1000 + i * 7).padStart(7, '0'), 'ชื่อ–นามสกุล': (female ? 'นาง' : 'นาย') + (female ? pick(F) : pick(M)) + ' ' + pick(L),
      'อายุ': String(35 + Math.floor(rnd() * 55)), 'เพศ': female ? 'หญิง' : 'ชาย', Area_ID: 'SAKO-01', 'ตำบล': 'ซากอ', 'หมู่': '1', 'อำเภอ': 'ศรีสาคร', Active: true, Screening_Status: i % 3 === 0 ? 'คัดกรองแล้ว' : 'ยังไม่คัดกรอง' };
  }),
  follows: [], refs: []
};
const P = i => S.people[i];
S.follows = [
  fu(1, 0, 'HT', 'RISK', '136/86', -6, 'OPEN'), fu(2, 3, 'DM', 'RISK', 'FBS 108', 4, 'OPEN'), fu(3, 6, 'HT', 'SUSPECTED', '148/94', 12, 'OPEN'),
  fu(4, 9, 'DM', 'SUSPECTED', 'RBS 212', 40, 'OPEN'), fu(5, 12, 'HT', 'RISK', '132/84', 70, 'OPEN'), fu(6, 15, 'HT', 'RISK', '134/86', -20, 'COMPLETED')
];
S.refs = [rf(1, 18, 'HT', 'BP 186/118 mmHg', 'OPEN'), rf(2, 21, 'DM', 'สงสัย DM ต้องยืนยันผล', 'ARRIVED')];
function fu(n, pi, disease, st, val, dueIn, status) {
  const p = P(pi);
  return { FollowUp_ID: 'FU-D' + n, Screening_ID: 'SCR-D' + n, Person_ID: p.Person_ID, Area_ID: 'SAKO-01', Disease: disease, FollowUp_Round: 1, Initial_Status: st, Initial_Value: val,
    Open_Date: daysFrom(dueIn - 90), Due_Date: daysFrom(dueIn), FollowUp_Status: status, Volunteer_ID: 'DEMO', Name: p['ชื่อ–นามสกุล'], HN: p.HN,
    Display_Status: status === 'COMPLETED' ? 'ดำเนินการแล้ว' : dueIn < 0 ? 'เกินกำหนด' : dueIn <= 14 ? 'ใกล้ครบกำหนด' : 'รอติดตาม' };
}
function rf(n, pi, disease, note, status) {
  const p = P(pi);
  return { Referral_ID: 'REF-D' + n, Person_ID: p.Person_ID, Disease: disease, Area_ID: 'SAKO-01', Referral_Date: daysFrom(-n * 2), Referral_Status: status, Destination: 'โรงพยาบาลศรีสาคร', Note: note, Name: p['ชื่อ–นามสกุล'], HN: p.HN };
}
const classifyHT = (s, d) => (s >= 180 || d >= 110 ? { status: 'SUSPECTED', urgent: true } : s >= 140 || d >= 90 ? { status: 'SUSPECTED' } : s >= 130 || d >= 85 ? { status: 'RISK' } : { status: 'NORMAL' });
const classifyDM = (v, f) => ((f && v < 70) ? 'RISK' : (f && v >= 126) || (!f && v >= 200) ? 'SUSPECTED' : (f && v >= 100) || (!f && v >= 140) ? 'RISK' : 'NORMAL');

export const api = {
  async volunteerLogin(cid) {
    await wait(500);
    if (!/^\d{13}$/.test(cid)) throw ApiErr('INVALID_CID', 'กรุณากรอกเลข CID 13 หลัก');
    S.role = 'VOLUNTEER'; S.areaId = 'SAKO-01';
    return { token: 'demo-token', expiresAt: daysFrom(0.5), user: { role: 'VOLUNTEER', actorId: 'DEMO', displayName: 'นางสาวสาธิต ใจดี', areaId: 'SAKO-01' } };
  },
  async adminLogin(u, p) {
    await wait(500);
    if (!u || !p) throw ApiErr('LOGIN_FAILED', 'กรุณากรอก Username และ Password');
    S.role = 'ADMIN';
    return { token: 'demo-token', expiresAt: daysFrom(0.5), user: { role: 'ADMIN', actorId: 'A-DEMO', displayName: 'เจ้าหน้าที่ตัวอย่าง', areaId: '' } };
  },
  async logout() { await wait(100); },
  async me() { await wait(); return { role: S.role, areaId: S.areaId }; },
  async areas() { await wait(); return AREAS.filter(a => S.role !== 'VOLUNTEER' || a[0] === S.areaId).map(a => ({ Area_ID: a[0], 'ตำบล': a[1], 'หมู่': a[2], 'อำเภอ': 'ศรีสาคร', Active: true })); },
  async people(o = {}) {
    await wait(420);
    const list = S.people.slice(0, o.limit || 5000);
    return { areaId: S.areaId, total: 373, count: list.length, limit: o.limit, screeningYear: '2570', screenedCount: 142 + S.people.filter(p => p.Screening_Status !== 'ยังไม่คัดกรอง').length - 32, people: list };
  },
  async followUps(o = {}) { await wait(); return { areaId: o.areaId || S.areaId, count: S.follows.length, followUps: S.follows }; },
  async referrals(o = {}) { await wait(); return { areaId: o.areaId || S.areaId, count: S.refs.length, referrals: S.refs }; },
  async dashboardSummary() {
    await wait(700);
    const areas = AREAS.map(a => ({ areaId: a[0], target: a[3], screened: SCREENED[a[0]], unscreened: a[3] - SCREENED[a[0]], coverage: Math.round(SCREENED[a[0]] / a[3] * 1000) / 10 }));
    const screened = areas.reduce((n, a) => n + a.screened, 0), target = areas.reduce((n, a) => n + a.target, 0);
    return { year: '2570', population: { target, screened, unscreened: target - screened, coverage: Math.round(screened / target * 1000) / 10 },
      ht: { normal: 455, risk: 181, suspected: 104, urgent: 24 }, dm: { normal: 552, risk: 148, suspected: 64 },
      areas, monthly: [78, 0, 0, 0, 0, 0, 0, 0, 0, 96, 148, 131].map((v, i) => [120, 104, 87, 0, 0, 0, 0, 0, 0, 96, 148, 131][i] ?? v),
      followUp: { open: 38 }, referral: { open: 7 }, cache: { hit: false, mode: 'DEMO' } };
  },
  async createScreening(p) {
    await wait(900);
    const person = S.people.find(x => x.Person_ID === p.personId);
    if (!person) throw ApiErr('PERSON_NOT_FOUND', 'ไม่พบประชาชนในฐานข้อมูล');
    if (person.Screening_Status !== 'ยังไม่คัดกรอง') throw ApiErr('ALREADY_SCREENED', 'บุคคลนี้มีผลคัดกรองในปี 2570 แล้ว');
    const rs = p.bpReadings, sbp = Math.round(rs.reduce((n, x) => n + x.sbp, 0) / rs.length), dbp = Math.round(rs.reduce((n, x) => n + x.dbp, 0) / rs.length);
    const ht = classifyHT(sbp, dbp), fasting = p.glucoseType === 'FBS', dm = classifyDM(p.glucoseValue, fasting);
    const id = 'SCR-' + Date.now(), gen = [];
    const mk = (disease, st, val) => { const f = fu(S.follows.length + 1, S.people.indexOf(person), disease, st, val, 90, 'OPEN'); f.FollowUp_ID = 'FU-' + Date.now() + disease; f.Screening_ID = id; S.follows.unshift(f); gen.push({ followUpId: f.FollowUp_ID, disease, dueDate: f.Due_Date, status: 'OPEN' }); };
    if (ht.status !== 'NORMAL' && !ht.urgent) mk('HT', ht.status, sbp + '/' + dbp);
    if (dm !== 'NORMAL') mk('DM', dm, (fasting ? 'FBS ' : 'RBS ') + p.glucoseValue);
    let referral = null;
    if (ht.urgent) { const r = rf(S.refs.length + 1, S.people.indexOf(person), 'HT', `BP ${sbp}/${dbp} mmHg`, 'OPEN'); r.Referral_ID = 'REF-' + Date.now(); S.refs.unshift(r); referral = { referralId: r.Referral_ID, disease: 'HT', priority: 'URGENT' }; }
    person.Screening_Status = 'คัดกรองแล้ว';
    return { screeningId: id, screeningYear: '2570', personId: p.personId, finalBP: { sbp, dbp }, htStatus: ht.status, dmStatus: dm,
      bmi: Math.round(p.weightKg / Math.pow(p.heightCm / 100, 2) * 10) / 10, followUps: gen, referral, clinicalRuleVersion: 'PENDING_FINAL', clinicalRulePending: true, message: 'บันทึกผลคัดกรองแล้ว (โหมดสาธิต)' };
  },
  async saveFollowUp(p) {
    await wait(700);
    const f = S.follows.find(x => x.FollowUp_ID === p.followUpId);
    if (!f) throw ApiErr('FOLLOWUP_NOT_FOUND', 'ไม่พบงานติดตาม');
    if (f.FollowUp_Status === 'COMPLETED') throw ApiErr('FOLLOWUP_ALREADY_COMPLETED', 'งานติดตามนี้ถูกบันทึกแล้ว');
    let result;
    if (f.Disease === 'HT') result = classifyHT(p.sbp, p.dbp).status; else result = classifyDM(p.glucoseValue, p.glucoseType === 'FBS');
    f.FollowUp_Status = 'COMPLETED'; f.Display_Status = 'ดำเนินการแล้ว';
    return { followUpId: f.FollowUp_ID, disease: f.Disease, followUpStatus: 'COMPLETED', result, clinicalRulePending: true };
  },
  async saveReferral(p) {
    await wait(600);
    const r = S.refs.find(x => x.Referral_ID === p.referralId);
    if (!r) throw ApiErr('REFERRAL_NOT_FOUND', 'ไม่พบรายการส่งต่อ');
    r.Referral_Status = p.referralStatus; if (p.note) r.Note = p.note;
    return { referralId: r.Referral_ID, referralStatus: r.Referral_Status };
  },
  async createReferral() { throw ApiErr('NOT_SUPPORTED', 'โหมดสาธิตไม่รองรับ'); }
};

/* โหมดสาธิต: รวมข้อมูลหน้าแรกให้เหมือน endpoint home ของ Backend */
api.home = async () => { const [areas, people, followUps, referrals] = await Promise.all([api.areas(), api.people({ limit: 5000 }), api.followUps({}), api.referrals({})]); return { areas, people, followUps, referrals }; };

/* โหมดสาธิต: รายงานข้อมูลสมมติ (ไม่ใช่ข้อมูลจริง) */
api.reportMeta = async () => ({ year: '2570', maxRows: 5000, areas: await api.areas(), volunteers: [{ id: 'DEMO1', name: 'นางสาวสาธิต ใจดี', areaId: 'SAKO-01' }, { id: 'DEMO2', name: 'นายตัวอย่าง รักสุข', areaId: 'SAKO-01' }] });
api.report = async p => {
  await wait(400);
  const areas = (await api.areas()).map(a => a.Area_ID), sts = ['NORMAL', 'RISK', 'SUSPECTED', 'URGENT'], dms = ['NORMAL', 'RISK', 'SUSPECTED'];
  const want = String(p.areas || '').split(',').filter(Boolean), grp = String(p.groups || '').split(',').filter(Boolean);
  const rows = Array.from({ length: 36 }, (_, i) => ({ screeningId: 'DEMO-' + i, date: '2026-10-' + String(1 + (i % 9)).padStart(2, '0'), time: '09:30:00', areaId: areas[i % areas.length], tambon: 'ซากอ', moo: String(1 + (i % 3)), hn: String(1000 + i).padStart(7, '0'), name: 'ตัวอย่าง คนที่ ' + (i + 1), age: 40 + (i % 30), sex: i % 2 ? 'ชาย' : 'หญิง', sbp: 110 + (i % 8) * 10, dbp: 70 + (i % 6) * 5, htGroup: sts[i % 4], glucoseType: i % 2 ? 'FBS' : 'RBS', glucose: 90 + (i % 7) * 15, dmStatus: dms[i % 3], bmi: 22.5, weight: 60, height: 160, volunteerId: 'DEMO1', volunteerName: 'นางสาวสาธิต ใจดี', fuHtDue: '', fuHtStatus: '', fuDmDue: '', fuDmStatus: '', cid: p.includeCid === false ? undefined : '000000000000' + (i % 10) }))
    .filter(r => (!want.length || want.includes(r.areaId)) && (!grp.length || grp.includes(r.htGroup) || grp.includes(r.dmStatus)));
  const z = () => ({ NORMAL: 0, RISK: 0, SUSPECTED: 0, URGENT: 0 }), ht = z(), dm = z(), byArea = {};
  rows.forEach(r => { ht[r.htGroup]++; dm[r.dmStatus]++; const a = (byArea[r.areaId] = byArea[r.areaId] || { areaId: r.areaId, tambon: r.tambon, moo: r.moo, total: 0, ht: z(), dm: z() }); a.total++; a.ht[r.htGroup]++; a.dm[r.dmStatus]++; });
  return { generatedAt: new Date().toISOString(), filters: { from: p.from || '', to: p.to || '', areas: want, volunteers: [], groups: grp, disease: p.disease || 'ANY', includeCid: p.includeCid !== false }, total: rows.length, truncated: false, maxRows: 5000, summary: { ht, dm, byArea: Object.values(byArea), byVolunteer: [{ id: 'DEMO1', name: 'นางสาวสาธิต ใจดี', total: rows.length }] }, rows };
};
api.reportExportLog = async () => ({ logged: true });

