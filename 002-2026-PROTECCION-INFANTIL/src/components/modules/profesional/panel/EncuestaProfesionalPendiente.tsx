"use client";
/**
 * SPEC-429 (A-75 · brief §9-bis · orden CEO 23:5x) · Sección de encuesta
 * del panel del profesional. Componente PROPIO de Dev 01; Dev 02 lo monta
 * en `PanelProfesional.tsx` con **una sola línea**:
 *
 *     <EncuestaProfesionalPendiente />
 *
 * Fetching autónomo (`/api/encuesta`): si el profesional tiene una cita
 * CUMPLIDA sin responder, muestra el formulario; si no, se pinta un vacío
 * discreto (no ensucia el panel).
 */
import { useEffect, useState } from "react";
import { EncuestaFormulario } from "@/components/modules/encuesta/EncuestaFormulario";
import type { DefinicionPregunta } from "@/lib/profesional/cita/encuestas-preguntas";

interface Pendiente {
    solicitudId: string;
    origen: "PADRE" | "PROFESIONAL";
    preguntas: DefinicionPregunta[];
}

export function EncuestaProfesionalPendiente() {
    const [pendiente, setPendiente] = useState<Pendiente | null | "cargando">("cargando");

    async function traer() {
        try {
            const res = await fetch("/api/encuesta", { credentials: "include" });
            if (!res.ok) {
                setPendiente(null);
                return;
            }
            const json = (await res.json()) as { data: Pendiente | null };
            setPendiente(json.data);
        } catch {
            setPendiente(null);
        }
    }

    useEffect(() => {
        void traer();
    }, []);

    if (pendiente === "cargando") {
        return null;
    }
    if (!pendiente) return null;
    // Solo se pinta cuando la pendencia es del lado del profesional. Si por
    // alguna razón (mixto de roles en la misma sesión) el GET devuelve una
    // pendencia como PADRE, no la mostramos acá — la /encuesta la absorbe.
    if (pendiente.origen !== "PROFESIONAL") return null;
    return (
        <div className="mt-6">
            <EncuestaFormulario
                solicitudId={pendiente.solicitudId}
                origen="PROFESIONAL"
                preguntas={pendiente.preguntas}
                titulo="Cerrá la última cita — cinco preguntas"
                explicacion="Sin estrellas ni texto libre. Tus respuestas se cruzan con las del padre para detectar contradicciones (r1 y r2)."
                onCompletado={() => setPendiente(null)}
            />
        </div>
    );
}
