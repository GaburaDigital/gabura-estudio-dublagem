// Service worker: guarda todos os arquivos do estúdio para funcionar sem internet.
// A versão do cache muda a cada publicação (o build do Vite escreve a versão e a lista de arquivos).
const CACHE = 'estudio-dublagem-__VERSAO__';
const ARQUIVOS = __ARQUIVOS__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('estudio-dublagem-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Primeiro o cache (rápido e offline); se não tiver, busca na rede.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html'))),
  );
});
