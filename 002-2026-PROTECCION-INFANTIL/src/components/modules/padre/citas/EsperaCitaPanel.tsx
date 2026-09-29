"use client";
/**
 * SPEC-428 (A-75 · brief §9 M6-M7) · Panel de espera del padre:
 *  · Muestra estado + reloj de 48 h desde el pago hasta que el profesional
 *    confirma o vence la solicitud.
 *  · Si venció (`VENCIDA_SIN_RESPUESTA`) o el profesional no asistió, ofrece
 *    «Elegir otro profesional» que hereda el pago (SPEC-395 · `/reasignar`).
 *
 * SPEC-754 · el contacto del profesional NO se muestra en ningún estado: el
 * contacto mutuo está CERRADO (`debeExponerContacto` → false siempre), así que
 * `cita.contactoProfesional` nunca llega poblado y no viaja al cliente. El canal
 * de la reunión es el ENLACE de la cita (SPEC-750); el recurso de plata, la PQR
 * (SPEC-752). El campo `contactoProfesional?` se conserva en el DTO solo para que
 * los candados afirmen su AUSENCIA.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import type { ExpedienteParaCompartirDto } from "@/lib/dal/services/expediente-detalle/types";
import { badgeDeCitaEfectivo } from "@/lib/padre/citas-listado";
import { derivarVistaFranjaPasada, type VistaEspera, type AccionesEspera, type TonoEspera } from "@/lib/padre/vista-espera-cita";

// SPEC-749 FR-2 · destino REAL de «Escríbenos»: el correo de soporte que ya usa la plataforma
// (`email-colegio.ts` `urlSoporte`, las pantallas de verificación) y que nombra la FORMA del canal
// de continuidad. Puente hasta la puerta de PQR de SPEC-752 (Dev-3), que será el destino definitivo.
const CORREO_SOPORTE = "gerencia@innovadataco.com";

// SPEC-730 · el estado de una cita es PROCESO, nunca criticidad: cielo/pino/ámbar/tinta,
// CERO rubí. `gris` = tinta neutro (estado pasado/cerrado — SPEC-749 FR-2).
const TONO_CLASES: Record<TonoEspera, string> = {
    verde: "bg-pino/10 text-pino border-pino/30",
    rojo: "bg-ambar/10 text-ambar border-ambar/40",
    gris: "bg-tinta/5 text-subtle border-tinta/10",
    espera: "bg-cielo/10 text-cielo border-cielo/30",
};
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

// SPEC-749 FR-2: mapa por estado CRUDO — la conducta base. La verdad de «franja
// pasada» para PAGADA_PENDIENTE/SIN_CONFIRMAR la deriva `derivarVistaFranjaPasada`;
// CONFIRMADA con franja pasada sigue mostrando esto (copy de Diseño diferido, §14).
const ESTADO_LEGIBLE: Record<CitaParaPadreDto["estado"], VistaEspera> = {
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
 * (nombre visible del profesional + modalidad); nada del menor, y todavía sin la
 * dirección presencial (llega con SPEC-708) ni el enlace de la reunión (es POR CITA,
 * lo pone el operador — no un campo del perfil del profesional).
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

/**
 * SPEC-749 FR-2 · SALIDAS de una cita con la hora ya pasada — DOS a propósito (Diseño): «o
 * quiere seguir (→ Pedir otra cita) o algo salió mal (→ Escríbenos)». Ambas con destino REAL:
 * «Pedir otra cita» → directorio; «Escríbenos» → `mailto:` al soporte de la plataforma (no un
 * botón muerto ni un texto inerte — un «escríbenos» sin dónde es la misma promesa-sin-mecanismo
 * que se está arreglando). No promete devolución. El destino definitivo será la PQR de SPEC-752.
 */
function AccionFranjaPasada({ acciones }: { acciones: AccionesEspera | undefined }) {
    if (!acciones) return null;
    return (
        <section className="rounded-2xl border border-tinta/15 bg-tinta/5 p-4 sm:p-5 space-y-3">
            {acciones.pedirOtraCita && (
                <Link
                    href="/dashboard/padre/profesionales"
                    className="inline-flex items-center gap-2 rounded-full bg-cielo px-4 py-2 text-sm font-semibold text-acento-ink transition hover:bg-cielo/90"
                >
                    Pedir otra cita
                </Link>
            )}
            {acciones.escribenos && (
                <p className="cuerpo text-body">
                    ¿Algo no salió como esperabas?{" "}
                    <a className="underline underline-offset-2 hover:text-body" href={`mailto:${CORREO_SOPORTE}`}>Escríbenos</a>.
                </p>
            )}
            {acciones.revisarPago && (
                <p className="cuerpo text-body">
                    <a className="underline underline-offset-2 hover:text-body" href={`mailto:${CORREO_SOPORTE}`}>Escríbenos</a> para revisar tu pago.
                </p>
            )}
        </section>
    );
}

