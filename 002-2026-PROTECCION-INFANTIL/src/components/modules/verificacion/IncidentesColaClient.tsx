"use client";

/**
 * SPEC-408 · Cola 2 — incidentes de citas autocerradas sin código.
 *
 * SPEC-427 le puso datos a la traza: dejó de decir "pendiente de instrumentar"
 * y ahora muestra lo que el brief §9 momento 6 exige que vea el Verificador —
 * cuántas veces se pidió cada código, si el correo salió, y si el profesional
 * lo digitó. Sin eso la cola veía el problema y no podía ver la causa.
 */
import { useEffect, useState } from "react";

interface EmisionEnTraza {
    tipo: "CITA" | "EXPEDIENTE";
    pedidoEn: string;
    expiraEn: string;
    usadoEn: string | null;
    intentosFallidos: number;
    envio: { estado: string; enviarEn: string | null; sentAt: string | null } | null;
}

interface FilaIncidente {
    solicitudId: string;
    padre: { email: string; nombre: string };
    profesional: { email: string; nombreVisible: string };
    fechaCita: string;
    montoTotal: number;
    estadoDesde: string;
    trazaCodigos: { cita: EmisionEnTraza[]; expediente: EmisionEnTraza[] };
}

function fmtFecha(iso: string): string {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}
function fmtMonto(n: number): string {
    return `$${n.toLocaleString("es-CO")}`;
}

/** Ícono de trazo: el código se digitó. Sin librerías, sin emoji. */
function IconoUsado() {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
            <path
                d="M3 8.5 6.5 12 13 4.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** Ícono de trazo: se pidió y nadie lo digitó. */
function IconoSinUsar() {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 5.4v3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

/**
 * La traza de un tipo de código. Es la pregunta que trae al Verificador a esta
 * pantalla: ¿el padre lo pidió?, ¿el correo salió?, ¿el profesional lo digitó?
 */
function Traza({ titulo, emisiones }: { titulo: string; emisiones: EmisionEnTraza[] }) {
    const usado = emisiones.some((e) => e.usadoEn !== null);
    return (
        <div className="rounded-xl bg-tinta/5 p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="microetiqueta">{titulo}</p>
                <span className={`flex items-center gap-1 text-xs ${usado ? "text-body" : "text-subtle"}`}>
                    {usado ? <IconoUsado /> : <IconoSinUsar />}
                    {usado ? "digitado" : "sin digitar"}
                </span>
            </div>
            {emisiones.length === 0 ? (
                <p className="cuerpo mt-2 text-xs text-subtle">Nunca se pidió.</p>
            ) : (
                <>
                    <p className="cuerpo mt-2 text-xs text-subtle">
                        Se pidió <span className="cifra">{emisiones.length}</span>{" "}
                        {emisiones.length === 1 ? "vez" : "veces"}.
                    </p>
                    <ul className="mt-1 space-y-1">
                        {emisiones.map((e, i) => (
                            <li
                                key={`${e.pedidoEn}-${i}`}
                                className="flex flex-wrap items-baseline gap-x-2 text-xs text-subtle anim-entrada"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <span className="cifra">{fmtFecha(e.pedidoEn)}</span>
                                <span>·</span>
                                <span>envío {e.envio ? e.envio.estado.toLowerCase() : "no programado"}</span>
                                {e.intentosFallidos > 0 && (
                                    <span className="palabra-estado">
                                        {e.intentosFallidos} intento{e.intentosFallidos === 1 ? "" : "s"} fallido
                                        {e.intentosFallidos === 1 ? "" : "s"}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
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
                <p className="cuerpo text-subtle">Ninguna cita se autocerró sin código. Todo cerró en su tiempo.</p>
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
                    <div className="mt-3">
                        {/* SPEC-427b agrega el panel del código de expediente cuando
                            exista quien lo emita. En 427 no se pinta: mostrar
                            «Nunca se pidió» sobre algo que no puede pedirse sería
                            un hecho falso ante quien adjudica el incidente (B6). */}
                        <Traza titulo="Código de cita" emisiones={f.trazaCodigos.cita} />
                    </div>
                </li>
            ))}
        </ul>
    );
}
