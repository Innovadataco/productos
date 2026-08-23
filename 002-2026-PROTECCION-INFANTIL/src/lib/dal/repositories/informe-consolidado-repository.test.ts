/**
 * SPEC-234 (002-PI-134): tests del InformeConsolidadoRepository.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "./expediente-repository";
import { InformeConsolidadoRepository } from "./informe-consolidado-repository";

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
