/**
 * SPEC-234 (002-PI-134): regla N1 de progresión de gravedad.
 * Detecta si las categorías de los eventos evolucionan hacia mayor severidad.
 */
import type { EventoExpediente } from "@prisma/client";
import type { ResultadoRegla } from "./aceleracion";

export function detectarProgresion(
    eventos: EventoExpediente[],
    severidadPorCategoria: Record<string, number>
): ResultadoRegla {
    if (eventos.length < 2) {
        return {
            detectado: false,
            severidad: "BAJA",
            descripcionTexto: "No hay suficientes eventos para evaluar progresión de gravedad.",
            datosContextoJson: { tipoPatron: "PROGRESION", totalEventos: eventos.length },
        };
    }

    const ordenados = [...eventos].sort(
        (a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime()
    );

    const valores = ordenados.map((e) => severidadPorCategoria[e.categoriaDetectada ?? "OTRO"] ?? 0);

    let minimoPrevio = valores[0] ?? 0;
    let mayorIncremento = 0;
    let categoriaInicial = ordenados[0]?.categoriaDetectada ?? "OTRO";
    let categoriaFinal = categoriaInicial;

    for (let i = 1; i < valores.length; i++) {
        const incremento = valores[i] - minimoPrevio;
        if (incremento > mayorIncremento) {
            mayorIncremento = incremento;
            categoriaInicial = ordenados[0]?.categoriaDetectada ?? "OTRO";
            categoriaFinal = ordenados[i]?.categoriaDetectada ?? "OTRO";
        }
        if (valores[i] < minimoPrevio) {
            minimoPrevio = valores[i];
        }
    }

    const umbralIncremento = 20;
    const detectado = mayorIncremento >= umbralIncremento;

    return {
        detectado,
        severidad: detectado ? (mayorIncremento >= 50 ? "ALTA" : "MEDIA") : "BAJA",
        descripcionTexto: detectado
            ? `Progresión de gravedad detectada: de ${categoriaInicial} a ${categoriaFinal} (+${mayorIncremento.toFixed(0)} puntos de severidad).`
            : "No se detecta progresión de gravedad significativa.",
        datosContextoJson: {
            tipoPatron: "PROGRESION",
            mayorIncremento,
            categoriaInicial,
            categoriaFinal,
            totalEventos: eventos.length,
        },
    };
}
