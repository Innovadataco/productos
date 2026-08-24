/**
 * SPEC-234 (002-PI-134): tests del InformeConsolidadoRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "./expediente-repository";
import {
    InformeConsolidadoRepository,
    parseAprobaciones,
    parseCorrecciones,
} from "./informe-consolidado-repository";

async function crearPadre() {
    return crearUsuario("PARENT");
}

async function crearExpediente(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
    return new ExpedienteRepository().crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: "+573001234567",
        plataformaId: "whatsapp",
    });
}

function baseInforme(expedienteId: string, versionSecuencial: number) {
    return {
        expedienteId,
        versionSecuencial,
        scoreValor: 10.5,
        scoreGravedad: "VERDE" as const,
        categoriasDetectadasJson: { CONTACTO_INSISTENTE: 1 },
        resumenTextoGenerado: "Resumen de prueba",
    };
}

describe("InformeConsolidadoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crearInforme persiste un informe con los campos obligatorios", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();

        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));

        expect(informe.expedienteId).toBe(expediente.id);
        expect(informe.versionSecuencial).toBe(1);
        expect(informe.scoreGravedad).toBe("VERDE");
        expect(informe.estadoAprobacion).toBe("PENDIENTE_COMITE");
    });

    it("obtenerPorId devuelve el informe creado", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const creado = await repo.crearInforme(baseInforme(expediente.id, 1));

        const encontrado = await repo.obtenerPorId(creado.id);
        expect(encontrado?.id).toBe(creado.id);
    });

    it("obtenerPorHash devuelve el informe por pdfHash", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const creado = await repo.crearInforme({
            ...baseInforme(expediente.id, 1),
            pdfHash: "abc123",
        });

        const encontrado = await repo.obtenerPorHash("abc123");
        expect(encontrado?.id).toBe(creado.id);
    });

    it("listarPorExpediente ordena por versionSecuencial descendente", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const v1 = await repo.crearInforme(baseInforme(expediente.id, 1));
        const v2 = await repo.crearInforme(baseInforme(expediente.id, 2));

        const lista = await repo.listarPorExpediente(expediente.id, { page: 1, pageSize: 10 });
        expect(lista.items).toHaveLength(2);
        expect(lista.items[0].id).toBe(v2.id);
        expect(lista.items[1].id).toBe(v1.id);
        expect(lista.pagination.total).toBe(2);
    });

    it("obtenerUltimaVersion devuelve la versión más alta", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        await repo.crearInforme(baseInforme(expediente.id, 1));
        const v3 = await repo.crearInforme(baseInforme(expediente.id, 3));
        await repo.crearInforme(baseInforme(expediente.id, 2));

        const ultima = await repo.obtenerUltimaVersion(expediente.id);
        expect(ultima?.id).toBe(v3.id);
    });
});

// SPEC-237 (002-PI-mega-cola): bandeja de consolidación, aprobación
// multi-miembro, corrección append-only y devolución con motivo.
describe("InformeConsolidadoRepository — SPEC-237", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    const miembro = (id: string, nombre = "Miembro") => ({ id, nombre });

    it("listarPendientesConsolidacion solo incluye PENDIENTE_COMITE y CORREGIDO", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const pendiente = await repo.crearInforme(baseInforme(expediente.id, 1));
        const corregido = await repo.crearInforme(baseInforme(expediente.id, 2));
        await prisma.informeConsolidado.update({
            where: { id: corregido.id },
            data: { estadoAprobacion: "CORREGIDO" },
        });
        const aprobado = await repo.crearInforme(baseInforme(expediente.id, 3));
        await prisma.informeConsolidado.update({
            where: { id: aprobado.id },
            data: { estadoAprobacion: "APROBADO" },
        });

        const lista = await repo.listarPendientesConsolidacion({ page: 1, pageSize: 25 });
        const ids = lista.items.map((i) => i.id);
        expect(ids).toContain(pendiente.id);
        expect(ids).toContain(corregido.id);
        expect(ids).not.toContain(aprobado.id);
        expect(lista.items[0].expediente.identificadorReportado).toBe("+573001234567");
    });

    it("aprobarPorMiembro registra el voto y no aprueba antes del umbral", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        const r1 = await repo.aprobarPorMiembro(informe.id, miembro(m1.id, "Ana"), 2);
        expect(r1.aprobo).toBe(false);
        expect(r1.yaAprobado).toBe(false);
        expect(r1.informe.estadoAprobacion).toBe("PENDIENTE_COMITE");
        expect(parseAprobaciones(r1.informe.aprobadoPorMiembrosJson)).toHaveLength(1);
    });

    it("aprobarPorMiembro aprueba al alcanzar el umbral con miembros distintos", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");
        const m2 = await crearUsuario("COMITE_VALIDACION");

        await repo.aprobarPorMiembro(informe.id, miembro(m1.id, "Ana"), 2);
        const r2 = await repo.aprobarPorMiembro(informe.id, miembro(m2.id, "Luis"), 2);
        expect(r2.aprobo).toBe(true);
        expect(r2.informe.estadoAprobacion).toBe("APROBADO");

        // Voto excedente de un tercer miembro: se ignora sin mutar.
        const m3 = await crearUsuario("COMITE_VALIDACION");
        const r3 = await repo.aprobarPorMiembro(informe.id, miembro(m3.id, "Sara"), 2);
        expect(r3.aprobo).toBe(false);
        expect(r3.yaAprobado).toBe(true);
        expect(parseAprobaciones(r3.informe.aprobadoPorMiembrosJson)).toHaveLength(2);
    });

    it("aprobarPorMiembro rechaza voto duplicado del mismo miembro con 409", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        await repo.aprobarPorMiembro(informe.id, miembro(m1.id, "Ana"), 2);
        await expect(repo.aprobarPorMiembro(informe.id, miembro(m1.id, "Ana"), 2)).rejects.toMatchObject({
            statusCode: 409,
        });
    });

    it("corregirTexto añade snapshots append-only y deja estado CORREGIDO", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");
        const m2 = await crearUsuario("COMITE_VALIDACION");

        const c1 = await repo.corregirTexto(informe.id, miembro(m1.id, "Ana"), "Texto v2", "Ajuste redacción");
        expect(c1.estadoAprobacion).toBe("CORREGIDO");
        expect(c1.resumenTextoGenerado).toBe("Texto v2");

        const c2 = await repo.corregirTexto(informe.id, miembro(m2.id, "Luis"), "Texto v3", "Segundo ajuste");
        const correcciones = parseCorrecciones(c2.correccionesJson);
        expect(correcciones).toHaveLength(2);
        expect(correcciones[0].textoAnterior).toBe("Resumen de prueba");
        expect(correcciones[0].textoNuevo).toBe("Texto v2");
        expect(correcciones[1].textoAnterior).toBe("Texto v2");
        expect(correcciones[1].textoNuevo).toBe("Texto v3");
        expect(c2.estadoAprobacion).toBe("CORREGIDO");
    });

    it("corregirTexto actualiza la guía de acción cuando se provee", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        const c1 = await repo.corregirTexto(
            informe.id,
            miembro(m1.id, "Ana"),
            "Texto v2",
            "Cambio de guía",
            "guia-xyz"
        );
        expect(c1.guiaAccionCategoriaIdPrincipal).toBe("guia-xyz");
    });

    it("devolverConMotivo cambia estado a DEVUELTO y persiste el motivo", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        const devuelto = await repo.devolverConMotivo(informe.id, miembro(m1.id, "Ana"), "Falta evidencia");
        expect(devuelto.estadoAprobacion).toBe("DEVUELTO");
        expect(devuelto.motivoDevolucion).toBe("Falta evidencia");

        // Sale de la bandeja de pendientes.
        const lista = await repo.listarPendientesConsolidacion({ page: 1, pageSize: 25 });
        expect(lista.items.map((i) => i.id)).not.toContain(informe.id);
    });

    it("devolverConMotivo rechaza motivo vacío con 400", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        await expect(repo.devolverConMotivo(informe.id, miembro(m1.id, "Ana"), "   ")).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it("las mutaciones registran AuditLog con la acción canónica", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpediente(padre.id);
        const repo = new InformeConsolidadoRepository();
        const informe = await repo.crearInforme(baseInforme(expediente.id, 1));
        const m1 = await crearUsuario("COMITE_VALIDACION");

        await repo.aprobarPorMiembro(informe.id, miembro(m1.id, "Ana"), 2);
        await repo.corregirTexto(informe.id, miembro(m1.id, "Ana"), "Texto v2", "Ajuste");
        await repo.devolverConMotivo(informe.id, miembro(m1.id, "Ana"), "Falta evidencia");

        const acciones = await prisma.auditLog.findMany({
            where: { recursoId: informe.id },
            select: { accion: true },
        });
        const claves = acciones.map((a) => a.accion);
        expect(claves).toContain("INFORME_CONSOLIDADO_APROBADO");
        expect(claves).toContain("INFORME_CONSOLIDADO_CORREGIDO");
        expect(claves).toContain("INFORME_CONSOLIDADO_DEVUELTO");
    });
});
