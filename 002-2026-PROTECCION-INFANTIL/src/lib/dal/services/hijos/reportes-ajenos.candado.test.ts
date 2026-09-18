/**
 * SPEC-716 · CANDADO — «A quién protejo · Sus cuentas»: el dato sin texto ni autor.
 *
 * (a) ESTRUCTURAL: cada ReporteAjenoDto tiene EXACTAMENTE { id, creadoEn, pais, ciudad,
 *     categoriaLabel, esAnonimo } — falla si aparece CUALQUIER clave de más (p.ej. texto/autor).
 * (b) NO-FUGA con el dato REAL: un reporte con texto conocido sembrado en el escenario; el texto
 *     NO aparece en la salida. Control positivo: el reporte SÍ está en la respuesta (total≥1), así
 *     que si alguien proyectara el texto, el stringify lo mostraría y el candado se pondría rojo.
 * (c) OTROS, no el padre: el reporte del propio padre queda FUERA; los ajenos (otro usuario y
 *     anónimo) entran.
 * (d) UNA sola verdad de visibilidad: un reporte NO visible (PENDIENTE) no se cuenta.
 * (e) Solo identificadores ACTIVOS del padre: un identificador inactivo, y el hijo de otro padre,
 *     no aparecen.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { listarCuentasReportadasPorOtros, type ReporteAjenoDto } from "./reportes-ajenos";

const CLAVES_DTO = ["id", "creadoEn", "pais", "ciudad", "categoriaLabel", "esAnonimo"] as const;
const TEXTO_SECRETO = "RELATO-SECRETO-716-no-debe-filtrarse-jamas";

let plataformaId: string;

async function sembrarReporte(opts: {
    identificador: string;
    usuarioId: string | null;
    esAnonimo: boolean;
    estado: string;
    texto: string;
    conClasificacion?: boolean;
    sufijo: string;
    plataformaId?: string;
}) {
    const r = await crearReporteFixture(prisma, {
        data: {
            identificador: opts.identificador,
            plataformaId: opts.plataformaId ?? plataformaId,
            usuarioId: opts.usuarioId,
            esAnonimo: opts.esAnonimo,
            estado: opts.estado as never,
            texto: opts.texto,
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            numeroSeguimiento: `RPT-716-${opts.sufijo}`,
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

describe("SPEC-716 · listarCuentasReportadasPorOtros", () => {
    beforeEach(async () => {
        await resetDatabase();
        plataformaId = (await crearPlataforma()).id;
    });

    it("blindaje + no-fuga + OTROS + visibilidad, en un escenario real", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const CUENTA = "cuenta.zaira.716";
        await prisma.hijo.create({
            data: {
                usuarioId: padre.id,
                nombre: "Zaira",
                identificadores: { create: [{ valor: CUENTA, activo: true, plataformaId }] },
            },
        });

        const rOtro = await sembrarReporte({ identificador: CUENTA, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: TEXTO_SECRETO, conClasificacion: true, sufijo: "otro" });
        await sembrarReporte({ identificador: CUENTA, usuarioId: null, esAnonimo: true, estado: "REVISION_MANUAL", texto: "relato anonimo", sufijo: "anon" });
        const rPadre = await sembrarReporte({ identificador: CUENTA, usuarioId: padre.id, esAnonimo: false, estado: "CLASIFICADO", texto: "relato del propio padre", sufijo: "padre" });
        await sembrarReporte({ identificador: CUENTA, usuarioId: otro.id, esAnonimo: false, estado: "PENDIENTE", texto: "relato pendiente", sufijo: "pend" });

        const out = await listarCuentasReportadasPorOtros(padre.id);

        // Estructura: 1 hijo, 1 cuenta activa con su plataforma.
        expect(out).toHaveLength(1);
        expect(out[0]!.cuentas).toHaveLength(1);
        const cuenta = out[0]!.cuentas[0]!;
        expect(cuenta.valor).toBe(CUENTA);
        expect(cuenta.plataforma).toBeTruthy();

        // OTROS + visibilidad: entran rOtro (CLASIFICADO, otro) y el anónimo (REVISION_MANUAL);
        // FUERA el del padre y el PENDIENTE.
        expect(cuenta.total).toBe(2);
        const ids = cuenta.reportes.map((r) => r.id);
        expect(ids).toContain(rOtro.id); // control positivo: el reporte real está en la respuesta
        expect(ids).not.toContain(rPadre.id); // el del padre NO

        // (a) ESTRUCTURAL: cada DTO tiene EXACTAMENTE las 6 claves acordadas.
        for (const r of cuenta.reportes) {
            expect(Object.keys(r).sort()).toEqual([...CLAVES_DTO].sort());
        }
        // categoriaLabel del rOtro es no-nulo; el anónimo (sin clasificación) es null.
        const dtoOtro = cuenta.reportes.find((r) => r.id === rOtro.id)!;
        expect(dtoOtro.categoriaLabel).toBeTruthy();

        // (b) NO-FUGA: el texto (de CUALQUIER reporte) no aparece por ninguna parte de la salida.
        const serializado = JSON.stringify(out);
        expect(serializado).not.toContain(TEXTO_SECRETO);
        expect(serializado).not.toContain("relato del propio padre");
        expect(serializado).not.toContain("relato anonimo");
    });

    it("solo identificadores ACTIVOS del padre; el hijo de otro padre no aparece", async () => {
        const padre = await crearUsuario("PARENT");
        const otroPadre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const ACTIVA = "cuenta.activa.716";
        const INACTIVA = "cuenta.inactiva.716";
        const AJENA = "cuenta.otropadre.716";

        await prisma.hijo.create({
            data: {
                usuarioId: padre.id,
                nombre: "Zaira",
                identificadores: {
                    create: [
                        { valor: ACTIVA, activo: true, plataformaId },
                        { valor: INACTIVA, activo: false, plataformaId },
                    ],
                },
            },
        });
        await prisma.hijo.create({
            data: { usuarioId: otroPadre.id, nombre: "Ajeno", identificadores: { create: [{ valor: AJENA, activo: true, plataformaId }] } },
        });

        await sembrarReporte({ identificador: ACTIVA, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: "a", sufijo: "a" });
        await sembrarReporte({ identificador: INACTIVA, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: "b", sufijo: "b" });
        await sembrarReporte({ identificador: AJENA, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: "c", sufijo: "c" });

        const out = await listarCuentasReportadasPorOtros(padre.id);

        expect(out).toHaveLength(1); // solo el hijo del padre
        const cuentas = out[0]!.cuentas;
        expect(cuentas.map((c) => c.valor)).toEqual([ACTIVA]); // inactiva no se lista
        expect(cuentas[0]!.total).toBe(1);
    });

    it("I-429: mismo alias en dos plataformas → cada cuenta cuenta SOLO el reporte de SU red", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const platB = await prisma.plataforma.upsert({
            where: { clave: "instagram" },
            update: {},
            create: { clave: "instagram", nombre: "Instagram" },
        });
        const ALIAS = "@zaira.716";
        await prisma.hijo.create({
            data: {
                usuarioId: padre.id,
                nombre: "Zaira",
                identificadores: {
                    create: [
                        { valor: ALIAS, activo: true, plataformaId }, // plataforma A (del beforeEach)
                        { valor: ALIAS, activo: true, plataformaId: platB.id }, // plataforma B
                    ],
                },
            },
        });
        // El MISMO alias reportado por otros: uno en A, uno en B.
        await sembrarReporte({ identificador: ALIAS, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: "en A", sufijo: "a" });
        await sembrarReporte({ identificador: ALIAS, usuarioId: otro.id, esAnonimo: false, estado: "CLASIFICADO", texto: "en B", sufijo: "b", plataformaId: platB.id });

        const cuentas = (await listarCuentasReportadasPorOtros(padre.id))[0]!.cuentas;
        // Dos cuentas (mismo valor, distinta plataforma); CADA una cuenta SOLO su red.
        // Control positivo por remoción del discriminador: si el where ignorara la plataforma,
        // cada cuenta contaría 2 → estas aserciones caen en rojo.
        expect(cuentas).toHaveLength(2);
        for (const c of cuentas) expect(c.total).toBe(1);
        expect(cuentas[0]!.reportes[0]!.id).not.toBe(cuentas[1]!.reportes[0]!.id);
    });

    it("sin hijos → arreglo vacío (sin romperse)", async () => {
        const padre = await crearUsuario("PARENT");
        expect(await listarCuentasReportadasPorOtros(padre.id)).toEqual([]);
    });
});

// Nota de tipos: fija la forma del DTO en compilación (además del candado estructural en runtime).
const _forma: ReporteAjenoDto = { id: "", creadoEn: new Date(), pais: null, ciudad: null, categoriaLabel: null, esAnonimo: false };
void _forma;
