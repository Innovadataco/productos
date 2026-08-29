"use client";

import { SemaforoItem } from "./SemaforoItem";
import type { SemaforoContacto } from "@/lib/padre/semaforo";

interface SemaforoCirculoProps {
    contactos: SemaforoContacto[];
    titulo?: string;
}

function ordenarPorSeveridad(a: SemaforoContacto, b: SemaforoContacto): number {
    const peso = { ROJO: 3, AMBAR: 2, VERDE: 1 } as const;
    const diff = peso[b.color] - peso[a.color];
    if (diff !== 0) return diff;
    return (b.totalReportes ?? 0) - (a.totalReportes ?? 0);
}

export function SemaforoCirculo({ contactos, titulo = "Estado de tu círculo de confianza" }: SemaforoCirculoProps) {
    if (contactos.length === 0) {
        return (
            <div className="glass rounded-3xl p-6 text-center">
                <h2 className="text-lg font-semibold text-body">{titulo}</h2>
                <p className="mt-2 text-sm text-muted">
                    Aún no tienes contactos en tu círculo. Agrega uno para empezar a monitorear.
                </p>
            </div>
        );
    }

    const ordenados = [...contactos].sort(ordenarPorSeveridad);

    return (
        <section aria-labelledby="semaforo-circulo-titulo">
            <h2 id="semaforo-circulo-titulo" className="text-lg font-semibold text-body">
                {titulo}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ordenados.map((contacto) => (
                    <li key={contacto.id}>
                        <SemaforoItem
                            etiqueta={contacto.etiqueta}
                            color={contacto.color}
                            totalReportes={contacto.totalReportes}
                            categoriaDominante={contacto.categoriaDominante}
                            activo={contacto.activo}
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}
