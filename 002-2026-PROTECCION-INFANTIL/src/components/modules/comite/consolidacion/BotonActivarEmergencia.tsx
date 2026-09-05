"use client";

// SPEC-239 (002-PI-mega-cola): botón "Activar emergencia" de la vista de
// consolidación del comité (US5, FR-010). Visible SOLO cuando el expediente
// está en gravedad ROJO; exige confirmación modal (la acción notifica al
// contacto de emergencia prioritario del padre). Color ruby vía token `rubi`
// del sistema de diseño; texto neutro.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

async function extraerError(res: Response, fallback: string): Promise<string> {
    try {
        const json = await res.json();
        return json?.error?.message ?? fallback;
    } catch {
        return fallback;
    }
}

export function BotonActivarEmergencia({
    expedienteId,
    scoreGravedadActual,
}: {
    expedienteId: string;
    scoreGravedadActual: string;
}) {
    const router = useRouter();
    const [abierto, setAbierto] = useState(false);
    const [ejecutando, setEjecutando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    // US5.2: con gravedad distinta a ROJO el botón no se renderiza.
    if (scoreGravedadActual !== "ROJO") return null;

    const confirmar = async () => {
        setEjecutando(true);
        setError(null);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/comite/expediente/${expedienteId}/activar-emergencia`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                setError(await extraerError(res, "No se pudo activar la emergencia"));
                return;
            }
            setAbierto(false);
            setMensaje("Emergencia activada: se notificó al contacto prioritario");
            router.refresh();
        } catch {
            setError("Error de red al activar la emergencia");
        } finally {
            setEjecutando(false);
        }
    };

    return (
        <section className="glass rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-semibold text-body">Emergencia</h3>
            <p className="text-sm text-muted">
                Caso en gravedad ROJO. La activación notifica de inmediato al contacto de emergencia prioritario
                registrado por el padre.
            </p>
            <div>
                {/* SPEC-475 (I-320) · el DISPARADOR de una acción destructiva es
                    Fantasma-rubí; el rubí sólido se reserva al «confirmar» del modal,
                    donde el usuario ya decidió (regla Diseño §7.1). */}
                <Button
                    type="button"
                    onClick={() => setAbierto(true)}
                    disabled={ejecutando}
                    variant="danger"
                    className="text-sm"
                >
                    Activar emergencia
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-sm text-rubi">
                    {error}
                </p>
            )}
            {mensaje && <p className="text-sm text-pino">{mensaje}</p>}

            <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Activar emergencia" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-body">
                        Esta acción notifica de inmediato al contacto de emergencia de mayor prioridad registrado
                        por el padre. Úsala solo cuando el caso requiera contacto inmediato con el acudiente.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {/* SPEC-475 (I-320) · el CONFIRMAR del modal es el único lugar
                            con rubí SÓLIDO (reserva de Diseño §7.1): el usuario ya
                            decidió acá. One-off intencional, no una variante reusable. */}
                        <button
                            type="button"
                            onClick={confirmar}
                            disabled={ejecutando}
                            className="inline-flex items-center justify-center rounded-xl bg-rubi px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {ejecutando ? "Activando..." : "Confirmar activación"}
                        </button>
                        <Button
                            onClick={() => setAbierto(false)}
                            disabled={ejecutando}
                            variant="outline"
                            className="text-sm"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}
