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

interface Props {
    citaInicial: CitaParaPadreDto;
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
        detalle: "Esta solicitud fue reprogramada. Buscá abajo el enlace a la nueva cita.",
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

export function EsperaCitaPanel({ citaInicial }: Props) {
    const [cita, setCita] = useState<CitaParaPadreDto>(citaInicial);
    const [refrescando, setRefrescando] = useState(false);
    const estado = ESTADO_LEGIBLE[cita.estado];
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
                        <strong>Se cumplieron las 48 h.</strong> Refrescá la página o esperá al próximo tick del sistema
                        para que quede como vencida y podás elegir otro profesional.
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

            {puedeElegirOtro && (
                <section className="rounded-2xl border border-pino/30 bg-pino/5 p-4 sm:p-5">
                    <p className="cuerpo text-body">
                        El pago se hereda: elige a otro profesional sin volver a pagar la primera cita.
                    </p>
                    <Link
                        href={`/dashboard/padre/profesionales?heredarDe=${encodeURIComponent(cita.id)}`}
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-pino px-4 py-2 text-sm font-semibold text-white transition hover:bg-pino/90"
                    >
                        Elegir otro profesional
                    </Link>
                </section>
            )}

            <p className="etiqueta text-subtle">
                <Link href="/dashboard/padre" className="underline hover:text-body">Volver a mi expediente</Link>
            </p>
        </div>
    );
}
