"use client";

import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;

        // SPEC-533 (I-329): registrar el Service Worker para que el modo sin
        // conexión funcione (al caerse la red, navegar cae en /offline en vez de
        // ERR_INTERNET_DISCONNECTED). El SW (public/sw.js) YA excluye /dashboard,
        // /login, /registro, /mis-reportes, /api/ y los payloads RSC (shouldCache),
        // y hace skipWaiting + clients.claim: registrar NO revive el bug de cachés
        // obsoletas post-login que motivó el desregistro anterior (I-329 causa).
        //
        // SPEC-906: el registro lleva ?v=<versión del build> (NEXT_PUBLIC_SW_VERSION =
        // SHA del build, inyectado en build; fallback APP_VERSION). El SW deriva su
        // CACHE_NAME de ese ?v=, así que tras un deploy usa un caché nuevo y purga el
        // viejo en `activate` — sin ChunkLoadError por shell/chunks de un build previo.
        const version = process.env.NEXT_PUBLIC_SW_VERSION || APP_VERSION;
        const registrar = () => {
            navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`).catch((error) => {
                console.error("[PWA] Error registrando el Service Worker:", error);
            });
        };

        if (document.readyState === "complete") {
            registrar();
            return;
        }
        window.addEventListener("load", registrar);
        return () => window.removeEventListener("load", registrar);
    }, []);

    return null;
}
