"use client";

/**
 * SPEC-726 (FORMA-SPEC726-MODAL-CARGA-ARCHIVO) · el modal de carga «nivel Dios».
 *
 * Un solo componente para subir DOCUMENTOS y la AUTORIZACIÓN. Cablea la subida con
 * **`XMLHttpRequest.upload.onprogress`** para una **barra con % REAL** (`fetch` no da
 * progreso). Reglas de la forma, todas honestas (I-417 — el movimiento no miente):
 *  · Determinado (barra con %) es lo que se PUBLICA; el indeterminado solo aparece si
 *    `lengthComputable === false`. Ninguna barra avanza sola.
 *  · Al 100 % de subida, el texto pasa a «Guardando…» hasta el 2xx (subir ≠ procesado).
 *  · **Cancelar** → `xhr.abort()`, la ficha vuelve intacta (sin estado a medias).
 *  · **Timeout por ESTANCAMIENTO** (no por duración total) cuando hay %: si no llegan
 *    bytes en STALL_MS, se corta con el error de red — una subida lenta pero viva no
 *    se mata. En indeterminado, un tope total generoso.
 *  · Éxito → check en pino, la lista pasa a «En revisión», cierra. Error → en ámbar,
 *    dentro del modal, con Reintentar/Cerrar. El servidor manda el mensaje correcto.
 *
 * Modal SÓLIDO (superficie opaca) + velo `bg-tinta/55` + blur + z-50; hoja en móvil.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/** ~20 s sin recibir bytes = estancado (con %). No es un tope de duración total. */
const STALL_MS = 20_000;
/** Respaldo indeterminado (sin %): tope total generoso para no colgar indefinido. */
const TOPE_INDETERMINADO_MS = 120_000;

type Estado =
    | { fase: "cargando"; pct: number | null } // null = indeterminado (lengthComputable false)
    | { fase: "guardando" }
    | { fase: "exito" }
    | { fase: "error"; mensaje: string };

