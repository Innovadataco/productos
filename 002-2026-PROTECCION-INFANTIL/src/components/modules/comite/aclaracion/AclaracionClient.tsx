"use client";

// SPEC-238 (002-PI-mega-cola): detalle de la aclaración y formulario de
// respuesta del comité (T022). Solo renderiza acciones cuando la aclaración
// está PENDIENTE; el endpoint valida rol, ámbito y estado (409/403/404).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const MAX_RESPUESTA = 2000;

interface AclaracionClientProps {
    aclaracionId: string;
    expedienteId: string;
    estado: string;
    solicitadaEn: string;
    solicitudTexto: string;
    respuestaTexto: string | null;
    respondidaEn: string | null;
}

function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function AclaracionClient({
    aclaracionId,
    estado,
    solicitadaEn,
    solicitudTexto,
    respuestaTexto,
    respondidaEn,
}: AclaracionClientProps) {
    const router = useRouter();
    const [respuesta, setRespuesta] = useState("");
    const [ejecutando, setEjecutando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    const puedeResponder = estado === "PENDIENTE";

    const handleResponder = async () => {
        const texto = respuesta.trim();
        if (!texto) {
            setError("El texto de la respuesta es obligatorio");
            return;
        }
        if (texto.length > MAX_RESPUESTA) {
            setError(`El texto no puede superar ${MAX_RESPUESTA} caracteres`);
            return;
        }
        setEjecutando(true);
        setError(null);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/comite/aclaracion/${aclaracionId}/responder`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ respuestaTexto: texto }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(json?.error?.message ?? "No se pudo registrar la respuesta");
                return;
            }
            setMensaje("Respuesta registrada; el expediente volvió a aprobación del padre");
            setRespuesta("");
            router.refresh();
        } catch {
            setError("Error de red al registrar la respuesta");
        } finally {
            setEjecutando(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="glass rounded-2xl p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-body">Solicitud del padre</h2>
                    <span className="text-xs text-muted" data-testid="aclaracion-estado">
                        Estado: {estado}
                    </span>
                </div>
                <p className="text-xs text-muted">Solicitada el {formatearFecha(solicitadaEn)}</p>
                <p className="text-sm text-body whitespace-pre-wrap" data-testid="aclaracion-solicitud">
                    {solicitudTexto}
                </p>
            </section>

            {respuestaTexto !== null && (
                <section className="glass rounded-2xl p-6 space-y-3">
                    <h2 className="text-lg font-semibold text-body">Respuesta del comité</h2>
                    {respondidaEn && <p className="text-xs text-muted">Respondida el {formatearFecha(respondidaEn)}</p>}
                    <p className="text-sm text-body whitespace-pre-wrap" data-testid="aclaracion-respuesta">
                        {respuestaTexto}
                    </p>
                </section>
            )}

            {puedeResponder && (
                <section className="glass rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-body">Responder aclaración</h2>
                    <Textarea
                        value={respuesta}
                        onChange={(e) => setRespuesta(e.target.value)}
                        rows={5}
                        maxLength={MAX_RESPUESTA}
                        placeholder="Escribe la respuesta para el padre (máximo 2000 caracteres)"
                        aria-label="Respuesta de la aclaración"
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={handleResponder} disabled={ejecutando} className="text-sm">
                            {ejecutando ? "Enviando..." : "Enviar respuesta"}
                        </Button>
                        <span className="text-xs text-muted">
                            {respuesta.length}/{MAX_RESPUESTA}
                        </span>
                    </div>
                </section>
            )}

            {!puedeResponder && respuestaTexto === null && (
                <section className="glass rounded-2xl p-6">
                    <p className="text-sm text-muted" data-testid="aclaracion-sin-acciones">
                        La aclaración está en estado {estado}; ya no admite respuesta del comité.
                    </p>
                </section>
            )}

            {error && (
                <p className="text-sm text-rubi" role="alert" data-testid="aclaracion-error">
                    {error}
                </p>
            )}
            {mensaje && (
                <p className="text-sm text-pino" role="status" data-testid="aclaracion-mensaje">
                    {mensaje}
                </p>
            )}
        </div>
    );
}
