// SPEC-906 (I-...) — Service worker con CACHE_NAME versionado por build + auto-actualización.
//
// Bug en prod: con un CACHE_NAME FIJO, tras un deploy (chunks con hash nuevo) el SW servía el shell/chunks
// viejos → ChunkLoadError en el login. Y el fetch handler devolvía `undefined` en una rama → «Failed to
// convert value to 'Response'». Arreglos:
//  (a) CACHE_NAME = proteccion-infantil-<v>, donde <v> viene del ?v= de la URL de registro (ServiceWorker
//      Register inyecta el SHA del build vía NEXT_PUBLIC_SW_VERSION). Tras un deploy el SW nuevo usa un
//      nombre distinto y purga los viejos en `activate`; skipWaiting()+clients.claim() toman control ya.
//  (b) Navegaciones/HTML en NETWORK-FIRST: nunca se sirve un shell cacheado que referencie chunks viejos.
//  (c) El fetch handler SIEMPRE resuelve a un Response válido (fallo de red → /offline o Response de error;
//      jamás undefined).
//  (d) Los SW ya instalados en navegadores se auto-sanan en la próxima visita: este archivo cambió de bytes,
//      el navegador reinstala, `activate` purga y claim toma control.

/** Versión del caché derivada del ?v= de la URL del SW (el SHA del build). Cambia por build → busta el caché. */
function versionDeLocation(href) {
    try {
        return new URL(href).searchParams.get("v") || "sin-version";
    } catch {
        return "sin-version";
    }
}

const CACHE_NAME = "proteccion-infantil-" + versionDeLocation(self.location.href);
const OFFLINE_URL = "/offline";
// SPEC-906: ya NO se precachea "/" (el shell de la portada referencia chunks con hash → fuente del stale).
const PRECACHE = [OFFLINE_URL, "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

/** Una request es "navegación" (documento HTML) si su mode es navigate o acepta text/html. */
function esNavegacion(request) {
    if (request.mode === "navigate") return true;
    const accept = request.headers.get("accept") || "";
    return request.method === "GET" && accept.includes("text/html");
}

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

// NETWORK-FIRST para navegaciones: SIEMPRE devuelve un Response (red → fresco; fallo → /offline o 503).
async function responderNavegacion(request) {
    try {
        return await fetch(request);
    } catch {
        const offline = await caches.match(OFFLINE_URL);
        return offline || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
}

// Assets cacheables: network-first con repoblación del caché; fallback a caché; SIEMPRE un Response (nunca
// undefined → la rama que rompía con «Failed to convert value to 'Response'» ya no existe).
async function responderActivo(request) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response("", { status: 504, statusText: "Sin conexión" });
    }
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
    const request = event.request;
    // (b) Navegación/HTML → network-first (nunca shell cacheado con chunks viejos).
    if (esNavegacion(request)) {
        event.respondWith(responderNavegacion(request));
        return;
    }
    // No cacheable y no navegación → el navegador la maneja normal (no se intercepta, no hay Response inválido).
    if (!shouldCache(request)) return;
    // (c) Cacheable → network-first + fallback, SIEMPRE Response.
    event.respondWith(responderActivo(request));
});
