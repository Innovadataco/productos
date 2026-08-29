"use client";
import { VegaEmbed } from "react-vega";

interface Props {
    spec: object;
    ancho?: number;
    alto?: number;
}

export function GraficoVegaLite({ spec, ancho = 500, alto = 240 }: Props) {
    const specConTamaño = { ...spec, width: ancho, height: alto };
    return (
        <div data-testid="grafico-vl">
            <VegaEmbed spec={specConTamaño as never} options={{ actions: false }} />
        </div>
    );
}
