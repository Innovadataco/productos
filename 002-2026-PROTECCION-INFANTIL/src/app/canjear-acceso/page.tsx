"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface SesionAbierta {
    tokenSesion: string;
    expiraEn: string;
}

/**
 * SPEC-584 (Fase 3) · «Canjear código»: pantalla compartida del padre y del
 * profesional. Digita el código que le pasó el padre dueño del reporte; al
 * canjearlo se abre una sesión de visualización de 15 min para leer el texto.
 */
export default function CanjearAccesoPage() {
    const [codigo, setCodigo] = useState("");
    const [sesion, setSesion] = useState<SesionAbierta | null>(null);
    const [texto, setTexto] = useState("");
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    async function canjear() {
        setCargando(true);
        setError("");
        try {
            const res = await fetch("/api/reportes/acceso/canjar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ codigo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo canjear el código.");
            setSesion(data);
            await leer(data.tokenSesion);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setCargando(false);
        }
    }

    async function leer(token: string) {
        const res = await fetch(`/api/reportes/acceso/ver?token=${encodeURIComponent(token)}`, {
            credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "No se pudo leer el texto.");
        setTexto(data.texto);
    }

    return (
        <main className="mx-auto max-w-2xl px-4 py-12">
            <h1 className="text-2xl font-bold text-body">Canjear código de acceso</h1>
            <p className="mt-2 text-sm text-muted">
                Digita el código que te compartió el padre o tutor. Al canjearlo podrás leer el texto del reporte
                durante 15 minutos.
            </p>

            {sesion ? (
                <div className="mt-6 space-y-3">
                    <p className="text-xs text-muted">
                        Sesión abierta hasta {new Date(sesion.expiraEn).toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}
                        .
                    </p>
                    {texto ? (
                        <div className="rounded-2xl border border-tinta/10 p-4">
                            <p className="text-sm whitespace-pre-line text-body">{texto}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted">Cargando texto...</p>
                    )}
                </div>
            ) : (
                <form
                    className="mt-6 space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void canjear();
                    }}
                >
                    <label className="block text-sm text-muted" htmlFor="codigo">
                        Código de acceso
                    </label>
                    <input
                        id="codigo"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        className="w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 text-body uppercase tracking-widest"
                        placeholder="ABCD2345"
                        autoComplete="off"
                    />
                    {error && <p className="text-xs text-estado-rubi">{error}</p>}
                    <Button type="submit" disabled={cargando || codigo.trim().length < 4}>
                        {cargando ? "Canjeando..." : "Canjear código"}
                    </Button>
                </form>
            )}
        </main>
    );
}
