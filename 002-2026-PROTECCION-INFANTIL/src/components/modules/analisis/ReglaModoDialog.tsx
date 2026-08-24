"use client";

/**
 * SPEC-224 (002-PI-125, FR-009, D-77): diálogo de cambio de modo de una regla
 * con confirmación fuerte. Promoción a EJECUTA: exige escribir exactamente
 * "EJECUTA" y un motivo de ≥ 20 caracteres (botón deshabilitado hasta cumplir
 * ambos). Reversión a Recomienda: solo motivo ≥ 20 (salir de autonomía es la
 * operación segura). Tono neutral, sin voseo.
 */
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alerta } from "@/components/ui/Alerta";

export interface ReglaParaModo {
    id: string;
    nombre: string;
    modo: "RECOMIENDA" | "EJECUTA";
    activa: boolean;
}

export interface ResultadoCambioModoPanel {
    id: string;
    modo: "RECOMIENDA" | "EJECUTA";
    advertencia: string | null;
}

interface ReglaModoDialogProps {
    regla: ReglaParaModo | null;
    onClose: () => void;
    onConfirmado: (resultado: ResultadoCambioModoPanel) => void;
}

const LONGITUD_MIN_MOTIVO = 20;

export function ReglaModoDialog({ regla, onClose, onConfirmado }: ReglaModoDialogProps) {
    const [confirmacion, setConfirmacion] = useState("");
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const modoObjetivo: "RECOMIENDA" | "EJECUTA" = regla?.modo === "EJECUTA" ? "RECOMIENDA" : "EJECUTA";
    const esPromocion = modoObjetivo === "EJECUTA";
    const motivoValido = motivo.trim().length >= LONGITUD_MIN_MOTIVO;
    const confirmacionValida = !esPromocion || confirmacion === "EJECUTA";
    const habilitado = motivoValido && confirmacionValida && !enviando;

    async function confirmar() {
        if (!regla || !habilitado) return;
        setEnviando(true);
        setError(null);
        try {
            const respuesta = await fetch(`/api/admin/analisis/reglas/${regla.id}/modo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    esPromocion
                        ? { modo: "EJECUTA", confirmacion, motivo: motivo.trim() }
                        : { modo: "RECOMIENDA", motivo: motivo.trim() }
                ),
            });
            const cuerpo = (await respuesta.json()) as ResultadoCambioModoPanel & {
                error?: { message?: string };
            };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "No se pudo cambiar el modo");
                return;
            }
            setConfirmacion("");
            setMotivo("");
            onConfirmado(cuerpo);
        } catch {
            setError("Error de red al cambiar el modo");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <Modal isOpen={regla !== null} onClose={onClose} title={esPromocion ? "Cambiar a Ejecuta sola" : "Cambiar a Recomienda"} size="md">
            {regla && (
                <div className="space-y-4">
                    <p className="text-sm text-body">
                        {esPromocion ? (
                            <>
                                La regla <strong>{regla.nombre}</strong> pasará a ejecutar su acción sin
                                intervención humana. Es una decisión deliberada: escribe{" "}
                                <strong>EJECUTA</strong> para confirmar y registra el motivo.
                            </>
                        ) : (
                            <>
                                La regla <strong>{regla.nombre}</strong> volverá a generar solo sugerencias
                                (revisión humana). Registra el motivo.
                            </>
                        )}
                    </p>
                    {esPromocion && !regla.activa && (
                        <Alerta tono="advertencia">La regla está inactiva: el worker no la evaluará hasta activarla.</Alerta>
                    )}
                    {esPromocion && (
                        <Input
                            label='Escribe "EJECUTA" para confirmar'
                            value={confirmacion}
                            onChange={(e) => setConfirmacion(e.target.value)}
                            placeholder="EJECUTA"
                            autoComplete="off"
                        />
                    )}
                    <Textarea
                        label={`Motivo (mínimo ${LONGITUD_MIN_MOTIVO} caracteres)`}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        placeholder="Por qué se cambia el modo de esta regla"
                    />
                    {error && <Alerta tono="error">{error}</Alerta>}
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button
                            variant={esPromocion ? "danger" : "primary"}
                            onClick={confirmar}
                            disabled={!habilitado}
                            isLoading={enviando}
                        >
                            {esPromocion ? "Confirmar EJECUTA" : "Confirmar Recomienda"}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
