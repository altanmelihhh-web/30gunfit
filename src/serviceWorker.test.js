/**
 * @jest-environment node
 */
/**
 * public/service-worker.js için davranış testi.
 *
 * Bu mantık sessizce bozulabilir: navigate isteği tarayıcının HTTP cache'inden
 * bayat index.html alırsa kullanıcı deploy edilen sürümü hiç görmez ve bunu
 * kimse fark etmez. Test, SW'yi sahte global'lerle yükleyip kayıtlı fetch
 * handler'ını doğrudan çağırıyor.
 */

const loadServiceWorker = () => {
  const listeners = {};
  const caches = {
    open: jest.fn(() => Promise.resolve({ addAll: jest.fn(() => Promise.resolve()), put: jest.fn(() => Promise.resolve()) })),
    keys: jest.fn(() => Promise.resolve([])),
    match: jest.fn(() => Promise.resolve(undefined)),
    delete: jest.fn(() => Promise.resolve(true))
  };

  global.self = {
    addEventListener: (type, handler) => { listeners[type] = handler; },
    location: { origin: 'https://gunfit-c0243.web.app' },
    skipWaiting: jest.fn(),
    clients: { claim: jest.fn() },
    registration: { showNotification: jest.fn() }
  };
  global.caches = caches;
  global.fetch = jest.fn();

  jest.isolateModules(() => {
    require('../public/service-worker.js');
  });

  return { listeners, caches };
};

const makeEvent = (request) => {
  let responded = null;
  return {
    request,
    respondWith: (p) => { responded = p; },
    waitUntil: () => {},
    getResponse: () => responded
  };
};

const makeResponse = (body = 'ok') => ({
  ok: true,
  clone: () => makeResponse(body),
  body
});

describe('service worker - navigate istekleri', () => {
  test('index.html her zaman ağdan ve HTTP cache atlanarak alınır', async () => {
    const { listeners } = loadServiceWorker();
    global.fetch.mockResolvedValue(makeResponse('taze-index'));

    const event = makeEvent({
      method: 'GET',
      mode: 'navigate',
      url: 'https://gunfit-c0243.web.app/'
    });
    listeners.fetch(event);
    await event.getResponse();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = global.fetch.mock.calls[0];
    // Bu olmadan tarayıcı bayat index.html döndürüp eski chunk'ları isteyebilir.
    expect(options).toEqual({ cache: 'no-store' });
  });

  test('ağ yoksa cache fallback devreye girer', async () => {
    const { listeners, caches } = loadServiceWorker();
    global.fetch.mockRejectedValue(new Error('offline'));
    caches.match.mockResolvedValue(makeResponse('cache-index'));

    const event = makeEvent({
      method: 'GET',
      mode: 'navigate',
      url: 'https://gunfit-c0243.web.app/'
    });
    listeners.fetch(event);
    const response = await event.getResponse();

    expect(response.body).toBe('cache-index');
  });
});

describe('service worker - statik dosyalar', () => {
  test('hashli asset cache-first okunur (ağa gidilmez)', async () => {
    const { listeners, caches } = loadServiceWorker();
    caches.match.mockResolvedValue(makeResponse('cached-chunk'));

    const event = makeEvent({
      method: 'GET',
      mode: 'no-cors',
      url: 'https://gunfit-c0243.web.app/assets/index-ABC123.js'
    });
    listeners.fetch(event);
    const response = await event.getResponse();

    expect(response.body).toBe('cached-chunk');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('service worker - müdahale sınırları', () => {
  test('cross-origin isteklere (Firestore, Gemini) dokunulmaz', () => {
    const { listeners } = loadServiceWorker();

    const event = makeEvent({
      method: 'GET',
      mode: 'cors',
      url: 'https://firestore.googleapis.com/v1/projects/x/databases'
    });
    listeners.fetch(event);

    expect(event.getResponse()).toBeNull();
  });

  test('GET olmayan isteklere dokunulmaz', () => {
    const { listeners } = loadServiceWorker();

    const event = makeEvent({
      method: 'POST',
      mode: 'cors',
      url: 'https://gunfit-c0243.web.app/api'
    });
    listeners.fetch(event);

    expect(event.getResponse()).toBeNull();
  });
});
