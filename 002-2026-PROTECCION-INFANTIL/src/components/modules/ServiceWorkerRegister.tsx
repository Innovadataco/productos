"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (process.env.NODE_ENV !== "production") return;
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("[PWA] Service Worker registrado:", registration.scope);
                })
                .catch((error) => {
                    console.error("[PWA] Error registrando Service Worker:", error);
                });
        }
    }, []);

    return null;
}
