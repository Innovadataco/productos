/**
 * SPEC-716 (Parte B) · CANDADO — «Cuentas que reportaste por ella»: los reportes PROPIOS del padre,
 * por hijo, SIN el texto del relato en esta ruta.
 *
 * (a) ESTRUCTURAL: cada CuentaQueReporteDto tiene EXACTAMENTE { reporteId, valor, plataforma,
 *     creadoEn, enRevision, categoriaLabel } — falla si aparece cualquier clave de más (p.ej. texto).
 * (b) NO-FUGA con el dato REAL: el reporte del padre lleva un texto conocido sembrado; el texto NO
 *     aparece en la salida. Control positivo: el reporte SÍ está (reporteId presente), así que si
 *     alguien proyectara el relato, el stringify lo mostraría y el candado se pondría rojo.
 * (c) PROPIOS, no ajenos: el reporte de OTRO usuario sobre el mismo hijo queda FUERA (ese es el
 *     grupo «Sus cuentas», población distinta que NO se funde con ésta).
 * (d) Agrupa por hijoId y respeta la MISMA visibilidad que `tieneReportes` (PENDIENTE fuera).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { listarCuentasQueReporte, type CuentaQueReporteDto } from "./reportes-propios-por-hijo";

const CLAVES_DTO = ["reporteId", "valor", "plataforma", "creadoEn", "enRevision", "categoriaLabel"] as const;
const TEXTO_SECRETO = "RELATO-PROPIO-716B-no-debe-filtrarse-jamas";

let plataformaId: string;

async function sembrarReportePropio(opts: {
    identificador: string;
    usuarioId: string | null;
    hijoId: string | null;
    estado: string;
    texto: string;
    conClasificacion?: boolean;
    sufijo: string;
}) {
    const r = await crearReporteFixture(prisma, {
        data: {
            identificador: opts.identificador,
            plataformaId,
            usuarioId: opts.usuarioId,
            hijoId: opts.hijoId,
            esAnonimo: opts.usuarioId === null,
            estado: opts.estado as never,
            texto: opts.texto,
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            numeroSeguimiento: `RPT-716B-${opts.sufijo}`,
        },
    });
    if (opts.conClasificacion) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: r.id,
                categoria: "OFRECIMIENTO_REGALOS" as never,
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 100,
            },
        });
    }
    return r;
}

describe("SPEC-716 (Parte B) · listarCuentasQueReporte", () => {
    beforeEach(async () => {
        await resetDatabase();
        plataformaId = (await crearPlataforma()).id;
    });

    it("blindaje + no-fuga + PROPIOS + visibilidad, agrupado por hijo", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const hijo = await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: "Zaira" } });

        // Propio, clasificado (aparece, con categoría).
        const rClasif = await sembrarReportePropio({ identificador: "acosador.uno", usuarioId: padre.id, hijoId: hijo.id, estado: "CLASIFICADO", texto: TEXTO_SECRETO, conClasificacion: true, sufijo: "clasif" });
        // Propio, en revisión (aparece, enRevision=true, sin categoría).
        const rRevision = await sembrarReportePropio({ identificador: "acosador.dos", usuarioId: padre.id, hijoId: hijo.id, estado: "REVISION_MANUAL", texto: "otro relato propio", sufijo: "rev" });
        // Propio pero PENDIENTE (no visible → fuera).
        await sembrarReportePropio({ identificador: "acosador.tres", usuarioId: padre.id, hijoId: hijo.id, estado: "PENDIENTE", texto: "pendiente", sufijo: "pend" });
        // De OTRO usuario, mismo hijo (grupo A, no éste → fuera).
        await sembrarReportePropio({ identificador: "acosador.cuatro", usuarioId: otro.id, hijoId: hijo.id, estado: "CLASIFICADO", texto: "relato ajeno", conClasificacion: true, sufijo: "ajeno" });

        const out = await listarCuentasQueReporte(padre.id);

        // Agrupa por hijo: 1 hijo con 2 cuentas propias visibles.
        expect(out).toHaveLength(1);
        expect(out[0]!.hijoId).toBe(hijo.id);
        const cuentas = out[0]!.cuentas;
        const ids = cuentas.map((c) => c.reporteId);
        expect(ids).toContain(rClasif.id); // control positivo: el reporte real está
        expect(ids).toContain(rRevision.id);
        expect(cuentas).toHaveLength(2); // PENDIENTE y el ajeno quedan fuera

        // (a) ESTRUCTURAL: exactamente las 6 claves.
        for (const c of cuentas) expect(Object.keys(c).sort()).toEqual([...CLAVES_DTO].sort());
        // enRevision/categoría bien derivados.
        const dtoClasif = cuentas.find((c) => c.reporteId === rClasif.id)!;
        expect(dtoClasif.enRevision).toBe(false);
        expect(dtoClasif.categoriaLabel).toBeTruthy();
        const dtoRev = cuentas.find((c) => c.reporteId === rRevision.id)!;
        expect(dtoRev.enRevision).toBe(true);
        expect(dtoRev.categoriaLabel).toBeNull();

        // (b) NO-FUGA: ningún texto de relato aparece en la salida.
        const serializado = JSON.stringify(out);
        expect(serializado).not.toContain(TEXTO_SECRETO);
        expect(serializado).not.toContain("otro relato propio");
        // (c) el reporte ajeno no está (población distinta).
        expect(serializado).not.toContain("acosador.cuatro");
        expect(serializado).not.toContain("relato ajeno");
    });

    it("sin reportes propios → arreglo vacío", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.hijo.create({ data: { usuarioId: padre.id, nombre: "Zaira" } });
        expect(await listarCuentasQueReporte(padre.id)).toEqual([]);
    });
});

// Nota de tipos: fija la forma del DTO en compilación además del candado estructural en runtime.
const _forma: CuentaQueReporteDto = { reporteId: "", valor: "", plataforma: null, creadoEn: new Date(), enRevision: false, categoriaLabel: null };
void _forma;
