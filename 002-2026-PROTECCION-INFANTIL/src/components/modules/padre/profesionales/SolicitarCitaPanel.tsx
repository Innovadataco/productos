"use client";

/**
 * SPEC-428 (A-75 §9 M4) · Panel de reserva de cita del padre.
 *
 * Reemplaza el botón "Solicitar cita (próximamente)" de L3 con el flujo real:
 * elegir franja → confirmar pago (§4: se paga el PRECIO ESTÁNDAR, no la tarifa
 * del profesional — que aplica desde la 2ª cita) → decidir si comparte
 * expediente → cita creada en `SIN_CONFIRMAR` esperando aprobación de admin.
 *
 * Diseño: tokens del sistema. Instrument Serif títulos. DM Mono precios y
 * fechas. Motion suave con `anim-entrada`. Cero color crudo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { leerBorradorConsulta, borrarBorradorConsulta } from "@/lib/padre/borrador-consulta";

interface Franja {
    id: string;
    inicio: string;
    fin: string;
    modalidad: "VIRTUAL" | "PRESENCIAL";
}

interface Props {
    profesionalId: string;
    tarifaProfesionalCOP: number;
    precioEstandarPrimeraCitaCOP: number;
    duracionMinutos: number;
    /** Si el padre viene de un expediente, se propone compartirlo. */
    expedienteIdSugerido?: string | undefined;
    /**
     * SPEC-428 (M7): si viene, esta reserva es una REASIGNACIÓN — el pago se
     * hereda de la solicitud original (POST /citas/[id]/reasignar). El panel
     * oculta el toggle de compartir expediente (esa decisión ya está tomada
     * en la solicitud original y el service la propaga) y no vuelve a cobrar.
     */
    heredarDeSolicitudId?: string | undefined;
}

const CURRENCY_COP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

