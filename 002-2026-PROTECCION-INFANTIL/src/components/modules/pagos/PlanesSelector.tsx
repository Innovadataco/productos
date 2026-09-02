"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { ConfirmarPagoManual } from "./ConfirmarPagoManual";
import type { PlanSelectorDTO, UsuarioSelector, ColorRolSelector } from "@/lib/pagos/planes-selector.types";
import { calcularDesgloseVista, formatearCOP } from "@/lib/pagos/planes-selector.utils";
import { nombrePlanHumano, descripcionPlanHumana } from "@/lib/pagos/nombre-plan-humano";

interface PlanesSelectorProps {
    planes: PlanSelectorDTO[];
    usuario: UsuarioSelector;
    color: ColorRolSelector;
    onSeleccionar: (planId: string, codigoBono?: string) => Promise<void>;
    onFreemium?: (() => Promise<void>) | undefined;
    duracionFreemiumDias?: number;
    tasaIva?: number;
    aplicaIva?: boolean;
}

const DURACION_ORDEN: Record<string, number> = {
    MES_1: 1,
    MES_3: 3,
    MES_6: 6,
    MES_12: 12,
};

const DURACION_LABEL: Record<string, string> = {
    MES_1: "1 mes",
    MES_3: "3 meses",
    MES_6: "6 meses",
    MES_12: "Anual",
};

const ACENTOS: Record<ColorRolSelector, { titulo: string; boton: string; badge: string }> = {
    cielo: {
        titulo: "text-cielo",
        boton: "bg-cielo text-white hover:brightness-110",
        badge: "bg-cielo/10 text-cielo",
    },
    pino: {
        titulo: "text-pino",
        boton: "bg-pino text-white hover:brightness-110",
        badge: "bg-pino/10 text-pino",
    },
};



