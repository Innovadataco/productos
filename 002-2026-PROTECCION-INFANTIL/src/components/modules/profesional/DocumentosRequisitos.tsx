"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * SPEC-436 (I-304) · el bloque donde el profesional carga sus documentos.
 *
 * La lista NO está quemada: sale de `GET /api/profesional/documentos`, que la
 * deriva del parámetro `verificacion.requisitos`. Si mañana se agrega un quinto
 * requisito, aparece acá **sin tocar código** — que es exactamente para lo que
 * ese parámetro existe.
 *
 * Hasta esta spec, al Verificador se le pedía decidir sobre documentos que
 * nadie había recolectado: el formulario subía un solo archivo, la autorización.
 */

interface EstadoDocumento {
    clave: string;
    nombre: string;
    descripcion: string;
    cargado: boolean;
    /** SPEC-693: subiste una versión nueva que está esperando revisión. */
    enRevision: boolean;
    extension: string | null;
    subidoEn: string | null;
    /** SPEC-707: aprobado y bloqueado mientras la verificación está en revisión/devuelta. */
    bloqueado: boolean;
    /** SPEC-707: motivo que escribió el verificador si este documento fue devuelto. */
    observacion: string | null;
}

function IconCheck() {
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

export function DocumentosRequisitos() {
    const [docs, setDocs] = useState<EstadoDocumento[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [subiendo, setSubiendo] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch("/api/profesional/documentos", { credentials: "include" });
            if (!res.ok) {
                // I-410: mostrar el MENSAJE del servidor (p. ej. «Complete su perfil
                // antes de cargar documentos.»), no «HTTP 400». El respaldo solo si el
                // servidor no manda mensaje. Candado: pantalla-muestra-mensaje-servidor.
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                throw new Error(cuerpo?.error?.message ?? `El servidor respondió con un error (HTTP ${res.status}).`);
            }
            const json = (await res.json()) as { data: EstadoDocumento[] };
            setDocs(json.data);
        } catch (e) {
            // Se dice qué pasó: una lista vacía por error no puede parecer
            // «no hay requisitos» (lección I-294).
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function subir(clave: string, archivo: File) {
        setSubiendo(clave);
        setError(null);
        try {
            const form = new FormData();
            form.append("archivo", archivo);
            form.append("requisito", clave);
            const res = await fetch("/api/profesional/documentos", {
                method: "POST",
                credentials: "include",
                body: form,
            });
            if (!res.ok) {
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(cuerpo?.error?.message ?? `No se pudo subir (HTTP ${res.status}).`);
                return;
            }
            const json = (await res.json()) as { data: EstadoDocumento[] };
            setDocs(json.data);
        } catch (e) {
            console.error("[DocumentosRequisitos]", e);
            setError("No pudimos comunicarnos con el servidor. Revise su conexión e intente de nuevo.");
        } finally {
            setSubiendo(null);
        }
    }

    if (error && docs === null) {
        return (
            <p role="alert" className="text-sm text-ambar">
                No pudimos cargar la lista de documentos: {error}
            </p>
        );
    }
    if (docs === null) {
        return <p className="text-sm text-muted">Cargando la lista de documentos…</p>;
    }

    return (
        <div className="space-y-3">
            {docs.map((d, i) => (
                <div
                    key={d.clave}
                    className="anim-entrada rounded-xl bg-tinta/5 p-4"
                    style={{ animationDelay: `${i * 40}ms` }}
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-body">{d.nombre}</p>
                        {d.bloqueado ? (
                            // SPEC-707: aprobado por el verificador; no se reemplaza mientras la
                            // verificación sigue en revisión o con observaciones.
                            <span className="flex items-center gap-1 text-xs text-body">
                                <IconCheck />
                                Aprobado
                            </span>
                        ) : d.enRevision ? (
                            // SPEC-693 (FORMA §3): subió una versión nueva; sigue activo mientras se revisa.
                            <span className="text-xs font-medium text-estado-ambar">
                                En revisión — enviaste un documento nuevo
                            </span>
                        ) : d.cargado ? (
                            <span className="flex items-center gap-1 text-xs text-body">
                                <IconCheck />
                                Cargado
                            </span>
                        ) : (
                            <span className="text-xs text-subtle">Sin cargar</span>
                        )}
                    </div>
                    {d.descripcion && <p className="mt-1 text-xs text-muted">{d.descripcion}</p>}
                    {d.observacion && (
                        // SPEC-707: el MOTIVO que escribió el verificador, junto al documento
                        // devuelto. La forma del aviso la afina Diseño.
                        <p role="note" className="mt-2 rounded-lg bg-tinta/5 px-3 py-2 text-xs text-body">
                            <span className="font-semibold text-estado-ambar">Le devolvieron este documento. </span>
                            {d.observacion}
                        </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        {d.bloqueado ? (
                            // SPEC-707: aprobado → no se reemplaza mientras la verificación sigue
                            // en revisión (el servidor también lo rechaza). Solo el devuelto se sube.
                            <span className="text-xs text-muted">
                                Ya está aprobado. No necesita volver a subirlo mientras su verificación está en revisión.
                            </span>
                        ) : (
                            <input
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                aria-label={`Subir ${d.nombre}`}
                                disabled={subiendo !== null}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void subir(d.clave, f);
                                }}
                                className="text-sm"
                            />
                        )}
                        {subiendo === d.clave && <span className="text-xs text-muted">Subiendo…</span>}
                        {d.cargado && (
                            <a
                                href={`/api/profesional/documentos/${d.clave}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-body underline underline-offset-2"
                            >
                                Ver el que subiste
                            </a>
                        )}
                    </div>
                </div>
            ))}
            {error && (
                <p role="alert" className="text-sm text-ambar">
                    {error}
                </p>
            )}
        </div>
    );
}
