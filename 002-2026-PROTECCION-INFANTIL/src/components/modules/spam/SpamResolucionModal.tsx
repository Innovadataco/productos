"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { AdminReporteDetalle } from "../AdminReporteDetalle";

const CATEGORIAS = [
    { value: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
    { value: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
    { value: "OFRECIMIENTO_REGALOS", label: "Ofrecimiento de regalos" },
    { value: "SUPLANTACION_IDENTIDAD", label: "Suplantación de identidad" },
    { value: "SOLICITUD_ENCUENTRO", label: "Solicitud de encuentro" },
    { value: "COMPARTIMIENTO_SEXUAL", label: "Compartimiento sexual" },
    { value: "EXTORSION", label: "Extorsión" },
    { value: "CONTENIDO_GENERADO_IA", label: "Contenido generado por IA" },
    { value: "DIFUSION_NO_CONSENTIDA", label: "Difusión no consentida" },
    { value: "DOXING", label: "Doxing" },
    { value: "OTRO", label: "Otro" },
];

interface SpamResolucionModalProps {
    reporteId: string;
    categoria: string;
    motivo: string;
    resolviendo: boolean;
    onClose: () => void;
    onCategoriaChange: (value: string) => void;
    onMotivoChange: (value: string) => void;
    onResolve: (decision: "es_spam" | "corregir" | "procesar_como_acoso") => void;
    onRefresh: () => void;
}

export function SpamResolucionModal({
    reporteId,
    categoria,
    motivo,
    resolviendo,
    onClose,
    onCategoriaChange,
    onMotivoChange,
    onResolve,
    onRefresh,
}: SpamResolucionModalProps) {
    return (
        <Modal isOpen onClose={onClose} title="Revisar posible spam">
            <AdminReporteDetalle
                reporteId={reporteId}
                onClose={onClose}
                onRefresh={onRefresh}
                inline
            />

            <div className="mt-6 space-y-4 rounded-2xl glass p-4">
                <h3 className="font-medium text-body">Resolución</h3>
                <div>
                    <label className="block text-sm font-medium text-body mb-1.5">Categoría si es válido</label>
                    <Select
                        options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
                        value={categoria}
                        onChange={(e) => onCategoriaChange(e.target.value)}
                    />
                </div>
                <textarea
                    className="w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                    rows={3}
                    placeholder="Motivo de la resolución (opcional)"
                    value={motivo}
                    onChange={(e) => onMotivoChange(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => onResolve("procesar_como_acoso")} disabled={resolviendo} variant="secondary">
                        {resolviendo ? "Resolviendo..." : "Procesar como acoso"}
                    </Button>
                    <Button onClick={() => onResolve("corregir")} disabled={resolviendo} variant="secondary">
                        {resolviendo ? "Resolviendo..." : "Marcar como válido"}
                    </Button>
                    <Button onClick={() => onResolve("es_spam")} disabled={resolviendo}>
                        {resolviendo ? "Resolviendo..." : "Confirmar spam"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