function fmtFranja(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function fmtRango(f: Franja): string {
    return `${fmtFranja(f.inicio)} — ${new Date(f.fin).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SolicitarCitaPanel({
    profesionalId,
    tarifaProfesionalCOP,
    precioEstandarPrimeraCitaCOP,
    duracionMinutos,
    expedienteIdSugerido,
    heredarDeSolicitudId,
}: Props) {
    const esReasignacion = Boolean(heredarDeSolicitudId);
    const router = useRouter();
    const [franjas, setFranjas] = useState<Franja[] | null>(null);
    const [cargaError, setCargaError] = useState<string | null>(null);
    const [franjaSel, setFranjaSel] = useState<Franja | null>(null);
    // SPEC-440 (I-306): estado inicial vacío; el useEffect al montar rellena
    // desde `sessionStorage` (el borrador que dejó el paso previo). No viene
    // por props ni por URL.
    const [presentacion, setPresentacion] = useState("");
    const [urgencia, setUrgencia] = useState<"ESTA_SEMANA" | "SIN_APURO">("SIN_APURO");
    const [compartirExpediente, setCompartirExpediente] = useState(Boolean(expedienteIdSugerido));
    const [modalAbierto, setModalAbierto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

    const cargarFranjas = useCallback(async () => {
        setCargaError(null);
        try {
            const res = await fetch(`/api/publico/profesionales/${profesionalId}/franjas`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { data: Franja[] };
            setFranjas(json.data);
        } catch (e) {
            setCargaError(e instanceof Error ? e.message : String(e));
        }
    }, [profesionalId]);

    useEffect(() => {
        void cargarFranjas();
    }, [cargarFranjas]);

    // SPEC-440 (I-306): al montar, rellenar desde el borrador de sessionStorage
    // (dejado por `PresentacionUrgenciaForm`). Solo aplica al alta nueva; en
    // reasignación la presentación viaja desde la solicitud original.
    useEffect(() => {
        if (esReasignacion) return;
        const borrador = leerBorradorConsulta();
        if (borrador) {
            setPresentacion(borrador.presentacion);
            setUrgencia(borrador.urgencia);
        }
    }, [esReasignacion]);

    // En reasignación la presentación ya está en la solicitud original —
    // el service la propaga y la cita nueva la hereda; el panel no la exige.
    const presentacionValida = esReasignacion || presentacion.trim().length >= 20;
    const puedeContinuar = franjaSel !== null && presentacionValida;

    async function enviar() {
        if (!franjaSel) return;
        setEnviando(true);
        setErrorEnvio(null);
        try {
            const url = esReasignacion
                ? `/api/padre/citas/${encodeURIComponent(heredarDeSolicitudId!)}/reasignar`
                : "/api/padre/citas";
            const body: Record<string, unknown> = esReasignacion
                ? { nuevoProfesionalId: profesionalId, nuevaFranjaId: franjaSel.id }
                : {
                    profesionalId,
                    franjaId: franjaSel.id,
                    presentacion: presentacion.trim(),
                    urgencia,
                };
            if (!esReasignacion && compartirExpediente && expedienteIdSugerido) {
                body.expedienteCompartidoId = expedienteIdSugerido;
            }
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = (await res.json().catch(() => ({}))) as {
                data?: { id: string };
                error?: { message?: string };
            };
            if (!res.ok || !json.data?.id) {
                throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            }
            // SPEC-440 (I-306): la solicitud quedó registrada — el borrador
            // ya cumplió su misión. Lo limpiamos para no arrastrarlo a la
            // próxima búsqueda (ni dejar PII rondando en sessionStorage).
            borrarBorradorConsulta();
            router.push(`/dashboard/padre/citas/${json.data.id}`);
        } catch (e) {
            setErrorEnvio(e instanceof Error ? e.message : String(e));
        } finally {
            setEnviando(false);
        }
    }

    const nombreFranjaSel = useMemo(() => (franjaSel ? fmtRango(franjaSel) : ""), [franjaSel]);

    return (
        <section aria-labelledby="reservar" className="glass rounded-2xl p-5 anim-entrada">
            <h2 id="reservar" className="text-sm font-semibold text-body">Solicitar cita</h2>
            <p className="mt-1 text-xs text-muted">
                Elige una franja libre. El pago se aprueba luego con un admin;
                mientras tanto la franja queda reservada.
            </p>

            {/* Precio estándar por delante — el que se paga (§4). La tarifa
                del profesional es informativa (aplica desde la 2ª cita).
                SPEC-428 (M7): si es reasignación (heredar pago), no cobra. */}
            <div className="mt-3 rounded-xl bg-pino/10 p-3">
                <p className="text-[11px] uppercase tracking-wide text-estado-pino">
                    {esReasignacion ? "Pago heredado" : "Costo de esta cita"}
                </p>
                <p className="cifra text-2xl font-bold text-estado-pino">
                    {esReasignacion ? "Sin cargo" : CURRENCY_COP.format(precioEstandarPrimeraCitaCOP)}
                </p>
                <p className="mt-1 text-xs text-subtle">
                    {esReasignacion
                        ? "El pago viaja con esta nueva solicitud desde tu cita anterior — no se cobra de nuevo."
                        : (
                            <>
                                Primera cita al precio estándar. De la 2ª cita en adelante:
                                <span className="cifra"> {CURRENCY_COP.format(tarifaProfesionalCOP)}</span>
                                {duracionMinutos ? ` · ${duracionMinutos} min` : ""}
                            </>
                        )}
                </p>
            </div>

            {/* Presentación — se pide sólo cuando NO es reasignación (en la
                reasignación viaja desde la solicitud original). */}
            {!esReasignacion && (
                <div className="mt-4">
                    <label htmlFor="presentacion" className="text-xs font-semibold text-body">
                        Cuéntanos qué pasa (mín. 20 caracteres)
                    </label>
                    <textarea
                        id="presentacion"
                        className="mt-1 w-full rounded-xl border border-tinta/15 bg-tinta/[0.03] p-3 text-sm text-body focus:outline-none focus:ring-2 focus:ring-cielo"
                        rows={3}
                        value={presentacion}
                        onChange={(e) => setPresentacion(e.target.value)}
                        placeholder="Un párrafo corto que ayude al profesional a prepararse."
                    />
                    {!presentacionValida && presentacion.length > 0 && (
                        <p className="mt-1 text-xs text-estado-rubi">
                            Faltan {Math.max(0, 20 - presentacion.trim().length)} caracteres.
                        </p>
                    )}
                </div>
            )}

            {/* Urgencia — sólo aplica a solicitud nueva. */}
            {!esReasignacion && (
                <div className="mt-3">
                    <p className="text-xs font-semibold text-body">Urgencia</p>
                    <div className="mt-2 flex gap-2">
                        {(["ESTA_SEMANA", "SIN_APURO"] as const).map((u) => (
                            <button
                                key={u}
                                type="button"
                                onClick={() => setUrgencia(u)}
                                className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                                    urgencia === u
                                        ? "bg-cielo text-white shadow"
                                        : "bg-tinta/5 text-body hover:bg-tinta/10"
                                }`}
                            >
                                {u === "ESTA_SEMANA" ? "Esta semana" : "Sin apuro"}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Franjas */}
            <div className="mt-4">
                <p className="text-xs font-semibold text-body">Franjas libres</p>
                {cargaError && (
                    <p className="mt-1 text-xs text-estado-rubi">No pudimos cargar las franjas: {cargaError}</p>
                )}
                {!franjas && !cargaError && (
                    <p className="mt-1 text-xs text-subtle animate-pulse">Cargando…</p>
                )}
                {franjas && franjas.length === 0 && (
                    <p className="mt-1 text-xs text-subtle">Este profesional no tiene franjas libres en este momento.</p>
                )}
                {franjas && franjas.length > 0 && (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {franjas.slice(0, 10).map((f) => {
                            const seleccionada = franjaSel?.id === f.id;
                            return (
                                <li key={f.id}>
                                    <button
                                        type="button"
                                        onClick={() => setFranjaSel(f)}
                                        className={`w-full rounded-xl p-3 text-left text-sm transition ${
                                            seleccionada
                                                ? "bg-cielo/15 ring-2 ring-cielo text-body"
                                                : "bg-tinta/5 hover:bg-tinta/10 text-body"
                                        }`}
                                    >
                                        <p className="cifra font-medium">{fmtRango(f)}</p>
                                        <p className="text-[11px] uppercase tracking-wide text-subtle">{f.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</p>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <button
                type="button"
                disabled={!puedeContinuar}
                onClick={() => setModalAbierto(true)}
                className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                    puedeContinuar ? "bg-pino hover:bg-pino/90" : "bg-tinta/30 cursor-not-allowed"
                }`}
            >
                {esReasignacion ? "Elegir a este profesional" : "Pagar y solicitar la cita"}
            </button>

            {/* Modal de confirmación */}
            {modalAbierto && franjaSel && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-cita-titulo"
                    className="fixed inset-0 z-40 flex items-center justify-center bg-tinta/40 p-4 anim-entrada"
                >
                    <div className="glass w-full max-w-md rounded-2xl p-6">
                        <h3 id="modal-cita-titulo" className="titular-seccion">
                            {esReasignacion ? "Elegir a este profesional" : "Confirmar solicitud"}
                        </h3>
                        <p className="cuerpo text-subtle mt-1">
                            Franja: <span className="cifra font-medium text-body">{nombreFranjaSel}</span>
                        </p>
                        <p className="cuerpo text-subtle mt-1">
                            {esReasignacion
                                ? <>Pago: <span className="cifra font-bold text-estado-pino">heredado de tu solicitud anterior</span></>
                                : <>Total a pagar: <span className="cifra font-bold text-estado-pino">{CURRENCY_COP.format(precioEstandarPrimeraCitaCOP)}</span></>}
                        </p>
                        <p className="mt-3 text-xs text-subtle">
                            {esReasignacion
                                ? "Se crea una solicitud nueva con este profesional y el pago viaja con ella; no se cobra otra vez. Tienes 48 h de espera nuevamente."
                                : "El pago se aprueba manualmente por un admin. La franja queda reservada mientras tanto; si el profesional no confirma en 48h, puedes elegir otro sin volver a pagar."}
                        </p>

                        {expedienteIdSugerido && (
                            <label className="mt-4 flex items-start gap-2 rounded-xl bg-tinta/5 p-3">
                                <input
                                    type="checkbox"
                                    checked={compartirExpediente}
                                    onChange={(e) => setCompartirExpediente(e.target.checked)}
                                    className="mt-1"
                                />
                                <span className="text-xs text-body">
                                    Compartir mi expediente con este profesional (podrá abrirlo con
                                    tu autorización). Al pagar se registra tu decisión.
                                </span>
                            </label>
                        )}

                        {errorEnvio && (
                            <p className="mt-3 text-xs text-estado-rubi">{errorEnvio}</p>
                        )}

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setModalAbierto(false)}
                                className="rounded-full bg-tinta/5 px-4 py-2 text-sm text-body hover:bg-tinta/10 transition"
                            >Volver</button>
                            <button
                                type="button"
                                disabled={enviando}
                                onClick={() => void enviar()}
                                className="rounded-full bg-pino px-4 py-2 text-sm font-semibold text-white hover:bg-pino/90 transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {enviando ? "Enviando…" : esReasignacion ? "Confirmar reasignación" : "Confirmar y pagar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
