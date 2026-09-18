"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { EstadoSolicitudCita } from "@prisma/client";

/**
 * SPEC-425 (A-75 · L5) + SPEC-712 (FORMA-SPEC712 §6) · las acciones de una
 * solicitud, PINTADAS POR ESTADO.
 *
 * El bug de Jelkin (medido): el componente recibía **solo `solicitudId`, sin el
 * estado**, y pintaba «Confirmar»/«No puedo» SIEMPRE — aun en `SIN_CONFIRMAR`,
 * donde el pago de la reserva todavía no se aprobó. Al pulsar «No puedo» el
 * servidor rechazaba con la REGLA («Solo se puede rechazar una solicitud pagada
 * y pendiente», `cita.service.ts:215`), no con el estado. El profesional quedaba
 * mirando una regla en vez de saber en qué va.
 *
 * Regla (misma lección que la ficha bloqueada de SPEC-706): las acciones
 * aparecen SOLO cuando aplican; el resto del tiempo se muestra el ESTADO. El
 * componente ahora **sabe el estado** y pinta por estado:
 *
 *  · SIN_CONFIRMAR    → sin botones (nada que aceptar/rechazar aún) + insignia
 *                       neutra «En validación» + la línea de qué va.
 *  · PAGADA_PENDIENTE → los dos botones (Confirmar = primario de la casa, cielo,
 *                       con su firma; «No puedo» = neutro) + la línea del pago.
 *
 * `confirmar` y `rechazar` exigen `PAGADA_PENDIENTE` en el motor
 * (`cita.service.ts:189,215`): el ÚNICO 409 de esas dos funciones es el desfase
 * de estado. Por eso los botones se renderizan SOLO en ese estado —candado de
 * control positivo: en `SIN_CONFIRMAR` no hay botón que pegue contra la regla— y
 * si por una carrera el estado cambió bajo los pies, el 409 se traduce a un
 * mensaje de ESTADO, no a la regla cruda.
 *
 * (Al confirmar, la cita pasa a CONFIRMADA y recién ahí se comparte el
 * dónde/enlace — SPEC-708.)
 */
export function SolicitudAcciones({
    estado,
    solicitudId,
}: {
    estado: EstadoSolicitudCita;
    solicitudId: string;
}) {
    const router = useRouter();
    const [enCurso, setEnCurso] = useState<"confirmar" | "rechazar" | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function ejecutar(accion: "confirmar" | "rechazar") {
        setEnCurso(accion);
        setError(null);
        try {
            const res = await fetch(`/api/profesional/solicitudes/${solicitudId}/${accion}`, {
                method: "PATCH",
                credentials: "include",
            });
            if (!res.ok) {
                // FORMA §6: el 409 nunca llega como muro con la regla cruda. En estas dos
                // acciones el único CONFLICT del motor es el desfase de estado (una carrera
                // con el worker de 48h o con el admin): se le dice el ESTADO y que recargue.
                if (res.status === 409) {
                    setError("Esta solicitud cambió de estado; recargue para verla al día.");
                    return;
                }
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                // El resto (403/500…) muestra la causa real, no un "error interno" (I-287).
                setError(cuerpo?.error?.message ?? `No se pudo ${accion} (HTTP ${res.status}).`);
                return;
            }
            router.refresh();
        } catch (e) {
            console.error("[SolicitudAcciones]", e);
            setError("No pudimos comunicarnos con el servidor. Revise su conexión e intente de nuevo.");
        } finally {
            setEnCurso(null);
        }
    }

    // SIN_CONFIRMAR (y cualquier estado que no sea PAGADA_PENDIENTE): el pago de la
    // reserva no está aprobado, así que NO hay acción que tomar. Gate FAIL-SAFE — los
    // botones solo se pintan donde su acción no daría 409.
    if (estado !== "PAGADA_PENDIENTE") {
        return (
            <div className="mt-3 space-y-2">
                <span className="inline-flex items-center rounded-full bg-tinta/10 px-2.5 py-0.5 text-xs font-medium text-body dark:bg-tinta/20">
                    En validación
                </span>
                <p className="text-xs text-subtle">
                    <span className="font-medium text-body">Esta familia reservó esta hora.</span> Estamos validando su
                    pago. Cuando quede aprobado, aquí podrá confirmar la cita o avisar que no puede. Por ahora no tiene
                    que hacer nada.
                </p>
            </div>
        );
    }

    // PAGADA_PENDIENTE: el pago está aprobado — su acción ya aplica.
    return (
        <div className="mt-3">
            <p className="mb-2 text-xs text-subtle">
                El pago está aprobado. <span className="font-medium text-body">Confirme la cita</span> o, si no puede
                atenderla, <span className="font-medium text-body">avísele a la familia</span>.
            </p>
            <div className="flex flex-wrap gap-2">
                {/* Confirmar = primario de la casa (cielo, con su firma/movimiento). El pino se
                    reserva para el ESTADO confirmado del bloque, no para el botón (FORMA §6b). */}
                <Button
                    variant="primary"
                    onClick={() => void ejecutar("confirmar")}
                    disabled={enCurso !== null}
                    isLoading={enCurso === "confirmar"}
                >
                    Confirmar
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => void ejecutar("rechazar")}
                    disabled={enCurso !== null}
                    isLoading={enCurso === "rechazar"}
                >
                    No puedo
                </Button>
            </div>
            {error && (
                <p role="alert" className="mt-2 text-xs text-ambar">
                    {error}
                </p>
            )}
        </div>
    );
}
