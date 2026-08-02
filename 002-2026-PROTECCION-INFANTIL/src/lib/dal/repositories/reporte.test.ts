/**
 * E-8 (LOTE 2): tests de las lecturas de bandeja admin del ReporteRepository —
 * mismos select/orden/paginación que tenían las rutas migradas.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { ReporteRepository } from "./reporte";
import type { EstadoReporte } from "@prisma/client";

const TAG = Math.random().toString(36).slice(2, 8);
let correlativo = 0;

async function crearReporteDePrueba(
    estado: EstadoReporte = "REVISION_MANUAL",
    opciones: { prioridadAlta?: boolean; operadorId?: string; conClasificacion?: boolean } = {}
) {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    correlativo += 1;
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300${TAG}${correlativo}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba del repositorio de reportes con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${TAG}-${correlativo}`,
            estado,
            prioridadAlta: opciones.prioridadAlta ?? false,
            operadorId: opciones.operadorId ?? null,
        },
    });
    if (opciones.conClasificacion) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SPAM",
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 100,
            },
        });
    }
    return reporte;
}

describe("ReporteRepository (E-8 LOTE 2: bandeja admin)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("findPermisosGestion devuelve los campos de gestión incluido `eliminado`", async () => {
        const reporte = await crearReporteDePrueba();
        const repo = new ReporteRepository();

        const row = await repo.findPermisosGestion(reporte.id);
        expect(row).not.toBeNull();
        expect(row).toMatchObject({ id: reporte.id, estado: "REVISION_MANUAL", eliminado: false });
        expect("texto" in row!).toBe(false);

        expect(await repo.findPermisosGestion("no-existe")).toBeNull();
    });

    it("findPermisosGestionBasico devuelve gestión sin `eliminado`", async () => {
        const reporte = await crearReporteDePrueba();
        const row = await new ReporteRepository().findPermisosGestionBasico(reporte.id);
        expect(row).not.toBeNull();
        expect(row!.id).toBe(reporte.id);
        expect("eliminado" in row!).toBe(false);
    });

    it("findPermisosRevision devuelve operador/comité/tenant", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba("REVISION_MANUAL", { operadorId: operador.id });
        const row = await new ReporteRepository().findPermisosRevision(reporte.id);
        expect(row).toMatchObject({ operadorId: operador.id, comiteId: null });
        expect("estado" in row!).toBe(false);
    });

    it("findTextoOriginalCifrado solo expone textoOriginal", async () => {
        const reporte = await crearReporteDePrueba();
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { textoOriginal: "cifrado::texto-original" },
        });
        const row = await new ReporteRepository().findTextoOriginalCifrado(reporte.id);
        expect(row).toEqual({ textoOriginal: "cifrado::texto-original" });
    });

    it("findByIdConClasificacionYEmbedding incluye clasificación y embedding (null si no hay)", async () => {
        const reporte = await crearReporteDePrueba("POSIBLE_SPAM", { conClasificacion: true });
        const row = await new ReporteRepository().findByIdConClasificacionYEmbedding(reporte.id);
        expect(row!.clasificacion).toMatchObject({ categoria: "SPAM" });
        expect(row!.embedding).toBeNull();
    });

    it("findBandejaRevision: orden por prioridad y fecha, paginación, total y corrección anidada", async () => {
        const repo = new ReporteRepository();
        const normal = await crearReporteDePrueba("REVISION_MANUAL", { conClasificacion: true });
        const prioritario = await crearReporteDePrueba("REVISION_MANUAL", { prioridadAlta: true });
        const admin = await crearUsuario("ADMIN");
        const clasificacion = await prisma.clasificacionIA.findUnique({ where: { reporteId: normal.id } });
        await prisma.correccionAdmin.create({
            data: {
                clasificacionId: clasificacion!.id,
                categoriaOriginal: "SPAM",
                categoriaCorregida: "OTRO",
                adminId: admin.id,
                motivo: "corrección de prueba",
            },
        });

        const [rows, total] = await repo.findBandejaRevision({ estado: "REVISION_MANUAL" }, { skip: 0, take: 25 });
        expect(total).toBe(2);
        expect(rows.map((r) => r.id)).toEqual([prioritario.id, normal.id]);
        const conCorreccion = rows.find((r) => r.id === normal.id);
        expect(conCorreccion!.clasificacion?.correccion).toMatchObject({
            categoriaOriginal: "SPAM",
            categoriaCorregida: "OTRO",
        });

        const [pagina, totalPagina] = await repo.findBandejaRevision({ estado: "REVISION_MANUAL" }, { skip: 1, take: 1 });
        expect(totalPagina).toBe(2);
        expect(pagina).toHaveLength(1);
    });

    it("findDetalleRevision trae reintentos ordenados y la corrección con `confirmada`", async () => {
        const reporte = await crearReporteDePrueba("REVISION_MANUAL", { conClasificacion: true });
        await prisma.reintentoReporte.create({
            data: { reporteId: reporte.id, intento: 1, error: "fallo de prueba" },
        });
        const row = await new ReporteRepository().findDetalleRevision(reporte.id);
        expect(row!.id).toBe(reporte.id);
        expect(row!.reintentos).toHaveLength(1);
        expect(row!.clasificacion).toMatchObject({ categoria: "SPAM", correccion: null });
        expect("edadVictima" in row!).toBe(true);
    });

    it("findBandejaSpam: select exacto, confianza de la clasificación y paginación", async () => {
        const repo = new ReporteRepository();
        await crearReporteDePrueba("POSIBLE_SPAM", { conClasificacion: true });
        await crearReporteDePrueba("CLASIFICADO");

        const [rows, total] = await repo.findBandejaSpam({ estado: "POSIBLE_SPAM" }, { skip: 0, take: 20 });
        expect(total).toBe(1);
        expect(rows[0].clasificacion).toMatchObject({ categoria: "SPAM", confianza: 0.9 });
        expect(rows[0].plataforma).toMatchObject({ clave: "whatsapp" });
        expect(typeof rows[0].texto).toBe("string");
    });

    it("contarPorUsuarios: conteo agregado por autor, solo de los ids pedidos", async () => {
        const repo = new ReporteRepository();
        const a = await crearReporteDePrueba("CLASIFICADO");
        const b = await crearReporteDePrueba("CLASIFICADO");
        const autorA = a.usuarioId!;
        await prisma.reporte.update({ where: { id: b.id }, data: { usuarioId: autorA } });
        const otro = await crearReporteDePrueba("CLASIFICADO");

        const conteos = await repo.contarPorUsuarios({ usuarioId: { in: [autorA] } });
        expect(conteos).toHaveLength(1);
        expect(conteos[0]).toMatchObject({ usuarioId: autorA });
        expect(conteos[0]._count._all).toBe(2);
        expect(otro.usuarioId).not.toBe(autorA);
    });
});
