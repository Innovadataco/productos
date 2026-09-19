"use client";

import { useState } from "react";
import Link from "next/link";
import { GraficoProteccion, type HijoGrafico } from "./GraficoProteccion";
import { LineaEstadoProteccion, type EstadoClasificador } from "./LineaEstadoProteccion";
import { BloqueHuecoCobertura } from "./BloqueHuecoCobertura";
import { DetalleHijoCuentas } from "./DetalleHijoCuentas";
import type { HijoConCuentasDto } from "@/lib/dal/services/hijos/reportes-ajenos";
import type { HijoConCuentasQueReporteDto } from "@/lib/dal/services/hijos/reportes-propios-por-hijo";

/**
 * SPEC-660 + SPEC-716 (Parte B) · «A quién protejo» — vista de ENTERARSE (Proceso 2).
 *
 * CERO formularios acá: el CRUD (registrar/editar menores) vive en Mi perfil › «Menores de edad».
 * El gráfico ORIENTA (SPEC-716 §5): tocar un hijo baja a sus DOS GRUPOS —«Sus cuentas» (reportes de
 * otros) y «Cuentas que reportaste por ella»—, que NO se funden. Todo el drill-down es estado de
 * cliente sobre datos ya cargados por el servidor: la cuenta NUNCA viaja en la URL.
 */
const RUTA_PERFIL_MENORES = "/dashboard/padre/perfil#menores";

export interface AQuienProtejoData {
    hijos: HijoGrafico[];
    estadoClasificador: EstadoClasificador;
    // SPEC-716 (Parte A · I-427): cuántas CUENTAS activas tienen un reporte visible. La línea de
    // estado deriva su texto de ESTE número (mismo hecho que el ámbar del gráfico), no de una constante.
    cuentasConReporte: number;
    // SPEC-716 (Parte B): los dos grupos por hijo, ya cargados por el servidor (sin la cuenta en la URL).
    grupoA: HijoConCuentasDto[];
    grupoB: HijoConCuentasQueReporteDto[];
    circulo: { personas: number; todasTranquilas: boolean };
}

function Titulo() {
    return (
        <h1 className="text-3xl font-bold text-body md:text-4xl">
            A quién <span className="text-estado-pino">protejo</span>
        </h1>
    );
}

export function AQuienProtejoView({ hijos, estadoClasificador, cuentasConReporte, grupoA, grupoB, circulo }: AQuienProtejoData) {
    const [hijoSeleccionado, setHijoSeleccionado] = useState<string | null>(null);

    if (hijos.length === 0) {
        return (
            <div className="mx-auto w-full max-w-xl space-y-4 p-4 text-center">
                <Titulo />
                <div className="rounded-2xl border border-tinta/10 bg-tinta/[0.02] p-8">
                    <p className="text-body">Todavía no registraste a ningún menor.</p>
                    <p className="mt-1 text-sm text-muted">Registra a tus hijos y sus cuentas para poder cuidarlos.</p>
                    <Link
                        href={RUTA_PERFIL_MENORES}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cielo px-4 py-2.5 text-sm font-semibold text-acento-ink transition hover:brightness-110"
                    >
                        Agregar un menor
                    </Link>
                </div>
            </div>
        );
    }

    const huecos = hijos.filter((h) => h.activo && !h.tieneCuentasActivas).map((h) => ({ id: h.id, nombre: h.nombre }));
    const hijoSel = hijos.find((h) => h.id === hijoSeleccionado) ?? null;
    const grupoADelHijo = hijoSel ? (grupoA.find((g) => g.hijoId === hijoSel.id)?.cuentas ?? []) : [];
    const grupoBDelHijo = hijoSel ? (grupoB.find((g) => g.hijoId === hijoSel.id)?.cuentas ?? []) : [];

    return (
        <div className="mx-auto w-full max-w-xl space-y-4 p-4">
            <Titulo />
            <GraficoProteccion
                hijos={hijos}
                motorVivo={estadoClasificador.motorVivo}
                circuloPersonas={circulo.personas}
                onSelectHijo={(id) => setHijoSeleccionado((prev) => (prev === id ? null : id))}
                hijoSeleccionado={hijoSeleccionado}
            />
            <LineaEstadoProteccion estado={estadoClasificador} cuentasConReporte={cuentasConReporte} />

            {/* SPEC-716 (Parte B): el detalle del hijo tocado — sus dos grupos. Aparece BAJO el gráfico;
                la cuenta vive en estado/props (server-cargada), nunca en la URL. */}
            {hijoSel ? (
                <DetalleHijoCuentas
                    key={hijoSel.id}
                    hijo={{ id: hijoSel.id, nombre: hijoSel.nombre }}
                    grupoA={grupoADelHijo}
                    grupoB={grupoBDelHijo}
                />
            ) : (
                <p className="text-center text-sm text-subtle">Toca un hijo para ver sus cuentas y los reportes.</p>
            )}

            {circulo.personas > 0 && (
                <p className="flex items-center gap-2 rounded-xl bg-tinta/[0.035] px-3 py-2 text-sm text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-pino" aria-hidden />
                    <span>
                        Tu círculo: <b className="text-body">{circulo.personas} {circulo.personas === 1 ? "persona cercana" : "personas cercanas"}</b>
                        {circulo.todasTranquilas ? " · todas tranquilas" : ""}
                    </span>
                </p>
            )}
            <BloqueHuecoCobertura hijos={huecos} />
            <Link href={RUTA_PERFIL_MENORES} className="inline-flex items-center gap-1.5 text-sm font-semibold text-estado-cielo hover:underline">
                Gestionar en tu perfil →
            </Link>
        </div>
    );
}
