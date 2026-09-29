/**
 * SPEC-753 · CANDADO de contenido de las preguntas de servicio (LEGAL v0.1).
 *
 * Pinea que el texto y las opciones son EXACTAMENTE los de REPORTE-069 y que
 * siguen siendo de SERVICIO y CERRADAS: 5 preguntas idénticas ambos lados, las 4
 * razones neutras, y NINGUNA vía de texto libre. La PARIDAD keys↔enums de Prisma
 * la verifica el candado del service (con el esquema en main). Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    PREGUNTAS_SERVICIO,
    RAZONES_NO_REALIZO,
    opcionesValidas,
    etiquetaOpcion,
    type ClavePregunta,
} from "@/lib/profesional/cita/encuestas-preguntas";

describe("SPEC-753 · preguntas de servicio (LEGAL v0.1)", () => {
    it("son las 5 preguntas, en orden, con el enunciado EXACTO de LEGAL v0.1", () => {
        expect(PREGUNTAS_SERVICIO.map((p) => p.pregunta)).toEqual([
            "SE_REALIZO",
            "OPERADOR",
            "INICIO",
            "ENLACE",
            "DURACION",
        ]);
        const enunciado = (p: ClavePregunta) => PREGUNTAS_SERVICIO.find((x) => x.pregunta === p)!.enunciado;
        expect(enunciado("SE_REALIZO")).toBe("¿Se realizó la sesión?");
        expect(enunciado("OPERADOR")).toBe("¿El operador abrió la reunión, la presentó y se retiró?");
        expect(enunciado("INICIO")).toBe("¿La sesión comenzó a la hora acordada?");
        expect(enunciado("ENLACE")).toBe("¿El enlace / la videollamada funcionó?");
        expect(enunciado("DURACION")).toBe("¿Cuánto duró aproximadamente?");
    });

    it("cada opción tiene key y label; el conjunto de keys por pregunta es el cerrado esperado", () => {
        for (const p of PREGUNTAS_SERVICIO) {
            expect(p.opciones.length).toBeGreaterThan(0);
            for (const o of p.opciones) {
                expect(o.key, `key vacía en ${p.pregunta}`).toBeTruthy();
                expect(o.label, `label vacío en ${p.pregunta}/${o.key}`).toBeTruthy();
            }
        }
        expect(opcionesValidas("SE_REALIZO")).toEqual(["SI", "NO"]);
        expect(opcionesValidas("OPERADOR")).toEqual(["SI", "NO", "NO_HUBO_OPERADOR"]);
        expect(opcionesValidas("INICIO")).toEqual(["A_TIEMPO", "CON_RETRASO", "NO_COMENZO"]);
        expect(opcionesValidas("ENLACE")).toEqual(["SI", "CON_PROBLEMAS", "NO_FUNCIONO"]);
        expect(opcionesValidas("DURACION")).toEqual(["MENOS_15", "ENTRE_15_30", "ENTRE_30_45", "MAS_45"]);
    });

    it("las razones del «No» son las 4 neutras de evento, «Otra» incluida (sin texto libre)", () => {
        expect(RAZONES_NO_REALIZO.map((o) => o.key)).toEqual([
            "NO_ME_CONECTE",
            "OTRA_PARTE_NO_CONECTO",
            "PROBLEMA_TECNICO",
            "OTRA",
        ]);
        // «Otra» es una opción cerrada más — no hay campo/flag que abra texto.
        const otra = RAZONES_NO_REALIZO.find((o) => o.key === "OTRA")!;
        expect(otra.label).toBe("Otra");
    });

    it("etiquetaOpcion resuelve el label del valor cerrado y NUNCA inventa texto (devuelve la key si no hay)", () => {
        expect(etiquetaOpcion("INICIO", "CON_RETRASO")).toBe("Con retraso");
        expect(etiquetaOpcion("DURACION", "MAS_45")).toBe("Más de 45 min");
        // valor desconocido → devuelve la key tal cual, no fabrica una frase.
        expect(etiquetaOpcion("ENLACE", "VALOR_INEXISTENTE")).toBe("VALOR_INEXISTENTE");
    });
});
