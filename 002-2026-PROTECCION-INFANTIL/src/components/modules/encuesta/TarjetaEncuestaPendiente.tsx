"use client";
/**
 * SPEC-784 · La TARJETA del padre que lo invita a contar cómo le fue en su cita — punto de entrada de
 * la encuesta. Forma y copy de Diseño (`439d1c3`). NO es un redirect, NO es un modal, NO es un toast:
 * una tarjeta persistente y DESCARTABLE que vive DEBAJO del encabezado de reporte (nunca lo tapa).
 *
 * - Voluntaria: «Ahora no» de igual peso, sin culpa; descartar la esconde en ESTA vista y reaparece en
 *   la próxima entrada (estado de montaje, no persistido — «no mendiga» pero insiste hasta que se
 *   responda o cierre la ventana).
 * - No presume el desenlace: «cuéntanos cómo te fue» abre igual para el «sí» y para el «no» (el sistema
 *   aún no sabe si la cita ocurrió — lo deriva la encuesta).
 * - Si no hay pendientes, no renderiza nada (no ocupa espacio, no mendiga).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface Pendiente {
    solicitudId: string;
    franjaInicio: string; // ISO (viene por JSON)
}

function fechaCorta(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "tu cita";
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(d);
}

export function TarjetaEncuestaPendiente() {
    const [pendientes, setPendientes] = useState<Pendiente[]>([]);
    const [descartada, setDescartada] = useState(false);

    useEffect(() => {
        let vivo = true;
        fetch("/api/encuesta", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : { data: { pendientes: [] } }))
            .then((json) => {
                if (vivo) setPendientes(json?.data?.pendientes ?? []);
            })
            .catch(() => {
                /* silencioso: una invitación que no carga no puede romper el panel de reportes */
            });
        return () => {
            vivo = false;
        };
    }, []);

    if (descartada || pendientes.length === 0) return null;

    const masReciente = pendientes[0]!;
    const varias = pendientes.length > 1;
    const titulo = varias
        ? `Tienes ${pendientes.length} citas por contarnos.`
        : `Cuéntanos cómo te fue en tu cita del ${fechaCorta(masReciente.franjaInicio)}.`;

    return (
        <section aria-label="Encuesta de tu cita" className="glass rounded-2xl p-5">
            <p className="text-body font-medium">{titulo}</p>
            <p className="cuerpo text-subtle mt-1">Es un minuto y nos ayuda a cuidar el servicio.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                    href={`/encuesta?solicitud=${encodeURIComponent(masReciente.solicitudId)}`}
                    className="rounded-xl bg-cielo px-4 py-2 text-sm text-white hover:opacity-90"
                >
                    Contar cómo me fue
                </Link>
                <button
                    type="button"
                    onClick={() => setDescartada(true)}
                    className="rounded-xl border border-tinta/15 px-4 py-2 text-sm text-body hover:bg-tinta/5"
                >
                    Ahora no
                </button>
            </div>
        </section>
    );
}
