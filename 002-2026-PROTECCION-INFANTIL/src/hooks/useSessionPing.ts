"use client";

import { useEffect, useRef } from "react";

const PING_INTERVAL_MINUTOS = 5;
const PING_INTERVAL_MS = PING_INTERVAL_MINUTOS * 60 * 1000;

/**
 * Mantiene viva la sesión del usuario enviando un ping cada N minutos
 * mientras la pestaña esté visible (Page Visibility API).
 * SPEC-206 (002-PI-120).
 */
export function useSessionPing() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (typeof document === "undefined") return;

        async function ping() {
            if (document.visibilityState !== "visible") return;
            try {
                const res = await fetch("/api/session/ping", {
                    method: "POST",
                    credentials: "include",
                });
                if (!res.ok && res.status !== 401) {
                    console.warn("[SessionPing] Ping falló:", res.status);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Error desconocido";
                console.warn("[SessionPing] Error de red:", message);
            }
        }

        // Ping inmediato al montar si está visible.
        void ping();

        intervalRef.current = setInterval(() => {
            void ping();
        }, PING_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);
}
