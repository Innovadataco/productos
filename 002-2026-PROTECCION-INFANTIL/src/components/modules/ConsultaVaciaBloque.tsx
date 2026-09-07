"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/ui/Alerta";
import { Modal } from "@/components/ui/Modal";
import { dejarHandoffReportar } from "@/lib/reportar-handoff";
import { CanalesOficiales } from "./CanalesOficiales";

/**
 * F3 (N-5): bloque curado del estado vacío de la consulta pública.
 * Contenido 100% estático (viene de parámetros curados, NADA de IA).
 * Presunción de inocencia: lenguaje descriptivo, nunca "es seguro/peligroso".
 *
 * 3002: las señales y acciones viven tras un enlace informativo (modal) para no
 * saturar el estado vacío. Disclaimer, CTA de reporte y canales oficiales se
 * mantienen SIEMPRE visibles (restricción de producto).
 */
export type ConsultaVaciaBloqueData = {
    disclaimer?: string;
    senales?: string[];
    acciones?: string[];
};

type ConsultaVaciaBloqueProps = {
    bloque: ConsultaVaciaBloqueData;
    identificador: string;
};

export function ConsultaVaciaBloque({ bloque, identificador }: ConsultaVaciaBloqueProps) {
    const router = useRouter();
    const [mostrarConsejos, setMostrarConsejos] = useState(false);

    // El identificador consultado NO puede quedar en la URL de /reportar (spec
    // 091-US2 / 093-US4): esta es una pantalla pública y la URL termina en el
    // historial, en el `Referer` y en los logs. Viaja por sessionStorage, sin
    // `fijar`: acá es un prellenado de cortesía y el usuario puede corregirlo.
    const irAReportar = () => {
        registrarCta();
        dejarHandoffReportar(identificador, { fijar: false });
        router.push("/reportar");
    };

    // Evento analítico fire-and-forget: NUNCA lleva el identificador (privacidad).
    const registrarCta = () => {
        fetch("/api/consulta/evento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evento: "consulta_vacia_cta_reportar" }),
        }).catch(() => {
            // Analítica best-effort: nunca bloquea la navegación al wizard.
        });
    };

    const hayConsejos = (bloque.senales?.length ?? 0) > 0 || (bloque.acciones?.length ?? 0) > 0;

    return (
        <div className="space-y-4 text-left">
            {bloque.disclaimer && <Alerta tono="advertencia">{bloque.disclaimer}</Alerta>}

            {hayConsejos && (
                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => setMostrarConsejos(true)}
                        className="text-sm font-medium text-accent underline-offset-2 transition hover:underline"
                    >
                        Ver señales de alerta y qué puedes hacer
                    </button>
                </div>
            )}

            <div className="text-center">
                <button
                    type="button"
                    onClick={irAReportar}
                    className="inline-flex rounded-xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                >
                    Reportar una conducta
                </button>
            </div>

            <CanalesOficiales />

            <Modal
                isOpen={mostrarConsejos}
                onClose={() => setMostrarConsejos(false)}
                title="Señales de alerta y qué puedes hacer"
                size="md"
            >
                <div className="space-y-5 text-left">
                    {bloque.senales && bloque.senales.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-body mb-3 uppercase tracking-wide">
                                Señales de alerta a las que estar atento
                            </h3>
                            <ul className="list-disc space-y-1.5 pl-5 text-sm text-body">
                                {bloque.senales.map((senal) => (
                                    <li key={senal}>{senal}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {bloque.acciones && bloque.acciones.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-body mb-3 uppercase tracking-wide">
                                Qué puedes hacer
                            </h3>
                            <ul className="list-disc space-y-1.5 pl-5 text-sm text-body">
                                {bloque.acciones.map((accion) => (
                                    <li key={accion}>{accion}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
