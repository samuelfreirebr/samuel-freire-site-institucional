/* Notificações do painel do cliente (servidor/push.js, por site). Só mostra
   o aviso e, ao tocar, abre o /cliente/. Não guarda nada em cache. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { texto: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Website dashboard', { body: d.texto || '', icon: '/img/painel-192.png', badge: '/img/painel-192.png', data: { url: d.url || '/cliente/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/cliente/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
    const ja = abertas.find((c) => c.url.startsWith(self.location.origin + '/cliente'));
    return ja ? ja.navigate(url).then((c) => (c || ja).focus()) : self.clients.openWindow(url);
  }));
});
