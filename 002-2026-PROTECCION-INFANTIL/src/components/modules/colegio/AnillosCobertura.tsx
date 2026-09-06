"use client";

import Link from "next/link";
import { PanelVidrio } from "@/components/ui/PanelVidrio";

export interface CoberturaSujeto {
    total: number;
    conIdentificador: number;
    porcentaje: number;
}

export interface CoberturaPorSujeto {
    estudiantes: CoberturaSujeto;
    profesores: CoberturaSujeto;
    acudientes: CoberturaSujeto;
}

interface AnillosCoberturaProps {
    cobertura: CoberturaPorSujeto;
}

interface AnilloSujetoProps {
    titulo: string;
    subtitulo: string;
    porcentaje: number;
    total: number;
    ctaHref: string;
    ctaTexto: string;
    color: "pino" | "ambar" | "rubi";
}

const COLORES = {
    pino: "stroke-pino",
    ambar: "stroke-ambar",
    rubi: "stroke-rubi",
};

const COLORES_FONDO = {
    pino: "text-pino",
    ambar: "text-ambar",
    rubi: "text-rubi",
};

export function colorPorPorcentaje(porcentaje: number, total: number): "pino" | "ambar" {
    // SPEC-551: un gauge de cobertura NUNCA va en rojo (§7.9). Cobertura baja =
    // «falta registrar» = atención (ámbar), no criticidad. total 0 = aún nada = ámbar.
    if (total === 0) return "ambar";
    if (porcentaje >= 1) return "pino";
    return "ambar";
}

function AnilloSujeto({ titulo, subtitulo, porcentaje, total, ctaHref, ctaTexto, color }: AnilloSujetoProps) {
    const size = 112;
    const stroke = 10;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const fraccion = total === 0 ? 0 : Math.min(1, Math.max(0, porcentaje));
    const dashOffset = circumference * (1 - fraccion);
    const pct = Math.round(fraccion * 100);

    return (
        <div className="flex flex-col items-center text-center">
            <div className="relative">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${titulo}: ${pct}%`}>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        className="stroke-tinta/10"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        className={`${COLORES[color]} -rotate-90`}
                        style={{ transformOrigin: "center" }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`cifra text-2xl font-semibold ${COLORES_FONDO[color]}`}>{pct}%</span>
                </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-body">{titulo}</p>
            <p className="text-xs text-muted">{subtitulo}</p>
            {fraccion < 1 && (
                <Link
                    href={ctaHref}
                    className="mt-2 text-xs font-semibold text-accent hover:text-pino"
                >
                    {ctaTexto} →
                </Link>
            )}
        </div>
    );
}

export function AnillosCobertura({ cobertura }: AnillosCoberturaProps) {
    return (
        <PanelVidrio className="flex h-full flex-col p-6 sm:p-8">
            <h2 className="titular-seccion text-body">Cobertura de identificadores</h2>
            <p className="mt-1 text-sm text-muted">
                Porcentaje de sujetos activos con al menos un identificador activo registrado.
            </p>
            <div className="mt-6 grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3">
                <AnilloSujeto
                    titulo="Estudiantes"
                    subtitulo={`${cobertura.estudiantes.conIdentificador} de ${cobertura.estudiantes.total}`}
                    porcentaje={cobertura.estudiantes.porcentaje}
                    total={cobertura.estudiantes.total}
                    ctaHref="/dashboard/colegio/cursos/unificado"
                    ctaTexto="Completar estudiantes"
                    color={colorPorPorcentaje(cobertura.estudiantes.porcentaje, cobertura.estudiantes.total)}
                />
                <AnilloSujeto
                    titulo="Profesores"
                    subtitulo={`${cobertura.profesores.conIdentificador} de ${cobertura.profesores.total}`}
                    porcentaje={cobertura.profesores.porcentaje}
                    total={cobertura.profesores.total}
                    ctaHref="/dashboard/colegio/profesores"
                    ctaTexto="Agregar profesores"
                    color={colorPorPorcentaje(cobertura.profesores.porcentaje, cobertura.profesores.total)}
                />
                <AnilloSujeto
                    titulo="Acudientes"
                    subtitulo={`${cobertura.acudientes.conIdentificador} de ${cobertura.acudientes.total}`}
                    porcentaje={cobertura.acudientes.porcentaje}
                    total={cobertura.acudientes.total}
                    ctaHref="/dashboard/colegio/cursos"
                    ctaTexto="Ver cursos"
                    color={colorPorPorcentaje(cobertura.acudientes.porcentaje, cobertura.acudientes.total)}
                />
            </div>
        </PanelVidrio>
    );
}
