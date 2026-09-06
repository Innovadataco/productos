"use client";

import { useEffect } from "react";

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
        const registrar = () => {
            navigator.serviceWorker.register("/sw.js").catch((error) => {
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
