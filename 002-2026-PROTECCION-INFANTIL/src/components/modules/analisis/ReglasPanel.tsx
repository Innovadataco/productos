"use client";

/**
 * SPEC-224 (002-PI-125): orquestador del panel de reglas configurables.
 * Tres vistas: tabla del catálogo (default), editor (crear/editar con test
 * SQL) e historial de versiones (solo lectura). Gestiona además los diálogos
 * de cambio de modo (confirmación fuerte) y de activar/desactivar (motivo
 * obligatorio, US-1 escenario 4). Tono neutral, sin voseo.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { ReglasTable, type ReglaListItemPanel } from "./ReglasTable";
import { ReglaEditor, type ReglaDetallePanel } from "./ReglaEditor";
import { ReglaHistorial } from "./ReglaHistorial";
import { ReglaModoDialog } from "./ReglaModoDialog";

type Vista = "tabla" | "editor" | "historial";

interface RespuestaLista {
    items: ReglaListItemPanel[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function ReglasPanel() {
    const [vista, setVista] = useState<Vista>("tabla");
    const [reglas, setReglas] = useState<ReglaListItemPanel[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [reglaEdicion, setReglaEdicion] = useState<ReglaDetallePanel | null>(null);
    const [reglaHistorial, setReglaHistorial] = useState<ReglaListItemPanel | null>(null);
    const [reglaModo, setReglaModo] = useState<ReglaListItemPanel | null>(null);
    const [reglaToggle, setReglaToggle] = useState<ReglaListItemPanel | null>(null);
    const [motivoToggle, setMotivoToggle] = useState("");
    const [enviandoToggle, setEnviandoToggle] = useState(false);
    const [errorToggle, setErrorToggle] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const respuesta = await fetch("/api/admin/analisis/reglas?pageSize=100");
            const cuerpo = (await respuesta.json()) as RespuestaLista & { error?: { message?: string } };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "No se pudo cargar el catálogo de reglas");
                return;
            }
            setReglas(cuerpo.items ?? []);
        } catch {
            setError("Error de red al cargar las reglas");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function abrirEdicion(regla: ReglaListItemPanel) {
        setError(null);
        try {
            const respuesta = await fetch(`/api/admin/analisis/reglas/${regla.id}`);
            const cuerpo = (await respuesta.json()) as ReglaDetallePanel & { error?: { message?: string } };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "No se pudo cargar la regla");
                return;
            }
            setReglaEdicion(cuerpo);
            setVista("editor");
        } catch {
            setError("Error de red al cargar la regla");
        }
    }

    async function confirmarToggle() {
        if (!reglaToggle || motivoToggle.trim().length < 10) return;
        setEnviandoToggle(true);
        setErrorToggle(null);
        try {
            const respuesta = await fetch(`/api/admin/analisis/reglas/${reglaToggle.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activa: !reglaToggle.activa, motivo: motivoToggle.trim() }),
            });
            const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
            if (!respuesta.ok) {
                setErrorToggle(cuerpo.error?.message ?? "No se pudo cambiar el estado");
                return;
            }
            setReglaToggle(null);
            setMotivoToggle("");
            await cargar();
        } catch {
            setErrorToggle("Error de red al cambiar el estado");
        } finally {
            setEnviandoToggle(false);
        }
    }

    if (vista === "editor") {
        return (
            <ReglaEditor
                regla={reglaEdicion}
                onGuardado={() => {
                    setVista("tabla");
                    setReglaEdicion(null);
                    void cargar();
                }}
                onCancelar={() => {
                    setVista("tabla");
                    setReglaEdicion(null);
                }}
            />
        );
    }

    if (vista === "historial" && reglaHistorial) {
        return (
            <ReglaHistorial
                reglaId={reglaHistorial.id}
                claveRegla={reglaHistorial.clave}
                onVolver={() => {
                    setVista("tabla");
                    setReglaHistorial(null);
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button
                    onClick={() => {
                        setReglaEdicion(null);
                        setVista("editor");
                    }}
                >
                    Crear regla nueva
                </Button>
            </div>
            {aviso && (
                <Alerta tono="advertencia" role="status">
                    {aviso}
                </Alerta>
            )}
            {cargando && <Cargando />}
            {error && <Alerta tono="error">{error}</Alerta>}
            {!cargando && !error && reglas.length === 0 && (
                <p className="text-sm text-muted">
                    No hay reglas registradas. Crea la primera con el botón de arriba; nacerá en modo
                    Recomienda (solo genera sugerencias).
                </p>
            )}
            {!cargando && !error && reglas.length > 0 && (
                <ReglasTable
                    reglas={reglas}
                    onEditar={(regla) => void abrirEdicion(regla)}
                    onHistorial={(regla) => {
                        setReglaHistorial(regla);
                        setVista("historial");
                    }}
                    onCambiarModo={setReglaModo}
                    onToggleActiva={(regla) => {
                        setReglaToggle(regla);
                        setMotivoToggle("");
                        setErrorToggle(null);
                    }}
                />
            )}

            <ReglaModoDialog
                regla={reglaModo}
                onClose={() => setReglaModo(null)}
                onConfirmado={(resultado) => {
                    setReglaModo(null);
                    setAviso(resultado.advertencia);
                    void cargar();
                }}
            />

            <Modal
                isOpen={reglaToggle !== null}
                onClose={() => setReglaToggle(null)}
                title={reglaToggle?.activa ? "Desactivar regla" : "Activar regla"}
                size="md"
            >
                {reglaToggle && (
                    <div className="space-y-4">
                        <p className="text-sm text-body">
                            {reglaToggle.activa
                                ? `La regla ${reglaToggle.nombre} dejará de evaluarse (el worker la omite). El cambio queda en auditoría.`
                                : `La regla ${reglaToggle.nombre} volverá a evaluarse en el siguiente ciclo del worker. El cambio queda en auditoría.`}
                        </p>
                        <Textarea
                            label="Motivo (obligatorio, mínimo 10 caracteres)"
                            value={motivoToggle}
                            onChange={(e) => setMotivoToggle(e.target.value)}
                            rows={2}
                            placeholder="Por qué se cambia el estado de esta regla"
                        />
                        {errorToggle && <Alerta tono="error">{errorToggle}</Alerta>}
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setReglaToggle(null)} disabled={enviandoToggle}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={confirmarToggle}
                                isLoading={enviandoToggle}
                                disabled={motivoToggle.trim().length < 10}
                            >
                                {reglaToggle.activa ? "Desactivar" : "Activar"}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
