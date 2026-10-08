import { api, session, isDemo } from '../api.js';
import { clearAll } from '../store.js';
import { h, icon, seg } from '../ui.js';
import { CONFIG } from '../config.js';
import { go, canInstall, installApp } from '../shell.js';

const fmtCid = d => { d = d.replace(/\D/g, '').slice(0, 13); const p = [d.slice(0, 1), d.slice(1, 5), d.slice(5, 10), d.slice(10, 12), d.slice(12, 13)].filter(Boolean); return p.join('-'); };

export function loginView() {
  let mode = 'V', busy = false;
  const demo = isDemo();
  const err = h('div', { class: 'err-inline', hidden: true, role: 'alert' });
  const form = h('form', { class: 'login-form', novalidate: true, style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
  const btn = h('button', { class: 'cta', type: 'submit' }, 'เข้าสู่ระบบ');
  const tabs = seg([['V', 'อสม.'], ['A', 'เจ้าหน้าที่']], 'V', m => { mode = m; err.hidden = true; draw(); });

  function draw() {
    form.replaceChildren(...(mode === 'V' ? [
      h('div', { class: 'field rise' }, h('label', { for: 'cid' }, 'เลขประจำตัวประชาชน 13 หลัก'),
        h('input', { class: 'input num-t', id: 'cid', inputmode: 'numeric', autocomplete: 'off', maxlength: 17, placeholder: 'x-xxxx-xxxxx-xx-x', value: demo ? '0-0000-00000-00-0' : '', oninput: e => { e.target.value = fmtCid(e.target.value); e.target.classList.remove('bad'); } }))
    ] : [
      h('div', { class: 'field rise' }, h('label', { for: 'usr' }, 'ชื่อผู้ใช้'), h('input', { class: 'input', id: 'usr', autocomplete: 'username', value: demo ? 'admin' : '' })),
      h('div', { class: 'field rise', style: { '--i': 1 } }, h('label', { for: 'pwd' }, 'รหัสผ่าน'), h('input', { class: 'input', id: 'pwd', type: 'password', autocomplete: 'current-password', value: demo ? 'demo-password' : '' }))
    ]), err, btn);
  }
  draw();

  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    err.hidden = true;
    let call;
    if (mode === 'V') {
      const cid = form.querySelector('#cid').value.replace(/\D/g, '');
      if (cid.length !== 13) return fail('กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก', '#cid');
      call = () => api.volunteerLogin(cid);
    } else {
      const u = form.querySelector('#usr').value.trim(), p = form.querySelector('#pwd').value;
      if (!u || !p) return fail('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', u ? '#pwd' : '#usr');
      call = () => api.adminLogin(u, p);
    }
    busy = true; btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), 'กำลังตรวจสอบ...');
    try {
      const r = await call();
      clearAll(); session.set({ token: r.token, expiresAt: r.expiresAt, user: r.user });
      go(r.user.role === 'ADMIN' ? '#/admin' : '#/home');
    } catch (x) { fail(x.message || 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { busy = false; btn.disabled = false; btn.replaceChildren('เข้าสู่ระบบ'); }
  });
  function fail(msg, sel) {
    err.textContent = msg; err.hidden = false; err.style.animation = 'none'; void err.offsetWidth; err.style.animation = '';
    if (sel) form.querySelector(sel)?.classList.add('bad');
  }

  return h('div', { class: 'login' },
    h('i', { class: 'blob a' }), h('i', { class: 'blob b' }), h('i', { class: 'blob c' }),
    h('div', { class: 'login-card' },
      h('div', { class: 'login-logo' }, h('img', { src: 'assets/logo.png', alt: 'โลโก้โรงพยาบาลศรีสาคร', width: 104, height: 104 }), h('h1', {}, 'NCD Care'), h('p', {}, CONFIG.HOSPITAL + ' · คัดกรอง ติดตาม ส่งต่อ โรคไม่ติดต่อเรื้อรัง')),
      demo ? h('div', { class: 'demo-flag' }, 'โหมดสาธิต ข้อมูลทั้งหมดเป็นตัวอย่าง') : null,
      tabs, form,
      canInstall() ? h('button', { class: 'btn small', type: 'button', onclick: installApp }, icon('download'), 'ติดตั้งแอปลงเครื่อง') : null,
      h('p', { class: 'small muted center' }, 'เวอร์ชัน ' + CONFIG.VERSION)));
}