/**
 * SPEC-715 + SPEC-731 · lo que el padre puede hacer ANTES de una cita CONFIRMADA que aún
 * NO pasó: agregar al calendario + (opcional) compartir un caso. NADA de esto sobre una
 * cita cuya hora ya pasó (el llamador lo condiciona a `confirmadaViva`, SPEC-749 FR-2):
 * el `.ics` agendaría un evento del pasado y «compartir para la sesión» ya no aplica.
 */
function AntesDeLaCita({ cita, expedientes }: { cita: CitaParaPadreDto; expedientes: ExpedienteParaCompartirDto[] }) {
    // SPEC-731 §2a: el caso a compartir. Si la cita ya venía ligada a uno, ese es el
    // preseleccionado; si no, arranca vacío («No compartir») — nunca obligatorio.
    const tieneCasos = expedientes.length > 0;
    const compartidoValido =
        cita.expedienteCompartidoId != null &&
        expedientes.some((e) => e.expedienteId === cita.expedienteCompartidoId);
    const [expedienteSel, setExpedienteSel] = useState<string>(
        compartidoValido ? cita.expedienteCompartidoId! : "",
    );
    return (
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
    );
}

export function EsperaCitaPanel({ citaInicial, expedientes = [] }: Props) {
    const [cita, setCita] = useState<CitaParaPadreDto>(citaInicial);
    const [refrescando, setRefrescando] = useState(false);
    // SPEC-749 FR-2/FR-4: `now` inyectado (aquí, el reloj del cliente que avanza cada
    // 30 s) para que la pantalla cruce la frontera de la franja en vivo, sin refrescar.
    const [ahora, setAhora] = useState<number>(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setAhora(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);
    // La verdad de «franja pasada» (CONFIRMADA/PAGADA_PENDIENTE/SIN_CONFIRMAR); si no
    // aplica cae al mapa por estado crudo. `vistaPasada` no-nulo ⇒ la hora ya pasó → se
    // esconden las acciones de «antes de la cita» (calendario, compartir): son futuro sobre ayer.
    const vistaPasada = derivarVistaFranjaPasada(
        cita.estado,
        cita.franja.inicio,
        cita.franja.fin,
        cita.venceEn,
        cita.profesional.nombreVisible,
        ahora,
    );
    const estado = vistaPasada ?? ESTADO_LEGIBLE[cita.estado];
    const confirmadaViva = cita.estado === "CONFIRMADA" && !vistaPasada;
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

    const tonoClases = TONO_CLASES[estado.tono];

    return (
        <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5 anim-entrada">
            <header className="space-y-1">
                <p className="etiqueta text-subtle">Tu cita</p>
                <h1 className="font-serif text-2xl text-body">{estado.titulo}</h1>
                <p className="cuerpo text-subtle">{estado.detalle}</p>
            </header>

            {/* SPEC-730/731 (Diseño): la caja muestra la ETIQUETA AMIGABLE del estado, nunca el
                enum crudo «PAGADA_PENDIENTE»; el reloj de 48 h y el aviso de vencimiento van debajo. */}
            <section className={`rounded-2xl border p-4 sm:p-5 ${tonoClases}`}>
                <p className="etiqueta">Estado</p>
                <p className="cuerpo mt-1">{badgeDeCitaEfectivo(cita.estado, cita.franja.inicio, cita.franja.fin, ahora).label}</p>
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
                {/* SPEC-754 · el bloque de CONTACTO del profesional se retiró: el contacto mutuo
                    está CERRADO (`debeExponerContacto` → false siempre; `cita.contactoProfesional`
                    ya no llega poblado). El canal de la reunión es el ENLACE de la cita (SPEC-750)
                    y el recurso de plata va por la PQR (SPEC-752). El MARCADOR (copy que le dice al
                    padre por dónde seguir) lo entrega Diseño en su commit al sistema de diseño;
                    hasta entonces NO se inventa texto acá. */}
            </section>

            {/* SPEC-778 · el ACCESO a la reunión — la razón por la que el padre vuelve a esta
                pantalla. Va primero (antes de calendario/compartir). Copy de Diseño (FORMA-SPEC778,
                §1-3). Solo con la cita viva (`confirmadaViva`): pasada la hora, el enlace DESAPARECE
                y manda la vista «ya pasó» de FR-2 (750, no se rediscute). Nada del enlace que no
                controlamos: cero «sala/segura/caduca/un solo uso»; «no lo compartas» es indicación,
                no garantía. La `url` solo viene en PUBLICADO (derivada y gateada en el DTO). */}
            {confirmadaViva && cita.enlace?.estado === "SIN_PUBLICAR" && (
                <section className="rounded-2xl border border-ambar/40 bg-ambar/10 p-4 sm:p-5 text-ambar">
                    <p className="etiqueta">Acceso a la reunión</p>
                    <p className="cuerpo mt-1 text-body">
                        Tu cita está confirmada. El acceso a la reunión aparecerá aquí. Vuelve a esta
                        pantalla el día de tu cita.
                    </p>
                </section>
            )}
            {confirmadaViva && cita.enlace?.estado === "PUBLICADO" && cita.enlace.url && (
                <section className="rounded-2xl border border-cielo/30 bg-cielo/10 p-4 sm:p-5 space-y-2">
                    <p className="etiqueta text-cielo">Acceso a la reunión</p>
                    <p className="cuerpo text-body">Ya puedes entrar a tu reunión.</p>
                    <a
                        href={cita.enlace.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-cielo px-4 py-2 text-sm font-semibold text-acento-ink transition hover:bg-cielo/90"
                    >
                        Entrar a la reunión
                    </a>
                    <p className="cuerpo text-subtle">
                        Ábrelo a la hora de tu cita. Es tu acceso a la reunión de tu familia — no lo
                        compartas con nadie.
                    </p>
                </section>
            )}
            {confirmadaViva && cita.enlace?.estado === "INDETERMINADO" && (
                // Rama DEFENSIVA (condición 2 del CEO): el reloj del servidor siempre es válido, así
                // que en la práctica no se alcanza; si se alcanzara, NO se afirma que la hora pasó ni
                // que el operador no actuó — solo se pide recargar. Sin enlace (fail-closed).
                <section className="rounded-2xl border border-tinta/10 bg-tinta/5 p-4 sm:p-5 text-subtle">
                    <p className="etiqueta">Acceso a la reunión</p>
                    <p className="cuerpo mt-1 text-body">
                        No pudimos verificar el estado de tu reunión en este momento. Recarga la pantalla.
                    </p>
                </section>
            )}

            {/* SPEC-715 + SPEC-731 · con la cita CONFIRMADA el padre YA puede «seguir»
                sin depender de ningún caso: fecha (arriba) + agregar al calendario.
                Compartir un caso es un EXTRA OPCIONAL (§2), nunca un requisito. Nada de esto
                antes de CONFIRMADA (candado). El «dónde» presencial (dirección) llega con SPEC-708
                y el enlace de la reunión es POR CITA —lo pone el operador, no un campo del perfil—;
                el contacto del profesional NO se expone (SPEC-754); el recordatorio por correo y la
                encuesta NO existen y esta pantalla no los promete.
                SPEC-749 FR-2: NADA de esto sobre una cita cuya hora YA PASÓ (`!vistaPasada`) —
                «Agregar a mi calendario» agendaría un evento del pasado (Calidad, 29-09), y
                «compartir un caso para la sesión» ya no aplica. La forma exige que en
                CONFIRMADA-pasada no se ofrezcan (FORMA-CITA-CONFIRMADA-HORA-PASADA §1-bis). */}
            {confirmadaViva && <AntesDeLaCita cita={cita} expedientes={expedientes} />}

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

            {/* SPEC-749 FR-2 · la SALIDA cuando la hora ya pasó (CONFIRMADA/PAGADA_PENDIENTE/SIN_CONFIRMAR). */}
            <AccionFranjaPasada acciones={estado.acciones} />

            {/* SPEC-731 §3 · el pie vuelve a la LISTA DE CITAS (donde el padre estaba),
                no a «mi expediente» — que ni es un expediente ni es de donde venía. */}
            <p className="etiqueta text-subtle">
                <Link href="/dashboard/padre/citas" className="underline hover:text-body">Volver a mis citas</Link>
            </p>
        </div>
    );
}
