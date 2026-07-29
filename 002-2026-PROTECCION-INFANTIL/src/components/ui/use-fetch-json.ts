"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SPEC-124 (R7) — Hook client de datos compartido.
 * Unifica la máquina de estados copy-paste:
 * `cargando` + `fetch(url, { credentials: "include" })` + `error` + `recargar`.
 *
 * Si `url` es null no se hace fetch (p.ej. esperando auth) y `cargando` queda
 * en true hasta que haya URL.
 */

type UseFetchJsonResult<T> = {
    datos: T | null;
    cargando: boolean;
    error: string | null;
    recargar: () => Promise<void>;
};

export function useFetchJson<T>(url: string | null, deps: readonly unknown[] = []): UseFetchJsonResult<T> {
    const [datos, setDatos] = useState<T | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const recargar = useCallback(async () => {
        if (!url) return;
        setCargando(true);
        setError(null);
        try {
            const res = await fetch(url, { credentials: "include" });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo cargar la información.");
                setDatos(null);
                return;
            }
            setDatos(data as T);
        } catch {
            setError("Error de red al cargar la información.");
            setDatos(null);
        } finally {
            setCargando(false);
        }
    }, [url]);

    useEffect(() => {
        if (!url) return;
        void recargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, recargar, ...deps]);

    return { datos, cargando, error, recargar };
}
