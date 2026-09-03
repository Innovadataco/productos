// tests/unit/bi-vigilancia.test.ts · Contrato de src/lib/bi/vigilancia.ts
// Producto 006 · BI v2 · Marco de vigilancia (Lote 1)
// Unitarios puros: prisma.$queryRaw y getConfig mockeados — sin BD, sin red.
// El "ahora" se congela con fake timers para que las ventanas sean deterministas.
// Orden fijo de $queryRaw en getVigilancia():
//   embudo → pasos → atascados → ultima clasificación → cola → comercial → antifraude

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, getConfigMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    getConfigMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/config", () => ({ getConfig: getConfigMock }));

import { getInsightsVigilancia, getVigilancia } from "@/lib/bi/vigilancia";

// "Ahora" fijo: 2026-09-01 12:00 UTC.
const AHORA = new Date("2026-09-01T12:00:00Z");
const horasAtras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);

interface FilaComercial {
    vencen_7d: number;
    vencen_15d: number;
    vencen_30d: number;
    freemium_activo: number;
    premium_activo: number;
}

const COMERCIAL_CERO: FilaComercial = {
    vencen_7d: 0,
    vencen_15d: 0,
    vencen_30d: 0,
    freemium_activo: 0,
    premium_activo: 0,
};

/** getConfig devuelve null (defaults) salvo los overrides dados. */
function configCon(overrides: Record<string, string> = {}) {
    getConfigMock.mockImplementation(async (clave: string) => overrides[clave] ?? null);
}

/** Encola las 7 respuestas de $queryRaw en el orden fijo del módulo. */
function bdCon({
    embudo = [] as unknown[],
    pasos = [] as unknown[],
    atascados = 0,
    ultima = null as Date | null,
    cola = 0,
    comercial = COMERCIAL_CERO,
    antifraude = { rafagas: 0, spam: 0, fuente_filas: 0 },
} = {}) {
    queryRawMock.mockReset();
    queryRawMock
        .mockResolvedValueOnce(embudo)
        .mockResolvedValueOnce(pasos)
        .mockResolvedValueOnce([{ total: atascados }])
        .mockResolvedValueOnce([{ ultima }])
        .mockResolvedValueOnce([{ total: cola }])
        .mockResolvedValueOnce([comercial])
        .mockResolvedValueOnce([antifraude]);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.clearAllMocks();
    configCon();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getVigilancia · cicloVida (embudo + horas medias + atascados)", () => {
    it("embudo completo: estados canónicos con su total, 0 real si no tienen filas", async () => {
        bdCon({
            embudo: [
                { etapa: "CLASIFICADO", total: 3000 },
                { etapa: "REVISION_MANUAL", total: 12 },
            ],
        });
        const { cicloVida } = await getVigilancia();
        expect(cicloVida.etapas).toHaveLength(8);
        expect(cicloVida.etapas.map((e) => e.etapa)).toEqual([
            "PENDIENTE",
            "PROCESANDO",
            "REVISION_MANUAL",
            "REQUIERE_ANONIMIZACION",
            "CLASIFICADO",
            "CORREGIDO",
            "DUPLICADO",
            "POSIBLE_SPAM",
        ]);
        const porEtapa = new Map(cicloVida.etapas.map((e) => [e.etapa, e]));
        expect(porEtapa.get("CLASIFICADO")?.total).toBe(3000);
        expect(porEtapa.get("REVISION_MANUAL")?.total).toBe(12);
        expect(porEtapa.get("PENDIENTE")?.total).toBe(0); // cero real, no NULL
    });

    it("horas medias por transición: merge por estado de llegada, redondeo a 1 decimal", async () => {
        bdCon({
            embudo: [{ etapa: "CLASIFICADO", total: 10 }],
            pasos: [
                { etapa: "CLASIFICADO", horas_medias: 3.456 },
                { etapa: "REVISION_MANUAL", horas_medias: 27.04 },
            ],
        });
        const { cicloVida } = await getVigilancia();
        const porEtapa = new Map(cicloVida.etapas.map((e) => [e.etapa, e]));
        expect(porEtapa.get("CLASIFICADO")?.horasMedias).toBe(3.5);
        expect(porEtapa.get("REVISION_MANUAL")?.horasMedias).toBe(27);
    });

    it("estado sin transiciones → horasMedias null (candado 9, no se inventa)", async () => {
        bdCon({ embudo: [{ etapa: "PENDIENTE", total: 4 }] });
        const { cicloVida } = await getVigilancia();
        const pendiente = cicloVida.etapas.find((e) => e.etapa === "PENDIENTE");
        expect(pendiente?.horasMedias).toBeNull();
    });

    it("estado no listado en el orden canónico se anexa al final (enum futuro)", async () => {
        bdCon({ embudo: [{ etapa: "ESTADO_FUTURO", total: 7 }] });
        const { cicloVida } = await getVigilancia();
        expect(cicloVida.etapas).toHaveLength(9);
        expect(cicloVida.etapas[8]).toEqual({
            etapa: "ESTADO_FUTURO",
            total: 7,
            horasMedias: null,
        });
    });

    it("atascados pasa directo del ResultSet", async () => {
        bdCon({ atascados: 9 });
        const { cicloVida } = await getVigilancia();
        expect(cicloVida.atascados).toBe(9);
    });
});