export function PlanesSelector({
    planes,
    usuario,
    color,
    onSeleccionar,
    onFreemium,
    duracionFreemiumDias = 30,
    tasaIva = 19,
    aplicaIva = true,
}: PlanesSelectorProps) {
    const acento = ACENTOS[color];
    const [planSeleccionado, setPlanSeleccionado] = useState<PlanSelectorDTO | null>(null);
    const [errorFreemium, setErrorFreemium] = useState<string | null>(null);
    const [cargandoFreemium, setCargandoFreemium] = useState(false);

    const planesOrdenados = useMemo(() => {
        return [...planes]
            .filter((p) => !p.esFreemium)
            .sort((a, b) => (DURACION_ORDEN[a.duracion] ?? 99) - (DURACION_ORDEN[b.duracion] ?? 99));
    }, [planes]);

    const planFreemium = planes.find((p) => p.esFreemium);
    const esColegio = usuario.rol === "SCHOOL_ADMIN";
    // SPEC-355: la tarjeta de prueba gratis se pinta para CUALQUIER rol que
    // tenga acción de freemium — el colegio quedaba sin poder avanzar sin
    // pagar porque el gate era `rol === "PARENT"`. Para el colegio exige
    // además que el plan freemium exista en BD (fuente de la tarjeta); el
    // padre conserva su comportamiento histórico (tarjeta fija).
    const mostrarFreemium = Boolean(onFreemium) && (!esColegio || Boolean(planFreemium));

    async function handleFreemium() {
        if (!onFreemium) return;
        setErrorFreemium(null);
        setCargandoFreemium(true);
        try {
            await onFreemium();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "No se pudo activar la prueba gratis";
            setErrorFreemium(msg);
        } finally {
            setCargandoFreemium(false);
        }
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
            {/* SPEC-355: voz por rol — al rector se le habla de usted (Colombia). */}
            <header>
                <h1 className="text-2xl font-bold text-body">{esColegio ? "Elija su plan" : "Elige tu plan"}</h1>
                <p className="mt-1 text-sm text-muted">
                    {esColegio
                        ? "Seleccione el plan institucional para su colegio."
                        : "Selecciona el plan que mejor se ajuste a tu familia."}
                </p>
            </header>

            {errorFreemium && <Alerta tono="error">{errorFreemium}</Alerta>}

            {/* SPEC-362 (A-70 · G13): eran 4 columnas fijas. Con 4-5 tarjetas el
                texto caía en columnas de una palabra y los botones quedaban
                cortados (recorrido de Jelkin). Ahora las tarjetas tienen un ancho
                mínimo y la grilla acomoda las que quepan. */}
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
                {mostrarFreemium && (
                    <GlassCard className="flex flex-col" data-testid="plan-freemium">
                        <div className="mb-4">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${acento.badge}`}>
                                Prueba gratis
                            </span>
                        </div>
                        <h3 className="text-lg font-semibold text-body">
                            {esColegio ? (planFreemium?.nombre ?? "Prueba institucional") : "Prueba gratis"}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                            {esColegio
                                ? (planFreemium?.descripcion ??
                                  `Explore la plataforma sin costo durante ${duracionFreemiumDias} días.`)
                                : `Explora la plataforma sin costo durante ${duracionFreemiumDias} días.`}
                        </p>
                        <div className="mt-4 flex-1">
                            <p className="text-3xl font-bold text-body">$0</p>
                            <p className="text-sm text-muted">COP / {duracionFreemiumDias} días</p>
                        </div>
                        <Button
                            className={`mt-6 w-full ${acento.boton}`}
                            onClick={handleFreemium}
                            isLoading={cargandoFreemium}
                            disabled={!onFreemium}
                        >
                            Activar prueba gratis
                        </Button>
                    </GlassCard>
                )}

                {planesOrdenados.map((plan) => {
                    const desglose = calcularDesgloseVista(plan.precioBaseCOP, tasaIva, aplicaIva);
                    const descuentoAnual =
                        plan.duracion === "MES_12" && plan.descuentoAnualPct
                            ? `${plan.descuentoAnualPct}% dto.`
                            : null;

                    return (
                        <GlassCard key={plan.id} className="flex flex-col">
                            <div className="mb-4 flex items-center justify-between">
                                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${acento.badge}`}>
                                    {DURACION_LABEL[plan.duracion] ?? plan.duracion}
                                </span>
                                {descuentoAnual && (
                                    <span className="text-xs font-semibold text-pino">{descuentoAnual}</span>
                                )}
                            </div>
                            <h3 className="text-lg font-semibold text-body">{nombrePlanHumano(plan)}</h3>
                            <p className="mt-1 text-sm text-muted">{descripcionPlanHumana(plan)}</p>
                            <div className="mt-4 flex-1">
                                <p className="text-2xl font-bold tabular-nums text-body sm:text-3xl">
                                    {formatearCOP(desglose.total)}
                                </p>
                                <p className="text-sm text-muted">COP / {DURACION_LABEL[plan.duracion] ?? "periodo"}</p>
                                <p className="mt-2 text-xs text-muted">
                                    Subtotal: {formatearCOP(desglose.subtotal)}
                                    {aplicaIva && (
                                        <> · IVA ({tasaIva}%): {formatearCOP(desglose.iva)}</>
                                    )}
                                </p>
                            </div>
                            <Button className={`mt-6 w-full ${acento.boton}`} onClick={() => setPlanSeleccionado(plan)}>
                                Elegir
                            </Button>
                        </GlassCard>
                    );
                })}
            </div>

            {planSeleccionado && (
                <ConfirmarPagoManual
                    plan={planSeleccionado}
                    color={color}
                    tasaIva={tasaIva}
                    aplicaIva={aplicaIva}
                    onConfirmar={async (planId, codigoBono) => {
                        await onSeleccionar(planId, codigoBono);
                        setPlanSeleccionado(null);
                    }}
                    onCerrar={() => setPlanSeleccionado(null)}
                />
            )}
        </div>
    );
}
