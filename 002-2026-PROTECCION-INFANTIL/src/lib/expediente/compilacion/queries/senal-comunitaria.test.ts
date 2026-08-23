/**
 * SPEC-234 (002-PI-134): tests de la query de señal comunitaria.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { SenalComunitariaRepository } from "@/lib/dal/repositories/senal-comunitaria-repository";
import { obtenerSenalComunitaria } from "./senal-comunitaria";

async function crearPadre() {
    return crearUsuario("PARENT");
}

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
    const evento = await repo.agregarEvento({
        expedienteId: expediente.id,
        texto: "Evento de prueba",
        reporteACrear: {
            ciudad: "Bogotá",
            pais: "Colombia",
        },
    });
    await prisma.eventoExpediente.update({
        where: { id: evento.id },
        data: { categoriaDetectada: "CONTACTO_INSISTENTE", plataforma: "whatsapp" },
    });
    return expediente;
}

describe("obtenerSenalComunitaria", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("recalcula y guarda agregados cuando no hay caché", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpedienteConEventos(padre.id);

        const senal = await obtenerSenalComunitaria(expediente.identificadorReportado);

        expect(senal.totalExpedientesActivos).toBe(1);
        expect(senal.categoriasFrecuenciaJson).toHaveProperty("CONTACTO_INSISTENTE");
        expect(senal.plataformasJson).toHaveProperty("whatsapp");
        expect(senal.paisesJson).toHaveProperty("Colombia");
        expect(senal.ciudadesJson).toHaveProperty("Bogotá");

        const cache = await new SenalComunitariaRepository().obtenerPorIdentificador(
            expediente.identificadorReportado
        );
        expect(cache?.invalidado).toBe(false);
    });

    it("usa la caché cuando no está invalidada", async () => {
        const padre = await crearPadre();
        const expediente = await crearExpedienteConEventos(padre.id);
        const primera = await obtenerSenalComunitaria(expediente.identificadorReportado);

        // Invalidamos para forzar recálculo y luego recuperamos la segunda lectura
        await new SenalComunitariaRepository().invalidar(expediente.identificadorReportado);
        const segunda = await obtenerSenalComunitaria(expediente.identificadorReportado);

        expect(segunda.totalExpedientesActivos).toBe(primera.totalExpedientesActivos);
    });
});