describe("getVigilancia · motorCaido (síntoma, no certeza)", () => {
    it("dispara: última clasificación más vieja que 6 h (default) Y cola > 0", async () => {
        bdCon({ ultima: horasAtras(10), cola: 5 });
        const { motorCaido } = await getVigilancia();
        expect(motorCaido.sospecha).toBe(true);
        expect(motorCaido.colaSinClasificar).toBe(5);
        expect(motorCaido.ultimaClasificacionEn).toBe(horasAtras(10).toISOString());
    });

    it("NO dispara: clasificación reciente aunque haya cola", async () => {
        bdCon({ ultima: horasAtras(1), cola: 3 });
        const { motorCaido } = await getVigilancia();
        expect(motorCaido.sospecha).toBe(false);
    });

    it("NO dispara: clasificación vieja pero cola vacía (sin reportes que clasificar)", async () => {
        bdCon({ ultima: horasAtras(72), cola: 0 });
        const { motorCaido } = await getVigilancia();
        expect(motorCaido.sospecha).toBe(false);
    });

    it("sin clasificaciones jamás → ultimaClasificacionEn null; con cola > 0 dispara", async () => {
        bdCon({ ultima: null, cola: 2 });
        const { motorCaido } = await getVigilancia();
        expect(motorCaido.ultimaClasificacionEn).toBeNull();
        expect(motorCaido.sospecha).toBe(true);
    });

    it("el umbral configurado en bi_config pisa el default (B3)", async () => {
        // Con 6 h default: 3 h es reciente → no dispara.
        bdCon({ ultima: horasAtras(3), cola: 4 });
        const conDefault = await getVigilancia();
        expect(conDefault.motorCaido.sospecha).toBe(false);

        // Con 2 h configuradas: 3 h ya es viejo → dispara.
        configCon({ "bi.vigilancia.motor_caido_horas": "2" });
        bdCon({ ultima: horasAtras(3), cola: 4 });
        const configurado = await getVigilancia();
        expect(configurado.motorCaido.sospecha).toBe(true);
    });
});

describe("getVigilancia · comercial y antifraude", () => {
    it("ventanas de vencimiento y activos pasan directo del ResultSet", async () => {
        bdCon({
            comercial: {
                vencen_7d: 2,
                vencen_15d: 3,
                vencen_30d: 6,
                freemium_activo: 40,
                premium_activo: 11,
            },
        });
        const { comercial } = await getVigilancia();
        expect(comercial).toEqual({
            vencen7d: 2,
            vencen15d: 3,
            vencen30d: 6,
            freemiumActivo: 40,
            premiumActivo: 11,
        });
    });

    it("FuenteReporte vacía (demo) → fuenteReporteConDatos false (honesto)", async () => {
        bdCon({ antifraude: { rafagas: 0, spam: 0, fuente_filas: 0 } });
        const { antifraude } = await getVigilancia();
        expect(antifraude.fuenteReporteConDatos).toBe(false);
        expect(antifraude.rafagas48h).toBe(0);
        expect(antifraude.spamSemana).toBe(0);
    });

    it("FuenteReporte con filas → fuenteReporteConDatos true", async () => {
        bdCon({ antifraude: { rafagas: 4, spam: 7, fuente_filas: 120 } });
        const { antifraude } = await getVigilancia();
        expect(antifraude).toEqual({
            rafagas48h: 4,
            spamSemana: 7,
            fuenteReporteConDatos: true,
        });
    });

    it("réplica vacía: todo en cero/null sin inventar cifras", async () => {
        bdCon();
        const data = await getVigilancia();
        expect(data.cicloVida.atascados).toBe(0);
        expect(data.cicloVida.etapas.every((e) => e.total === 0)).toBe(true);
        expect(data.cicloVida.etapas.every((e) => e.horasMedias === null)).toBe(true);
        expect(data.motorCaido).toEqual({
            sospecha: false,
            ultimaClasificacionEn: null,
            colaSinClasificar: 0,
        });
        expect(data.comercial).toEqual({
            vencen7d: 0,
            vencen15d: 0,
            vencen30d: 0,
            freemiumActivo: 0,
            premiumActivo: 0,
        });
        expect(data.antifraude).toEqual({
            rafagas48h: 0,
            spamSemana: 0,
            fuenteReporteConDatos: false,
        });
    });
});

