/**
 * SPEC-218 (002-PI-118): tests unitarios de los cálculos de la analítica
 * dinero-vs-valor. Sin BD; el ancla temporal se inyecta para evitar drift de
 * reloj y las aserciones de zona verifican America/Bogota (NFR-004 / SC-004).
 */
import { describe, it, expect } from "vitest";
import {
    ZONA_BOGOTA,
    etiquetaMesBogota,
    ultimasEtiquetasMesBogota,
    rangoMesUtc,
    diasCompletosEntre,
    diasDeMora,
    diasRestantes,
    variacionPct,
    clasificarAlertaCrecimiento,
    construirSeriesCrecimiento,
} from "./analitica-calculos";

describe("etiquetaMesBogota", () => {
    it("agrupa en el mes Bogotá, no en el mes UTC", () => {
        // 2026-08-01 04:30 UTC = 2026-07-31 23:30 en Bogotá (UTC-5).
        expect(etiquetaMesBogota(new Date("2026-08-01T04:30:00.000Z"))).toBe("2026-07");
        // 2026-08-01 05:30 UTC = 2026-08-01 00:30 en Bogotá.
        expect(etiquetaMesBogota(new Date("2026-08-01T05:30:00.000Z"))).toBe("2026-08");
    });

    it("usa la zona America/Bogota", () => {
        expect(ZONA_BOGOTA).toBe("America/Bogota");
    });
});

describe("ultimasEtiquetasMesBogota", () => {
    it("devuelve n etiquetas terminando en el mes del ancla", () => {
        expect(ultimasEtiquetasMesBogota(3, new Date("2026-08-24T15:00:00.000Z"))).toEqual([
            "2026-06",
            "2026-07",
            "2026-08",
        ]);
    });

    it("cruza el cambio de año", () => {
        expect(ultimasEtiquetasMesBogota(3, new Date("2027-01-10T12:00:00.000Z"))).toEqual([
            "2026-11",
            "2026-12",
            "2027-01",
        ]);
    });
});

