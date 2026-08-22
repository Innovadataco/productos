"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";

type OperadorOpcion = {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    estado: string;
    casosAbiertos: number;
    cupoMaximo: number;
};

type ReasignarModalProps = {
    reporteId: string;
    operadorActualId: string;
    operadorActualNombre?: string;
    isOpen: boolean;
    onClose: () => void;
    onReasignado: () => void;
};

export function ReasignarModal({
    reporteId,
    operadorActualId,
    operadorActualNombre,
    isOpen,
    onClose,
    onReasignado,
}: ReasignarModalProps) {
    const [operadores, setOperadores] = useState<OperadorOpcion[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [operadorDestinoId, setOperadorDestinoId] = useState("");
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setCargando(true);
        setError(null);
        setOperadorDestinoId("");
        setMotivo("");

        async function cargar() {
            try {
                const res = await fetch("/api/admin/operadores", { credentials: "include" });
                const data: unknown = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const mensaje =
                        data && typeof data === "object" && "error" in data
                            ? (data as { error?: { message?: string } }).error?.message
                            : undefined;
                    setError(mensaje || "No se pudo cargar la lista de operadores.");
                    return;
                }
                const raw = Array.isArray((data as { operadores?: unknown }).operadores)
                    ? ((data as { operadores: unknown[] }).operadores as unknown[])
                    : [];
                const lista: OperadorOpcion[] = raw.map((op) => {
                    const item = op as {
                        id?: string;
                        email?: string;
                        nombre?: string | null;
                        rol?: string;
                        estado?: string;
                        casosAbiertos?: number;
                        perfil?: { cupoMaximo?: number | null } | null;
                    };
                    return {
                        id: item.id ?? "",
                        email: item.email ?? "",
                        nombre: item.nombre ?? null,
                        rol: item.rol ?? "",
                        estado: item.estado ?? "",
                        casosAbiertos: item.casosAbiertos ?? 0,
                        cupoMaximo: item.perfil?.cupoMaximo ?? 10,
                    };
                });
                setOperadores(
                    lista.filter(
                        (op) =>
                            op.rol === "OPERADOR" &&
                            op.estado === "activo" &&
                            op.id !== operadorActualId &&
                            op.casosAbiertos < op.cupoMaximo
                    )
                );
            } catch {
                setError("Error de red al cargar operadores.");
            } finally {
                setCargando(false);
            }
        }

        void cargar();
    }, [isOpen, operadorActualId]);

    const validar = (): string | null => {
        if (!operadorDestinoId) return "Selecciona un operador destino.";
        if (operadorDestinoId === operadorActualId) {
            return "El operador destino debe ser diferente al operador actual.";
        }
        if (motivo.length < 20 || motivo.length > 500) {
            return "El motivo debe tener entre 20 y 500 caracteres.";
        }
        return null;
    };

    const confirmar = async () => {
        const errorValidacion = validar();
        if (errorValidacion) {
            setError(errorValidacion);
            return;
        }
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/operadores/reasignar", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reporteId, operadorDestinoId, motivo }),
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo reasignar el reporte.");
                return;
            }
            onReasignado();
            onClose();
        } catch {
            setError("Error de red al reasignar el reporte.");
        } finally {
            setEnviando(false);
        }
    };

    const opciones = [
        { value: "", label: "Selecciona un operador" },
        ...operadores.map((op) => ({
            value: op.id,
            label: `${op.nombre || op.email} (${op.email})`,
        })),
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reasignar reporte">
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Operador actual:{" "}
                    <span className="font-medium text-body">{operadorActualNombre || operadorActualId}</span>
                </p>

                {error && <Alerta tono="error">{error}</Alerta>}

                {cargando ? (
                    <Cargando inline texto="Cargando operadores..." className="py-4" />
                ) : (
                    <Select
                        label="Operador destino"
                        options={opciones}
                        value={operadorDestinoId}
                        onChange={(e) => setOperadorDestinoId(e.target.value)}
                    />
                )}

                <div>
                    <label htmlFor="motivo-reasignacion" className="block text-sm font-medium text-body mb-1.5">
                        Motivo de la reasignación
                    </label>
                    <textarea
                        id="motivo-reasignacion"
                        rows={3}
                        className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input"
                        placeholder="Explica por qué se reasigna el caso (obligatorio, entre 20 y 500 caracteres)."
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted">{motivo.length} / 500 caracteres</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={onClose} disabled={enviando}>
                        Cancelar
                    </Button>
                    <Button onClick={confirmar} isLoading={enviando}>
                        Confirmar reasignación
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
