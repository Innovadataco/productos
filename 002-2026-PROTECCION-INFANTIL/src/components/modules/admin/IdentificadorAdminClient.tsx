"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_IDENTIFICADOR_LENGTH } from "@/lib/expediente/identificador-param";

/**
 * SPEC-233 (002-PI-133): caja de búsqueda de la vista admin/comité por
 * identificador. Navega a la misma ruta con el valor codificado.
 */
export function IdentificadorAdminClient({ identificador }: { identificador: string }) {
    const router = useRouter();
    const [valor, setValor] = useState(identificador);

    function buscar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const candidato = valor.trim();
        if (!candidato || candidato.length > MAX_IDENTIFICADOR_LENGTH) return;
        router.push(`/dashboard/admin/identificador/${encodeURIComponent(candidato)}`);
    }

    return (
        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row">
            <input
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                maxLength={MAX_IDENTIFICADOR_LENGTH}
                placeholder="Buscar por identificador (número, nick o perfil)"
                aria-label="Buscar por identificador"
                className="w-full flex-1 rounded-xl border border-ambar/30 bg-white/70 px-4 py-2.5 text-sm text-body placeholder:text-muted focus:border-ambar focus:outline-none"
            />
            <button
                type="submit"
                className="rounded-xl bg-ambar px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            >
                Buscar
            </button>
        </form>
    );
}
