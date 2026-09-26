"use client";

/**
 * SPEC-740 · Paso 3 (TERMINAL) del asistente de registro del profesional: la Autorización.
 *
 * Es la compuerta «Guardar y enviar a revisión» (SPEC-686/703): aceptar la autorización
 * DESBLOQUEA el envío. Reusa `AceptacionAutorizacion` (texto legal certificado) DENTRO del
 * asistente — tarjeta sola; el marco «Paso 3 de 3» lo pone `WizardProfesionalShell`. Al
 * aceptar, el acto terminal es enviar a revisión (PUT parcial {enviarARevision:true}; el
 * servidor valida completitud contra la ficha YA guardada y nombra lo que falte). Voz usted.
 *
 * SOLO el camino de REGISTRO. La re-aceptación de un habilitado (versión nueva de la
 * autorización) sigue por su propia entrada, sin el asistente (decisión CEO SPEC-740).
 */
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { AceptacionAutorizacion } from "./AceptacionAutorizacion";

// Tras enviar, vuelve a la Ficha: ahí el encabezado muestra el estado EN_REVISION (solo lectura).
const DESTINO_TRAS_ENVIAR = "/perfil-profesional/completar";

export function AutorizacionPasoFinal({
    version,
    documentoContenido,
    yaAcepto,
}: {
    version: string;
    documentoContenido: string;
    yaAcepto: boolean;
}) {
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const enviarARevision = async () => {
        setError(null);
        setEnviando(true);
        try {
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enviarARevision: true }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (json?.error?.code === "FICHA_INCOMPLETA" && Array.isArray(json.error.campos)) {
                    setError(
                        `Falta completar en su ficha: ${json.error.campos.join(", ")}. Vuelva al paso 1 (Su ficha) para completarla.`,
                    );
                    return;
                }
                setError(json?.error?.message ?? "No fue posible enviar a revisión.");
                return;
            }
            // Navegación dura: la Ficha re-lee el estado ya en EN_REVISION (solo lectura + aviso).
            window.location.assign(DESTINO_TRAS_ENVIAR);
        } catch {
            setError("Error de red al enviar a revisión.");
        } finally {
            setEnviando(false);
        }
    };

    // Aún no aceptó: mostrar el texto legal para leer + aceptar; aceptar dispara el envío terminal.
    if (!yaAcepto) {
        return (
            <AceptacionAutorizacion
                version={version}
                documentoContenido={documentoContenido}
                redirectUrl={DESTINO_TRAS_ENVIAR}
                dentroDeAsistente
                onAceptado={enviarARevision}
                textoBoton="Guardar y enviar a revisión"
            />
        );
    }

    // Ya aceptó (volvió a este paso): no se re-pide la lectura; se ofrece el envío terminal.
    return (
        <GlassCard className="w-full max-w-2xl">
            <h1 className="text-2xl font-bold text-body">Autorización</h1>
            <p className="mt-2 text-sm text-body">
                <span className="font-medium">Autorización aceptada</span> (versión {version}). Ya puede
                enviar su perfil a revisión.
            </p>
            {error && (
                <div className="mt-4">
                    <Alerta tono="error">{error}</Alerta>
                </div>
            )}
            <div className="mt-6 flex justify-end">
                <Button onClick={() => void enviarARevision()} isLoading={enviando} disabled={enviando}>
                    Guardar y enviar a revisión
                </Button>
            </div>
        </GlassCard>
    );
}
