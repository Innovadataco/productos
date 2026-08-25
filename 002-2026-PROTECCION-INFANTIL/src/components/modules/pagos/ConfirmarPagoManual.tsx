"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alerta } from "@/components/ui/Alerta";
import type { PlanSelectorDTO, ColorRolSelector } from "@/lib/pagos/planes-selector.types";
import { calcularDesgloseVista, formatearCOP } from "@/lib/pagos/planes-selector.utils";

interface ConfirmarPagoManualProps {
    plan: PlanSelectorDTO;
    color: ColorRolSelector;
    tasaIva?: number;
    aplicaIva?: boolean;
    onConfirmar: (planId: string, codigoBono?: string) => Promise<void>;
    onCerrar: () => void;
}

const ACENTOS: Record<ColorRolSelector, { titulo: string; boton: string }> = {
    cielo: {
        titulo: "text-cielo",
        boton: "bg-cielo text-white hover:brightness-110",
    },
    pino: {
        titulo: "text-pino",
        boton: "bg-pino text-white hover:brightness-110",
    },
};

export function ConfirmarPagoManual({
    plan,
    color,
    tasaIva = 19,
    aplicaIva = true,
    onConfirmar,
    onCerrar,
}: ConfirmarPagoManualProps) {
    const acento = ACENTOS[color];
    const [codigoBono, setCodigoBono] = useState("");
    const [aceptaPagar, setAceptaPagar] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState(false);

    const desglose = calcularDesgloseVista(plan.precioBaseCOP, tasaIva, aplicaIva);

    async function handleConfirmar() {
        if (!aceptaPagar) return;
        setCargando(true);
        setError(null);
        setExito(false);
        try {
            await onConfirmar(plan.id, codigoBono.trim() || undefined);
            setExito(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "No se pudo registrar la solicitud";
            setError(msg);
        } finally {
            setCargando(false);
        }
    }

    return (
        <Modal isOpen onClose={onCerrar} title="Confirmar solicitud de plan" size="md">
            <div className="space-y-4">
                <div>
                    <h3 className={`text-lg font-semibold ${acento.titulo}`}>{plan.nombre}</h3>
                    {plan.descripcion && <p className="text-sm text-muted">{plan.descripcion}</p>}
                </div>

                <div className="rounded-xl bg-white/50 p-4 dark:bg-slate-800/50">
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-muted">Subtotal</dt>
                            <dd className="font-medium text-body">{formatearCOP(desglose.subtotal)}</dd>
                        </div>
                        {desglose.descuentoBono > 0 && (
                            <div className="flex justify-between text-pino">
                                <dt>Descuento cupón</dt>
                                <dd className="font-medium">-{formatearCOP(desglose.descuentoBono)}</dd>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <dt className="text-muted">Base gravable</dt>
                            <dd className="font-medium text-body">{formatearCOP(desglose.baseGravable)}</dd>
                        </div>
                        {aplicaIva && (
                            <div className="flex justify-between">
                                <dt className="text-muted">IVA ({tasaIva}%)</dt>
                                <dd className="font-medium text-body">{formatearCOP(desglose.iva)}</dd>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-tinta/10 pt-2 text-base">
                            <dt className="font-semibold text-body">Total a pagar</dt>
                            <dd className="font-bold text-body">{formatearCOP(desglose.total)}</dd>
                        </div>
                    </dl>
                </div>

                <Input
                    label="Código de cupón (opcional)"
                    placeholder="Ej: BIENVENIDO20"
                    value={codigoBono}
                    onChange={(e) => setCodigoBono(e.target.value)}
                    maxLength={100}
                />

                <label className="flex items-start gap-3 text-sm">
                    <input
                        type="checkbox"
                        checked={aceptaPagar}
                        onChange={(e) => setAceptaPagar(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-tinta/30 text-cielo focus:ring-cielo"
                    />
                    <span className="text-body">
                        Acepto pagar el valor indicado y autorizo la activación una vez sea confirmado el pago.
                    </span>
                </label>

                {error && <Alerta tono="error">{error}</Alerta>}
                {exito && (
                    <Alerta tono="exito" role="status">
                        Solicitud registrada. Te notificaremos cuando sea autorizada.
                    </Alerta>
                )}

                <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={onCerrar} className="flex-1" disabled={cargando}>
                        Cancelar
                    </Button>
                    <Button
                        className={`flex-1 ${acento.boton}`}
                        onClick={handleConfirmar}
                        disabled={!aceptaPagar || cargando || exito}
                        isLoading={cargando}
                    >
                        Confirmar solicitud
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
