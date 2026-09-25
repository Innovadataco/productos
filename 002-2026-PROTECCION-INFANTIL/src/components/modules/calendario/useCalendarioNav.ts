"use client";

/**
 * SPEC-730 · Estado de navegación de la rejilla (vista semana/día, ancla, días
 * visibles, rango) — compartido por los usos del padre (elegir franja / mis citas).
 * Puro de presentación: no hace red. En un teléfono abre en «día» (la semana es
 * ilegible). El profesional conserva su propia barra por ahora; SPEC-732 la unifica.
 */
import { useEffect, useMemo, useState } from "react";
import { DOW, addDias, diaSemana, lunesDe, nombreMes, numMes } from "./fechas";

export type VistaCalendario = "semana" | "dia";

export function useCalendarioNav(hoy: string, anclaInicial: string = hoy) {
    const [vista, setVista] = useState<VistaCalendario>("semana");
    const [ancla, setAncla] = useState(anclaInicial);

    // En un teléfono la vista principal es el día (la semana es ilegible).
    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 768) setVista("dia");
    }, []);

    const diasVisibles = useMemo(() => {
        if (vista === "dia") return [ancla];
        const lun = lunesDe(ancla);
        return Array.from({ length: 7 }, (_, i) => addDias(lun, i));
    }, [vista, ancla]);

    const rango = useMemo(() => {
        if (vista === "dia") return `${DOW[diaSemana(ancla)]} ${numMes(ancla)} de ${nombreMes(ancla)}`;
        const lun = lunesDe(ancla);
        const dom = addDias(lun, 6);
        return `${numMes(lun)} ${nombreMes(lun)} – ${numMes(dom)} ${nombreMes(dom)}`;
    }, [vista, ancla]);

    const anchoDia = vista === "dia" ? "1fr" : "repeat(7, minmax(84px, 1fr))";

    return {
        vista,
        setVista,
        ancla,
        setAncla,
        diasVisibles,
        rango,
        anchoDia,
        irAnterior: () => setAncla((a) => addDias(a, vista === "dia" ? -1 : -7)),
        irSiguiente: () => setAncla((a) => addDias(a, vista === "dia" ? 1 : 7)),
        irHoy: () => setAncla(hoy),
    };
}
