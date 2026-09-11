"use client";

/**
 * SPEC-340 (A-68 §3) — Mis reportes: la pantalla central del hilo.
 *
 * UNA tarjeta por cadena: nick + plataforma, clasificación dominante, cantidad
 * de eventos, fecha del último; acordeón cronológico con «Ver análisis», texto
 * tapado y «Agregar otro evento» (campos fijos — el sistema ya sabe sobre qué
 * está parado); «Otros reportes sobre este identificador» (SPEC-593: tarjeta con
 * contador prominente, eventos con fecha/lugar/clasificación en badges y nota de
 * privacidad; se retira el copy motivacional del mockup); y «Ver expediente».
 *
 * SPEC-604 (modelo EXPEDIENTE · cimientos): el expediente nace SOLO en el alta
 * del primer reporte — el botón «Crear expediente» desaparece (queda «Ver»).
 * Una cadena legada sin expediente simplemente no muestra acción; el endpoint
 * POST /api/padre/expedientes sigue vivo como backfill.
 */
import { fechaHoraSinMinutos, fechaHechoLegible } from "@/lib/format/fecha";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { TextoSensible } from "./TextoSensible";
import { VerAnalisis, type AnalisisIaDto, type FichaHechoDto } from "./VerAnalisis";
import { AgregarEvento } from "./AgregarEvento";

interface EventoCadena {
    id: string;
    fechaIncidente: string;
    horaAproximada: boolean;
    creadoEn: string;
    estado: string;
    categoriaLabel: string | null;
    explicacion: string | null;
    // A-70 · F11: resultado real del motor + ficha del hecho.
    analisisIa: AnalisisIaDto | null;
    ficha: FichaHechoDto;
    esPrincipal: boolean;
    /** SPEC-591: ficha a la que va dirigido este evento (null si no aplica). */
    hijoNombre: string | null;
}

interface OtroReporte {
    id: string;
    creadoEn: string;
    pais: string | null;
    ciudad: string | null;
    categoriaLabel: string | null;
    esAnonimo: boolean;
}

export interface Cadena {
    reportePrincipalId: string;
    identificador: string;
    plataforma: string;
    clasificacionDominante: string | null;
    cantidadEventos: number;
    ultimoEventoEn: string;
    expedienteId: string | null;
    eventos: EventoCadena[];
    otrosReportes: OtroReporte[];
}

const fmtFechaHora = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
});

