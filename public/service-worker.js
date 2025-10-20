/* eslint-disable no-restricted-globals */

// Cache ismi ve versiyonu
const CACHE_NAME = '30gunfit-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// Service Worker yüklendiğinde
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('[Service Worker] Cache failed:', error);
      })
  );
  // Yeni service worker'ı hemen aktif et
  self.skipWaiting();
});

// Service Worker aktif olduğunda
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Service worker'ı hemen kontrol altına al
  return self.clients.claim();
});

// Fetch istekleri
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache'de varsa onu döndür
        if (response) {
          return response;
        }
        // Yoksa network'ten çek
        return fetch(event.request).then((response) => {
          // Geçerli bir response değilse cache'leme
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Response'u klonla (stream sadece 1 kez okunabilir)
          const responseToCache = response.clone();

          // Yeni response'u cache'e ekle
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Network hatası, offline sayfası göster
          return caches.match('/index.html');
        });
      })
  );
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
