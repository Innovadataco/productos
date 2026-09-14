"use client";

/**
 * SPEC-693 (I-416) · Pantalla «documento nuevo» — el documento, NO la persona.
 * FORMA de Diseño (13-09): el vigente y el nuevo lado a lado (mismo peso), «Aceptar este
 * documento» / «Devolverlo» con observación obligatoria (el mismo candado que NO CUMPLE),
 * y —lo que hoy nadie dice— las DOS reglas del CEO EN PANTALLA: aceptar no mueve la
 * vigencia; devolver deja al profesional atendiendo con el anterior. Al devolver, la línea
 * a gerencia (único canal real). Ningún botón que abarque al profesional.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface DocumentoNuevoData {
    perfilProfesionalId: string;
    profesional: { nombreVisible: string; tituloProfesional: string; ciudadNombre: string };
    requisitoClave: string;
    requisitoNombre: string;
    venceEn: string | null;
    vigente: { subidoEn: string; aprobadoEn: string | null; aprobadoPor: string | null };
    nuevo: { subidoEn: string };
}

function IconDownload({ className = "h-4 w-4" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
    );
}

function fecha(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

type Modo = "idle" | "aceptar" | "devolver";

export function DocumentoNuevoClient({ data }: { data: DocumentoNuevoData }) {
    const router = useRouter();
    const [modo, setModo] = useState<Modo>("idle");
    const [observacion, setObservacion] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

    const base = `/api/admin/verificacion-profesionales/${data.perfilProfesionalId}/documentos/${data.requisitoClave}`;

    async function confirmar(decision: "APROBAR" | "DEVOLVER") {
        setEnviando(true);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/verificacion-profesionales/${data.perfilProfesionalId}/renovacion`, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    requisitoClave: data.requisitoClave,
                    decision,
                    observacion: decision === "DEVOLVER" ? observacion.trim() : "",
                }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
                throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
            }
            setMensaje({
                tipo: "ok",
                texto:
                    decision === "APROBAR"
                        ? "Documento aceptado. Queda como el vigente de este requisito."
                        : "Documento devuelto. El profesional sigue atendiendo con el anterior.",
            });
            setTimeout(() => router.push("/dashboard/admin/verificacion"), 1400);
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="space-y-6 anim-entrada">
            {/* Encabezado — el alcance, fijado en palabras */}
            <section className="glass rounded-3xl p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="titular-h1">{data.profesional.nombreVisible}</h1>
                    <span className="rounded-full bg-pino/10 px-3 py-1 text-xs font-medium text-estado-pino">
                        Atendiendo
                    </span>
                </div>
                <p className="cuerpo text-subtle mt-1">
                    {data.profesional.tituloProfesional} · {data.profesional.ciudadNombre}
                </p>
                <p className="cuerpo mt-4 text-body">
                    Está revisando <strong>un documento</strong>, no a la persona. Decida solo si este archivo
                    sirve para <strong>{data.requisitoNombre}</strong>.
                </p>
            </section>

            {/* Los dos documentos, lado a lado — mismo peso */}
            <section className="grid gap-4 sm:grid-cols-2">
                <article className="glass rounded-2xl p-5">
                    <p className="microetiqueta">El que está vigente</p>
                    <p className="cuerpo text-subtle mt-1">
                        Aprobado el {fecha(data.vigente.aprobadoEn)}
                        {data.vigente.aprobadoPor ? ` por ${data.vigente.aprobadoPor}` : ""}
                    </p>
                    <a
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-cielo/10 px-3 py-1.5 text-xs font-medium text-body transition hover:bg-cielo/20"
                        href={`${base}?version=vigente`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <IconDownload />
                        Ver documento
                    </a>
                </article>
                <article className="glass rounded-2xl p-5 ring-2 ring-cielo/20">
                    <p className="microetiqueta">El nuevo</p>
                    <p className="cuerpo text-subtle mt-1">Lo subió el {fecha(data.nuevo.subidoEn)}</p>
                    <a
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-cielo/10 px-3 py-1.5 text-xs font-medium text-body transition hover:bg-cielo/20"
                        href={`${base}?version=nuevo`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <IconDownload />
                        Ver documento
                    </a>
                </article>
            </section>

            {/* Acciones — por ESTE requisito y solo por este. Nada que abarque al profesional. */}
            <section className="glass rounded-2xl p-5 sm:p-6">
                {modo === "idle" && (
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setModo("aceptar")}
                            className="rounded-full bg-pino px-6 py-2 text-sm font-semibold text-white transition hover:bg-pino/90"
                        >
                            Aceptar este documento
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo("devolver")}
                            className="rounded-full bg-tinta/5 px-6 py-2 text-sm font-semibold text-body transition hover:bg-tinta/10"
                        >
                            Devolverlo
                        </button>
                    </div>
                )}

                {modo === "aceptar" && (
                    <div className="space-y-4">
                        {/* FORMA §3 · las dos reglas DICHAS, no escondidas. */}
                        <p className="cuerpo text-body">
                            Este archivo queda como el documento vigente de <strong>{data.requisitoNombre}</strong>.
                            {" "}<strong>El perfil no cambia de estado</strong> y{" "}
                            <strong>la fecha de vencimiento de su verificación sigue igual: {fecha(data.venceEn)}.</strong>{" "}
                            Para mover esa fecha hace falta una re-verificación completa.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={enviando}
                                onClick={() => confirmar("APROBAR")}
                                className="rounded-full bg-pino px-6 py-2 text-sm font-semibold text-white transition hover:bg-pino/90 disabled:opacity-50"
                            >
                                {enviando ? "Aceptando…" : "Confirmar: aceptar documento"}
                            </button>
                            <button
                                type="button"
                                disabled={enviando}
                                onClick={() => setModo("idle")}
                                className="rounded-full bg-tinta/5 px-6 py-2 text-sm font-medium text-subtle transition hover:bg-tinta/10 hover:text-body"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {modo === "devolver" && (
                    <div className="space-y-4">
                        <div>
                            <label className="microetiqueta block" htmlFor="obs-devolver">
                                Observación · obligatoria
                            </label>
                            <textarea
                                id="obs-devolver"
                                className="mt-1 w-full rounded-xl border border-tinta/15 bg-tinta/[0.03] p-3 text-sm text-body focus:outline-none focus:ring-2 focus:ring-cielo"
                                rows={3}
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                                placeholder="Qué debe corregir. El profesional lo recibe tal cual."
                            />
                        </div>
                        {/* FORMA §3 · la frase que más falta hace: devolver NO lo saca de circulación. */}
                        <p className="cuerpo text-body">
                            Le llega su observación y puede subir otro.{" "}
                            <strong>Sigue atendiendo con el documento anterior</strong>, que continúa aprobado.
                            Devolverlo <strong>no lo saca de circulación</strong>.
                        </p>
                        {/* FORMA §4 · el único canal que existe para algo más grave que un documento. */}
                        <p className="cuerpo text-subtle text-sm">
                            ¿Esto es más grave que un documento? Avise a{" "}
                            <a className="underline underline-offset-2" href="mailto:gerencia@innovadataco.com">
                                gerencia@innovadataco.com
                            </a>{" "}
                            — desde acá no se puede suspender a nadie.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={enviando || observacion.trim().length === 0}
                                onClick={() => confirmar("DEVOLVER")}
                                className={`rounded-full px-6 py-2 text-sm font-semibold text-white transition ${
                                    observacion.trim().length === 0
                                        ? "bg-tinta/30 cursor-not-allowed"
                                        : "bg-ambar hover:bg-ambar/90"
                                }`}
                            >
                                {enviando ? "Devolviendo…" : "Confirmar: devolver documento"}
                            </button>
                            <button
                                type="button"
                                disabled={enviando}
                                onClick={() => {
                                    setModo("idle");
                                    setObservacion("");
                                }}
                                className="rounded-full bg-tinta/5 px-6 py-2 text-sm font-medium text-subtle transition hover:bg-tinta/10 hover:text-body"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {mensaje && (
                <div
                    role="status"
                    className={`rounded-2xl p-4 anim-entrada ${
                        mensaje.tipo === "ok" ? "bg-pino/10 text-estado-pino" : "bg-rubi/10 text-estado-rubi"
                    }`}
                >
                    {mensaje.texto}
                </div>
            )}
        </div>
    );
}
