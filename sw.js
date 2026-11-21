const CACHE_NAME = "hochantu-cache-v2";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./src/styles.css",
    "./src/app.js",
    "./manifest.json",
    "./assets/icons/app-icon.svg",
    "./assets/fonts/Inter-Regular.otf",
    "./assets/fonts/SF-Pro-Rounded-Bold.otf",
    "./assets/audio/true.wav",
    "./assets/audio/false.wav",
    "./data/set1_0_65.json",
    "./data/set2_65_85.json",
    "./data/set3_85_95.json",
    "./data/set4_95_100.json"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() =>
                caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                })
            )
    );
});
