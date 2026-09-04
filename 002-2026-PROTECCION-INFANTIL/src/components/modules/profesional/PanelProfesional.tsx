import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { fechaCorta, fechaHora } from "@/lib/format/fecha";
import type { PanelProfesionalDto } from "@/lib/profesional/panel/panel.service";
import { SolicitudAcciones } from "./SolicitudAcciones";
import { CerrarConCodigo } from "./CerrarConCodigo";
import { AbrirExpediente } from "./AbrirExpediente";

/** Días del autocierre (brief §3). Lo dice el servidor; acá solo se muestra. */
const DIAS_AUTOCIERRE_UI = 5;

/**
 * SPEC-425 (A-75 · L5) · El inicio del profesional.
 *
 * Copia el mockup aprobado por Jelkin («Lo que ve el profesional») con **una
 * diferencia deliberada**: los controles que todavía no tienen motor no se
 * pintan como botones. El brief §7 pone el **cierre en L6** y **la plata en
 * L7**; L5 dice «casos por cerrar», que es *listarlos*. Donde falta la acción
 * va una línea que dice qué falta, no un control apagado — un botón
 * deshabilitado sigue prometiendo algo.
 */
export function PanelProfesional({ data }: { data: PanelProfesionalDto }) {
    const primerNombre = data.nombreVisible.split(" ")[0] ?? data.nombreVisible;
    const pendientes = data.solicitudes.length;

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">Hola, {primerNombre}</h1>
                <p className="text-muted">
                    {pendientes === 0
                        ? "No tenés solicitudes esperando respuesta."
                        : `Tenés ${pendientes} solicitud${pendientes === 1 ? "" : "es"} esperando respuesta.`}
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <div className="space-y-6">
                    <Solicitudes data={data} />
                    <CasosPorCerrar data={data} />
                    <CitasConfirmadas data={data} />
                </div>
                <div className="space-y-6">
                    <PorCobrar data={data} />
                    <Marcador data={data} />
                    <Verificacion data={data} />
                    <ExpedientesCompartidos data={data} />
                </div>
            </div>
        </div>
    );
}

