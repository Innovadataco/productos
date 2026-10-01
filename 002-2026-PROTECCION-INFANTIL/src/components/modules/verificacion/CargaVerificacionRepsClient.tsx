"use client";

/**
 * SPEC-790 (T6) · Carga MANUAL de verificación de habilitación (REPS) — pantalla admin.
 * FORMA-SPEC790-ADMIN-CARGA-VERIFICACION-HABILITACION v1.2 (Diseño, 30-09, commit 53844d0).
 *
 * El admin TRANSCRIBE lo que leyó en la fuente oficial (no decide, copia). La pantalla hace sentir el peso
 * sin paralizar (§0), distingue los CUATRO resultados sin pensar (§1, verbo + ícono/tono; Vencida ≠ No
 * encontrada; cero rubí — D-120), vuelve IMPOSIBLE guardar «Vigente» sin fecha + ≥1 modalidad (§2/§3,
 * Guardar deshabilitado estructural: la UI nunca construye la combinación que la base rechaza), dice lo que
 * la acción NO hace (§4) y recibe al admin con un estado VACÍO de primera clase (§5). Voz USTED (interno).
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Alerta } from "@/components/ui/Alerta";
import { diaBogota, instanteDesdeHoraBogota, formatoFechaBogota } from "@/lib/fechas/formato-bogota";
import type { RepsCargaItem } from "@/lib/dal/repositories/perfil-profesional";

type EstadoReps = RepsCargaItem["estadoReps"];
type ModalidadReps = "PRESENCIAL" | "TELEMEDICINA";

/**
 * Los CUATRO resultados (§1). El `dice` queda en PRIMERA PERSONA del admin a propósito (v1.2: es su
 * statement, «la busqué/encontré», no un desliz ni voseo). Tono ámbar/tinta/cielo — NUNCA rubí (el rojo se
 * reserva a la criticidad de protección de un menor, D-120). El verbo + el ícono + el tono separan «Vencida»
 * («la encontré, caducó») de «No encontrada» («busqué y no existe»): confundirlas acusa de algo distinto.
 */
const RESULTADOS: ReadonlyArray<{ valor: EstadoReps; rotulo: string; dice: string; tono: string; icono: string }> = [
    { valor: "VIGENTE", rotulo: "Vigente", dice: "La busqué y está vigente.", tono: "bg-cielo/10 text-estado-cielo", icono: "✓" },
    { valor: "VENCIDA", rotulo: "Vencida", dice: "La encontré y está vencida.", tono: "bg-ambar/10 text-estado-ambar", icono: "⚠" },
    { valor: "NO_ENCONTRADA", rotulo: "No encontrada", dice: "La busqué y no aparece en la fuente.", tono: "bg-tinta/10 text-body", icono: "∅" },
    { valor: "SIN_VERIFICAR", rotulo: "Sin verificar", dice: "Todavía no la verifiqué.", tono: "bg-tinta/5 text-subtle", icono: "◷" },
];
const POR_VALOR = new Map(RESULTADOS.map((r) => [r.valor, r] as const));

/** Catálogo del producto (§3). El rótulo es «Virtual/Presencial»; el valor es el `ModalidadReps` del REPS
 *  (TELEMEDICINA corresponde al VIRTUAL de la cita). La lista DECIDE: el profesional solo se ofrece en estas. */
const MODALIDADES: ReadonlyArray<{ valor: ModalidadReps; rotulo: string }> = [
    { valor: "TELEMEDICINA", rotulo: "Virtual" },
    { valor: "PRESENCIAL", rotulo: "Presencial" },
];

/** §4 · Lo que la acción NO hace (en la confirmación y tras guardar). Verbatim de Diseño. */
const NO_HACE: readonly string[] = [
    "Registrar esto no le envía aviso al profesional.",
    "El sistema no comprueba la habilitación; registra lo que usted transcribió de la fuente oficial.",
    "Cada carga queda registrada con quién la hizo y cuándo; una corrección es una carga nueva, no un borrón.",
];

