"use client";

/**
 * SPEC-172 (Pilar D.5) — Bloque "Deriva prod": termómetro del motor en
 * producción. Por categoría, compara la tasa de corrección humana sobre lo
 * revisado contra el fallo del banco curado (1 − accuracy del baseline de
 * Simulación) y marca la brecha en puntos porcentuales con un semáforo.
 * Solo estadísticas agregadas: cero textos de reportes y cero PII.
 * Acciones: recalcular la ventana actual bajo demanda y saltar a Simulación
 * para afinar el modelo (el puente medición → ajuste).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

const RUTA_SIMULACION = "/dashboard/admin/ia?tab=simulacion";

/** Mismo default del seed y de DEFAULTS_DERIVA (src/lib/motor/deriva.ts); el GET siempre lo envía. */
const UMBRAL_PP_DEFECTO = 15;

export type FilaDerivaProd = {
    categoria: string;
    total: number;
    correcciones: number;
    /** 0..1: correcciones humanas / clasificaciones revisadas de la categoría. */
    tasaCorreccion: number;
    /** recall 0..1 del banco curado; null cuando la categoría no tiene baseline. */
    accuracyBanco: number | null;
    /** (tasaCorreccion − (1 − accuracyBanco)) × 100; null sin baseline. */
    brechaPp: number | null;
    alertada: boolean;
    muestraInsuficiente?: boolean;
};

type BaselineBanco = {
    baselineFecha: string | null;
    baselineRunId: string | null;
    baselineVieja: boolean;
};

type UmbralesDeriva = { umbralPp: number; minMuestra: number };

type RespuestaGetDeriva = {
    semanaInicio?: string;
    filas: FilaDerivaProd[];
    baseline?: BaselineBanco;
    umbrales?: UmbralesDeriva;
    sinBaseline?: boolean;
    mensaje?: string;
};

type RespuestaRecalculo = {
    semanaInicio?: string;
    filas: FilaDerivaProd[];
};

type DatosDeriva = {
    semanaInicio: string | null;
    filas: FilaDerivaProd[];
    baseline: BaselineBanco | null;
    umbrales: UmbralesDeriva | null;
    sinBaseline: boolean;
    mensaje: string | null;
};

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    OTRO: "Otro",
};

function formatCategoria(categoria: string) {
    return CATEGORIA_LABELS[categoria] || categoria;
}

function formatearPct(fraccion: number): string {
    return `${(fraccion * 100).toFixed(1)}%`;
}

function formatearPp(puntos: number): string {
    return `${puntos > 0 ? "+" : ""}${puntos.toFixed(1)}`;
}

/** dd/mm/aaaa desde un ISO — determinista, sin depender del locale del runtime. */
function formatearFecha(iso: string): string {
    return iso.slice(0, 10).split("-").reverse().join("/");
}

type SemaforoFila = { variante: BadgeVariant; texto: string };

function semaforoDe(fila: FilaDerivaProd, umbrales: UmbralesDeriva | null): SemaforoFila {
    if (fila.accuracyBanco === null || fila.brechaPp === null) {
        return { variante: "neutral", texto: "Sin baseline" };
    }
    const insuficiente = fila.muestraInsuficiente ?? (umbrales !== null && fila.total < umbrales.minMuestra);
    if (insuficiente) {
        return { variante: "neutral", texto: "Muestra insuficiente" };
    }
    const umbralPp = umbrales?.umbralPp ?? UMBRAL_PP_DEFECTO;
    if (fila.brechaPp < umbralPp) return { variante: "success", texto: "Estable" };
    if (fila.brechaPp <= umbralPp * 1.5) return { variante: "warning", texto: "Deriva leve" };
    return { variante: "danger", texto: "Deriva alta" };
}

function extraerMensajeError(body: unknown): string | null {
    if (body && typeof body === "object" && "error" in body) {
        const mensaje = (body as { error?: { message?: unknown } }).error?.message;
        if (typeof mensaje === "string" && mensaje.length > 0) return mensaje;
    }
    return null;
}

const CLASES_LINK_BOTON =
    "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 glass-input text-body hover:bg-white/80 dark:hover:bg-slate-800/80 border";

