"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { PendienteCaso } from "@/lib/colegio/seguimiento";

/**
 * SPEC-159 (US2, FR-005) — "Lo que falta que haga el rector": los pendientes
 * llegan computados del servidor (datos reales, nada hardcodeado). Los verbos
 * de estado llaman al endpoint EXISTENTE de cambio de estado (intacto); al
 * completarse todo, copy positivo — la calma también se muestra (§4.0.1).
 */

interface PendientesCasoProps {
    pendientes: PendienteCaso[];
    alertaId: string;
}

/** Botón del pendiente de estado: PATCH al endpoint existente y refresh. */
function AccionEstado({ alertaId, estado, texto }: { alertaId: string; estado: "vista" | "gestionada"; texto: string }) {
    const router = useRouter();
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function ejecutar() {
        if (enviando) return;
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/alertas/${alertaId}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "No pudimos actualizar la alerta.");
                return;
            }
            router.refresh();
        } catch {
            setError("Error de red actualizando la alerta.");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <Button variant="outline" className="min-h-12" isLoading={enviando} onClick={ejecutar}>
                {texto}
            </Button>
            {error ? <p className="text-sm text-estado-rubi">{error}</p> : null}
        </div>
    );
}

export function PendientesCaso({ pendientes, alertaId }: PendientesCasoProps) {
    if (pendientes.length === 0) {
        return (
            <section
                aria-label="Lo que falta por hacer"
                className="glass rounded-[var(--radio-card)] bg-pino/10 p-6 ring-1 ring-pino/30 sm:p-8"
            >
                <h2 className="titular-seccion text-body">Caso al día</h2>
                <p className="cuerpo mt-2 text-muted">Quedó registrado lo actuado — la vigilancia sigue activa.</p>
            </section>
        );
    }

    return (
        <section aria-label="Lo que falta por hacer" className="glass rounded-[var(--radio-card)] p-6 sm:p-8">
            <h2 className="titular-seccion text-body">Lo que falta por hacer</h2>
            <ul className="mt-4 space-y-3">
                {pendientes.map((pendiente) => (
                    <li key={pendiente.clave} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-body">{pendiente.texto}</p>
                        {pendiente.clave === "revisar" ? (
                            <AccionEstado alertaId={alertaId} estado="vista" texto="Marcar como vista" />
                        ) : pendiente.clave === "gestionar" ? (
                            <AccionEstado alertaId={alertaId} estado="gestionada" texto="Marcar gestionada" />
                        ) : (
                            <a
                                href="#bitacora"
                                className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-accent transition hover:underline"
                            >
                                Ir a la bitácora ↓
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
