"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alerta } from "@/components/ui/Alerta";
import type { TargetSinSuscripcion, PlanManualDTO } from "@/lib/pagos/admin-activacion-manual.types";

const METODOS_PAGO = [
    { value: "TRANSFERENCIA_BANCARIA", label: "Transferencia bancaria" },
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "OTRO", label: "Otro" },
];

const DURACION_LABEL: Record<string, string> = {
    MES_1: "1 mes",
    MES_2: "2 meses",
    MES_3: "3 meses",
    MES_6: "6 meses",
    MES_12: "12 meses",
};

type ModoActivar = {
    modo: "activar";
    target: TargetSinSuscripcion;
    planes: PlanManualDTO[];
};

type ModoAutorizar = {
    modo: "autorizar";
    suscripcionId: string;
    planNombre: string;
    titularNombre: string;
    titularTipo: "PADRE" | "COLEGIO";
};

type ActivarSuscripcionManualProps = ModoActivar | ModoAutorizar;

function esActivar(props: ActivarSuscripcionManualProps): props is ModoActivar {
    return props.modo === "activar";
}

function formatearCOP(valor: number | null): string {
    if (valor === null || valor === undefined) return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
        valor
    );
}

export function ActivarSuscripcionManual(props: ActivarSuscripcionManualProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState(false);

    const anioActual = new Date().getFullYear();
    const planesFiltrados = useMemo(() => {
        if (!esActivar(props)) return [];
        return props.planes.filter(
            (p) => p.tipoTitular === props.target.tipo && p.anio === anioActual && p.activo && !p.esFreemium
        );
    }, [props, anioActual]);

    const [planId, setPlanId] = useState(planesFiltrados[0]?.id ?? "");
    const [metodo, setMetodo] = useState("TRANSFERENCIA_BANCARIA");
    const [referencia, setReferencia] = useState("");
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState("");

    const titulo = esActivar(props) ? "Activar suscripción manualmente" : "Autorizar solicitud de suscripción";
    const nombreTitular = esActivar(props) ? props.target.nombre : props.titularNombre;
    const tipoTitular = esActivar(props) ? props.target.tipo : props.titularTipo;
    const subtitulo = esActivar(props)
        ? [props.target.email, props.target.identificacion].filter(Boolean).join(" · ")
        : props.planNombre;

    function handleClose() {
        if (exito) {
            window.location.reload();
            return;
        }
        setIsOpen(false);
        setError(null);
    }

    function resetForm() {
        setPlanId(planesFiltrados[0]?.id ?? "");
        setMetodo("TRANSFERENCIA_BANCARIA");
        setReferencia("");
        setMonto("");
        setFecha("");
        setError(null);
        setExito(false);
    }

    function abrir() {
        resetForm();
        setIsOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading || exito) return;
        if (esActivar(props) && !planId) {
            setError("Selecciona un plan");
            return;
        }
        if (!referencia.trim()) {
            setError("La referencia de pago es obligatoria");
            return;
        }
        const montoNumero = Number(monto);
        if (Number.isNaN(montoNumero) || montoNumero < 0) {
            setError("El monto debe ser un número mayor o igual a cero");
            return;
        }

        setLoading(true);
        setError(null);

        const body: Record<string, unknown> = {
            metodoPagoManual: metodo,
            referenciaPagoManual: referencia.trim(),
            montoRealPagado: montoNumero,
        };
        if (fecha) {
            body.fechaPagoReal = new Date(`${fecha}T00:00:00`).toISOString();
        }

        let url: string;
        if (esActivar(props)) {
            url = "/api/admin/pagos/activar-manual";
            body.planId = planId;
            if (props.target.tipo === "PADRE") {
                body.usuarioObjetivoId = props.target.id;
            } else {
                body.colegioObjetivoId = props.target.id;
            }
        } else {
            url = `/api/admin/pagos/pendientes/${props.suscripcionId}/autorizar`;
        }

        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
            if (!res.ok) {
                throw new Error(data.error?.message ?? "No se pudo procesar la solicitud");
            }
            setExito(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    const puedeEnviar =
        !loading &&
        !exito &&
        referencia.trim().length > 0 &&
        monto !== "" &&
        (!esActivar(props) || planId !== "");

    return (
        <>
            <Button
                onClick={abrir}
                className="bg-ambar text-white shadow-lg shadow-ambar/25 hover:brightness-110 px-3 py-1.5 text-xs"
            >
                {esActivar(props) ? "Activar" : "Autorizar"}
            </Button>

            <Modal isOpen={isOpen} onClose={handleClose} title={titulo} size="md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="rounded-xl bg-ambar/5 p-3 text-sm dark:bg-ambar/10">
                        <p className="font-medium text-body">{nombreTitular}</p>
                        <p className="text-muted">
                            {tipoTitular}
                            {subtitulo ? ` · ${subtitulo}` : ""}
                        </p>
                    </div>

                    {esActivar(props) && (
                        <>
                            {planesFiltrados.length === 0 ? (
                                <Alerta tono="advertencia" role="status">
                                    No hay planes activos para {props.target.tipo} en {anioActual}.
                                </Alerta>
                            ) : (
                                <Select
                                    label="Plan"
                                    value={planId}
                                    onChange={(e) => setPlanId(e.target.value)}
                                    options={planesFiltrados.map((p) => ({
                                        value: p.id,
                                        label: `${p.nombre} — ${DURACION_LABEL[p.duracion] ?? p.duracion} (${formatearCOP(
                                            p.precioBaseCOP
                                        )})`,
                                    }))}
                                />
                            )}
                        </>
                    )}

                    <Select
                        label="Método de pago"
                        value={metodo}
                        onChange={(e) => setMetodo(e.target.value)}
                        options={METODOS_PAGO}
                    />

                    <Input
                        label="Referencia de pago"
                        placeholder="Ej: consignación #12345"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        maxLength={200}
                        required
                    />

                    <Input
                        label="Monto real pagado (COP)"
                        type="number"
                        min={0}
                        step="1"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        required
                    />

                    <Input
                        label="Fecha de pago (opcional)"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                    />

                    {error && <Alerta tono="error">{error}</Alerta>}
                    {exito && (
                        <Alerta tono="exito" role="status">
                            {esActivar(props)
                                ? "Suscripción activada correctamente."
                                : "Solicitud autorizada correctamente."}{" "}
                            Cierra para recargar la página.
                        </Alerta>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
                            {exito ? "Cerrar" : "Cancelar"}
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-ambar text-white shadow-lg shadow-ambar/25 hover:brightness-110"
                            disabled={!puedeEnviar}
                            isLoading={loading}
                        >
                            Confirmar
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
