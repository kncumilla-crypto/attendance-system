const CACHE_NAME = 'attendance-system-v5';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // শুধু essential files, icons বাদ
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing (without icons)...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching essential files only');
        // প্রতিটি file আলাদাভাবে add করুন যাতে একটি fail করলে বাকিগুলো continue করে
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => 
              console.log(`Failed to cache ${url}:`, err)
            )
          )
        );
      })
      .then(() => {
        console.log('Install completed (ignoring missing files)');
        return self.skipWaiting();
      })
  );
});

// ... rest of the code same
