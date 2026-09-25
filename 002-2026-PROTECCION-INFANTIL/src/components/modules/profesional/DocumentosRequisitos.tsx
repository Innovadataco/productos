"use client";

import { useCallback, useEffect, useState } from "react";
import { ModalCargaArchivo } from "@/components/modules/profesional/ModalCargaArchivo";

/**
 * SPEC-436 (I-304) · el bloque donde el profesional carga sus documentos.
 *
 * La lista NO está quemada: sale de `GET /api/profesional/documentos`, que la
 * deriva del parámetro `verificacion.requisitos`. Si mañana se agrega un quinto
 * requisito, aparece acá **sin tocar código**.
 *
 * SPEC-727: un profesional NUEVO sin perfil abre «completar» y esta sección hace el
 * GET al montar. Sin perfil ya NO es 400 (ensuciaba consola/monitoreo): el server
 * responde 200 `sinPerfil`, y acá se muestra el estado vacío legítimo.
 *
 * SPEC-726: el tope de tamaño es un parámetro (`tamanoMaxMb`, leído del MISMO valor
 * que valida el servidor). El cliente rechaza temprano con ese número + copy de
 * Diseño, y la subida usa el modal «nivel Dios» con barra de % real (XHR).
 */

interface EstadoDocumento {
    clave: string;
    nombre: string;
    descripcion: string;
    cargado: boolean;
    /** SPEC-693: subió una versión nueva que está esperando revisión. */
    enRevision: boolean;
    extension: string | null;
    subidoEn: string | null;
    /** SPEC-707: no se puede subir/reemplazar por ahora (aprobado, o solicitud en revisión). */
    bloqueado: boolean;
    /** SPEC-707: motivo que escribió el verificador si este documento fue devuelto. */
    observacion: string | null;
    /** SPEC-707: insignia de revisión (Diseño FORMA-SPEC707). */
    revision: "aprobado" | "devuelto" | "en_revision" | null;
}

const TIPOS_OK = ["application/pdf", "image/png", "image/jpeg"];
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * SPEC-726 · rechazo temprano en el CLIENTE (cortesía): mismo número (parámetro) y
 * mismo copy que el servidor. El servidor sigue siendo la verdad; esto solo evita
 * gastar una subida cuando ya se ve que no pasa.
 */
function rechazoTemprano(archivo: File, nombre: string, maxMb: number): string | null {
    if (archivo.size === 0) return "Ese archivo está vacío. Elija otro.";
    if (archivo.size > maxMb * 1024 * 1024) {
        return `Su ${lcFirst(nombre)} pesa más del máximo permitido (${maxMb} MB). Si es una foto, tómela con menos resolución o envíela como PDF.`;
    }
    if (archivo.type && !TIPOS_OK.includes(archivo.type)) {
        return "Formato no aceptado. Suba un PDF, PNG o JPG.";
    }
    return null;
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
    const [tamanoMaxMb, setTamanoMaxMb] = useState<number | null>(null);
    const [sinPerfil, setSinPerfil] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rechazo, setRechazo] = useState<{ clave: string; mensaje: string } | null>(null);
    const [modal, setModal] = useState<{ clave: string; nombre: string; archivo: File } | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch("/api/profesional/documentos", { credentials: "include" });
            if (!res.ok) {
                // I-410: mostrar el MENSAJE del servidor, no «HTTP 400». Candado:
                // pantalla-muestra-mensaje-servidor.
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                throw new Error(cuerpo?.error?.message ?? `El servidor respondió con un error (HTTP ${res.status}).`);
            }
            const json = (await res.json()) as { data: EstadoDocumento[]; tamanoMaxMb: number; sinPerfil?: boolean };
            setDocs(json.data);
            setTamanoMaxMb(json.tamanoMaxMb);
            setSinPerfil(json.sinPerfil === true);
        } catch (e) {
            // Se dice qué pasó: una lista vacía por error no puede parecer «no hay
            // requisitos» (lección I-294).
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function elegir(d: EstadoDocumento, archivo: File | undefined) {
        if (!archivo || tamanoMaxMb === null) return;
        const msg = rechazoTemprano(archivo, d.nombre, tamanoMaxMb);
        if (msg) {
            setRechazo({ clave: d.clave, mensaje: msg });
            return;
        }
        setRechazo(null);
        setModal({ clave: d.clave, nombre: d.nombre, archivo });
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
    // SPEC-727: sin perfil todavía — estado vacío legítimo (no un error), en usted.
    if (sinPerfil) {
        return (
            <p className="rounded-xl bg-tinta/5 p-4 text-sm text-muted">
                Guarde su ficha para poder cargar documentos.
            </p>
        );
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
                        {/* SPEC-707 (Diseño FORMA-SPEC707): la insignia por estado de la revisión. */}
                        {d.revision === "devuelto" ? (
                            <span className="text-xs font-medium text-estado-ambar">Devuelto</span>
                        ) : d.revision === "aprobado" ? (
                            <span className="flex items-center gap-1 text-xs text-pino">
                                <IconCheck />
                                Aprobado
                            </span>
                        ) : d.revision === "en_revision" ? (
                            <span className="text-xs font-medium text-estado-ambar">En revisión</span>
                        ) : d.enRevision ? (
                            <span className="text-xs font-medium text-estado-ambar">
                                En revisión — envió un documento nuevo
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
                    {d.revision === "devuelto" && d.observacion && (
                        <div role="note" className="mt-2 rounded-lg border-l-2 border-estado-ambar bg-tinta/5 px-3 py-2 text-xs text-body">
                            <p className="font-semibold text-estado-ambar">Qué revisar</p>
                            <p className="mt-1">«{d.observacion}»</p>
                        </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        {d.revision === "aprobado" ? (
                            <span className="text-xs text-muted">
                                Aprobado. Mientras revisamos su solicitud, este documento no se cambia.
                            </span>
                        ) : d.revision === "en_revision" ? null : (
                            <input
                                type="file"
                                accept="application/pdf,image/png,image/jpeg"
                                aria-label={`${d.revision === "devuelto" ? "Volver a subir" : "Subir"} ${d.nombre}`}
                                disabled={modal !== null}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = ""; // permite re-elegir el mismo archivo tras un rechazo
                                    elegir(d, f);
                                }}
                                className="text-sm"
                            />
                        )}
                        {d.cargado && (
                            <a
                                href={`/api/profesional/documentos/${d.clave}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-body underline underline-offset-2"
                            >
                                Ver el que subió
                            </a>
                        )}
                    </div>
                    {rechazo?.clave === d.clave && (
                        <p role="alert" className="mt-2 text-xs text-estado-ambar">
                            {rechazo.mensaje}
                        </p>
                    )}
                </div>
            ))}
            {error && (
                <p role="alert" className="text-sm text-ambar">
                    {error}
                </p>
            )}

            {/* SPEC-726 · modal de carga con barra de % real (XHR). Bloquea la ficha, permite
                cancelar, timeout por estancamiento, y muestra el error correcto en usted. */}
            {modal && (
                <ModalCargaArchivo
                    url="/api/profesional/documentos"
                    campos={{ requisito: modal.clave }}
                    archivo={modal.archivo}
                    requisitoNombre={lcFirst(modal.nombre)}
                    onExito={(resp) => {
                        const j = resp as { data?: EstadoDocumento[] } | null;
                        if (j?.data) setDocs(j.data);
                        setModal(null);
                    }}
                    onCerrar={() => setModal(null)}
                />
            )}
        </div>
    );
}
