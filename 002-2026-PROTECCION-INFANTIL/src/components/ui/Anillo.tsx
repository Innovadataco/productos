import type { CSSProperties } from "react";

/**
 * SPEC-157 (§4.3) — La forma firma: los anillos de protección.
 * Dos anillos concéntricos (trazo 17, extremos redondeados) que se dibujan al entrar:
 * exterior = vigilancia (% estudiantes con identificadores, cielo),
 * interior = reacción (% con acudiente a quien llamar, pino).
 * Ningún arco es decorativo: cada uno codifica un número real (§4.0.2).
 * Reduced-motion: la media query global apaga la animación y el dashoffset base ya
 * es el valor final — el dato se ve completo sin animación.
 */

export type EstadoSistema = "pino" | "ambar" | "rubi";

interface AnilloProps {
    /** Fracción 0..1 de estudiantes con identificadores registrados. */
    vigilancia: number;
    /** Fracción 0..1 de estudiantes con acudiente a quien llamar. */
    reaccion: number;
    estudiantes: number;
    sinRedes: number;
    sinContacto: number;
    /** 240 por defecto; 88 = escala mini de curso (sin leyenda ni centro). */
    size?: number;
    estado?: EstadoSistema;
    className?: string;
}

const TRAZO = 17;
const HUECO = 6;
const MINI = 96;

const FILL_ESTADO: Record<EstadoSistema, string> = {
    pino: "fill-pino",
    ambar: "fill-ambar",
    rubi: "fill-rubi",
};

function fraccionSegura(valor: number): number {
    return Math.min(1, Math.max(0, valor));
}

interface ArcoProps {
    centro: number;
    radio: number;
    fraccion: number;
    claseTrazo: string;
    nombre: string;
    retardo: number;
}

function Arco({ centro, radio, fraccion, claseTrazo, nombre, retardo }: ArcoProps) {
    const circunferencia = 2 * Math.PI * radio;
    const dashFinal = circunferencia * (1 - fraccionSegura(fraccion));
    const estilo = {
        "--dash-inicial": circunferencia,
        "--dash-final": dashFinal,
        "--anim-retardo": `${retardo}ms`,
    } as CSSProperties;
    return (
        <>
            <circle
                cx={centro}
                cy={centro}
                r={radio}
                fill="none"
                strokeWidth={TRAZO}
                className={`${claseTrazo} opacity-20`}
                transform={`rotate(-90 ${centro} ${centro})`}
            />
            <circle
                cx={centro}
                cy={centro}
                r={radio}
                fill="none"
                strokeWidth={TRAZO}
                strokeLinecap="round"
                strokeDasharray={circunferencia}
                strokeDashoffset={dashFinal}
                className={`${claseTrazo} anim-dibujo`}
                style={estilo}
                transform={`rotate(-90 ${centro} ${centro})`}
                data-arco={nombre}
            />
        </>
    );
}

function leyendaHueco(cantidad: number, texto: string): string {
    return `${cantidad} ${cantidad === 1 ? "estudiante" : "estudiantes"} ${texto}`;
}

export function Anillo({
    vigilancia,
    reaccion,
    estudiantes,
    sinRedes,
    sinContacto,
    size = 240,
    estado = "pino",
    className = "",
}: AnilloProps) {
    const centro = size / 2;
    const radioExterior = (size - TRAZO) / 2;
    const radioInterior = radioExterior - TRAZO - HUECO;
    const mini = size <= MINI;

    const pctVigilancia = Math.round(fraccionSegura(vigilancia) * 100);
    const pctReaccion = Math.round(fraccionSegura(reaccion) * 100);
    const ariaLabel =
        `Anillos de protección: vigilancia ${pctVigilancia}%, reacción ${pctReaccion}%. ` +
        `${leyendaHueco(sinRedes, "sin redes registradas")} y ${leyendaHueco(sinContacto, "sin acudiente a quien llamar")}.`;

    return (
        <figure className={`flex flex-col items-center gap-3 ${className}`} style={{ margin: 0 }}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-label={ariaLabel}
            >
                <Arco
                    centro={centro}
                    radio={radioExterior}
                    fraccion={vigilancia}
                    claseTrazo="stroke-cielo"
                    nombre="vigilancia"
                    retardo={0}
                />
                <Arco
                    centro={centro}
                    radio={radioInterior}
                    fraccion={reaccion}
                    claseTrazo="stroke-pino"
                    nombre="reaccion"
                    retardo={80}
                />
                {!mini && (
                    <>
                        <path
                            data-centro="escudo"
                            className={FILL_ESTADO[estado]}
                            d={`M ${centro} ${centro - 26} l 13 5.2 v 8.3 c 0 8.8 -5.5 14.3 -13 17.5 c -7.5 -3.2 -13 -8.7 -13 -17.5 v -8.3 Z`}
                        />
                        <text
                            x={centro}
                            y={centro + 24}
                            textAnchor="middle"
                            className="cifra fill-tinta"
                            fontSize={26}
                            fontWeight={600}
                        >
                            {estudiantes}
                        </text>
                    </>
                )}
            </svg>
            {!mini && (
                <figcaption className="flex flex-col items-center gap-1 text-center">
                    <span className="text-muted text-sm">
                        {leyendaHueco(sinRedes, "sin redes registradas")}
                    </span>
                    <span className="text-muted text-sm">
                        {leyendaHueco(sinContacto, "sin acudiente a quien llamar")}
                    </span>
                </figcaption>
            )}
        </figure>
    );
}
