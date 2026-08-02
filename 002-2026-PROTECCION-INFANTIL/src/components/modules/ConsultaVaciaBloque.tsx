"use client";

import Link from "next/link";
import { Alerta } from "@/components/ui/Alerta";
import { CanalesOficiales } from "./CanalesOficiales";

/**
 * F3 (N-5): bloque curado del estado vacío de la consulta pública.
 * Contenido 100% estático (viene de parámetros curados, NADA de IA).
 * Presunción de inocencia: lenguaje descriptivo, nunca "es seguro/peligroso".
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
    const hrefReportar = `/reportar?identificador=${encodeURIComponent(identificador)}`;

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

    return (
        <div className="space-y-4 text-left">
            {bloque.disclaimer && <Alerta tono="advertencia">{bloque.disclaimer}</Alerta>}

            {bloque.senales && bloque.senales.length > 0 && (
                <div className="glass rounded-2xl p-5">
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
                <div className="glass rounded-2xl p-5">
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

            <div className="text-center">
                <Link
                    href={hrefReportar}
                    onClick={registrarCta}
                    className="inline-flex rounded-xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                >
                    Reportar una conducta
                </Link>
            </div>

            <CanalesOficiales />
        </div>
    );
}
