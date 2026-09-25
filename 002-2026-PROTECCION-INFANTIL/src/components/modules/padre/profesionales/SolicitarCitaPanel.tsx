"use client";

/**
 * SPEC-428 (A-75 §9 M4) + SPEC-712 (FORMA-SPEC712 · Jelkin probando 17-09) ·
 * Panel de reserva de cita del padre.
 *
 * Reemplaza el botón "Solicitar cita (próximamente)" de L3 con el flujo real:
 * elegir horario → confirmar (§4: se paga el PRECIO ESTÁNDAR, no la tarifa del
 * profesional — que aplica desde la 2ª cita) → decidir si comparte expediente →
 * cita creada en `SIN_CONFIRMAR` esperando que se valide el pago.
 *
 * SPEC-712 (medido contra `da40aa9e`, forma de Diseño):
 *  1. Fuera el texto del «admin»; encabezado simple «Elige un horario».
 *  2. La presentación se pregunta UNA vez (en el paso previo): acá se MUESTRA con
 *     opción de editar, sin re-exigir el mínimo si no la toca. Si llega sin
 *     borrador, se pide acá (una vez).
 *  3. Urgencia honesta: franjas ordenadas de la más próxima a la más lejana;
 *     chip «Solo esta semana» que FILTRA de verdad; línea de emergencia SIEMPRE
 *     visible; se retira el toggle binario inerte (no filtraba ni ordenaba). La
 *     urgencia sigue viajando (desde el borrador) para que el profesional trie.
 *  4. Modal SÓLIDO (`bg-superficie-2`), velo firme (`bg-tinta/55` + blur) y
 *     `z-50`: un cuadro de confirmación de pago no puede leerse a medias.
 *  5. Sin «admin» ni «48h» prometidas: «Tu pago está en proceso de validación…».
 *     Mientras la pasarela esté apagada y no se cobre nada, el botón dice
 *     «Confirmar solicitud» (no «…y pagar») y la CTA «Solicitar la cita» (no
 *     «Pagar…»): un botón que dice que cobra sin cobrar miente (veredicto CEO).
 *
 * Diseño: tokens del sistema. Voz del padre = «tú» (D-107).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RejillaElegirFranja } from "@/components/modules/padre/citas/RejillaElegirFranja";

interface Franja {
    id: string;
    inicio: string;
    fin: string;
    modalidad: "VIRTUAL" | "PRESENCIAL";
}

interface Props {
    profesionalId: string;
    // SPEC-685 (PR2-bis): la tarifa del profesional es nulable («por fijar»); cuando
    // es null no se muestra la línea de la 2ª cita (nunca 0 ni una cifra inventada).
    tarifaProfesionalCOP: number | null;
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
    // SPEC-729 §2: la presentación se toma de Mi perfil (presentacionEstandar) al
    // montar; no viene por borrador, props ni URL. Si Mi perfil la tiene, se MUESTRA
    // (con «Editar»); si está vacía, se ofrece completarla en Mi perfil (sin formulario acá).
    const [presentacion, setPresentacion] = useState("");
    const [tienePresentacion, setTienePresentacion] = useState(false);
    const [editandoPresentacion, setEditandoPresentacion] = useState(false);
    // SPEC-712 §3 + SPEC-729 §4: la urgencia ya no se elige acá; viaja fija en SIN_APURO.
    // SPEC-730: el chip «Solo esta semana» se retiró — la navegación de la rejilla lo suple.
    const [urgencia] = useState<"ESTA_SEMANA" | "SIN_APURO">("SIN_APURO");
    const [compartirExpediente, setCompartirExpediente] = useState(Boolean(expedienteIdSugerido));
    const [modalAbierto, setModalAbierto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

    const cargarFranjas = useCallback(async () => {
        setCargaError(null);
        try {
            const res = await fetch(`/api/publico/profesionales/${profesionalId}/franjas`);
            if (!res.ok) {
                // I-410: mostrar el mensaje del servidor, no «HTTP NNN».
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                throw new Error(cuerpo?.error?.message ?? `El servidor respondió con un error (HTTP ${res.status}).`);
            }
            const json = (await res.json()) as { data: Franja[] };
            setFranjas(json.data);
        } catch (e) {
            setCargaError(e instanceof Error ? e.message : String(e));
        }
    }, [profesionalId]);

    useEffect(() => {
        void cargarFranjas();
    }, [cargarFranjas]);

    // SPEC-729 §2: al montar (alta nueva), la presentación se toma de Mi perfil.
    // En reasignación viaja desde la solicitud original (no se pide ni se muestra acá).
    useEffect(() => {
        if (esReasignacion) return;
        let cancelado = false;
        void (async () => {
            try {
                const res = await fetch("/api/padre/perfil", { credentials: "include" });
                if (!res.ok || cancelado) return;
                const { perfil } = (await res.json()) as { perfil?: { presentacionEstandar?: string | null } };
                if (cancelado || !perfil?.presentacionEstandar) return;
                setPresentacion(perfil.presentacionEstandar);
                setTienePresentacion(true); // SPEC-712 §2: mostrar, no re-pedir.
            } catch {
                // Sin red/perfil: se trata como vacía → enlace a Mi perfil. No bloquea.
            }
        })();
        return () => {
            cancelado = true;
        };
    }, [esReasignacion]);

    // SPEC-729 §3: mínimo único = 10. En reasignación la presentación ya está en la
    // solicitud original — el service la propaga; el panel no la exige.
    const presentacionValida = esReasignacion || presentacion.trim().length >= 10;
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
            {/* SPEC-712 §1: encabezado simple; fuera el texto del «admin». */}
            <h2 id="reservar" className="text-sm font-semibold text-body">Elige un horario</h2>

            {/* SPEC-712 §3.4: en protección infantil, la salida de emergencia va SIEMPRE
                visible — antes de cualquier cola de cita paga. Canales oficiales de la casa
                (ver CanalesOficiales.tsx): 141 ICBF · 123 emergencias · Te Protejo. */}
            <p className="mt-2 rounded-xl bg-ambar/10 p-3 text-xs text-body">
                <span className="font-semibold">¿Es una emergencia?</span> No esperes la cita. Llama a{" "}
                <a href="tel:141" className="font-semibold text-accent underline">141</a> (ICBF) o{" "}
                <a href="tel:123" className="font-semibold text-accent underline">123</a>, o entra a{" "}
                <a
                    href="https://www.teprotejo.gov.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent underline"
                >
                    Te Protejo
                </a>
                .
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
                        : tarifaProfesionalCOP !== null && tarifaProfesionalCOP > 0
                            ? (
                                <>
                                Primera cita al precio estándar. De la 2ª cita en adelante:
                                    <span className="cifra"> {CURRENCY_COP.format(tarifaProfesionalCOP)}</span>
                                    {duracionMinutos ? ` · ${duracionMinutos} min` : ""}
                                </>
                            )
                            : "Primera cita al precio estándar. De la segunda cita en adelante: por definir."}
                </p>
            </div>

            {/* SPEC-712 §2 + SPEC-729 §2 · Presentación tomada de Mi perfil. Si la tiene,
                se MUESTRA con «Editar» (ajuste puntual para esta cita, sin re-exigir el
                mínimo salvo que la toque). Si está vacía, NO un formulario acá: enlace a
                Mi perfil. En reasignación viaja desde la solicitud original. */}
            {!esReasignacion && (
                <div className="mt-4">
                    {tienePresentacion ? (
                        editandoPresentacion ? (
                            <>
                                <label htmlFor="presentacion" className="text-xs font-semibold text-body">
                                    Ajusta lo que nos contaste
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
                                        Faltan {Math.max(0, 10 - presentacion.trim().length)} caracteres.
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="rounded-xl bg-tinta/5 p-3">
                                <p className="text-xs font-semibold text-body">Lo que nos contaste</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-body">«{presentacion}»</p>
                                {/* Acción (no chip): va por el `<Button>` de la casa (frontera SPEC-633). */}
                                <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() => setEditandoPresentacion(true)}
                                    className="mt-2"
                                >
                                    Editar
                                </Button>
                            </div>
                        )
                    ) : (
                        <div className="rounded-xl bg-tinta/5 p-3">
                            <p className="text-xs font-semibold text-body">Tu presentación</p>
                            <p className="mt-1 text-sm text-subtle">
                                Aún no tienes una presentación.{" "}
                                <Link href="/dashboard/padre/perfil" className="font-semibold text-accent underline">
                                    Complétala en Mi perfil
                                </Link>{" "}
                                para que el profesional sepa de qué se trata.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Franjas — SPEC-730: la MISMA rejilla visual del profesional (no una lista);
                el toque selecciona la franja libre. Solo lectura salvo esa selección. */}
            <div className="mt-4">
                <p className="text-xs font-semibold text-body">Elige un horario libre</p>
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
                    <div className="mt-2">
                        <RejillaElegirFranja
                            franjas={franjas}
                            franjaSelId={franjaSel?.id ?? null}
                            onSeleccionar={setFranjaSel}
                        />
                    </div>
                )}
                {franjaSel && (
                    <p className="mt-2 text-xs text-body">
                        Elegiste: <span className="cifra font-medium">{fmtRango(franjaSel)}</span>
                    </p>
                )}
            </div>

            <Button type="button" disabled={!puedeContinuar} onClick={() => setModalAbierto(true)} className="mt-4 w-full">
                {/* SPEC-712 §5: mientras no se cobre, la CTA no dice «Pagar». */}
                {esReasignacion ? "Elegir a este profesional" : "Solicitar la cita"}
            </Button>

            {/* Modal de confirmación — SPEC-712 §4: superficie SÓLIDA, velo firme, z-50,
                hoja desde abajo en móvil. Jerarquía: título → franja → Total a pagar → el
                mensaje del pago → compartir → botones. */}
            {modalAbierto && franjaSel && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-cita-titulo"
                    className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/55 p-0 backdrop-blur-sm anim-entrada sm:items-center sm:p-4"
                >
                    <div className="w-full max-w-md rounded-t-2xl bg-superficie-2 p-6 shadow-2xl ring-1 ring-tinta/10 sm:rounded-2xl">
                        <h3 id="modal-cita-titulo" className="titular-seccion">
                            {esReasignacion ? "Elegir a este profesional" : "Confirmar solicitud"}
                        </h3>
                        <p className="cuerpo text-subtle mt-1">
                            Franja: <span className="cifra font-medium text-body">{nombreFranjaSel}</span>
                        </p>

                        {/* Total a pagar — lo que más pesa (en pino). Mientras no se cobre, es el
                            VALOR de la reserva, no un cobro hecho (§5). */}
                        <div className="mt-3 rounded-xl bg-pino/10 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-estado-pino">
                                {esReasignacion ? "Pago" : "Total a pagar"}
                            </p>
                            <p className="cifra text-2xl font-bold text-estado-pino">
                                {esReasignacion ? "Sin cargo" : CURRENCY_COP.format(precioEstandarPrimeraCitaCOP)}
                            </p>
                        </div>

                        <p className="mt-3 text-xs text-subtle">
                            {esReasignacion ? (
                                "Se crea una solicitud nueva con este profesional y el pago viaja con ella; no se cobra otra vez. Tienes 48 h de espera nuevamente."
                            ) : (
                                <>
                                    <span className="font-medium text-body">Tu pago está en proceso de validación.</span>{" "}
                                    Estamos terminando de conectar la pasarela de pago; en cuanto esté lista, lo validamos
                                    y te confirmamos la cita. La franja queda reservada para ti mientras tanto.
                                </>
                            )}
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
                                    tu autorización). Al enviar la solicitud se registra tu decisión.
                                </span>
                            </label>
                        )}

                        {errorEnvio && (
                            <p className="mt-3 text-xs text-estado-rubi">{errorEnvio}</p>
                        )}

                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="ghost" type="button" onClick={() => setModalAbierto(false)}>
                                Volver
                            </Button>
                            <Button type="button" disabled={enviando} isLoading={enviando} onClick={() => void enviar()}>
                                {/* SPEC-712 §5: no dice «pagar» sin cobrar (veredicto CEO). */}
                                {esReasignacion ? "Confirmar reasignación" : "Confirmar solicitud"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
