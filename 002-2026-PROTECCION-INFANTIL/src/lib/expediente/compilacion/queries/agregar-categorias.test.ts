/**
 * SPEC-234 (002-PI-134): tests del agregado de categorías por expediente.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { agregarCategoriasPorExpediente } from "./agregar-categorias";

async function crearExpedienteConEventos(padreId: string) {
    await prisma.plataforma.upsert({
        where: { clave: "whatsapp" },
        update: {},
        create: { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
    });
    const repo = new ExpedienteRepository();
    const expediente = await repo.crearExpediente({
        padreUsuarioId: padreId,
        identificadorReportado: "+573001234567",
        plataformaId: "whatsapp",
    });
    const e1 = await repo.agregarEvento({ expedienteId: expediente.id, texto: "A" });
    const e2 = await repo.agregarEvento({ expedienteId: expediente.id, texto: "B" });
    await prisma.eventoExpediente.update({
        where: { id: e1.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", confianzaClasificacion: 0.7 },
    });
    await prisma.eventoExpediente.update({
        where: { id: e2.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", confianzaClasificacion: 0.9 },
    });
    return expediente;
}

describe("agregarCategoriasPorExpediente", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("agrupa eventos por categoría y calcula confianza promedio", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await crearExpedienteConEventos(padre.id);

        const categorias = await agregarCategoriasPorExpediente(expediente.id);

        expect(categorias).toHaveLength(1);
        expect(categorias[0].categoria).toBe("CONTACTO_INSISTENTE");
        expect(categorias[0].totalEventos).toBe(2);
        expect(categorias[0].confianzaPromedio).toBeCloseTo(0.8);
    });
});