function InsigniaEstado({ estado }: { estado: EstadoReps }) {
    const r = POR_VALOR.get(estado)!;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.tono}`}>
            <span aria-hidden>{r.icono}</span>
            {r.rotulo}
        </span>
    );
}

export function CargaVerificacionRepsClient({ profesionalesIniciales }: { profesionalesIniciales: RepsCargaItem[] }) {
    const [profesionales, setProfesionales] = useState<RepsCargaItem[]>(profesionalesIniciales);
    const [activo, setActivo] = useState<RepsCargaItem | null>(null);

    // Estado del formulario (se reinicia al abrir el modal de un profesional).
    const [resultado, setResultado] = useState<EstadoReps | null>(null);
    const [fecha, setFecha] = useState("");
    const [modalidades, setModalidades] = useState<ModalidadReps[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState(false);

    const refrescar = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/verificacion-profesionales/reps", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as { data?: RepsCargaItem[] };
            if (data.data) setProfesionales(data.data);
        } catch {
            /* la lista vieja queda; no rompemos la pantalla por un refresco fallido */
        }
    }, []);

    function abrir(p: RepsCargaItem) {
        setActivo(p);
        setResultado(null);
        setFecha("");
        setModalidades([]);
        setError(null);
        setExito(false);
    }
    function cerrar() {
        setActivo(null);
    }

    // Al cambiar el resultado, la fecha y las modalidades solo aplican a «Vigente»: se limpian para los otros
    // tres (y para que `puedeGuardar` no arrastre valores que no corresponden).
    function elegirResultado(valor: EstadoReps) {
        setResultado(valor);
        if (valor !== "VIGENTE") {
            setFecha("");
            setModalidades([]);
        }
    }
    function alternarModalidad(valor: ModalidadReps) {
        setModalidades((prev) => (prev.includes(valor) ? prev.filter((m) => m !== valor) : [...prev, valor]));
    }

    const esVigente = resultado === "VIGENTE";
    // §2: una fecha ya pasada sobre «Vigente» probablemente es «Vencida». Se AVISA, no se bloquea.
    const fechaEsPasada = esVigente && fecha !== "" && fecha < diaBogota();
    // §2/§3 · IMPOSIBILIDAD ESTRUCTURAL: Guardar queda deshabilitado hasta que la combinación sea construible.
    // «Vigente» exige fecha + ≥1 modalidad; los otros tres no piden nada más. La UI NUNCA arma el «vigente sin
    // fecha» que la base rechazaría con su error crudo.
    const puedeGuardar =
        !enviando && !exito && resultado !== null && (!esVigente || (fecha !== "" && modalidades.length >= 1));

    async function guardar() {
        if (!activo || resultado === null || !puedeGuardar) return;
        setEnviando(true);
        setError(null);
        try {
            const body = {
                resultado,
                vigenteHasta: esVigente && fecha ? instanteDesdeHoraBogota(fecha, "23:59").toISOString() : null,
                modalidades: esVigente ? modalidades : [],
            };
            const res = await fetch(`/api/admin/verificacion-profesionales/${activo.id}/reps`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!res.ok) throw new Error(data.error?.message ?? "No se pudo registrar la verificación.");
            setExito(true);
            await refrescar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ocurrió un error al registrar la verificación.");
        } finally {
            setEnviando(false);
        }
    }

    const sinProfesionales = profesionales.length === 0;
    // §5 · el estado VACÍO de primera clase: HOY nadie tiene verificación cargada (es el caso NORMAL).
    const ningunaVerificacion = !sinProfesionales && profesionales.every((p) => p.verificadoEn === null);

    // SPEC-813 §5-bis · la ALARMA de admin, dos ZONAS por tipo de trabajo (el 5 grave no comparte forma con
    // el 7 rutinario, para que su goteo no lo sepulte). «Revisar»: algo MAL en el registro (5 arriba y
    // prominente, 8 debajo). «Re-verificar»: rutina NUESTRA (7), callada y creciente.
    const zonaRevisar = profesionales
        .filter((p) => p.zonaAdmin === "REVISAR")
        .sort((a, b) => Number(b.estadoReps === "NO_ENCONTRADA") - Number(a.estadoReps === "NO_ENCONTRADA"));
    const zonaReVerificar = profesionales.filter((p) => p.zonaAdmin === "RE_VERIFICAR");

    return (
        <div className="space-y-5 anim-entrada">
            {sinProfesionales ? (
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="cuerpo text-subtle">No hay profesionales activos para verificar todavía.</p>
                </div>
            ) : (
                <>
                    {ningunaVerificacion && (
                        // §5 · no una lista muda: mensaje con la acción a la vista. (Copy de Diseño v1.2.)
                        <div className="glass rounded-2xl border border-cielo/20 p-5">
                            <p className="font-semibold text-body">Todavía no hay verificaciones de habilitación cargadas.</p>
                            <p className="cuerpo text-subtle mt-1">
                                Cargue la primera para que los profesionales puedan aparecer en la oferta a las familias.
                            </p>
                        </div>
                    )}

                    {/* SPEC-813 §5-bis · Zona «Revisar»: algo MAL en el registro — un humano lo investiga.
                        Prominente (ámbar firme) + conteo; el 5 (No encontrada) primero por ser el grave. */}
                    {zonaRevisar.length > 0 && (
                        <section aria-label="Revisar" className="rounded-2xl border border-ambar/30 bg-ambar/10 p-5">
                            <h2 className="text-base font-semibold text-estado-ambar">
                                Revisar — hay algo que revisar en el registro ({zonaRevisar.length})
                            </h2>
                            <ul className="mt-3 space-y-3">
                                {zonaRevisar.map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ambar/20 p-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-body truncate">{p.nombreVisible}</p>
                                            {p.estadoReps === "NO_ENCONTRADA" ? (
                                                <p className="cuerpo text-sm text-estado-ambar">
                                                    No encontramos su inscripción en el registro oficial. La buscamos y no aparece —
                                                    revísela a mano (puede ser un dato mal cargado o que no esté inscrito). No es un
                                                    trámite vencido del profesional; no se le pide «renovar».
                                                </p>
                                            ) : (
                                                <p className="cuerpo text-sm text-estado-ambar">
                                                    Su inscripción no tiene fecha de vigencia. Dato incompleto; revisar y completar.
                                                </p>
                                            )}
                                        </div>
                                        <Button type="button" variant="outline" onClick={() => abrir(p)}>
                                            Cargar verificación
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* SPEC-813 §5-bis · Zona «Re-verificar»: rutina/higiene NUESTRA (7) — callada (tinta/muted),
                        porque el profesional probablemente está al día y es nuestra desactualización. */}
                    {zonaReVerificar.length > 0 && (
                        <section aria-label="Re-verificar" className="rounded-2xl border border-tinta/15 p-5">
                            <h2 className="text-base font-semibold text-body">Re-verificar — rutina nuestra ({zonaReVerificar.length})</h2>
                            <ul className="mt-3 space-y-3">
                                {zonaReVerificar.map((p) => (
                                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tinta/10 p-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-body truncate">{p.nombreVisible}</p>
                                            <p className="cuerpo text-sm text-subtle">
                                                Nuestra verificación cumplió 365 días. Su inscripción puede seguir vigente ante la
                                                autoridad — lo que caducó es nuestra re-verificación, no su habilitación. La acción es
                                                nuestra: vuelvan a verificarla. Al profesional no se le pide nada.
                                            </p>
                                        </div>
                                        <Button type="button" variant="outline" onClick={() => abrir(p)}>
                                            Re-verificar
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <ul className="space-y-3">
                        {profesionales.map((p) => (
                            <li key={p.id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-body truncate">{p.nombreVisible}</p>
                                    <p className="cuerpo text-subtle text-sm">{p.tituloProfesional}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <InsigniaEstado estado={p.estadoReps} />
                                        {p.estadoReps === "VIGENTE" && p.vigenteHasta && (
                                            <span className="text-xs text-subtle">
                                                Vigente hasta {formatoFechaBogota(new Date(p.vigenteHasta))}
                                                {p.modalidades.length > 0 && (
                                                    <> · {p.modalidades.map((m) => (m === "TELEMEDICINA" ? "Virtual" : "Presencial")).join(" · ")}</>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button type="button" variant="outline" onClick={() => abrir(p)}>
                                    Cargar verificación
                                </Button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <Modal isOpen={activo !== null} onClose={cerrar} title={activo ? `Cargar verificación — ${activo.nombreVisible}` : ""} size="md">
                {activo && (
                    <div className="space-y-5">
                        {/* §0 · el peso sin paralizar: está COPIANDO, no decidiendo. */}
                        <p className="cuerpo text-subtle">
                            Está copiando lo que leyó en la fuente oficial. <strong className="text-body">Revise que coincida</strong> antes de guardar:
                            si se equivoca, el profesional queda fuera del directorio o entra sin estarlo.
                        </p>

                        {/* §1 · los cuatro resultados, distinguibles sin pensar. */}
                        <fieldset className="space-y-2">
                            <legend className="font-medium text-body">¿Qué encontró en la fuente?</legend>
                            {RESULTADOS.map((r) => {
                                const sel = resultado === r.valor;
                                return (
                                    <label
                                        key={r.valor}
                                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${sel ? "border-accent bg-accent/5" : "border-tinta/10 hover:bg-tinta/5"}`}
                                    >
                                        <input
                                            type="radio"
                                            name="resultado-reps"
                                            value={r.valor}
                                            checked={sel}
                                            onChange={() => elegirResultado(r.valor)}
                                            disabled={enviando || exito}
                                            className="mt-1 h-4 w-4 text-accent ring-accent-input"
                                        />
                                        <span className="flex-1">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.tono}`}>
                                                <span aria-hidden>{r.icono}</span>
                                                {r.rotulo}
                                            </span>
                                            <span className="cuerpo text-subtle mt-1 block">{r.dice}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>

                        {/* §2/§3 · solo con «Vigente»: fecha obligatoria + modalidades (≥1). Para los otros no aparece. */}
                        {esVigente && (
                            <div className="space-y-4 rounded-xl border border-cielo/20 bg-cielo/5 p-4">
                                {/* Sin `min`: §2 AVISA una fecha pasada, no la BLOQUEA («sin bloquear si insiste»). */}
                                <Input
                                    label="Vigente hasta"
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    disabled={enviando || exito}
                                />
                                {fechaEsPasada && (
                                    <Alerta tono="advertencia">
                                        Esa fecha ya pasó: ¿es «Vencida» en vez de «Vigente»?
                                    </Alerta>
                                )}
                                <fieldset>
                                    <legend className="font-medium text-body">Modalidades que la habilitación cubre</legend>
                                    <p className="cuerpo text-subtle text-sm">El profesional solo se ofrecerá en estas.</p>
                                    <div className="mt-2 flex flex-wrap gap-4">
                                        {MODALIDADES.map((m) => (
                                            <label key={m.valor} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={modalidades.includes(m.valor)}
                                                    onChange={() => alternarModalidad(m.valor)}
                                                    disabled={enviando || exito}
                                                    className="h-4 w-4 rounded border-tinta/10 text-accent ring-accent-input"
                                                />
                                                {m.rotulo}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {/* §4 · lo que la acción NO hace (en la confirmación Y tras guardar: el bloque queda visible). */}
                        <div className="rounded-xl bg-tinta/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Esta acción</p>
                            <ul className="mt-2 space-y-1.5">
                                {NO_HACE.map((frase) => (
                                    <li key={frase} className="cuerpo text-subtle text-sm flex gap-2">
                                        <span aria-hidden className="text-subtle">·</span>
                                        <span>{frase}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {error && <Alerta tono="error">{error}</Alerta>}
                        {exito && (
                            <Alerta tono="exito" role="status">
                                Verificación registrada. Quedó en el historial con su nombre y la fecha.
                            </Alerta>
                        )}

                        <div className="flex justify-end gap-3 pt-1">
                            <Button type="button" variant="outline" onClick={cerrar} disabled={enviando}>
                                {exito ? "Cerrar" : "Cancelar"}
                            </Button>
                            {!exito && (
                                <Button type="button" onClick={guardar} disabled={!puedeGuardar} isLoading={enviando}>
                                    Guardar verificación
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