export function MisReportesCadenas() {
    const router = useRouter();
    const [cadenas, setCadenas] = useState<Cadena[] | null>(null);
    // SPEC-340 §3.3-bis: minutos hasta que el texto revelado se re-tapa solo.
    // Se recibe del servidor (parámetro `padre.texto.retapado_minutos`); 10 es
    // el fallback que replica el default del propio ParametroSistema.
    const [retapadoMinutos, setRetapadoMinutos] = useState(10);
    const [error, setError] = useState("");
    const [abierta, setAbierta] = useState<string | null>(null);
    const [agregandoEn, setAgregandoEn] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch("/api/padre/reportes/cadenas", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar tus reportes.");
            const json = await res.json();
            setCadenas(json.cadenas);
            if (typeof json.retapadoMinutos === "number") setRetapadoMinutos(json.retapadoMinutos);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos cargar tus reportes.");
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    if (error) return <p className="text-sm text-ambar">{error}</p>;
    if (cadenas === null) return <Cargando texto="Cargando tus reportes…" />;
    if (cadenas.length === 0) {
        return (
            <p className="text-sm text-muted">
                Aún no has reportado. Cuando lo hagas, acá verás cada reporte con sus eventos, su análisis y lo
                que otros han reportado.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {cadenas.map((cadena) => {
                const expandida = abierta === cadena.reportePrincipalId;
                return (
                    <article
                        key={cadena.reportePrincipalId}
                        className="rounded-2xl border border-tinta/10 bg-superficie-1 p-4 dark:border-tinta/12"
                    >
                        <header className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h3 className="font-medium text-body">
                                    {cadena.identificador} · {cadena.plataforma}
                                </h3>
                                <p className="mt-0.5 text-sm text-muted">
                                    {cadena.cantidadEventos === 1
                                        ? "1 evento"
                                        : `${cadena.cantidadEventos} eventos tuyos`}
                                    {" · el último "}
                                    {fechaHoraSinMinutos(cadena.ultimoEventoEn)}
                                    {cadena.clasificacionDominante ? ` · ${cadena.clasificacionDominante}` : ""}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {/* SPEC-604: el expediente nace solo en el alta;
                                    ya no hay «Crear expediente», solo «Ver». */}
                                {cadena.expedienteId && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => router.push(`/dashboard/padre/expedientes/${cadena.expedienteId}`)}
                                    >
                                        Ver expediente
                                    </Button>
                                )}
                            </div>
                        </header>

                        <button
                            type="button"
                            className="mt-2 text-xs font-medium text-pino underline-offset-2 hover:underline"
                            aria-expanded={expandida}
                            onClick={() => setAbierta(expandida ? null : cadena.reportePrincipalId)}
                        >
                            {expandida ? "Ocultar los eventos" : "Ver los eventos"}
                        </button>

                        {expandida && (
                            <div className="mt-3 space-y-4 border-t border-tinta/10 pt-3 dark:border-papel/10">
                                {cadena.eventos.map((ev) => (
                                    <div key={ev.id} className="rounded-xl border border-tinta/10 bg-superficie-2 p-3 dark:border-tinta/12">
                                        <p className="text-xs text-muted">
                                            {fechaHechoLegible(ev.fechaIncidente, ev.horaAproximada)}
                                            {ev.esPrincipal ? " · el primero" : ""}
                                            {ev.categoriaLabel ? ` · ${ev.categoriaLabel}` : ""}
                                            {ev.hijoNombre ? ` · dirigido a ${ev.hijoNombre}` : ""}
                                        </p>
                                        <div className="mt-2">
                                            <TextoSensible reporteId={ev.id} retapadoMinutos={retapadoMinutos} />
                                        </div>
                                        <div className="mt-2">
                                            <VerAnalisis
                                                categoriaLabel={ev.categoriaLabel}
                                                explicacion={ev.explicacion}
                                                analisisIa={ev.analisisIa}
                                                ficha={ev.ficha}
                                                fechaIncidente={ev.fechaIncidente}
                                                horaAproximada={ev.horaAproximada}
                                                estado={ev.estado}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {agregandoEn === cadena.reportePrincipalId ? (
                                    <AgregarEvento
                                        reporteId={cadena.reportePrincipalId}
                                        identificador={cadena.identificador}
                                        plataforma={cadena.plataforma}
                                        onListo={() => {
                                            setAgregandoEn(null);
                                            void cargar();
                                        }}
                                        onCancelar={() => setAgregandoEn(null)}
                                    />
                                ) : (
                                    <Button variant="outline" onClick={() => setAgregandoEn(cadena.reportePrincipalId)}>
                                        Agregar otro evento
                                    </Button>
                                )}

                                <section
                                    aria-label="Otros reportes sobre este identificador"
                                    className="rounded-xl border border-tinta/10 bg-superficie-2 p-3 dark:border-tinta/12"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-medium text-body">
                                            Otros reportes sobre este identificador
                                        </h4>
                                        {cadena.otrosReportes.length > 0 && (
                                            <span className="rounded-full bg-cielo/10 px-2.5 py-0.5 text-xs font-semibold text-estado-cielo">
                                                {cadena.otrosReportes.length === 1
                                                    ? "1 persona más"
                                                    : `${cadena.otrosReportes.length} personas más`}
                                            </span>
                                        )}
                                    </div>
                                    {cadena.otrosReportes.length === 0 ? (
                                        <p className="mt-2 text-sm text-muted">Sin otros reportes por ahora.</p>
                                    ) : (
                                        <>
                                            <p className="mt-2 text-sm text-muted">
                                                {cadena.otrosReportes.length === 1 ? (
                                                    <>
                                                        Una persona más reportó a{" "}
                                                        <strong className="text-body">{cadena.identificador}</strong>.
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong className="text-body">
                                                            {cadena.otrosReportes.length} personas más
                                                        </strong>{" "}
                                                        reportaron a <strong className="text-body">{cadena.identificador}</strong>.
                                                    </>
                                                )}
                                            </p>
                                            <ul className="mt-3 space-y-2">
                                                {cadena.otrosReportes.map((o) => (
                                                    <li
                                                        key={o.id}
                                                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                                                    >
                                                        <span className="text-muted">
                                                            {fmtFechaHora.format(new Date(o.creadoEn))}
                                                        </span>
                                                        {o.ciudad ? <span className="text-muted">· {o.ciudad}</span> : null}
                                                        {o.categoriaLabel ? (
                                                            <span className="rounded-full bg-tinta/5 px-2 py-0.5 text-xs font-medium text-body dark:bg-papel/10">
                                                                {o.categoriaLabel}
                                                            </span>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="mt-3 text-xs text-subtle">
                                                Por privacidad, de otros reportes solo ves fecha, lugar y clasificación —
                                                nunca el texto ni quién reportó.
                                            </p>
                                        </>
                                    )}
                                </section>
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}
