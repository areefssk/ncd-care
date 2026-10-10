/* NCD Care service worker: เก็บเฉพาะไฟล์หน้าเว็บ (shell) ไว้เปิดเร็ว ไม่เก็บข้อมูลจาก API */
const VERSION = 'ncd-care-v7.1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/api.js', 'js/demo-api.js', 'js/store.js', 'js/ui.js', 'js/rules.js',
  'js/shell.js', 'js/splash.js', 'js/views/reports.js', 'js/areamap.js', 'js/areageo.js', 'js/fx.js', 'js/views/cases.js', 'js/views/login.js', 'js/views/volunteer.js', 'js/views/screening.js', 'js/views/admin.js',
  'assets/logo.png', 'assets/icon-192.png', 'assets/favicon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // API และฟอนต์ไปที่เครือข่ายตามปกติ
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || net; // เปิดจากแคชก่อน แล้วอัปเดตเบื้องหลัง
    })
  );
});
