"use client";

/**
 * SPEC-340 (A-68 §3) — Mis reportes: la pantalla central del hilo.
 *
 * UNA tarjeta por cadena: nick + plataforma, clasificación dominante, cantidad
 * de eventos, fecha del último; acordeón cronológico con «Ver análisis», texto
 * tapado y «Agregar otro evento» (campos fijos — el sistema ya sabe sobre qué
 * está parado); «Otros reportes» blindados; y el botón Crear/Ver expediente.
 * Voz del mockup en tuteo. «Nada se cierra: puedes volver cuando lo necesites.»
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { TextoSensible } from "./TextoSensible";
import { VerAnalisis } from "./VerAnalisis";
import { AgregarEvento } from "./AgregarEvento";

interface EventoCadena {
    id: string;
    fechaIncidente: string;
    creadoEn: string;
    estado: string;
    categoriaLabel: string | null;
    explicacion: string | null;
    esPrincipal: boolean;
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
    const [creandoExp, setCreandoExp] = useState<string | null>(null);

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

    const crearExpediente = useCallback(
        async (cadena: Cadena) => {
            setCreandoExp(cadena.reportePrincipalId);
            try {
                const res = await fetch("/api/padre/expedientes", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reportePrincipalId: cadena.reportePrincipalId }),
                });
                if (!res.ok) throw new Error("No pudimos crear el expediente. Intenta de nuevo.");
                const { expedienteId } = await res.json();
                router.push(`/dashboard/padre/expedientes/${expedienteId}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "No pudimos crear el expediente.");
                setCreandoExp(null);
            }
        },
        [router]
    );

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
                        className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40"
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
                                    {fmtFechaHora.format(new Date(cadena.ultimoEventoEn))}
                                    {cadena.clasificacionDominante ? ` · ${cadena.clasificacionDominante}` : ""}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {cadena.expedienteId ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => router.push(`/dashboard/padre/expedientes/${cadena.expedienteId}`)}
                                    >
                                        Ver expediente
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        isLoading={creandoExp === cadena.reportePrincipalId}
                                        onClick={() => void crearExpediente(cadena)}
                                    >
                                        Crear expediente
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
                                    <div key={ev.id} className="rounded-xl bg-papel/80 p-3 dark:bg-tinta/60">
                                        <p className="text-xs text-muted">
                                            {fmtFechaHora.format(new Date(ev.fechaIncidente))}
                                            {ev.esPrincipal ? " · el primero" : ""}
                                            {ev.categoriaLabel ? ` · ${ev.categoriaLabel}` : ""}
                                        </p>
                                        <div className="mt-2">
                                            <TextoSensible reporteId={ev.id} retapadoMinutos={retapadoMinutos} />
                                        </div>
                                        <div className="mt-2">
                                            <VerAnalisis categoriaLabel={ev.categoriaLabel} explicacion={ev.explicacion} />
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

                                <section>
                                    <h4 className="text-sm font-medium text-body">Otros reportes</h4>
                                    {cadena.otrosReportes.length === 0 ? (
                                        <p className="mt-1 text-sm text-muted">Sin otros reportes por ahora.</p>
                                    ) : (
                                        <>
                                            <p className="mt-1 text-sm text-muted">
                                                No estás solo: {cadena.otrosReportes.length}{" "}
                                                {cadena.otrosReportes.length === 1 ? "persona más reportó" : "personas más reportaron"}{" "}
                                                a {cadena.identificador}.
                                            </p>
                                            <ul className="mt-2 space-y-1">
                                                {cadena.otrosReportes.map((o) => (
                                                    <li key={o.id} className="text-sm text-muted">
                                                        {fmtFechaHora.format(new Date(o.creadoEn))}
                                                        {o.ciudad ? ` · ${o.ciudad}` : ""}
                                                        {o.categoriaLabel ? ` · ${o.categoriaLabel}` : ""}
                                                        {" · "}
                                                        <span className="text-xs">{o.esAnonimo ? "anónimo" : "otro padre"}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="mt-1 text-xs text-muted">
                                                Por privacidad, de otros reportes solo ves fecha, lugar y clasificación —
                                                nunca el texto ni quién reportó.
                                            </p>
                                        </>
                                    )}
                                </section>

                                <p className="text-xs text-muted">
                                    Cada evento que agregas fortalece tu expediente. Nada se cierra: puedes volver
                                    cuando lo necesites.
                                </p>
                            </div>
                        )}
                    </article>
                );
            })}
        </div>
    );
}
