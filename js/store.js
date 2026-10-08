/* แคชในหน่วยความจำ: แสดงข้อมูลเดิมทันที แล้วโหลดใหม่เบื้องหลัง (ไม่เก็บข้อมูลบุคคลลงเครื่องถาวร) */
import { CONFIG } from './config.js';
const mem = new Map();
export async function cached(key, fetcher, { ttl = CONFIG.CACHE_TTL_MS, onData, force = false } = {}) {
  const hit = mem.get(key);
  if (hit && !force) onData?.(hit.data, { stale: Date.now() - hit.t > ttl });
  if (hit && !force && Date.now() - hit.t <= ttl) return hit.data;
  try {
    const data = await fetcher();
    mem.set(key, { t: Date.now(), data });
    onData?.(data, { stale: false });
    return data;
  } catch (e) {
    if (hit) { e.keptStale = true; onData?.(hit.data, { stale: true, error: e }); return hit.data; }
    throw e;
  }
}
export const invalidate = (...prefixes) => { for (const k of [...mem.keys()]) if (!prefixes.length || prefixes.some(p => k.startsWith(p))) mem.delete(k); };
export const clearAll = () => mem.clear();

/* ร่างฟอร์มคัดกรอง เก็บเฉพาะค่าตัวเลขใน sessionStorage กันข้อมูลหายเมื่อรีเฟรช */
const dk = id => 'ncd.draft.' + id;
export const draft = {
  get(id) { try { return JSON.parse(sessionStorage.getItem(dk(id)) || 'null'); } catch { return null; } },
  set(id, v) { try { sessionStorage.setItem(dk(id), JSON.stringify(v)); } catch {} },
  clear(id) { try { sessionStorage.removeItem(dk(id)); } catch {} }
};