describe("rangoMesUtc", () => {
    it("devuelve el rango semiabierto del mes Bogotá en UTC", () => {
        const { inicio, fin } = rangoMesUtc("2026-08");
        expect(inicio.toISOString()).toBe("2026-08-01T05:00:00.000Z");
        expect(fin.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    });

    it("cruza el cambio de año en diciembre", () => {
        const { fin } = rangoMesUtc("2026-12");
        expect(fin.toISOString()).toBe("2027-01-01T05:00:00.000Z");
    });

    it("rechaza etiquetas inválidas", () => {
        expect(() => rangoMesUtc("2026-13")).toThrow();
        expect(() => rangoMesUtc("no-es-mes")).toThrow();
    });
});

describe("días", () => {
    const ahora = new Date("2026-08-24T12:00:00.000Z");

    it("diasCompletosEntre redondea hacia abajo y soporta negativos", () => {
        expect(diasCompletosEntre(new Date("2026-08-20T13:00:00.000Z"), ahora)).toBe(3);
        expect(diasCompletosEntre(ahora, new Date("2026-08-20T13:00:00.000Z"))).toBe(-4);
    });

    it("diasDeMora nunca es negativo", () => {
        expect(diasDeMora(new Date("2026-07-20T12:00:00.000Z"), ahora)).toBe(35);
        expect(diasDeMora(new Date("2026-09-01T00:00:00.000Z"), ahora)).toBe(0);
    });

    it("diasRestantes nunca es negativo", () => {
        expect(diasRestantes(new Date("2026-08-30T12:00:00.000Z"), ahora)).toBe(6);
        expect(diasRestantes(new Date("2026-08-20T12:00:00.000Z"), ahora)).toBe(0);
    });
});

describe("variacionPct", () => {
    it("calcula la variación entera", () => {
        expect(variacionPct(1500, 1200)).toBe(25);
        expect(variacionPct(3, 5)).toBe(-40);
        expect(variacionPct(18, 12)).toBe(50);
    });

    it("devuelve null sin base de comparación y 0 cuando ambos son cero", () => {
        expect(variacionPct(10, 0)).toBeNull();
        expect(variacionPct(0, 0)).toBe(0);
    });
});

describe("clasificarAlertaCrecimiento", () => {
    it("marca alta/baja solo fuera del umbral de 25%", () => {
        expect(clasificarAlertaCrecimiento(26)).toBe("crecimiento_alto");
        expect(clasificarAlertaCrecimiento(-26)).toBe("crecimiento_bajo");
        expect(clasificarAlertaCrecimiento(25)).toBeNull();
        expect(clasificarAlertaCrecimiento(-25)).toBeNull();
        expect(clasificarAlertaCrecimiento(0)).toBeNull();
        expect(clasificarAlertaCrecimiento(null)).toBeNull();
    });

    it("respeta un umbral personalizado", () => {
        expect(clasificarAlertaCrecimiento(15, 10)).toBe("crecimiento_alto");
    });
});

describe("construirSeriesCrecimiento", () => {
    const etiquetas = ["2026-06", "2026-07", "2026-08"];

    it("agrupa altas por país y mes Bogotá y detecta anomalías >25%", () => {
        const altas = [
            // CO: 10 → 12 → 18 (+50% ⇒ crecimiento_alto)
            ...Array.from({ length: 10 }, () => ({ paisCliente: "CO", createdAt: new Date("2026-06-15T12:00:00.000Z") })),
            ...Array.from({ length: 12 }, () => ({ paisCliente: "CO", createdAt: new Date("2026-07-15T12:00:00.000Z") })),
            ...Array.from({ length: 18 }, () => ({ paisCliente: "CO", createdAt: new Date("2026-08-15T12:00:00.000Z") })),
            // CL: 5 → 4 → 3 (-40% con redondeo 3/4 = -25 exacto en el borde... se usa 4→3)
            ...Array.from({ length: 5 }, () => ({ paisCliente: "CL", createdAt: new Date("2026-06-15T12:00:00.000Z") })),
            ...Array.from({ length: 4 }, () => ({ paisCliente: "CL", createdAt: new Date("2026-07-15T12:00:00.000Z") })),
            ...Array.from({ length: 2 }, () => ({ paisCliente: "CL", createdAt: new Date("2026-08-15T12:00:00.000Z") })),
        ];
        const series = construirSeriesCrecimiento(altas, etiquetas);
        expect(series).toHaveLength(2);

        const co = series.find((s) => s.pais === "CO")!;
        expect(co.data).toEqual([10, 12, 18]);
        expect(co.variacionPct).toBe(50);
        expect(co.alerta).toBe("crecimiento_alto");

        const cl = series.find((s) => s.pais === "CL")!;
        expect(cl.data).toEqual([5, 4, 2]);
        expect(cl.variacionPct).toBe(-50);
        expect(cl.alerta).toBe("crecimiento_bajo");
    });

    it("respeta el borde Bogotá al agrupar (sin drift de timezone)", () => {
        // 2026-08-01 04:30 UTC sigue siendo julio en Bogotá.
        const altas = [{ paisCliente: "MX", createdAt: new Date("2026-08-01T04:30:00.000Z") }];
        const [serie] = construirSeriesCrecimiento(altas, etiquetas);
        expect(serie.data).toEqual([0, 1, 0]);
    });

    it("ordena por volumen del último mes y rellena huecos con cero", () => {
        const altas = [
            { paisCliente: "AR", createdAt: new Date("2026-06-10T12:00:00.000Z") },
            { paisCliente: "PE", createdAt: new Date("2026-08-10T12:00:00.000Z") },
            { paisCliente: "PE", createdAt: new Date("2026-08-11T12:00:00.000Z") },
        ];
        const series = construirSeriesCrecimiento(altas, etiquetas);
        expect(series[0].pais).toBe("PE");
        expect(series.find((s) => s.pais === "AR")!.data).toEqual([1, 0, 0]);
    });

    it("devuelve lista vacía sin altas", () => {
        expect(construirSeriesCrecimiento([], etiquetas)).toEqual([]);
    });
});
