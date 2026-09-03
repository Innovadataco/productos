"use client";

/**
 * SPEC-408 · Cola 2 — incidentes de citas SIN_CONFIRMAR con la traza de códigos
 * a la vista. `trazaCodigos` viene cableada en null porque los códigos (brief
 * §9 momento 6) aún no están instrumentados; la UI muestra "pendiente" y no
 * miente sobre datos que no existen todavía.
 */
import { useEffect, useState } from "react";

interface FilaIncidente {
    solicitudId: string;
    padre: { email: string; nombre: string };
    profesional: { email: string; nombreVisible: string };
    fechaCita: string;
    montoTotal: number;
    estadoDesde: string;
    trazaCodigos: null;
}

function fmtFecha(iso: string): string {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}
function fmtMonto(n: number): string {
    return `$${n.toLocaleString("es-CO")}`;
}

export function IncidentesColaClient() {
    const [filas, setFilas] = useState<FilaIncidente[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const res = await fetch("/api/admin/verificacion-profesionales/incidentes", { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { data: FilaIncidente[] };
                if (vivo) setFilas(json.data);
            } catch (e) {
                if (vivo) setError(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => {
            vivo = false;
        };
    }, []);

    if (error) {
        return (
            <div className="glass rounded-2xl p-6 text-body">
                <p className="titular-seccion mb-2">No pudimos cargar los incidentes</p>
                <p className="cuerpo text-subtle">{error}</p>
            </div>
        );
    }
    if (filas === null) {
        return (
            <div className="animate-pulse space-y-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass h-20 rounded-2xl" />
                ))}
            </div>
        );
    }
    if (filas.length === 0) {
        return (
            <div className="glass rounded-3xl p-10 text-center">
                <p className="titular-seccion mb-2">Sin incidentes</p>
                <p className="cuerpo text-subtle">Ninguna cita quedó SIN_CONFIRMAR. Todo cerró en su tiempo.</p>
            </div>
        );
    }
    return (
        <ul className="space-y-3">
            {filas.map((f, i) => (
                <li
                    key={f.solicitudId}
                    className="glass rounded-2xl p-5 anim-entrada"
                    style={{ animationDelay: `${i * 40}ms` }}
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                            <p className="titular-seccion">
                                {f.padre.nombre} <span className="text-subtle">↔</span> {f.profesional.nombreVisible}
                            </p>
                            <p className="cuerpo text-subtle mt-1">
                                Cita del <span className="cifra">{fmtFecha(f.fechaCita)}</span> ·
                                {" "}{fmtMonto(f.montoTotal)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="microetiqueta">Sin confirmar desde</p>
                            <p className="cifra text-body">{fmtFecha(f.estadoDesde)}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-mono text-subtle">{f.padre.email}</span>
                        <span className="text-subtle">→</span>
                        <span className="font-mono text-subtle">{f.profesional.email}</span>
                    </div>
                    <div className="mt-3 rounded-xl bg-tinta/5 p-3 text-xs text-subtle">
                        {f.trazaCodigos === null
                            ? "Traza de códigos pendiente de instrumentar (SPEC-408 · brief §9 momento 6 futuro)."
                            : "Ver traza"}
                    </div>
                </li>
            ))}
        </ul>
    );
}
