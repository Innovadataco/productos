"use client";

/**
 * SPEC-351 (A-69 · D1 · T060) — carga del escudo institucional en Configuración.
 * SOLO PNG/JPG ≤ 500 KB (SVG prohibido — se valida por magia de bytes en el
 * servidor; acá solo restringimos el selector). Voz USTED.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function EscudoColegioUploader() {
    const [tieneEscudo, setTieneEscudo] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [mensaje, setMensaje] = useState("");
    const [version, setVersion] = useState(0); // cache-bust del preview
    const inputRef = useRef<HTMLInputElement | null>(null);

    const verificar = useCallback(async () => {
        try {
            const res = await fetch("/api/colegio/configuracion/escudo", { credentials: "include" });
            setTieneEscudo(res.ok);
        } catch {
            setTieneEscudo(false);
        }
    }, []);

    useEffect(() => {
        void verificar();
    }, [verificar]);

    const subir = useCallback(async (archivo: File) => {
        setSubiendo(true);
        setMensaje("");
        try {
            const form = new FormData();
            form.append("escudo", archivo);
            const res = await fetch("/api/colegio/configuracion/escudo", {
                method: "POST",
                credentials: "include",
                body: form,
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error?.message ?? "No pudimos guardar el escudo.");
            }
            setMensaje("Escudo guardado. Sus próximos informes saldrán membretados.");
            setVersion((v) => v + 1);
            await verificar();
        } catch (err) {
            setMensaje(err instanceof Error ? err.message : "No pudimos guardar el escudo.");
        } finally {
            setSubiendo(false);
        }
    }, [verificar]);

    return (
        <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
            <h2 className="font-medium text-body">Escudo del colegio</h2>
            <p className="mt-1 text-sm text-muted">
                Cargue el escudo institucional (PNG o JPG, máximo 500 KB). Todos los
                informes firmados salen membretados con él.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
                {tieneEscudo && (
                    // eslint-disable-next-line @next/next/no-img-element -- preview de un endpoint autenticado, next/image no aplica
                    <img
                        src={`/api/colegio/configuracion/escudo?v=${version}`}
                        alt="Escudo del colegio"
                        className="h-16 w-16 rounded-lg border border-tinta/10 object-contain dark:border-papel/10"
                    />
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void subir(f);
                        e.target.value = "";
                    }}
                />
                <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={subiendo}>
                    {subiendo ? "Subiendo…" : tieneEscudo ? "Cambiar escudo" : "Cargar escudo"}
                </Button>
                {mensaje && <span className="text-xs text-muted">{mensaje}</span>}
            </div>
        </section>
    );
}