function Bloque({
    titulo,
    cuenta,
    calma,
    children,
}: {
    titulo: string;
    // `exactOptionalPropertyTypes` está activo: un opcional que puede recibir
    // `undefined` explícito tiene que declararlo.
    cuenta?: string | undefined;
    calma?: boolean | undefined;
    children: React.ReactNode;
}) {
    return (
        <GlassCard className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-body">{titulo}</h2>
                {cuenta && (
                    <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            calma ? "bg-tinta/5 text-subtle" : "bg-ambar/15 text-ambar"
                        }`}
                    >
                        {cuenta}
                    </span>
                )}
            </div>
            {children}
        </GlassCard>
    );
}

function Vacio({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-muted">{children}</p>;
}

function Avatar({ nombre }: { nombre: string }) {
    const iniciales = nombre
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
    return (
        <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pino/12 text-sm font-semibold text-pino"
        >
            {iniciales || "?"}
        </div>
    );
}

function Solicitudes({ data }: { data: PanelProfesionalDto }) {
    const n = data.solicitudes.length;
    return (
        <Bloque titulo="Solicitudes de primera cita" cuenta={n > 0 ? `${n} sin responder` : undefined}>
            {n === 0 ? (
                <Vacio>Cuando una familia te pida una primera cita, aparece acá.</Vacio>
            ) : (
                <ul className="space-y-4">
                    {data.solicitudes.map((s) => (
                        <li key={s.id} className="flex gap-3 border-t border-tinta/8 pt-4 first:border-0 first:pt-0">
                            <Avatar nombre={s.padreNombre} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-body">{s.padreNombre}</p>
                                <p className="text-xs text-muted">
                                    Pidió {fechaHora(s.inicio)} · {s.modalidad.toLowerCase()}
                                    {s.reservaPagada && <span className="text-pino"> · reserva pagada</span>}
                                </p>
                                {s.compartioExpediente && (
                                    <p className="mt-1 text-xs text-cielo">
                                        Te compartió el expediente de su hijo
                                    </p>
                                )}
                                <SolicitudAcciones solicitudId={s.id} />
                                {s.venceEnRespuesta ? (
                                    <p className="mt-2 text-xs text-ambar">
                                        Tenés plazo hasta el {fechaHora(s.venceEnRespuesta)}. Después se le
                                        abre tu contacto directo y se le devuelve la reserva.
                                    </p>
                                ) : (
                                    <p className="mt-2 text-xs text-muted">
                                        El plazo de 48 h arranca cuando se apruebe el pago de la reserva.
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Bloque>
    );
}

function CasosPorCerrar({ data }: { data: PanelProfesionalDto }) {
    const n = data.casosPorCerrar.length;
    return (
        <Bloque titulo="Casos por cerrar" cuenta={n > 0 ? `${n} pendiente${n === 1 ? "" : "s"}` : undefined}>
            {n === 0 ? (
                <Vacio>Las citas que ya pasaron y falta cerrar aparecen acá.</Vacio>
            ) : (
                <ul className="space-y-4">
                    {data.casosPorCerrar.map((c) => (
                        <li key={c.id} className="flex gap-3 border-t border-tinta/8 pt-4 first:border-0 first:pt-0">
                            <Avatar nombre={c.padreNombre} />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-body">{c.padreNombre}</p>
                                <p className="text-xs text-muted">
                                    Cita del {fechaHora(c.inicio)} · {c.modalidad.toLowerCase()}
                                </p>
                                <p className="mt-2 text-xs text-muted">
                                    Tu pago de{" "}
                                    <strong className="text-body">{pesos(c.montoRetenido)}</strong> queda
                                    retenido hasta que la cierres.
                                </p>
                                <CerrarConCodigo solicitudId={c.id} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {/* SPEC-427: el cierre ya existe. Liberar el pago sigue siendo de L7. */}
            <p className="mt-4 border-t border-tinta/8 pt-3 text-xs text-subtle">
                Cerrás la cita con el código que te dicta el padre. Si pasan {DIAS_AUTOCIERRE_UI} días sin
                cerrarla, queda sin confirmar y no entra en el pago.
                <br />
                El giro de la plata todavía no está disponible: por ahora cerrar deja la constancia.
            </p>
        </Bloque>
    );
}

function CitasConfirmadas({ data }: { data: PanelProfesionalDto }) {
    const n = data.citasConfirmadas.length;
    return (
        <Bloque titulo="Citas confirmadas" cuenta={n > 0 ? `${n} por delante` : undefined} calma>
            {n === 0 ? (
                <Vacio>Cuando confirmes una solicitud, la vas a ver en esta agenda.</Vacio>
            ) : (
                <ul className="space-y-3">
                    {data.citasConfirmadas.map((c) => (
                        <li key={c.id} className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-tinta/5">
                                <span className="text-sm font-bold leading-none text-body">
                                    {fechaCorta(c.inicio).split(" ")[0]}
                                </span>
                                <span className="text-[10px] uppercase text-subtle">
                                    {fechaCorta(c.inicio).split(" ")[1]}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-body">{c.padreNombre}</p>
                                <p className="text-xs text-muted">
                                    {fechaHora(c.inicio)} · {c.modalidad.toLowerCase()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Bloque>
    );
}

function pesos(valor: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(valor);
}

function PorCobrar({ data }: { data: PanelProfesionalDto }) {
    const { montoRetenido, citasEsperandoCierre, desglose } = data.porCobrar;
    return (
        <Bloque titulo="Por cobrar">
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-body">{pesos(montoRetenido)}</span>
                <span className="text-xs text-muted">
                    {citasEsperandoCierre} cita{citasEsperandoCierre === 1 ? "" : "s"} esperando cierre
                </span>
            </div>
            <p className="mt-2 text-xs text-muted">
                Una cita sin cerrar no entra en el giro.
            </p>
            <dl className="mt-4 space-y-1.5 border-t border-tinta/8 pt-3 text-xs">
                <Fila termino="Tu tarifa por consulta" valor={pesos(desglose.tarifaProfesional)} fuerte />
                <Fila termino="El padre paga" valor={pesos(desglose.pagaElPadre)} />
                <Fila
                    termino={`Servicio de la red (${desglose.porcentajeServicio}%)`}
                    valor={pesos(desglose.servicioRed)}
                />
            </dl>
            <p className="mt-3 text-xs text-subtle">
                Vos ponés tu tarifa. Podés cambiarla cuando quieras desde tu perfil.
            </p>
        </Bloque>
    );
}

function Fila({ termino, valor, fuerte }: { termino: string; valor: string; fuerte?: boolean | undefined }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{termino}</dt>
            <dd className={fuerte ? "font-semibold text-body" : "text-body"}>{valor}</dd>
        </div>
    );
}

function Marcador({ data }: { data: PanelProfesionalDto }) {
    const { familiasAtendidas, solicitudesRecibidas, sinConfirmar } = data.marcador;
    return (
        <Bloque titulo="Tu año en la red">
            <div className="grid grid-cols-3 gap-2 text-center">
                <Kpi n={familiasAtendidas} etiqueta="familias atendidas" />
                <Kpi n={solicitudesRecibidas} etiqueta="solicitudes recibidas" />
                <Kpi n={sinConfirmar} etiqueta="sin confirmar" apagado />
            </div>
            <p className="mt-4 text-xs text-muted">
                Solo cuentan las que atendiste. Las <strong>sin confirmar</strong> no suman ni se giran.
            </p>
        </Bloque>
    );
}

function Kpi({ n, etiqueta, apagado }: { n: number; etiqueta: string; apagado?: boolean | undefined }) {
    return (
        <div className="rounded-xl bg-tinta/4 p-3">
            <span className={`block text-xl font-bold ${apagado ? "text-subtle" : "text-body"}`}>{n}</span>
            <span className="block text-[11px] leading-tight text-muted">{etiqueta}</span>
        </div>
    );
}

function Verificacion({ data }: { data: PanelProfesionalDto }) {
    const v = data.verificacion;
    return (
        <Bloque titulo="Tu verificación">
            {!v ? (
                <Vacio>Tu perfil todavía no pasó por verificación.</Vacio>
            ) : (
                <>
                    <p className="text-sm font-semibold text-body">
                        {v.alDia ? "Al día" : "Vencida"}
                    </p>
                    <p className="text-xs text-muted">
                        Revisada el {fechaCorta(v.revisadaEn)} · vence el {fechaCorta(v.venceEn)}
                    </p>
                    <p className="mt-3 text-xs text-subtle">
                        {v.alDia
                            ? "Te avisamos con un mes de anticipación. Si vence, tu perfil deja de mostrarse hasta que se revise de nuevo."
                            : "Mientras esté vencida tu perfil no se muestra a las familias. Volvé a enviarlo para que lo revisen."}
                    </p>
                    <Link
                        href="/perfil-profesional/verificacion"
                        className="mt-3 inline-block rounded-xl border border-tinta/15 px-3 py-1.5 text-xs font-medium text-body transition hover:bg-tinta/5"
                    >
                        Ver el detalle
                    </Link>
                </>
            )}
        </Bloque>
    );
}

function ExpedientesCompartidos({ data }: { data: PanelProfesionalDto }) {
    const n = data.expedientesCompartidos.length;
    return (
        <Bloque titulo="Expedientes compartidos" cuenta={n > 0 ? `${n} activo${n === 1 ? "" : "s"}` : undefined} calma>
            {n === 0 ? (
                <Vacio>Cuando una familia te comparta el expediente de su hijo, aparece acá.</Vacio>
            ) : (
                <ul className="space-y-2">
                    {data.expedientesCompartidos.map((e) => (
                        <AbrirExpediente key={e.solicitudId} solicitudId={e.solicitudId} padreNombre={e.padreNombre} />
                    ))}
                </ul>
            )}
            {/* Brief §9 momento 6: se abren con el código que la familia entrega. */}
            <p className="mt-3 text-xs text-subtle">
                Cada expediente se abre con el código que la familia te dicta en la sesión, en solo
                lectura. Sin ese código, solo ves quién te lo compartió.
            </p>
        </Bloque>
    );
}
