"use client";

import { useState } from "react";
import { LandingHero, type ResultadoConsulta } from "@/components/modules/LandingHero";
import { useApi } from "@/lib/hooks/useApi";

/**
 * SPEC-129 (D-b, O-2): bloque de consulta pública compartido por la home pública
 * y la home del colegio — UNA sola implementación (antes el glue vivía duplicado
 * en HomePageClient). El identificador viaja en el cuerpo, NUNCA en la URL (spec 091-US1).
 */
export function ConsultaPublica() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);

    const handleSearch = async (identificador: string) => {
        setBuscado(true);
        await request("/api/consulta", {
            method: "POST",
            body: JSON.stringify({ identificador }),
        });
    };

    return (
        <LandingHero
            onSearch={handleSearch}
            data={data as ResultadoConsulta | null}
            isLoading={isLoading}
            error={error}
            buscado={buscado}
        />
    );
}
