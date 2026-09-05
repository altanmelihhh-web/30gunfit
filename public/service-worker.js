/* eslint-disable no-restricted-globals */

// Cache adını her önemli değişiklikte artır - eskisi activate sırasında otomatik silinir
const CACHE_NAME = '30gunfit-v5';

// Sadece adı hiç değişmeyen, stabil dosyalar - hashlenmiş JS/CSS burada YOK,
// onlar runtime'da kendi kuralıyla (isStaticAsset) cache'leniyor
const STATIC_CACHE_URLS = [
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .catch((error) => console.log('[Service Worker] Cache failed:', error))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => {
          console.log('[Service Worker] Deleting old cache:', name);
          return caches.delete(name);
        })
    ))
  );
  self.clients.claim();
});

const isSameOrigin = (url) => url.origin === self.location.origin;
const isStaticAsset = (url) => url.pathname.startsWith('/assets/') || /\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname);

const safeCachePut = (cache, request, response) => {
  if (request.method !== 'GET') return;
  if (!/^https?:$/.test(new URL(request.url).protocol)) return;
  cache.put(request, response).catch(() => {});
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Sadece kendi origin'imizdeki GET isteklerine müdahale et - Firestore/Auth/Gemini/Drive
  // gibi cross-origin API çağrılarına hiç dokunma, tarayıcı normal şekilde yönetsin
  // (bu aynı zamanda "Failed to execute 'put' on 'Cache'" hatalarının da kaynağıydı)
  if (request.method !== 'GET' || !isSameOrigin(url)) {
    return;
  }

  // Navigasyon istekleri (sayfa yüklemeleri) - önce ağa git, en güncel index.html'i al.
  // Deploy sonrası kullanıcı hep en son sürümü görsün diye. Sadece offline'ken cache'e düş.
  //
  // cache: 'no-store' şart: düz fetch() tarayıcının HTTP cache'ini kullanır ve
  // index.html oradan bayat gelebilir - bu durumda sayfa eski JS chunk adlarını
  // isteyip deploy edilen sürümü hiç görmez. Hosting header'ı da no-cache veriyor,
  // bu ikinci savunma hattı.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, responseToCache));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Hashlenmiş statik dosyalar (JS/CSS/görsel) - içerik değişirse dosya adı da değişir,
  // bu yüzden sonsuza kadar cache'den okumak güvenli
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => safeCachePut(cache, request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // Diğer same-origin istekler - direkt ağa git, sadece offline'da cache'e düş
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// Push bildirimleri için
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  const options = {
    body: event.data ? event.data.text() : 'Antrenman zamanı!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'workout-reminder',
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Antrenmana Başla',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Kapat',
        icon: '/logo192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('💪 30 Gün Fit', options)
  );
});

// Bildirim tıklama
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Periyodik arka plan senkronizasyonu (Experimental)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'workout-reminder') {
    event.waitUntil(checkWorkoutTime());
  }
});

async function checkWorkoutTime() {
  // Burada localStorage'a erişemiyoruz,
  // ancak IndexedDB veya Cache API kullanılabilir
  console.log('[Service Worker] Checking workout time...');
}

// Background Sync (Offline işlemler için)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts());
  }
});

async function syncWorkouts() {
  console.log('[Service Worker] Syncing workouts...');
  // Offline yapılan değişiklikleri senkronize et
}
