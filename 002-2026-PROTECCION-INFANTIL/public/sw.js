const CACHE_NAME = "proteccion-infantil-v2";
const OFFLINE_URL = "/offline";
const PRECACHE = ["/", OFFLINE_URL, "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

function shouldCache(request) {
    if (request.method !== "GET") return false;
    const url = new URL(request.url);
    // No cachear APIs ni rutas dinámicas/protegidas
    if (url.pathname.startsWith("/api/")) return false;
    if (url.pathname.startsWith("/dashboard")) return false;
    if (url.pathname.startsWith("/login") || url.pathname.startsWith("/registro") || url.pathname.startsWith("/mis-reportes")) return false;
    // No cachear payloads RSC de Next.js
    if (request.headers.get("RSC") === "1") return false;
    return true;
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (!shouldCache(event.request)) {
        // Para rutas dinámicas intentamos red primero; si falla, offline shell solo para navegación
        if (event.request.mode === "navigate") {
            event.respondWith(
                fetch(event.request).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("Offline", { status: 503 })))
            );
        }
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() =>
                caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === "navigate") {
                        return caches.match(OFFLINE_URL);
                    }
                    return undefined;
                })
            )
    );
});
