const CACHE = 'stelanes-emporio-v3';
const FICHEIROS_BASE = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/logo.jpg',
  '/capa.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHEIROS_BASE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;

  // nunca guardar em cache chamadas à API — precisam de estar sempre atualizadas
  if (request.url.includes('/api/')) {
    evento.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ erro: 'Sem ligação' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    })));
    return;
  }

  // páginas (HTML): tentar sempre a rede primeiro, para nunca mostrar uma versão desatualizada
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((respostaRede) => {
          const clone = respostaRede.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return respostaRede;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  evento.respondWith(
    caches.match(request).then((respostaCache) => {
      return (
        respostaCache ||
        fetch(request)
          .then((respostaRede) => {
            const clone = respostaRede.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
            return respostaRede;
          })
          .catch(() => caches.match('/'))
      );
    })
  );
});
