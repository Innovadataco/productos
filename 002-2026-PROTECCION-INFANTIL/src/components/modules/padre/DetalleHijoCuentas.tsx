"use client";

/**
 * SPEC-716 (Parte B) · Bajo cada hijo, sus DOS GRUPOS — separados a propósito (mockup 13-09).
 *
 *  A) «Sus cuentas» — ¿alguien reportó una cuenta del hijo? (reportes de OTROS). Del reporte se ve
 *     TODO menos el texto: cantidad, clasificación, fecha, país y ciudad — nunca el relato, nunca
 *     quién reportó. Al pulsar «Ver quién la reportó» se abre el detalle de esa cuenta (in-page).
 *  B) «Cuentas que reportaste por {nombre}» — lo que el PADRE reportó (sus propios reportes con
 *     `hijoId`, SPEC-591). Poblaciones distintas: A y B NO se funden.
 *
 * La cuenta NUNCA viaja en la URL: todo el drill-down es estado de cliente sobre datos ya cargados
 * por el servidor (nada de `?hijo=` ni `/identificador/<cuenta>`). Ámbar, nunca rubí (D-120).
 */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { relativoHumano } from "@/lib/colegio/fechas-humano";
import type { CuentaReportadaDto, ReporteAjenoDto } from "@/lib/dal/services/hijos/reportes-ajenos";
import type { CuentaQueReporteDto } from "@/lib/dal/services/hijos/reportes-propios-por-hijo";

const RUTA_REPORTAR = "/dashboard/padre/reportar";
const RUTA_PSICOLOGOS = "/dashboard/padre/profesionales/directorio";