export function DerivaProdBloque() {
    const [datos, setDatos] = useState<DatosDeriva | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [recalculando, setRecalculando] = useState(false);
    const [errorRecalculo, setErrorRecalculo] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/motor/deriva", { credentials: "include" });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                setError(extraerMensajeError(body) ?? "No se pudo consultar la deriva del motor.");
                return;
            }
            const data = body as RespuestaGetDeriva;
            if (data.sinBaseline) {
                setDatos({
                    semanaInicio: null,
                    filas: [],
                    baseline: null,
                    umbrales: null,
                    sinBaseline: true,
                    mensaje: data.mensaje ?? null,
                });
            } else {
                setDatos({
                    semanaInicio: data.semanaInicio ?? null,
                    filas: data.filas,
                    baseline: data.baseline ?? null,
                    umbrales: data.umbrales ?? null,
                    sinBaseline: false,
                    mensaje: null,
                });
            }
            setError(null);
        } catch {
            setError("Error de red al consultar la deriva del motor.");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function recalcular() {
        setRecalculando(true);
        setErrorRecalculo(null);
        try {
            const res = await fetch("/api/admin/motor/deriva/recalcular", {
                method: "POST",
                credentials: "include",
            });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                setErrorRecalculo(extraerMensajeError(body) ?? "No se pudo recalcular la deriva.");
                return;
            }
            const data = body as RespuestaRecalculo;
            // El baseline y los umbrales no cambian con el recálculo: se conservan del GET.
            setDatos((prev) => ({
                semanaInicio: data.semanaInicio ?? prev?.semanaInicio ?? null,
                filas: data.filas,
                baseline: prev?.baseline ?? null,
                umbrales: prev?.umbrales ?? null,
                sinBaseline: false,
                mensaje: null,
            }));
        } catch {
            setErrorRecalculo("Error de red al recalcular la deriva.");
        } finally {
            setRecalculando(false);
        }
    }

    return (
        <GlassCard className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Deriva prod</h2>
                    <p className="text-sm text-muted">
                        Termómetro real del motor en producción: cuánto se desvía frente al banco curado de Simulación.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={RUTA_SIMULACION} className={CLASES_LINK_BOTON}>
                        Afinar en Simulación
                    </Link>
                    <Button
                        variant="outline"
                        onClick={() => void recalcular()}
                        isLoading={recalculando}
                        disabled={cargando}
                    >
                        Recalcular ahora
                    </Button>
                </div>
            </div>

            {datos?.sinBaseline && (
                <div
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                >
                    <p>
                        Sin baseline del banco — corre una simulación.{" "}
                        <Link href={RUTA_SIMULACION} className="font-semibold underline">
                            Abrir Simulación
                        </Link>
                    </p>
                    {datos.mensaje && <p className="mt-1 text-xs">{datos.mensaje}</p>}
                </div>
            )}

            {!datos?.sinBaseline && datos?.baseline?.baselineVieja && datos.baseline.baselineFecha && (
                <div
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                >
                    <p>
                        Baseline desactualizada ({formatearFecha(datos.baseline.baselineFecha)}) — corre Simulación de
                        nuevo.{" "}
                        <Link href={RUTA_SIMULACION} className="font-semibold underline">
                            Abrir Simulación
                        </Link>
                    </p>
                </div>
            )}

            {errorRecalculo && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
                >
                    {errorRecalculo}
                </p>
            )}

            {cargando && !datos ? (
                <Cargando texto="Consultando la deriva del motor..." />
            ) : error && !datos ? (
                <ErrorState title="No pudimos consultar la deriva" description={error} onRetry={() => void cargar()} />
            ) : datos && !datos.sinBaseline ? (
                <>
                    {datos.semanaInicio && datos.umbrales && (
                        <p className="text-xs text-subtle">
                            Semana del {formatearFecha(datos.semanaInicio)} · umbral de alerta: {datos.umbrales.umbralPp}{" "}
                            pp · muestra mínima: {datos.umbrales.minMuestra} revisadas
                        </p>
                    )}
                    {datos.filas.length === 0 ? (
                        <p className="text-sm text-muted">No hubo clasificaciones revisadas en la ventana medida.</p>
                    ) : (
                        <Tabla aria-label="Deriva del motor por categoría" sinContenedor>
                            <TablaHead variante="borde">
                                <tr>
                                    <th className="pb-3 font-medium">Categoría</th>
                                    <th className="pb-3 font-medium text-right">Revisadas</th>
                                    <th className="pb-3 font-medium text-right">Corregidas</th>
                                    <th className="pb-3 font-medium text-right">Tasa corrección %</th>
                                    <th className="pb-3 font-medium text-right">Banco %</th>
                                    <th className="pb-3 font-medium text-right">Brecha (pp)</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {datos.filas.map((fila) => {
                                    const semaforo = semaforoDe(fila, datos.umbrales);
                                    return (
                                        <tr key={fila.categoria}>
                                            <td className="py-3 pr-4 text-body">{formatCategoria(fila.categoria)}</td>
                                            <td className="py-3 pr-4 text-right text-muted">{fila.total}</td>
                                            <td className="py-3 pr-4 text-right text-muted">{fila.correcciones}</td>
                                            <td className="py-3 pr-4 text-right text-body">
                                                {formatearPct(fila.tasaCorreccion)}
                                            </td>
                                            <td className="py-3 pr-4 text-right text-muted">
                                                {fila.accuracyBanco === null ? "—" : formatearPct(fila.accuracyBanco)}
                                            </td>
                                            <td className="py-3 pr-4 text-right text-body">
                                                {fila.brechaPp === null ? "—" : formatearPp(fila.brechaPp)}
                                            </td>
                                            <td className="py-3">
                                                <Badge variant={semaforo.variante}>{semaforo.texto}</Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </TablaBody>
                        </Tabla>
                    )}
                </>
            ) : null}

            <p className="text-xs text-subtle">
                La tasa es la tasa de corrección sobre lo revisado: de las clasificaciones del motor que revisó un
                humano, cuántas terminaron corregidas. No es un error absoluto. La brecha compara esa tasa contra el
                fallo del banco (1 − accuracy) en puntos porcentuales.
            </p>
        </GlassCard>
    );
}
