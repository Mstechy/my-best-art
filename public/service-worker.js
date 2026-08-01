// MarketHub Service Worker v2
// Advanced caching: Stale-While-Revalidate for API, Cache-First for assets

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `markethub-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `markethub-images-${CACHE_VERSION}`;
const API_CACHE = `markethub-api-${CACHE_VERSION}`;
const FONT_CACHE = `markethub-fonts-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/placeholder.svg',
  '/hero-placeholder.svg',
];

// Max entries per cache to prevent unbounded storage
const MAX_CACHE_ENTRIES = {
  [STATIC_CACHE]: 50,
  [API_CACHE]: 100,
  [IMAGE_CACHE]: 200,
  [FONT_CACHE]: 30,
};

// Install: precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('markethub-') && !name.includes(CACHE_VERSION);
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: is a Supabase storage URL
function isStorageUrl(url) {
  return url.includes('.supabase.co/storage/');
}

// Helper: is a video file (video players use Range requests and must NOT be intercepted/cached)
function isVideoUrl(url) {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  return /\.(mp4|mov|webm|ogg|m4v)$/i.test(path) ||
         (isStorageUrl(url) && /\/video_/i.test(path));
}

// Helper: is an API/Supabase REST call
function isApiUrl(url) {
  return url.includes('.supabase.co/rest/') || 
         url.includes('.supabase.co/rpc/') ||
         url.includes('api.');
}

// Helper: is an image URL
function isImageUrl(url) {
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  return isStorageUrl(url) || 
         /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(path) ||
         path.includes('/render/image/');
}

// Helper: is a font URL
function isFontUrl(url) {
  return /\.(woff2?|ttf|otf|eot)$/i.test(url) || url.includes('fonts.googleapis');
}

// Fetch: intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || !url.startsWith('http')) return;

  // Videos: let the browser handle natively (Range requests, large streams — NEVER cache these)
  if (isVideoUrl(url)) return;

  // Fonts: cache-first (they rarely change)
  if (isFontUrl(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Images: cache-first with background refresh
  if (isImageUrl(url)) {
    event.respondWith(imageCacheStrategy(request));
    return;
  }

  // API calls: stale-while-revalidate (fast UI updates)
  if (isApiUrl(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Navigation requests: network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// Cache-First strategy
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Stale-While-Revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Network-First strategy (with fallback)
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page if available
    const offlinePage = await caches.match('/');
    if (offlinePage) return offlinePage;
    return new Response('Offline', { status: 503 });
  }
}

// Image-specific strategy: cache-first with background refresh
async function imageCacheStrategy(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  // Return cached immediately if available
  if (cached) {
    // Background refresh for images that might have changed
    fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {});
    return cached;
  }

  // Not in cache, fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { 
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}