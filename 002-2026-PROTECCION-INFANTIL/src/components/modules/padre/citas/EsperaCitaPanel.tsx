"use client";
/**
 * SPEC-428 (A-75 · brief §9 M6-M7) · Panel de espera del padre:
 *  · Muestra estado + reloj de 48 h desde el pago hasta que el profesional
 *    confirma o vence la solicitud.
 *  · Si venció (`VENCIDA_SIN_RESPUESTA`) o el profesional no asistió, ofrece
 *    «Elegir otro profesional» que hereda el pago (SPEC-395 · `/reasignar`).
 *
 * No pide contacto del profesional aquí — `debeExponerContacto` (DTO) sólo
 * lo revela cuando la cita ya está CONFIRMADA, y el DTO garantiza que si
 * no está expuesto, no viaja al cliente.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import type { ExpedienteParaCompartirDto } from "@/lib/dal/services/expediente-detalle/types";
import { GenerarPase } from "@/components/modules/padre/GenerarPase";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

interface Props {
    citaInicial: CitaParaPadreDto;
    /**
     * SPEC-731 · los casos del padre para el selector «compartir un caso» (id +
     * etiqueta legible, sin contenido). Vacío = el padre no tiene ningún caso →
     * la cita confirmada muestra «no hace falta», nunca un callejón a lista
     * vacía. Solo lo llena el server cuando la cita está CONFIRMADA.
     */
    expedientes?: ExpedienteParaCompartirDto[];
}

const ESTADO_LEGIBLE: Record<CitaParaPadreDto["estado"], { titulo: string; detalle: string; tono: "espera" | "verde" | "gris" | "rojo" }> = {
    PAGADA_PENDIENTE: {
        titulo: "Esperando confirmación del profesional",
        detalle: "El profesional tiene hasta 48 h para confirmar. Si no responde, podrás elegir otro sin volver a pagar.",
        tono: "espera",
    },
    CONFIRMADA: {
        titulo: "Cita confirmada",
        detalle: "El profesional ya la aceptó. El día y la hora quedan como acordado abajo.",
        tono: "verde",
    },
    CUMPLIDA: {
        titulo: "Cita realizada",
        detalle: "Esta cita ya se realizó. Puedes pedir una siguiente desde el directorio.",
        tono: "gris",
    },
    NO_ASISTIO_PADRE: {
        titulo: "No asistió el padre",
        detalle: "El profesional marcó que no llegaste. Si fue un error, escríbenos a soporte.",
        tono: "gris",
    },
    NO_ASISTIO_PROFESIONAL: {
        titulo: "El profesional no asistió",
        detalle: "Puedes elegir otro profesional sin volver a pagar (el pago se hereda).",
        tono: "rojo",
    },
    VENCIDA_SIN_RESPUESTA: {
        titulo: "No respondió a tiempo",
        detalle: "Pasaron 48 h sin confirmación. Elige otro profesional — el pago viaja con la nueva solicitud.",
        tono: "rojo",
    },
    REEMBOLSADA: {
        titulo: "Cita reembolsada",
        detalle: "El pago volvió a tu método. Puedes pedir una nueva cita cuando quieras.",
        tono: "gris",
    },
    SIN_CONFIRMAR: {
        titulo: "Pendiente de pago",
        detalle: "Todavía no se confirmó el pago. Si es un error, escríbenos a soporte.",
        tono: "gris",
    },
    REPROGRAMADA: {
        titulo: "Reprogramada",
        detalle: "Esta solicitud fue reprogramada. Busca abajo el enlace a la nueva cita.",
        tono: "gris",
    },
};

function formatearFranja(inicioISO: string, finISO: string): string {
    const inicio = new Date(inicioISO);
    const fin = new Date(finISO);
    const opciones: Intl.DateTimeFormatOptions = {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
        timeZone: "America/Bogota",
    };
    const inicioTxt = new Intl.DateTimeFormat("es-CO", opciones).format(inicio);
    const finHora = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(fin);
    return `${inicioTxt} — ${finHora}`;
}

function formatearMonto(cop: number): string {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cop);
}

/**
 * SPEC-715 · «Agregar a mi calendario»: un `.ics` armado en el cliente desde la
 * fecha/hora que la cita ya trae (sin backend, sin infra). Solo datos públicos
 * (nombre visible del profesional + modalidad); nada del menor, y todavía sin
 * dirección/enlace (eso llega con SPEC-708).
 */
