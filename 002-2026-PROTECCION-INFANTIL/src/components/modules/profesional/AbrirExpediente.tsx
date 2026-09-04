"use client";

import { useState } from "react";

/**
 * SPEC-427b (A-75 · L6 · brief §9 momento 6) · abrir el expediente compartido.
 *
 * El padre eligió compartir su expediente y le dictó al profesional un segundo
 * código en la sesión. Acá el profesional lo digita; si coincide, se despliega
 * el expediente **en solo lectura** —las mismas cifras que ve el padre— y cada
 * apertura queda auditada (H-2).
 *
 * SPEC-425 dejó este bloque como una lista muerta («solo se listan»). 427b lo
 * vuelve accionable sin inventar una segunda vista: el contenido es el de la
 * capa 1 de SPEC-340.
 */

interface BloqueFranja {
    inicio: string;
    fin: string;
    conteo: number;
}
interface LecturaCapa1 {
    total: number;
    propios: number;
    ajenos: number;
    anonimos: number;
    franjas: { dominante: (BloqueFranja & { total: number }) | null };
    escalada: { primera: string; ultima: string } | null;
    aceleracion: { ultimos7: number; previos7: number } | null;
    alcance: { reporteros: number };
    perfil: { edadMin: number; edadMax: number } | null;
    ciudades: { masReciente: { ciudad: string | null } | null };
}
interface Respuesta {
    lectura: LecturaCapa1;
    hijoCruzado: { nombre: string; anioNacimiento: number | null; sexo: string | null } | null;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl bg-tinta/5 p-3">
            <p className="microetiqueta">{etiqueta}</p>
            <p className="cuerpo mt-1 text-body">{children}</p>
        </div>
    );
}

function Lectura({ r }: { r: Respuesta }) {
    const l = r.lectura;
    return (
        <div className="anim-entrada mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
                <Dato etiqueta="Hechos">
                    <span className="cifra">{l.total}</span>{" "}
                    <span className="text-subtle text-xs">({l.propios} tuyos · {l.ajenos} de otros)</span>
                </Dato>
                <Dato etiqueta="Quiénes reportaron">
                    <span className="cifra">{l.alcance.reporteros}</span>
                </Dato>
                <Dato etiqueta="Edad reportada">
                    {l.perfil ? (
                        <span className="cifra">
                            {l.perfil.edadMin === l.perfil.edadMax
                                ? l.perfil.edadMin
                                : `${l.perfil.edadMin}–${l.perfil.edadMax}`}
                        </span>
                    ) : (
                        <span className="text-subtle text-xs">sin dato</span>
                    )}
                </Dato>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <Dato etiqueta="Franja más frecuente">
                    {l.franjas.dominante ? (
                        <>
                            <span className="cifra">
                                {l.franjas.dominante.inicio}–{l.franjas.dominante.fin}
                            </span>{" "}
                            <span className="text-subtle text-xs">
                                ({l.franjas.dominante.conteo} de {l.franjas.dominante.total})
                            </span>
                        </>
                    ) : (
                        <span className="text-subtle text-xs">sin una franja que predomine</span>
                    )}
                </Dato>
                <Dato etiqueta="Últimos 7 días">
                    {l.aceleracion ? (
                        <span className="cifra">
                            {l.aceleracion.ultimos7} <span className="text-subtle text-xs">(antes {l.aceleracion.previos7})</span>
                        </span>
                    ) : (
                        <span className="text-subtle text-xs">sin aceleración</span>
                    )}
                </Dato>
            </div>
            {l.escalada && (
                <Dato etiqueta="Cambió de tipo">
                    de <span className="palabra-estado">{l.escalada.primera}</span> a{" "}
                    <span className="palabra-estado">{l.escalada.ultima}</span>
                </Dato>
            )}
            <p className="text-xs text-subtle">
                Estas son las mismas cifras que ve la familia, en solo lectura. No podés editar nada, y
                cada vez que lo abrís queda registrado.
            </p>
        </div>
    );
}

export function AbrirExpediente({ solicitudId, padreNombre }: { solicitudId: string; padreNombre: string }) {
    const [codigo, setCodigo] = useState("");
    const [enCurso, setEnCurso] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [datos, setDatos] = useState<Respuesta | null>(null);

    const completo = /^\d{6}$/.test(codigo);

    async function abrir() {
        setEnCurso(true);
        setError(null);
        try {
            const post = await fetch(`/api/profesional/citas/${solicitudId}/expediente`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo }),
            });
            if (!post.ok) {
                const cuerpo = (await post.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(cuerpo?.error?.message ?? `No se pudo abrir (HTTP ${post.status}).`);
                return;
            }
            const get = await fetch(`/api/profesional/citas/${solicitudId}/expediente`, {
                credentials: "include",
            });
            if (!get.ok) {
                setError(`Se abrió, pero no pudimos cargar el contenido (HTTP ${get.status}).`);
                return;
            }
            const json = (await get.json()) as { data: Respuesta };
            setDatos(json.data);
        } catch (e) {
            console.error("[AbrirExpediente]", e);
            setError("No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.");
        } finally {
            setEnCurso(false);
        }
    }

    return (
        <li className="rounded-xl bg-cielo/8 p-3">
            <p className="text-sm font-medium text-body">{padreNombre}</p>
            {datos ? (
                <Lectura r={datos} />
            ) : (
                <form
                    className="mt-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (completo && !enCurso) void abrir();
                    }}
                >
                    <label htmlFor={`exp-${solicitudId}`} className="microetiqueta">
                        Código de expediente
                    </label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                            id={`exp-${solicitudId}`}
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={6}
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="000000"
                            className="cifra w-28 rounded-xl border border-tinta/15 bg-transparent px-3 py-1.5 text-sm tracking-[0.3em] text-body outline-none transition focus:border-cielo"
                        />
                        <button
                            type="submit"
                            disabled={!completo || enCurso}
                            className="rounded-xl bg-cielo px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                            {enCurso ? "Abriendo…" : "Abrir en solo lectura"}
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                        Te lo dicta la familia en la sesión, aparte del código de la cita. Vence a los 30 minutos.
                    </p>
                    {error && (
                        <p role="alert" className="mt-2 text-xs text-ambar">
                            {error}
                        </p>
                    )}
                </form>
            )}
        </li>
    );
}
