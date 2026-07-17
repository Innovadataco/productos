"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;

        // Desregistrar service workers previos para evitar cachés obsoletas
        // que rompen navegación post-login y paneles admin.
        navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
            .then(() => {
                if ("caches" in window) {
                    return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
                }
            })
            .then(() => {
                console.log("[PWA] Service workers y cachés antiguos limpiados");
            })
            .catch((error) => {
                console.error("[PWA] Error limpiando Service Workers:", error);
            });
    }, []);

    return null;
}
