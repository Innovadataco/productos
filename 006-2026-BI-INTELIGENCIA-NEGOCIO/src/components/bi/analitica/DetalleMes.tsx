"use client";

import { useEffect, useState } from "react";
import { fmtMiles } from "../pulso/formatos";
import { PuntosCarga } from "./ProyeccionSemana";

/**
 * Payload REAL de GET /api/bi/analitica/detalle-mes?mes=YYYY-MM (T1).
 * 404 → el mes no tiene reportes (se dice, no se dibuja nada).
 */
interface DetalleMesData {
    mes: string;
    total: number;
    categoriaTop: { categoria: string; total: number } | null;
    alertasDelMes: number;
    escaladasDelMes: number;
    fenomenos: string[];
    anonimos: number;
}

type Fase = "cargando" | "listo" | "vacio" | "error";

/** Nombres largos de mes para el titular (constante de presentación). */
const MESES_LARGOS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-03" → "marzo de 2026"; cualquier otro formato se respeta tal cual. */
function mesLegible(mes: string): string {
    const iso = /^(\d{4})-(\d{2})$/.exec(mes);
    if (iso) {
        const idx = Number(iso[2]) - 1;
        if (idx >= 0 && idx < 12) return `${MESES_LARGOS[idx]} de ${iso[1]}`;
    }
    return mes;
}

/* Réplica local de formatearCategoria (@/lib/bi/pulso): ese módulo importa
   Prisma (capa de datos server) y no puede entrar al bundle del cliente.
   Misma regla de presentación: enum crudo → legible, NULL → 'sin clasificar'. */
function categoriaLegible(categoria: string | null): string {
    if (!categoria) return "sin clasificar";
    const limpia = categoria.replace(/_/g, " ").toLowerCase();
    return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/**
 * Detalle de un mes de la cronología (mejora aprobada por el dueño: "tocar
 * un mes cuenta qué pasó"). Pide /api/bi/analitica/detalle-mes y cuenta el
 * mes con las cifras del payload (candado 10: aquí no se calcula nada).
 * Estados honestos (candado 9): cargando con puntos, 404 → "ese mes no
 * tiene reportes", error de red/servidor anunciado en texto.
 */
export default function DetalleMes({ mes }: { mes: string }) {
    const [fase, setFase] = useState<Fase>("cargando");
    const [datos, setDatos] = useState<DetalleMesData | null>(null);

    useEffect(() => {
        let vivo = true;
        setFase("cargando");
        setDatos(null);
        fetch(`/api/bi/analitica/detalle-mes?mes=${encodeURIComponent(mes)}`, {
            cache: "no-store",
        })
            .then(async (res) => {
                if (!vivo) return;
                if (res.status === 404) {
                    setFase("vacio");
                    return;
                }
                if (!res.ok) {
                    setFase("error");
                    return;
                }
                const json = (await res.json()) as DetalleMesData;
                setDatos(json);
                setFase("listo");
            })
            .catch(() => {
                if (vivo) setFase("error");
            });
        return () => {
            vivo = false;
        };
    }, [mes]);

    return (
        <div
            className="mt-4 rounded-xl border border-[rgb(var(--pino-rgb)/0.3)] bg-[rgb(var(--tinta-rgb)/0.04)] p-4"
            aria-live="polite"
        >
            {fase === "cargando" && <PuntosCarga texto={`Consultando ${mesLegible(mes)}`} />}
            {fase === "vacio" && (
                <p className="text-[13px] text-muted">
                    {mesLegible(mes)} no tiene reportes en la réplica.
                </p>
            )}
            {fase === "error" && (
                <p className="text-[13px] text-muted">
                    No se pudo consultar el detalle de {mesLegible(mes)} — intenta de nuevo
                    tocando el mes.
                </p>
            )}
            {fase === "listo" && datos && (
                <>
                    <h4 className="mb-1 text-[14px] font-semibold">
                        Qué pasó en {mesLegible(datos.mes)}
                    </h4>
                    <p className="cifra text-[13px] text-body">
                        {fmtMiles(datos.total)}{" "}
                        {datos.total === 1 ? "reporte" : "reportes"} · top:{" "}
                        {datos.categoriaTop
                            ? `${categoriaLegible(datos.categoriaTop.categoria)} (${fmtMiles(datos.categoriaTop.total)})`
                            : "sin clasificar"}{" "}
                        · {fmtMiles(datos.alertasDelMes)}{" "}
                        {datos.alertasDelMes === 1 ? "alerta" : "alertas"} (
                        {fmtMiles(datos.escaladasDelMes)}{" "}
                        {datos.escaladasDelMes === 1 ? "escalada" : "escaladas"}) ·{" "}
                        {fmtMiles(datos.anonimos)}{" "}
                        {datos.anonimos === 1 ? "anónimo" : "anónimos"}
                    </p>
                    {datos.fenomenos.length === 0 ? (
                        <p className="mt-2 text-[12.5px] text-muted">
                            Sin fenómenos detectados ese mes.
                        </p>
                    ) : (
                        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[12.5px] text-muted">
                            {datos.fenomenos.map((f, i) => (
                                <li key={`${i}-${f.slice(0, 24)}`}>{f}</li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