function fmtTam(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ModalCargaArchivo({
    url,
    campos,
    archivo,
    requisitoNombre,
    onExito,
    onCerrar,
}: {
    url: string;
    /** Campos de texto del multipart además de `archivo` (p. ej. `{ requisito: clave }`). */
    campos: Record<string, string>;
    archivo: File;
    /** Cómo nombrar lo que sube, en el encabezado del modal (p. ej. «su tarjeta profesional»). */
    requisitoNombre: string;
    /** Recibe el JSON del 2xx (la lista actualizada) para que el llamador refresque. */
    onExito: (respuesta: unknown) => void;
    onCerrar: () => void;
}) {
    const [estado, setEstado] = useState<Estado>({ fase: "cargando", pct: 0 });
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const stallRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const respuestaRef = useRef<unknown>(null);

    const limpiarStall = () => {
        if (stallRef.current) {
            clearTimeout(stallRef.current);
            stallRef.current = null;
        }
    };

    const iniciar = useCallback(() => {
        setEstado({ fase: "cargando", pct: 0 });
        respuestaRef.current = null;
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        const form = new FormData();
        for (const [k, v] of Object.entries(campos)) form.append(k, v);
        form.append("archivo", archivo);

        const errorRed = () => {
            limpiarStall();
            setEstado({ fase: "error", mensaje: "No pudimos subir el archivo. Revise su conexión e intente de nuevo." });
        };
        const armarStall = (ms: number) => {
            limpiarStall();
            stallRef.current = setTimeout(() => {
                xhr.abort();
                errorRed();
            }, ms);
        };

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                armarStall(STALL_MS); // llegaron bytes → reinicia el reloj de estancamiento
                const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
                setEstado(e.loaded >= e.total ? { fase: "guardando" } : { fase: "cargando", pct });
            } else {
                // Respaldo: sin señal de avance, un tope total generoso (no reinicia por byte).
                setEstado((prev) => (prev.fase === "cargando" ? { fase: "cargando", pct: null } : prev));
            }
        };
        xhr.upload.onload = () => {
            limpiarStall();
            setEstado((prev) => (prev.fase === "cargando" ? { fase: "guardando" } : prev));
        };
        xhr.onload = () => {
            limpiarStall();
            let json: unknown = null;
            try {
                json = JSON.parse(xhr.responseText);
            } catch {
                /* respuesta sin JSON */
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                respuestaRef.current = json;
                setEstado({ fase: "exito" });
            } else {
                const msg =
                    (json as { error?: { message?: string } } | null)?.error?.message ??
                    "No pudimos subir el archivo. Revise su conexión e intente de nuevo.";
                setEstado({ fase: "error", mensaje: msg });
            }
        };
        xhr.onerror = errorRed;
        xhr.onabort = limpiarStall;

        xhr.open("POST", url);
        xhr.withCredentials = true;
        // Arranca en indeterminado-largo hasta el primer `progress`; ahí pasa a estancamiento.
        armarStall(TOPE_INDETERMINADO_MS);
        xhr.send(form);
    }, [url, campos, archivo]);

    useEffect(() => {
        iniciar();
        return () => {
            xhrRef.current?.abort();
            limpiarStall();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Éxito: se muestra el latido y se cierra (auto ~1.2 s o con «Listo»).
    useEffect(() => {
        if (estado.fase !== "exito") return;
        const t = setTimeout(() => onExito(respuestaRef.current), 1200);
        return () => clearTimeout(t);
    }, [estado.fase, onExito]);

    function cancelar() {
        xhrRef.current?.abort();
        onCerrar();
    }

    const pct = estado.fase === "cargando" ? estado.pct : estado.fase === "guardando" ? 100 : 0;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-carga-titulo"
            className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/55 p-0 backdrop-blur-sm anim-entrada sm:items-center sm:p-4"
        >
            <div className="w-full max-w-md rounded-t-2xl bg-superficie-2 p-6 shadow-2xl ring-1 ring-tinta/10 sm:rounded-2xl">
                <h3 id="modal-carga-titulo" className="text-base font-semibold text-body">
                    {estado.fase === "exito" ? "Listo" : `Subiendo su ${requisitoNombre}`}
                </h3>
                <p className="mt-0.5 text-xs text-subtle">
                    {archivo.name} · {fmtTam(archivo.size)}
                </p>

                {(estado.fase === "cargando" || estado.fase === "guardando") && (
                    <div className="mt-4 space-y-2">
                        {estado.fase === "cargando" && estado.pct === null ? (
                            // Indeterminado (respaldo): barra en bucle, SIN número — no finge avanzar.
                            <div className="h-2 w-full overflow-hidden rounded-full bg-tinta/10">
                                <div className="h-full w-1/3 animate-pulse rounded-full bg-cielo" />
                            </div>
                        ) : (
                            <>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-tinta/10">
                                    <div
                                        className="h-full rounded-full bg-cielo transition-[width] duration-200"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <p className="cifra text-right text-xs text-subtle">{pct} %</p>
                            </>
                        )}
                        <p className="text-sm text-body">
                            {estado.fase === "guardando"
                                ? "Guardando…"
                                : estado.pct === null
                                    ? "Cargando…"
                                    : "Subiendo…"}
                        </p>
                        <div className="flex justify-end">
                            <Button variant="ghost" type="button" onClick={cancelar}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}

                {estado.fase === "exito" && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-pino">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pino/12">
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                        <span className="text-body">
                            Su {requisitoNombre} quedó cargado y <span className="font-medium">en revisión</span>.
                        </span>
                    </div>
                )}

                {estado.fase === "error" && (
                    <div className="mt-4 space-y-3">
                        <p role="alert" className="rounded-xl bg-ambar/10 p-3 text-sm text-estado-ambar">
                            {estado.mensaje}
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" type="button" onClick={onCerrar}>
                                Cerrar
                            </Button>
                            <Button type="button" onClick={iniciar}>
                                Reintentar
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
