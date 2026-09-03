"use client";

/**
 * SPEC-408 · Cola 1 del Verificador · lista de solicitudes en revisión.
 * Diseño: tokens de globals.css. Instrument Serif para el título ("titular-h1"),
 * DM Mono para etiquetas técnicas ("font-mono" del sistema), motion suave
 * (transiciones opacity + translate al montar; hover con scale mínimo).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface FilaCola {
    solicitudId: string;
    profesionalId: string;
    nombreVisible: string;
    email: string;
    ciudadNombre: string;
    tituloProfesional: string;
    especialidades: string[];
    reintentos: number;
    esperandoDesde: string;
}

function tiempoRelativo(iso: string): string {
    const dif = Date.now() - new Date(iso).getTime();
    const min = Math.round(dif / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} días`;
}

export function VerificacionColaClient() {
    const [filas, setFilas] = useState<FilaCola[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const res = await fetch("/api/admin/verificacion-profesionales", { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { data: FilaCola[] };
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
                <p className="titular-seccion mb-2">No pudimos cargar la cola</p>
                <p className="cuerpo text-subtle">{error}</p>
            </div>
        );
    }

    if (filas === null) {
        return (
            <div className="animate-pulse space-y-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass h-24 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (filas.length === 0) {
        return (
            <div className="glass rounded-3xl p-10 text-center">
                <p className="titular-seccion mb-2">Cola vacía</p>
                <p className="cuerpo text-subtle">
                    No hay profesionales esperando verificación. Cuando llegue una solicitud, aparece acá.
                </p>
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {filas.map((f, i) => (
                <li
                    key={f.solicitudId}
                    className="anim-entrada"
                    style={{ animationDelay: `${i * 40}ms` }}
                >
                    <Link
                        href={`/dashboard/admin/verificacion/${f.solicitudId}`}
                        className="glass block rounded-2xl p-5 transition hover:scale-[1.005] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cielo"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <div>
                                <p className="titular-seccion">{f.nombreVisible}</p>
                                <p className="cuerpo text-subtle">{f.tituloProfesional} · {f.ciudadNombre}</p>
                            </div>
                            <div className="text-right">
                                <p className="microetiqueta">Esperando</p>
                                <p className="cifra text-body">{tiempoRelativo(f.esperandoDesde)}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {f.especialidades.slice(0, 4).map((e) => (
                                <span key={e} className="rounded-full bg-tinta/5 px-3 py-1 text-xs text-body">
                                    {e}
                                </span>
                            ))}
                            <span className="ml-auto font-mono text-xs text-subtle">
                                {f.reintentos > 0 ? `intento ${f.reintentos + 1}` : "primer envío"}
                            </span>
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
