/**
 * S-D · Candados de `reset-piloto --purga-total` + `parseArgs` estricto (CEO 06-09).
 *
 * (1) `parseArgs` ABORTA ante un flag desconocido — un script destructivo no traga banderas que
 *     no entiende (la trampa real: correr el reset NORMAL creyendo que fue total).
 * (2) `--purga-total` selecciona TODOS los reportes (ignora los «preservados», D-113); el reset
 *     normal los sigue excluyendo.
 * (3) La garantía post-purga: si algo queda en las 4 tablas cifradas, ABORTA ruidoso.
 *
 * Test de INTEGRACIÓN (usa la BD): vive en src/ para correr en la suite con BD; importa las
 * funciones puras de reset-piloto por ruta relativa. Corre post-migración (ventana/CI).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";
import { parseArgs, PRESERVADOS } from "../../scripts/limpieza/_common";
import { seleccionarReportesABorrar, afirmarPurgaTotalCompleta } from "../../scripts/limpieza/reset-piloto";

const FLAGS_RESET = ["motivo", "backup", "confirm", "solo-sembrado", "purga-total"];
const argv = (...flags: string[]) => ["node", "reset-piloto.ts", ...flags];

async function crearReporteVivo(identificador: string, numeroSeguimiento: string | null) {
    // Plataforma es tabla de SEED (no se trunca en resetDatabase): reusamos una ya sembrada en
    // vez de crear una con clave fija (que choca al re-correr). Reporte/Contenido SÍ se truncan.
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    return prisma.$transaction((tx) =>
        crearReporteConTexto(tx, {
            texto: "relato de un caso",
            reporte: {
                identificador,
                plataformaId: plataforma.id,
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                ...(numeroSeguimiento ? { numeroSeguimiento } : {}),
            },
        })
    );
}

describe("S-D · reset-piloto --purga-total + parseArgs estricto", () => {
    beforeEach(async () => {
        await resetDatabase();
        process.env.REPORTE_TEXTO_KEY_V1 = randomBytes(32).toString("base64");
        process.env.REPORTE_TEXTO_KEY_ACTIVA = "1";
    });

    it("parseArgs ABORTA ante un flag desconocido — no traga banderas (typo o inventado)", () => {
        expect(() => parseArgs(argv("--purga-tota"), FLAGS_RESET)).toThrow(/no reconocido/i);
        expect(() => parseArgs(argv("--flag-inventado=x"), FLAGS_RESET)).toThrow(/--flag-inventado/i);
    });

    it("parseArgs acepta exactamente los flags declarados", () => {
        const args = parseArgs(argv("--confirm", "--motivo=x", "--purga-total"), FLAGS_RESET);
        expect(args.confirm).toBe(true);
        expect(args.motivo).toBe("x");
        expect(args["purga-total"]).toBe(true);
    });

    it("--purga-total selecciona TODOS los reportes; el normal EXCLUYE los preservados (D-113)", async () => {
        const preservado = PRESERVADOS.reportesExcluidos[0]; // RPT-1RR278
        await crearReporteVivo("PRESERVADO-1", preservado);

        const normal = await seleccionarReportesABorrar(false);
        const total = await seleccionarReportesABorrar(true);

        expect(normal.some((r) => r.numeroSeguimiento === preservado)).toBe(false);
        expect(total.some((r) => r.numeroSeguimiento === preservado)).toBe(true);
    });

    it("afirmarPurgaTotalCompleta ABORTA si queda contenido cifrado; pasa con las tablas en 0", async () => {
        await crearReporteVivo("QUEDA-1", null);
        await expect(afirmarPurgaTotalCompleta()).rejects.toThrow(/NO dejó las tablas en 0/i);

        await resetDatabase(); // vacía las 4 tablas
        await expect(afirmarPurgaTotalCompleta()).resolves.toBeUndefined();
    });
});