describe("getInsightsVigilancia · reglas deterministas", () => {
    it("motor caído → insight ambar que declara ser síntoma, no certeza", async () => {
        bdCon({ ultima: horasAtras(30), cola: 8 });
        const insights = await getInsightsVigilancia();
        expect(insights).toHaveLength(1);
        expect(insights[0].severidad).toBe("ambar");
        expect(insights[0].titulo).toContain("motor de clasificación");
        expect(insights[0].detalle).toContain("8 reportes");
        expect(insights[0].detalle).toContain("síntoma");
    });

    it("atascados por encima del umbral → ambar; en el umbral exacto NO dispara", async () => {
        bdCon({ atascados: 6 }); // default 5 → 6 > 5 dispara
        const disparados = await getInsightsVigilancia();
        expect(disparados.some((i) => i.titulo.includes("atascados"))).toBe(true);
        expect(disparados[0].severidad).toBe("ambar");
        expect(disparados[0].titulo).toContain("6 reportes atascados");

        bdCon({ atascados: 5 }); // 5 > 5 es falso → no dispara
        const enUmbral = await getInsightsVigilancia();
        expect(enUmbral).toEqual([]);
    });

    it("umbral de atascados configurable desde bi_config (B3)", async () => {
        configCon({ "bi.vigilancia.atascados_alerta": "10" });
        bdCon({ atascados: 8 }); // 8 > 10 falso → no dispara
        const insights = await getInsightsVigilancia();
        expect(insights).toEqual([]);
    });

    it("ráfagas → ambar con la ventana configurada en el título", async () => {
        bdCon({ antifraude: { rafagas: 3, spam: 0, fuente_filas: 0 } });
        const insights = await getInsightsVigilancia();
        expect(insights).toHaveLength(1);
        expect(insights[0].severidad).toBe("ambar"); // contrato Insight no tiene rubí
        expect(insights[0].titulo).toBe("3 ráfagas en las últimas 48 h");
    });

    it("vencimientos en 15 días → cielo con acción de llamar (7d + 15d)", async () => {
        bdCon({ comercial: { ...COMERCIAL_CERO, vencen_7d: 2, vencen_15d: 1 } });
        const insights = await getInsightsVigilancia();
        expect(insights).toHaveLength(1);
        expect(insights[0].severidad).toBe("cielo");
        expect(insights[0].titulo).toBe("3 suscripciones vencen en 15 días");
        expect(insights[0].detalle).toContain("Llamar");
        expect(insights[0].accion?.etiqueta).toContain("Llamar");
    });

    it("solo vencen30d NO dispara el insight (la ventana accionable es 15 días)", async () => {
        bdCon({ comercial: { ...COMERCIAL_CERO, vencen_30d: 9 } });
        const insights = await getInsightsVigilancia();
        expect(insights).toEqual([]);
    });

    it("todo en calma → [] (candado 9: no se fabrican insights)", async () => {
        bdCon({ ultima: horasAtras(1), cola: 2 });
        const insights = await getInsightsVigilancia();
        expect(insights).toEqual([]);
    });

    it("varios disparos: ambar primero que cielo, orden fijo dentro de ambar", async () => {
        bdCon({
            ultima: horasAtras(30),
            cola: 8,
            atascados: 7,
            antifraude: { rafagas: 2, spam: 0, fuente_filas: 0 },
            comercial: { ...COMERCIAL_CERO, vencen_7d: 1 },
        });
        const insights = await getInsightsVigilancia();
        expect(insights).toHaveLength(4);
        expect(insights.map((i) => i.severidad)).toEqual([
            "ambar",
            "ambar",
            "ambar",
            "cielo",
        ]);
        expect(insights[0].titulo).toContain("motor");
        expect(insights[1].titulo).toContain("atascados");
        expect(insights[2].titulo).toContain("ráfaga");
        expect(insights[3].titulo).toContain("vence");
    });

    it("réplica caída (query rechaza) → [] sin afirmar nada", async () => {
        queryRawMock.mockReset();
        queryRawMock.mockRejectedValue(new Error("connection refused"));
        const insights = await getInsightsVigilancia();
        expect(insights).toEqual([]);
    });
});
