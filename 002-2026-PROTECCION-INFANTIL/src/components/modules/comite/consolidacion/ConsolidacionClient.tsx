"use client";

// SPEC-237 (002-PI-mega-cola): composición cliente de la vista de
// consolidación. Ejecuta las mutaciones (aprobar/corregir/devolver) contra
// la API y refresca el Server Component tras cada cambio.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConsolidacionHeader } from "./ConsolidacionHeader";
import { ConsolidacionTimeline } from "./ConsolidacionTimeline";
import { ConsolidacionResumenEditor } from "./ConsolidacionResumenEditor";
import { ConsolidacionPatronesN1 } from "./ConsolidacionPatronesN1";
import { ConsolidacionSenalComunitaria } from "./ConsolidacionSenalComunitaria";
import { ConsolidacionGuiaAccion } from "./ConsolidacionGuiaAccion";
import { ConsolidacionAcciones } from "./ConsolidacionAcciones";
import { BotonActivarEmergencia } from "./BotonActivarEmergencia";
import type { DetalleConsolidacionDto } from "./tipos";

async function extraerError(res: Response, fallback: string): Promise<string> {
    try {
        const json = await res.json();
        return json?.error?.message ?? fallback;
    } catch {
        return fallback;
    }
}

export function ConsolidacionClient({
    detalle,
    puedeActuar,
    puedeEmergencia = false,
}: {
    detalle: DetalleConsolidacionDto;
    puedeActuar: boolean;
    /** SPEC-239: solo COMITE_VALIDACION puede activar la emergencia de un caso ROJO. */
    puedeEmergencia?: boolean;
}) {
    const router = useRouter();
    const [guiaSeleccionada, setGuiaSeleccionada] = useState<string | null>(
        detalle.informe.guiaAccionCategoriaIdPrincipal
    );
    const [ejecutando, setEjecutando] = useState(false);

    const base = `/api/admin/comite/consolidacion/${detalle.expediente.id}`;

    const post = async (url: string, body: unknown): Promise<string | null> => {
        setEjecutando(true);
        try {
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) return extraerError(res, "No se pudo completar la acción");
            router.refresh();
            return null;
        } catch {
            return "Error de red al ejecutar la acción";
        } finally {
            setEjecutando(false);
        }
    };

    const handleAprobar = () => post(`${base}/aprobar`, {});

    const handleCorregir = (texto: string, motivo: string) =>
        post(`${base}/corregir`, {
            resumenTextoGenerado: texto,
            motivo,
            ...(guiaSeleccionada ? { guiaAccionCategoriaIdPrincipal: guiaSeleccionada } : {}),
        });

    const handleDevolver = (motivo: string) => post(`${base}/devolver`, { motivo });

    return (
        <div className="space-y-6">
            <ConsolidacionHeader detalle={detalle} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                    <ConsolidacionTimeline eventos={detalle.expediente.eventos} />
                    <ConsolidacionPatronesN1 patrones={detalle.patrones} />
                    <ConsolidacionSenalComunitaria senal={detalle.senalComunitaria} />
                </div>
                <div className="space-y-6">
                    <ConsolidacionGuiaAccion
                        guias={detalle.guiasDisponibles}
                        guiaSeleccionada={guiaSeleccionada}
                        onCambiar={setGuiaSeleccionada}
                        disabled={!puedeActuar}
                    />
                    <ConsolidacionResumenEditor
                        resumenInicial={detalle.informe.resumenTextoGenerado}
                        correcciones={detalle.informe.correcciones}
                        puedeActuar={puedeActuar}
                        guardando={ejecutando}
                        onCorregir={handleCorregir}
                    />
                    <ConsolidacionAcciones
                        puedeActuar={puedeActuar}
                        estadoAprobacion={detalle.informe.estadoAprobacion}
                        ejecutando={ejecutando}
                        onAprobar={handleAprobar}
                        onDevolver={handleDevolver}
                    />
                    {puedeEmergencia && (
                        <BotonActivarEmergencia
                            expedienteId={detalle.expediente.id}
                            scoreGravedadActual={detalle.expediente.scoreGravedadActual}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
