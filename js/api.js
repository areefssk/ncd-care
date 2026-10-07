/* NCD Care V2.1 — API connector (Phase 2)
 * timeout + retry (เฉพาะ GET) + ข้อความ error ภาษาไทย + จำข้อมูลล่าสุดในเครื่อง
 */
const NCD_API = (() => {
  const URL_ = 'https://script.google.com/macros/s/AKfycby8zASHAdvCSNq9EPFIV-8kE91a106O_5cnuLr8DiDOFddjQeVvL3_Kq1LXL1pjZz6-/exec';
  const K = { tok: 'ncd2_token', usr: 'ncd2_user', cache: 'ncd2_cache' };
  const TIMEOUT = 25000;
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
               del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
  const token = () => ls.get(K.tok) || '';
  const user = () => { try { return JSON.parse(ls.get(K.usr) || 'null'); } catch (e) { return null; } };
  const saveSession = d => { ls.set(K.tok, d.token); ls.set(K.usr, JSON.stringify(d.user || null)); };
  const clearSession = () => { ls.del(K.tok); ls.del(K.usr); ls.del(K.cache); };
  const cacheGet = () => { try { return JSON.parse(ls.get(K.cache) || 'null'); } catch (e) { return null; } };
  const cachePut = d => ls.set(K.cache, JSON.stringify({ at: Date.now(), d }));

  const MSG = { UNAUTHORIZED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
    LOGIN_FAILED: 'ไม่พบบัญชีนี้ หรือบัญชีถูกปิดใช้งาน', INVALID_CID: 'กรุณากรอกเลขบัตรประชาชน 13 หลัก' };
  function fail(code, message) { const e = new Error(MSG[code] || message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'); e.code = code; return e; }

  async function call(url, opts, retries) {
    for (let i = 0; ; i++) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT);
      try {
        const res = await fetch(url, Object.assign({ redirect: 'follow', signal: ctl.signal }, opts));
        const p = await res.json();
        if (!p || p.ok !== true) throw fail(p && p.error && p.error.code, p && p.error && p.error.message);
        return p.data;
      } catch (e) {
        if (e.code) { if (e.code === 'UNAUTHORIZED' || e.code === 'SESSION_EXPIRED') window.dispatchEvent(new Event('ncd:expired')); throw e; }
        if (i >= retries) throw fail('NETWORK', e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้า ลองใหม่อีกครั้ง' : 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต');
        await new Promise(r => setTimeout(r, 600 * (i + 1)));
      } finally { clearTimeout(t); }
    }
  }
  const get = (action, params = {}) => {
    const u = new URL(URL_); u.searchParams.set('action', action);
    Object.entries(Object.assign({ token: token() }, params)).forEach(([k, v]) => { if (v !== undefined && v !== '') u.searchParams.set(k, v); });
    return call(u.toString(), { method: 'GET' }, 2);
  };
  const post = (action, body = {}) => call(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: token() }, body)) }, 0);

  return { token, user, saveSession, clearSession, cacheGet, cachePut,
    volunteerLogin: cid => post('volunteerLogin', { cid, token: undefined }),
    adminLogin: (username, password) => post('adminLogin', { username, password, token: undefined }),
    home: () => get('home'), logout: () => post('logout').catch(() => {}) };
})();