function fechaHumana(d: Date | string): string {
    return new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

/** El detalle de UNA cuenta: quiénes la reportaron (sin texto, sin nombre). FORMA §3. */
function DetalleCuentaReportada({ nombre, cuenta, onVolver }: { nombre: string; cuenta: CuentaReportadaDto; onVolver: () => void }) {
    // Los anónimos pesan distinto y se muestran APARTE (FORMA §3).
    const verificados = cuenta.reportes.filter((r) => !r.esAnonimo);
    const anonimos = cuenta.reportes.filter((r) => r.esAnonimo);
    const ultima = cuenta.reportes[0]?.creadoEn; // el servicio ordena por creadoEn desc

    return (
        <div className="space-y-4">
            <Button type="button" variant="ghost" onClick={onVolver} className="inline-flex items-center gap-1">
                <span aria-hidden>←</span> Volver a {nombre}
            </Button>

            <header className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-ambar">Reportaron esta cuenta</p>
                <h3 className="text-lg font-semibold text-body">La cuenta de {nombre}</h3>
                <p className="text-sm text-muted">
                    <span className="rounded-full bg-tinta/[0.06] px-2 py-0.5 font-medium text-body">
                        {cuenta.valor}{cuenta.plataforma ? ` · ${cuenta.plataforma}` : ""}
                    </span>
                </p>
                <p className="text-sm text-body">
                    <b>{cuenta.total}</b> {cuenta.total === 1 ? "persona reportó" : "personas reportaron"} esta cuenta
                    {ultima ? <> · la última hace {relativoHumano(new Date(ultima))}</> : null}
                </p>
            </header>

            <div className="rounded-xl bg-tinta/[0.035] p-4 text-sm text-muted">
                <p className="font-medium text-body">Qué significa esto</p>
                <p className="mt-1">
                    Alguien señaló la cuenta de {nombre}. <b>No es una acusación contra {nombre}</b> y tampoco es prueba de
                    nada: es lo que otras personas reportaron. Acá tienes todo lo que podemos mostrarte —
                    <b> menos el texto de cada reporte</b>, que no se muestra.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-cielo/[0.08] p-4 text-sm">
                <span className="text-body">Si te preocupa, habla con alguien que sepa antes de hablar con {nombre}.</span>
                <Link href={RUTA_PSICOLOGOS} className="inline-flex items-center gap-1 rounded-xl bg-cielo px-3 py-1.5 font-semibold text-acento-ink transition hover:brightness-110">
                    Hablar con un psicólogo
                </Link>
            </div>

            <section aria-label="Quién la reportó" className="space-y-2">
                <h4 className="text-sm font-semibold text-body">Quién la reportó</h4>
                {/* Blindaje DICHO, no callado (FORMA §3). */}
                <p className="text-xs text-subtle">
                    El texto del reporte no se muestra, ni acá ni a nadie fuera del equipo. Tampoco verás quién lo escribió
                    — igual que ellos no ven lo tuyo.
                </p>
                <ul className="space-y-2">
                    {verificados.map((r) => <FichaReporte key={r.id} reporte={r} />)}
                </ul>
                {anonimos.length > 0 && (
                    <div className="rounded-xl border border-tinta/10 p-3">
                        <p className="text-xs text-subtle">
                            {anonimos.length === 1 ? "Un reporte anónimo" : `${anonimos.length} reportes anónimos`}, aparte:
                            anónimo de verdad —ni nosotros sabemos quién fue—. Pesa menos que uno verificado (nadie responde
                            por él), por eso te lo mostramos aparte.
                        </p>
                        <ul className="mt-2 space-y-2">
                            {anonimos.map((r) => <FichaReporte key={r.id} reporte={r} />)}
                        </ul>
                    </div>
                )}
            </section>
        </div>
    );
}

/** Una ficha de reporte: EXACTAMENTE 5 campos, sin texto y sin nombre de quien reportó (FORMA §3). */
function FichaReporte({ reporte }: { reporte: ReporteAjenoDto }) {
    return (
        <li className="rounded-xl border border-tinta/10 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-body">{reporte.categoriaLabel ?? "Sin clasificar aún"}</span>
                <span className="text-xs text-subtle">{fechaHumana(reporte.creadoEn)}</span>
            </div>
            <p className="mt-1 text-muted">
                {reporte.ciudad ?? "Sin ciudad"}, {reporte.pais ?? "Sin país"} ·{" "}
                {reporte.esAnonimo ? "Anónimo" : "Una familia con cuenta verificada"}
            </p>
        </li>
    );
}

/** Chip de estado de una cuenta del hijo (grupo A). FORMA §2. */
function chipCuenta(c: CuentaReportadaDto): { texto: string; clase: string } {
    if (c.total > 0) return { texto: c.total === 1 ? "1 reporte" : `${c.total} reportes`, clase: "bg-ambar/10 text-estado-ambar" };
    return { texto: "Nadie la reportó", clase: "bg-pino/10 text-estado-pino" };
}

export function DetalleHijoCuentas({
    hijo,
    grupoA,
    grupoB,
}: {
    hijo: { id: string; nombre: string };
    /** «Sus cuentas»: identificadores activos del hijo + reportes de OTROS. */
    grupoA: CuentaReportadaDto[];
    /** «Cuentas que reportaste por ella»: reportes PROPIOS del padre por este hijo. */
    grupoB: CuentaQueReporteDto[];
}) {
    const [cuentaAbierta, setCuentaAbierta] = useState<CuentaReportadaDto | null>(null);

    if (cuentaAbierta) {
        return (
            <div className="mt-4 rounded-2xl border border-tinta/10 bg-tinta/[0.02] p-4 anim-entrada">
                <DetalleCuentaReportada nombre={hijo.nombre} cuenta={cuentaAbierta} onVolver={() => setCuentaAbierta(null)} />
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-6 anim-entrada">
            {/* GRUPO A · Sus cuentas */}
            <section className="space-y-2" aria-label={`Cuentas de ${hijo.nombre}`}>
                <div>
                    <h3 className="text-base font-semibold text-body">Sus cuentas</h3>
                    <p className="text-sm text-muted">¿Alguien reportó una cuenta de {hijo.nombre}? Acá lo ves y lo puedes validar.</p>
                </div>
                {grupoA.length === 0 ? (
                    <p className="rounded-xl bg-tinta/[0.03] p-3 text-sm text-muted">
                        {hijo.nombre} no tiene cuentas registradas. Sin cuentas no hay nada que mirar por ella; agrégalas en tu perfil cuando las tenga.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {grupoA.map((c) => {
                            const chip = chipCuenta(c);
                            return (
                                <li key={`${c.valor}·${c.plataforma ?? ""}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tinta/10 p-3">
                                    <span className="text-sm text-body">
                                        <b>{c.valor}</b>{c.plataforma ? ` · ${c.plataforma}` : ""}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip.clase}`}>{chip.texto}</span>
                                        {c.total > 0 && (
                                            <Button type="button" variant="ghost" onClick={() => setCuentaAbierta(c)}>
                                                Ver quién la reportó
                                            </Button>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* GRUPO B · Cuentas que reportaste por ella — población distinta, NO se funde con A. */}
            <section className="space-y-2" aria-label={`Cuentas que reportaste por ${hijo.nombre}`}>
                <div>
                    <h3 className="text-base font-semibold text-body">Cuentas que reportaste por {hijo.nombre}</h3>
                    <p className="text-sm text-muted">Las cuentas de otros que le escribieron. Al reportarlas miramos si ya las reportó alguien más.</p>
                </div>
                {grupoB.length === 0 ? (
                    <div className="rounded-xl bg-tinta/[0.03] p-3 text-sm text-muted">
                        <p>Todavía no has reportado ninguna cuenta por {hijo.nombre}.</p>
                        <Link href={RUTA_REPORTAR} className="mt-2 inline-flex items-center gap-1 rounded-xl bg-cielo px-3 py-1.5 text-sm font-semibold text-acento-ink transition hover:brightness-110">
                            + Reportar una cuenta que le escribió
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {grupoB.map((c) => (
                            <li key={c.reporteId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tinta/10 p-3 text-sm">
                                <span className="text-body">
                                    <b>{c.valor}</b>{c.plataforma ? ` · ${c.plataforma}` : ""}
                                </span>
                                <span className="flex items-center gap-2 text-xs">
                                    {c.enRevision ? (
                                        <span className="rounded-full bg-tinta/10 px-2 py-0.5 font-medium text-body">En revisión</span>
                                    ) : (
                                        <span className="rounded-full bg-cielo/10 px-2 py-0.5 font-medium text-estado-cielo">{c.categoriaLabel}</span>
                                    )}
                                    <span className="text-subtle">{fechaHumana(c.creadoEn)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
