/**
 * SPEC-234 (002-PI-134): regla N1 de aceleración temporal.
 * Compara el intervalo promedio histórico contra el intervalo promedio reciente.
 */
import type { EventoExpediente } from "@prisma/client";

export interface ResultadoRegla {
    detectado: boolean;
    severidad: "BAJA" | "MEDIA" | "ALTA";
    descripcionTexto: string;
    datosContextoJson: Record<string, unknown>;
}

export function detectarAceleracion(eventos: EventoExpediente[], ratioMinimo: number): ResultadoRegla {
    if (eventos.length < 3) {
        return {
            detectado: false,
            severidad: "BAJA",
            descripcionTexto: "No hay suficientes eventos para evaluar aceleración temporal.",
            datosContextoJson: { tipoPatron: "ACELERACION", totalEventos: eventos.length },
        };
    }

    const ordenados = [...eventos].sort(
        (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
    );
    const intervalos: number[] = [];
    for (let i = 1; i < ordenados.length; i++) {
        intervalos.push(
            new Date(ordenados[i].fechaEvento).getTime() - new Date(ordenados[i - 1].fechaEvento).getTime()
        );
    }

    const mitad = Math.ceil(intervalos.length / 2);
    const historicos = intervalos.slice(0, mitad);
    const recientes = intervalos.slice(mitad);

    const promedioHistorico = historicos.reduce((a, b) => a + b, 0) / historicos.length;
    const promedioReciente = recientes.reduce((a, b) => a + b, 0) / recientes.length;

    const ratio = promedioReciente > 0 ? promedioHistorico / promedioReciente : 0;
    const detectado = ratio >= ratioMinimo;
    const severidad: "MEDIA" | "ALTA" = ratio >= ratioMinimo * 2 ? "ALTA" : "MEDIA";

    return {
        detectado,
        severidad: detectado ? severidad : "BAJA",
        descripcionTexto: detectado
            ? `Aceleración temporal detectada: los intervalos recientes son ${ratio.toFixed(2)} veces más cortos que los históricos.`
            : "No se detecta aceleración temporal significativa.",
        datosContextoJson: {
            tipoPatron: "ACELERACION",
            ratio,
            ratioMinimo,
            promedioHistoricoMs: promedioHistorico,
            promedioRecienteMs: promedioReciente,
            totalEventos: eventos.length,
        },
    };
}
