"use client";

/**
 * SPEC-400 (I-236) · PR 1 · Monta el interceptor de refresco de `sesion_estado`
 * en el layout raíz. Solo corre en el navegador; en SSR es un no-op porque el
 * `useEffect` no dispara.
 */
import { useEffect } from "react";
import { installSesionRefreshInterceptor } from "@/lib/http/sesion-refresh-interceptor";

export function SesionRefreshInterceptor(): null {
    useEffect(() => {
        installSesionRefreshInterceptor();
    }, []);
    return null;
}
