"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExpedienteCard } from "./ExpedienteCard";
import { MAX_IDENTIFICADOR_LENGTH } from "@/lib/expediente/identificador-param";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

interface ExpedienteItem {
    id: string;
    identificadorReportado: string;
    estado: EstadoExpediente;
    scoreGravedadActual: ScoreGravedad;
    fechaApertura: Date;
    ultimoEventoEn: Date | null;
    numEventos: number;
}

interface IdentificadorBusquedaClientProps {
    identificador: string;
    expedientes: ExpedienteItem[];
}

/**
 * SPEC-233 (002-PI-133): búsqueda por identificador en el ámbito padre.
 * Lista solo los expedientes propios sobre el identificador (nuevo → anterior)
 * y permite buscar otro identificador navegando a la misma ruta codificada.
 */
export function IdentificadorBusquedaClient({ identificador, expedientes }: IdentificadorBusquedaClientProps) {
    const router = useRouter();
    const [valor, setValor] = useState(identificador);

    function buscar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const candidato = valor.trim();
        if (!candidato || candidato.length > MAX_IDENTIFICADOR_LENGTH) return;
        router.push(`/dashboard/padre/identificador/${encodeURIComponent(candidato)}`);
    }

    return (
        <div>
            <form onSubmit={buscar} className="mb-6 flex flex-col gap-3 sm:flex-row">
                <input
                    type="text"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    maxLength={MAX_IDENTIFICADOR_LENGTH}
                    placeholder="Buscar por identificador (número, nick o perfil)"
                    aria-label="Buscar por identificador"
                    className="w-full flex-1 rounded-xl border border-cielo/30 bg-white/70 px-4 py-2.5 text-sm text-body placeholder:text-muted focus:border-primary-500 focus:outline-none"
                />
                <button
                    type="submit"
                    className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cielo/25 transition hover:opacity-90"
                >
                    Buscar
                </button>
            </form>

            {expedientes.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-body font-semibold">No tienes expedientes sobre este identificador</p>
                    <p className="mt-2 text-sm text-muted">
                        Si quieres reportar una nueva situación relacionada, puedes hacerlo desde el flujo de reporte.
                    </p>
                    <Link
                        href="/dashboard/padre/reportar"
                        className="mt-5 inline-block rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cielo/25 transition hover:opacity-90"
                    >
                        Reportar una situación
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {expedientes.map((exp) => (
                        <ExpedienteCard
                            key={exp.id}
                            id={exp.id}
                            identificadorReportado={exp.identificadorReportado}
                            estado={exp.estado}
                            scoreGravedadActual={exp.scoreGravedadActual}
                            fechaApertura={exp.fechaApertura}
                            ultimoEventoEn={exp.ultimoEventoEn}
                            numEventos={exp.numEventos}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
