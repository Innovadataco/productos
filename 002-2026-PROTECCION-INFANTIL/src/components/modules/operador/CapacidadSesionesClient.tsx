"use client";

/**
 * SPEC-750/T014 · Capacidad de sesiones para el ADMIN (contrato §5): las citas CONFIRMADAS que
 * quedaron SIN operador (el trigger no encontró operador libre) suben acá «antes del día» para
 * que un humano las resuelva. Reusa `/dashboard/admin/operadores/asignar`. Voz USTED. Sin PII
 * del padre (el endpoint proyecta). Muestra la hora REAL de cada cita — sin ventana horaria.
 */
import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";

type CitaSinOperador = {
    id: string;
    franja: { inicio: string; fin: string; modalidad: string };
    profesional: { nombreVisible: string };
};

function fmtInstante(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function CapacidadSesionesClient() {
    const [citas, setCitas] = useState<CitaSinOperador[] | null>(null);
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [asignando, setAsignando] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setError("");
        try {
            const res = await fetch("/api/admin/operadores/citas-sin-operador", { credentials: "include" });
            const json = (await res.json().catch(() => ({}))) as { data?: CitaSinOperador[]; error?: { message?: string } };
            if (res.ok) setCitas(json.data ?? []);
            else setError(json.error?.message ?? "Error cargando la capacidad de sesiones");
        } catch {
            setError("Error de red cargando la capacidad de sesiones");
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function asignar(id: string) {
        setAsignando(id);
        setAviso("");
        setError("");
        try {
            const res = await fetch(`/api/admin/operadores/asignar-cita/${id}`, { method: "POST", credentials: "include" });
            const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } };
            if (res.ok) {
                setAviso("Cita asignada a un operador libre.");
                await cargar();
            } else {
                setError(json.error?.message ?? "No se pudo asignar (¿sigue sin operador libre en esa hora?)");
            }
        } catch {
            setError("Error de red al asignar");
        } finally {
            setAsignando(null);
        }
    }

    return (
        <GlassCard className="p-4 sm:p-5 space-y-3">
            <div className="space-y-1">
                <h2 className="titulo text-body text-lg">Capacidad · sesiones sin operador</h2>
                <p className="cuerpo text-muted text-sm">
                    Citas confirmadas que quedaron sin operador libre en su hora. Resuélvalas antes del día.
                </p>
            </div>

            {error && <p className="cuerpo text-sm text-body">{error}</p>}
            {aviso && <p className="cuerpo text-sm text-muted">{aviso}</p>}

            {citas === null ? (
                <Cargando />
            ) : citas.length === 0 ? (
                <p className="cuerpo text-muted">No hay sesiones sin operador.</p>
            ) : (
                <ul className="space-y-2">
                    {citas.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde/40 pt-2 first:border-0 first:pt-0">
                            <span className="cuerpo text-body text-sm">
                                {fmtInstante(c.franja.inicio)} · {c.profesional.nombreVisible} · {c.franja.modalidad}
                            </span>
                            <Button onClick={() => asignar(c.id)} isLoading={asignando === c.id} disabled={asignando !== null}>
                                Asignar
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </GlassCard>
    );
}
