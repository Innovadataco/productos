import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { fechaCorta, fechaHora } from "@/lib/format/fecha";
import type { PanelProfesionalDto } from "@/lib/profesional/panel/panel.service";
import type { ModalidadOferta } from "@/lib/profesional/reps/aviso-estado-reps";
import { SolicitudAcciones } from "./SolicitudAcciones";

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
/**
 * SPEC-437 (A-75): los bloques se EXPORTAN porque «Citaciones» y «Casos»
 * son ahora pantallas propias del menú y muestran exactamente esto mismo.
 * Reusar el bloque —no copiarlo— es lo que impide que el Inicio y la
 * pantalla dedicada digan cosas distintas del mismo dato.
 */
export function PanelProfesional({ data }: { data: PanelProfesionalDto }) {
    const pendientes = data.solicitudes.length;

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">{data.saludo}</h1>
                <p className="text-muted">
                    {pendientes === 0
                        ? "Sin solicitudes por responder."
                        : `${pendientes} solicitud${pendientes === 1 ? "" : "es"} por responder.`}
                </p>
            </header>

            {/* SPEC-813: banner «fuera de la oferta» cuando el REPS CADUCÓ (estados 4/6). Conserva el acceso
                (entra y lo ve); ámbar, cero rubí; no promete reasignación ni notificación. */}
            {data.avisoReps === "CADUCADO" && <AvisoRepsCaducado />}

            {/* SPEC-836 pieza 2: banner de RE-VERIFICACIÓN NUESTRA (estado 7). REVISION_ADMIN funde 5/7/8; la
                copy «su inscripción sigue al día» SOLO es cierta en el 7 (zona RE_VERIFICAR) → se gatea con
                `esReVerificacionReps`. El 5 (NO_ENCONTRADA) y el 8 quedan admin-only (como antes). */}
            {data.avisoReps === "REVISION_ADMIN" && data.esReVerificacionReps && <AvisoRepsRevisionAdmin />}

            {/* SPEC-836 (4ª variante): estado 5 (NO_ENCONTRADA). REVISION_ADMIN funde 5/7/8; el 7 muestra
                re-verificación («sigue al día»), el 5 NO (ahí no aparece en el registro). El 5 bifurca sin
                asignar causa. Excluyente con el de arriba; el 8 es inconstruible → sin banner. */}
            {data.avisoReps === "REVISION_ADMIN" && data.esNoConfirmadaReps && <AvisoRepsNoConfirmada />}

            {/* SPEC-836 pieza 2: banner del HUECO DE MODALIDAD — el REPS está vigente pero no cubre una
                modalidad que el profesional OFRECE. 813 decía AL_DIA mientras 825/834/814 ya actuaban sobre
                él. Aquí SÍ es su acción (actualizar su inscripción o dejar de ofrecer esa modalidad). */}
            {data.avisoReps === "MODALIDAD_NO_CUBIERTA" && (
                <AvisoRepsModalidadNoCubierta modalidades={data.modalidadesRepsNoCubiertas} />
            )}

            {/* SPEC-610 (I-372): la ENTRADA VISIBLE al canje del pase. Antes
                `/canjear-acceso` no estaba enlazada desde ningún lado (solo en
                proxy.ts) y el profesional tenía que adivinar la URL — la función
                vivió muerta. Es la primera acción de su área, como en el mockup
                aprobado. El candado de cableado muere si este enlace desaparece
                del árbol de render del profesional. */}
            <GlassCard className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-body">Abrir un caso con un pase</h2>
                        <p className="mt-1 text-sm text-muted">
                            Pídale el pase al padre o a la madre. Son 8 caracteres.
                        </p>
                    </div>
                    <Link
                        href="/canjear-acceso"
                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                    >
                        Abrir un caso
                    </Link>
                </div>
            </GlassCard>

            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <div className="space-y-6">
                    <Solicitudes data={data} />
                    <CasosPorCerrar data={data} />
                    <SesionesPorRegistrar data={data} />
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

/**
 * SPEC-813 (FORMA-SPEC790-AVISO v4.1) · Banner que ve el profesional cuando su inscripción REPS CADUCÓ
 * (estados 4 VENCIDA / 6 vigencia pasada). Conserva el ACCESO, pierde la OFERTA: «sigue teniendo su
 * espacio, pero por ahora no lo estamos ofreciendo», nunca «perdió el acceso». Ámbar, cero rubí; voz usted.
 * NO promete reasignación de citas (no existe; es T7) ni notificación («el sistema le avisa»). NO predica
 * «habilitado» del profesional — la OFERTA es el eje visible. Lleva a su perfil/estado (la explicación +
 * cómo renovar); no es un callejón porque conserva el acceso.
 */
export function AvisoRepsCaducado() {
    return (
        <section
            aria-label="Estado de su inscripción en el registro de salud"
            className="rounded-2xl border border-ambar/30 bg-ambar/10 p-5 text-estado-ambar"
        >
            <h2 className="text-base font-semibold">Sigue teniendo su espacio aquí — por ahora no lo estamos ofreciendo a las familias.</h2>
            <div className="mt-2 space-y-2 text-sm">
                <p>
                    Su inscripción en el registro de salud figura como <strong>no vigente</strong> (lo verificamos contra el
                    registro oficial). Suele deberse a una <strong>renovación pendiente</strong> — no es una sanción ni un juicio
                    sobre su trabajo, y <strong>no pierde su cuenta ni su acceso a esta área.</strong>
                </p>
                <p>Mientras su inscripción no esté vigente, no aparece en la oferta a las familias ni recibe citas nuevas.</p>
                <p>
                    Cuando su inscripción vuelva a estar vigente, vuelve a la oferta por sí solo — no tiene que inscribirse de
                    nuevo ni pedir un reingreso.
                </p>
            </div>
            <Link
                href="/dashboard/profesional/mi-perfil"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-ambar/40 px-5 py-2.5 text-sm font-semibold transition hover:bg-ambar/10"
            >
                Ver qué significa y cómo renovar
            </Link>
        </section>
    );
}

/**
 * SPEC-836 pieza 2 · banner del HUECO DE MODALIDAD. El REPS está VIGENTE pero no cubre una (o ambas) de las
 * modalidades que el profesional OFRECE; 813 le decía AL_DIA mientras 825/834/814 ya actuaban. Acción SUYA
 * (actualizar la cobertura o dejar de ofrecer esa modalidad) → por eso va a SU panel, no al admin (que no
 * puede arreglarla). Nombra la(s) modalidad(es) —el hueco doble nombra las dos— para que no arregle la mitad.
 *
 * Copy VERBATIM de Diseño (FORMA-SPEC836, v1.0, commit c02e7e4 en Gestión), voz usted. Dos cadenas: singular
 * (una modalidad) y plural (las dos nombradas), NO un «(s)» que partiría el mensaje. El token {modalidad} se
 * interpola como «virtuales»/«presenciales» (concuerda con «citas»). Sin enlace: la forma describe las dos
 * salidas en prosa y no especifica uno (a diferencia de CADUCADO). No se reescribe; si Diseño reemite, se
 * re-transcribe.
 */
export function AvisoRepsModalidadNoCubierta({ modalidades }: { modalidades: readonly ModalidadOferta[] }) {
    const palabra = (m: ModalidadOferta) => (m === "VIRTUAL" ? "virtuales" : "presenciales");
    const plural = modalidades.length > 1;
    const lista = plural
        ? `${palabra(modalidades[0]!)} y ${palabra(modalidades[1]!)}`
        : palabra(modalidades[0] ?? "VIRTUAL");
    return (
        <section
            aria-label="Cobertura de modalidad en su inscripción en el registro de salud"
            className="rounded-2xl border border-ambar/30 bg-ambar/10 p-5 text-estado-ambar"
        >
            <h2 className="text-base font-semibold">
                Ofrece citas {lista}, pero su inscripción en el registro no cubre{" "}
                {plural ? "esas modalidades" : "esa modalidad"} — las familias no pueden{" "}
                {plural ? "reservarlas" : "reservarla"}.
            </h2>
            <p className="mt-2 text-sm">
                Actualice su inscripción para que cubra {lista}, o deje de ofrecer{" "}
                {plural ? "esas modalidades" : "esa modalidad"}.
            </p>
        </section>
    );
}

/**
 * SPEC-836 pieza 2 · banner de RE-VERIFICACIÓN NUESTRA (estado 7: nuestro re-chequeo envejeció, la autoridad
 * sigue dando la inscripción por vigente). v4.1 enrutaba este estado SOLO al admin («sería un callejón»); el
 * CEO revirtió esa decisión (FORMA-SPEC790 v4.2/v4.3) porque 825 (oculta franjas) y 814 (cola) volvieron el
 * silencio PORTANTE: el profesional ve que nadie le reserva y se inventa la explicación. A diferencia de
 * CADUCADO (suya: renueve) y del hueco de modalidad (suya: actualice/deje), aquí NO hay nada que él haga.
 *
 * Copy VERBATIM de Diseño (FORMA-SPEC790 v4.3, commit 45e1623, voz usted). DOS oraciones, ambas obligatorias:
 * la 1.ª tranquiliza (es nuestro, nada que hacer); la 2.ª explica el SÍNTOMA que él observa (su oferta en
 * pausa) — sin ella el banner tranquiliza pero no conecta con lo que ve. Sin plazo (ata al evento, no al
 * reloj: la re-verificación es carga manual). Sin enlace: no hay acción suya.
 */
export function AvisoRepsRevisionAdmin() {
    return (
        <section
            aria-label="Estado de la verificación de su inscripción en el registro de salud"
            className="rounded-2xl border border-ambar/30 bg-ambar/10 p-5 text-estado-ambar"
        >
            <h2 className="text-base font-semibold">
                Estamos re-verificando su inscripción — es un chequeo nuestro y su inscripción sigue al día, así
                que no hay nada que usted deba hacer.
            </h2>
            <p className="mt-2 text-sm">
                Mientras lo completamos, su oferta a las familias queda en pausa; vuelve por sí sola cuando
                terminemos.
            </p>
        </section>
    );
}

/**
 * SPEC-836 (4ª variante) · estado 5 (NO_ENCONTRADA): el REPS NO confirmó su inscripción. v4.1 lo mandaba al
 * admin; 836 le da voz porque 825 le oculta las franjas igual que en el 7, pero la copy del 7 («sigue al día»)
 * MENTIRÍA acá (no aparece en el registro) — por eso banner propio.
 *
 * Copy VERBATIM de Diseño (FORMA-SPEC790 v4.5, commit 2f88930, voz usted). El 5 es AMBIGUO (no inscrito / laguna
 * nuestra) y no se resuelve desde afuera: la copy NO asigna la causa — BIFURCA por lo que ÉL sabe. Tres PARÁ del
 * CEO respetados: SIN «escríbanos» (el profesional no tiene canal de soporte), SIN «lo estamos revisando» (0
 * verificadores activos = falso-conducta), sin enlace. «es algo de nuestro lado» ubica la responsabilidad sin
 * afirmar una revisión que no ocurre.
 */
export function AvisoRepsNoConfirmada() {
    return (
        <section
            aria-label="Estado de su inscripción en el registro de salud"
            className="rounded-2xl border border-ambar/30 bg-ambar/10 p-5 text-estado-ambar"
        >
            <h2 className="text-base font-semibold">
                No pudimos confirmar su inscripción en el registro, así que su oferta a las familias está en pausa.
            </h2>
            <p className="mt-2 text-sm">
                Si todavía no completó su inscripción en el registro, complétela y vuelve a la oferta. Si ya está
                inscrito y vigente, es algo de nuestro lado y no tiene que hacer nada.
            </p>
        </section>
    );
}

export function Solicitudes({ data }: { data: PanelProfesionalDto }) {
    const n = data.solicitudes.length;
    return (
        <Bloque titulo="Solicitudes de primera cita" cuenta={n > 0 ? `${n} sin responder` : undefined}>
            {n === 0 ? (
                <Vacio>Sin solicitudes.</Vacio>
            ) : (
                <ul className="space-y-4">
                    {data.solicitudes.map((s) => (
                        <li key={s.id} className="flex gap-3 border-t border-tinta/8 pt-4 first:border-0 first:pt-0">
                            <Avatar nombre={s.padreNombre} />
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-body">
                                    {s.padreNombre}
                                    {/* SPEC-712 §3: la marca urgente para que el profesional trie a quién
                                        confirmar. No promete rapidez al padre; ordena la atención. */}
                                    {s.urgente && (
                                        <span className="rounded-full bg-ambar/15 px-2 py-0.5 text-[11px] font-medium text-estado-ambar">
                                            Urgente
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-muted">
                                    Pidió {fechaHora(s.inicio)} · {s.modalidad.toLowerCase()}
                                    {s.reservaPagada && <span className="text-pino"> · reserva pagada</span>}
                                </p>
                                {s.compartioExpediente && (
                                    <p className="mt-1 text-xs text-cielo">
                                        Le compartió el expediente de su hijo
                                    </p>
                                )}
                                <SolicitudAcciones estado={s.estado} solicitudId={s.id} />
                                {s.venceEnRespuesta ? (
                                    <p className="mt-2 text-xs text-ambar">
                                        Plazo hasta el {fechaHora(s.venceEnRespuesta)}. Vencido, se abre
                                        el contacto directo y se devuelve la reserva.
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

/**
 * SPEC-784 · Un ítem de trabajo más en la cola del profesional: las sesiones que le quedan por
 * registrar (su encuesta de servicio pendiente). Sobrio, voz de usted, sin calidez — para él es un
 * registro, no un desahogo. Permanece hasta registrar; si no hay ninguna, no ocupa lugar en la cola.
 */
export function SesionesPorRegistrar({ data }: { data: PanelProfesionalDto }) {
    const n = data.sesionesPorRegistrar;
    if (n === 0) return null;
    return (
        <Bloque titulo="Sesiones por registrar" cuenta={`${n}`}>
            <p className="text-sm text-muted">
                {n === 1 ? "Tiene una sesión por registrar." : `Tiene ${n} sesiones por registrar.`} Su
                registro cierra el servicio de la cita.
            </p>
            <Link
                href="/encuesta"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-tinta/15 px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-tinta/5"
            >
                Registrar
            </Link>
        </Bloque>
    );
}

export function CasosPorCerrar({ data }: { data: PanelProfesionalDto }) {
    const n = data.casosPorCerrar.length;
    return (
        <Bloque titulo="Casos por cerrar" cuenta={n > 0 ? `${n} pendiente${n === 1 ? "" : "s"}` : undefined}>
            {n === 0 ? (
                <Vacio>Sin casos por cerrar.</Vacio>
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
                                    Pago retenido:{" "}
                                    <strong className="text-body">{pesos(c.montoRetenido)}</strong>. Se libera
                                    al cerrar la cita.
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {/* Honestidad sobre el alcance: el cierre es de L6, no de este lote. */}
            <p className="mt-4 border-t border-tinta/8 pt-3 text-xs text-subtle">
                El cierre de la cita todavía no está disponible.
            </p>
        </Bloque>
    );
}

export function CitasConfirmadas({ data }: { data: PanelProfesionalDto }) {
    const n = data.citasConfirmadas.length;
    return (
        <Bloque titulo="Citas confirmadas" cuenta={n > 0 ? `${n} por delante` : undefined} calma>
            {n === 0 ? (
                <Vacio>Sin citas confirmadas.</Vacio>
            ) : (
                <ul className="space-y-3">
                    {data.citasConfirmadas.map((c) => (
                        <li key={c.id} className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-tinta/5">
                                <span className="text-sm font-bold leading-none text-body">
                                    {fechaCorta(c.inicio).split(" ")[0]}
                                </span>
                                <span className="text-[11px] uppercase text-subtle">
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
            {/* SPEC-715 · abrir el caso con el pase: la familia le dicta 8 caracteres en la
                sesión; usted los canjea acá (la pantalla ya existe). No se le muestra el pase —
                lo dicta la familia—; solo el camino para canjearlo. */}
            {n > 0 && (
                <p className="mt-4 border-t border-tinta/8 pt-3 text-xs text-muted">
                    La familia le dará un pase en la sesión (8 caracteres) para abrir su caso.{" "}
                    <Link href="/canjear-acceso" className="font-medium text-accent underline">
                        Abrir un caso con un pase
                    </Link>
                </p>
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

export function PorCobrar({ data }: { data: PanelProfesionalDto }) {
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
                <Fila termino="Su tarifa por consulta" valor={pesos(desglose.tarifaProfesional)} fuerte />
                <Fila termino="El padre paga" valor={pesos(desglose.pagaElPadre)} />
                <Fila
                    termino={`Servicio de la red (${desglose.porcentajeServicio}%)`}
                    valor={pesos(desglose.servicioRed)}
                />
            </dl>
            <p className="mt-3 text-xs text-subtle">
                La tarifa se edita en el perfil.
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
        <Bloque titulo="Su año en la red">
            <div className="grid grid-cols-3 gap-2 text-center">
                <Kpi n={familiasAtendidas} etiqueta="familias atendidas" />
                <Kpi n={solicitudesRecibidas} etiqueta="solicitudes recibidas" />
                <Kpi n={sinConfirmar} etiqueta="sin confirmar" apagado />
            </div>
            <p className="mt-4 text-xs text-muted">
                Solo cuentan las atendidas. Las <strong>sin confirmar</strong> no suman ni se giran.
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
        <Bloque titulo="Su verificación">
            {!v ? (
                <Vacio>Sin verificación registrada.</Vacio>
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
                            ? "Aviso un mes antes del vencimiento. Vencida, el perfil deja de mostrarse."
                            : "Vencida, el perfil no se muestra a las familias. Envíelo de nuevo para revisión."}
                    </p>
                    {/* SPEC-706: «Mi estado» (/perfil-profesional/verificacion) se retiró. El detalle
                        de verificación del habilitado vive en «Mi perfil». */}
                    <Link
                        href="/dashboard/profesional/mi-perfil"
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
                <Vacio>Sin expedientes compartidos.</Vacio>
            ) : (
                <ul className="space-y-2">
                    {data.expedientesCompartidos.map((e) => (
                        <li key={e.solicitudId} className="rounded-xl bg-cielo/8 p-3">
                            <p className="text-sm font-medium text-body">{e.padreNombre}</p>
                            <p className="text-xs text-muted">
                                Solo lectura · el padre puede cerrarlo cuando quiera
                            </p>
                        </li>
                    ))}
                </ul>
            )}
            {/* Brief §9: se listan, no se abren sin el código que da el padre. */}
            <p className="mt-3 text-xs text-subtle">
                El expediente se abre con el código que la familia le entrega en la sesión. Desde aquí
                solo ve quién se lo compartió.
            </p>
        </Bloque>
    );
}