function fechaIcs(iso: string): string {
    return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function descargarIcs(cita: CitaParaPadreDto): void {
    const escapar = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Proteccion Infantil//cita//ES",
        "BEGIN:VEVENT",
        `UID:${cita.id}@proteccion-infantil`,
        `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
        `DTSTART:${fechaIcs(cita.franja.inicio)}`,
        `DTEND:${fechaIcs(cita.franja.fin)}`,
        `SUMMARY:${escapar(`Cita con ${cita.profesional.nombreVisible}`)}`,
        `DESCRIPTION:${escapar(`Modalidad: ${cita.franja.modalidad}`)}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function useCountdown(hastaISO: string | null): { horas: number; minutos: number; vencido: boolean } | null {
    const [ahora, setAhora] = useState<number>(() => Date.now());
    useEffect(() => {
        if (!hastaISO) return;
        const t = setInterval(() => setAhora(Date.now()), 30_000);
        return () => clearInterval(t);
    }, [hastaISO]);
    if (!hastaISO) return null;
    const restanteMs = new Date(hastaISO).getTime() - ahora;
    if (restanteMs <= 0) return { horas: 0, minutos: 0, vencido: true };
    const horas = Math.floor(restanteMs / (3600 * 1000));
    const minutos = Math.floor((restanteMs % (3600 * 1000)) / (60 * 1000));
    return { horas, minutos, vencido: false };
}

export function EsperaCitaPanel({ citaInicial, expedientes = [] }: Props) {
    const [cita, setCita] = useState<CitaParaPadreDto>(citaInicial);
    const [refrescando, setRefrescando] = useState(false);
    const estado = ESTADO_LEGIBLE[cita.estado];
    // SPEC-731 §2a: el caso a compartir. Si la cita ya venía ligada a uno, ese es
    // el preseleccionado; si no, arranca vacío («No compartir») — nunca obligatorio.
    const tieneCasos = expedientes.length > 0;
    const compartidoValido =
        cita.expedienteCompartidoId != null &&
        expedientes.some((e) => e.expedienteId === cita.expedienteCompartidoId);
    const [expedienteSel, setExpedienteSel] = useState<string>(
        compartidoValido ? cita.expedienteCompartidoId! : "",
    );
    const countdown = useCountdown(cita.estado === "PAGADA_PENDIENTE" ? cita.venceEn : null);

    // Refresca al foco (el motor confirma asíncrono; volver a la pestaña
    // trae el estado nuevo sin recargar la página entera).
    useEffect(() => {
        function alRegresar() {
            setRefrescando(true);
            fetch(`/api/padre/citas/${cita.id}`, { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then((j: { data: CitaParaPadreDto } | null) => j?.data && setCita(j.data))
                .catch(() => null)
                .finally(() => setRefrescando(false));
        }
        window.addEventListener("focus", alRegresar);
        return () => window.removeEventListener("focus", alRegresar);
    }, [cita.id]);

    const puedeElegirOtro = cita.estado === "VENCIDA_SIN_RESPUESTA" || cita.estado === "NO_ASISTIO_PROFESIONAL";

    const tonoClases = useMemo(() => {
        switch (estado.tono) {
            case "verde": return "bg-pino/10 text-pino border-pino/30";
            case "rojo": return "bg-ambar/10 text-ambar border-ambar/40";
            case "gris": return "bg-tinta/5 text-subtle border-tinta/10";
            default: return "bg-cielo/10 text-cielo border-cielo/30";
        }
    }, [estado.tono]);

    return (
        <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5 anim-entrada">
            <header className="space-y-1">
                <p className="etiqueta text-subtle">Tu cita</p>
                <h1 className="font-serif text-2xl text-body">{estado.titulo}</h1>
                <p className="cuerpo text-subtle">{estado.detalle}</p>
            </header>

            <section className={`rounded-2xl border p-4 sm:p-5 ${tonoClases}`}>
                <p className="etiqueta">Estado</p>
                <p className="cuerpo mt-1">{cita.estado.replaceAll("_", " ")}</p>
                {countdown && !countdown.vencido && (
                    <p className="cuerpo mt-3">
                        Vence en <strong className="font-mono">{countdown.horas}h {String(countdown.minutos).padStart(2, "0")}m</strong>.
                    </p>
                )}
                {countdown?.vencido && (
                    <p className="cuerpo mt-3">
                        <strong>Se cumplieron las 48 h.</strong> Refresca la página o espera al próximo tick del sistema
                        para que quede como vencida y puedas elegir otro profesional.
                    </p>
                )}
                {refrescando && <p className="etiqueta mt-2 text-subtle">Actualizando…</p>}
            </section>

            <section className="glass rounded-2xl p-4 sm:p-5 space-y-3">
                <div>
                    <p className="etiqueta text-subtle">Profesional</p>
                    <p className="cuerpo text-body">{cita.profesional.nombreVisible}</p>
                    <p className="etiqueta text-subtle">{cita.profesional.tituloProfesional} · {cita.profesional.ciudad.nombre}</p>
                </div>
                <div>
                    <p className="etiqueta text-subtle">Franja</p>
                    <p className="cuerpo text-body">{formatearFranja(cita.franja.inicio, cita.franja.fin)}</p>
                    <p className="etiqueta text-subtle capitalize">{cita.franja.modalidad}</p>
                </div>
                <div>
                    <p className="etiqueta text-subtle">Monto pagado</p>
                    <p className="cuerpo text-body">{formatearMonto(cita.montoTotal)}</p>
                    {cita.pagoHeredadoDeId && (
                        <p className="etiqueta text-subtle">
                            Pago heredado de una cita previa — no se cobró de nuevo.
                        </p>
                    )}
                </div>
                {cita.contactoProfesional && (
                    <div>
                        <p className="etiqueta text-subtle">Contacto (visible al confirmar)</p>
                        <p className="cuerpo text-body">{cita.contactoProfesional.email}</p>
                        {cita.contactoProfesional.telefono && (
                            <p className="cuerpo text-body">{cita.contactoProfesional.telefono}</p>
                        )}
                    </div>
                )}
            </section>

            {/* SPEC-715 + SPEC-731 · con la cita CONFIRMADA el padre YA puede «seguir»
                sin depender de ningún caso: fecha/contacto (arriba) + agregar al calendario.
                Compartir un caso es un EXTRA OPCIONAL (§2), nunca un requisito. Nada de esto
                antes de CONFIRMADA (candado). El «dónde/enlace» llega con SPEC-708; el
                recordatorio por correo y la encuesta NO existen y esta pantalla no los promete. */}
            {cita.estado === "CONFIRMADA" && (
                <>
                    {/* §1 · «poder seguir»: agregar la cita al calendario. Va PRIMERO,
                        antes de lo de compartir — la cita vale por sí sola. */}
                    <section className="glass rounded-2xl p-4 sm:p-5 space-y-2">
                        <p className="etiqueta text-subtle">Antes de la cita</p>
                        <Button variant="secondary" onClick={() => descargarIcs(cita)}>
                            Agregar a mi calendario
                        </Button>
                    </section>

                    {/* §2 · Compartir un caso — OPCIONAL, en dos casos según si el padre
                        tiene algún expediente. Nunca se fuerza ni se auto-crea un caso. */}
                    <section className="glass rounded-2xl p-4 sm:p-5 space-y-3">
                        {tieneCasos ? (
                            <>
                                {/* §2a · tiene uno o más casos: oferta, no imperativo. */}
                                <div className="space-y-1">
                                    <p className="etiqueta text-subtle">Compartir un caso (opcional)</p>
                                    <p className="cuerpo text-body">
                                        ¿Quieres que el profesional vea un caso tuyo?
                                    </p>
                                    <p className="cuerpo text-subtle">
                                        Elige cuál y te damos un <strong>pase</strong> para que lo abra en la sesión.
                                    </p>
                                </div>
                                <Select
                                    label="Caso a compartir"
                                    value={expedienteSel}
                                    onChange={(e) => setExpedienteSel(e.target.value)}
                                    options={[
                                        { value: "", label: "No compartir ningún caso" },
                                        ...expedientes.map((exp) => ({ value: exp.expedienteId, label: exp.etiqueta })),
                                    ]}
                                />
                                {expedienteSel && <GenerarPase expedienteId={expedienteSel} />}
                            </>
                        ) : (
                            <>
                                {/* §2b · sin ningún caso: cierra bien y ofrece, sin exigir.
                                    NO es un callejón (nada de «elige de una lista vacía»). */}
                                <p className="etiqueta text-subtle">Compartir un caso (opcional)</p>
                                <p className="cuerpo text-body">
                                    No tienes un caso para compartir — y no hace falta.
                                </p>
                                <p className="cuerpo text-subtle">
                                    Cuéntale directamente al profesional en la sesión. Si quieres dejar algo por
                                    escrito antes, puedes{" "}
                                    <Link href="/dashboard/padre/reportar" className="underline hover:text-body">
                                        reportar un caso
                                    </Link>
                                    .
                                </p>
                            </>
                        )}
                    </section>
                </>
            )}

            {/* SPEC-715 · después de la cita (CUMPLIDA): la salida real es pedir otra por el
                directorio. Sin encuesta (no existe) y sin «te avisaremos» (tampoco). */}
            {cita.estado === "CUMPLIDA" && (
                <section className="glass rounded-2xl p-4 sm:p-5">
                    <p className="cuerpo text-body">¿Quieres seguir? Puedes pedir otra cita con {cita.profesional.nombreVisible}.</p>
                    <Link
                        href={`/dashboard/padre/profesionales/${encodeURIComponent(cita.profesional.id)}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-cielo px-4 py-2 text-sm font-semibold text-acento-ink transition hover:bg-cielo/90"
                    >
                        Pedir otra cita
                    </Link>
                </section>
            )}

            {puedeElegirOtro && (
                <section className="rounded-2xl border border-pino/30 bg-pino/5 p-4 sm:p-5">
                    <p className="cuerpo text-body">
                        El pago se hereda: elige a otro profesional sin volver a pagar la primera cita.
                    </p>
                    <Link
                        href={`/dashboard/padre/profesionales?heredarDe=${encodeURIComponent(cita.id)}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-cielo px-4 py-2 text-sm font-semibold text-acento-ink transition hover:bg-cielo/90"
                    >
                        Elegir otro profesional
                    </Link>
                </section>
            )}

            {/* SPEC-731 §3 · el pie vuelve a la LISTA DE CITAS (donde el padre estaba),
                no a «mi expediente» — que ni es un expediente ni es de donde venía. */}
            <p className="etiqueta text-subtle">
                <Link href="/dashboard/padre/citas" className="underline hover:text-body">Volver a mis citas</Link>
            </p>
        </div>
    );
}
