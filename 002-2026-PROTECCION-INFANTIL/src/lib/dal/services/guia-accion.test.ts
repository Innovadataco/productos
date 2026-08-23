import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { GuiaAccionService } from "./guia-accion";
import { GuiaAccionRepository } from "../repositories/guia-accion-repository";
import { EstadoGuiaAccion } from "@prisma/client";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { seedParametrosPadre } from "../../../../prisma/seed";

async function crearAdmin() {
    return crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
}

async function crearGuiaBasica(repo: GuiaAccionRepository, adminId: string, categoria = "GROOMING") {
    return repo.crear({
        categoria,
        versionSecuencial: 1,
        tituloEmocional: "Título",
        categoriaBadgeTexto: "Badge",
        pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
        botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
        estado: EstadoGuiaAccion.BORRADOR,
        creadaPorAdminId: adminId,
    });
}

describe("GuiaAccionRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea y lista guías", async () => {
        const admin = await crearAdmin();
        const repo = new GuiaAccionRepository();
        await crearGuiaBasica(repo, admin.id);
        const listado = await repo.listar({ page: 1, pageSize: 10 });
        expect(listado.items).toHaveLength(1);
        expect(listado.pagination.total).toBe(1);
    });

    it("edita contenido solo en BORRADOR", async () => {
        const admin = await crearAdmin();
        const repo = new GuiaAccionRepository();
        const guia = await crearGuiaBasica(repo, admin.id);
        const editada = await repo.editarContenido(guia.id, { tituloEmocional: "Editado" });
        expect(editada.tituloEmocional).toBe("Editado");
    });

    it("transiciona BORRADOR -> PENDIENTE_APROBACION_COMITE", async () => {
        const admin = await crearAdmin();
        const repo = new GuiaAccionRepository();
        const guia = await crearGuiaBasica(repo, admin.id);
        const enviada = await repo.enviarAComite(guia.id);
        expect(enviada.estado).toBe(EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE);
    });

    it("publica reemplazando la activa anterior de la misma categoría", async () => {
        const admin = await crearAdmin();
        const repo = new GuiaAccionRepository();
        const activa = await repo.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "V1",
            categoriaBadgeTexto: "V1",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.ACTIVA,
            creadaPorAdminId: admin.id,
        });

        const nueva = await repo.crear({
            categoria: "GROOMING",
            versionSecuencial: 2,
            tituloEmocional: "V2",
            categoriaBadgeTexto: "V2",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE,
            creadaPorAdminId: admin.id,
        });

        await repo.reemplazarActivaPorCategoria("GROOMING");
        await repo.publicar(nueva.id);

        const anterior = await repo.buscarPorId(activa.id);
        expect(anterior?.estado).toBe(EstadoGuiaAccion.REEMPLAZADA);
        const actual = await repo.buscarPorId(nueva.id);
        expect(actual?.estado).toBe(EstadoGuiaAccion.ACTIVA);
    });

    it("impide dos guías ACTIVAS de la misma categoría (índice parcial)", async () => {
        const admin = await crearAdmin();
        await prisma.guiaAccionCategoria.create({
            data: {
                categoria: "GROOMING",
                versionSecuencial: 1,
                tituloEmocional: "A",
                categoriaBadgeTexto: "A",
                pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                estado: EstadoGuiaAccion.ACTIVA,
                creadaPorAdminId: admin.id,
            },
        });

        await expect(
            prisma.guiaAccionCategoria.create({
                data: {
                    categoria: "GROOMING",
                    versionSecuencial: 2,
                    tituloEmocional: "B",
                    categoriaBadgeTexto: "B",
                    pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                    botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                    estado: EstadoGuiaAccion.ACTIVA,
                    creadaPorAdminId: admin.id,
                },
            })
        ).rejects.toThrow();
    });
});

describe("GuiaAccionService", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametrosPadre();
    });

    it("crea guía en BORRADOR", async () => {
        const admin = await crearAdmin();
        const service = new GuiaAccionService();
        const guia = await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "Título",
            categoriaBadgeTexto: "Badge",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.BORRADOR,
            creadaPorAdminId: admin.id,
        });
        expect(guia.estado).toBe(EstadoGuiaAccion.BORRADOR);
    });

    it("primer voto del comité no publica la guía", async () => {
        const admin = await crearAdmin();
        const comite1 = await crearUsuario("COMITE_VALIDACION", `comite1-${Date.now()}@test.local`);
        const service = new GuiaAccionService();
        const guia = await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "Título",
            categoriaBadgeTexto: "Badge",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.BORRADOR,
            creadaPorAdminId: admin.id,
        });
        await service.enviarAComite(guia.id, admin.id);
        const resultado = await service.aprobar(guia.id, {
            usuarioId: comite1.id,
            email: comite1.email,
            aprobadoEn: new Date().toISOString(),
        });
        expect(resultado).not.toBeNull();
        expect(resultado!.estado).toBe(EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE);
    });

    it("segundo voto publica la guía y reemplaza la activa anterior", async () => {
        const admin = await crearAdmin();
        const comite1 = await crearUsuario("COMITE_VALIDACION", `comite1-${Date.now()}@test.local`);
        const comite2 = await crearUsuario("COMITE_VALIDACION", `comite2-${Date.now()}@test.local`);
        const service = new GuiaAccionService();
        const v1 = await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "V1",
            categoriaBadgeTexto: "V1",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.ACTIVA,
            creadaPorAdminId: admin.id,
        });
        const v2 = await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 2,
            tituloEmocional: "V2",
            categoriaBadgeTexto: "V2",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.BORRADOR,
            creadaPorAdminId: admin.id,
        });
        await service.enviarAComite(v2.id, admin.id);
        await service.aprobar(v2.id, { usuarioId: comite1.id, email: comite1.email, aprobadoEn: new Date().toISOString() });
        const publicada = await service.aprobar(v2.id, { usuarioId: comite2.id, email: comite2.email, aprobadoEn: new Date().toISOString() });
        expect(publicada).not.toBeNull();
        expect(publicada!.estado).toBe(EstadoGuiaAccion.ACTIVA);
        const anterior = await prisma.guiaAccionCategoria.findUnique({ where: { id: v1.id } });
        expect(anterior?.estado).toBe(EstadoGuiaAccion.REEMPLAZADA);
    });

    it("rechazar vuelve a BORRADOR y limpia votos", async () => {
        const admin = await crearAdmin();
        const comite1 = await crearUsuario("COMITE_VALIDACION", `comite1-${Date.now()}@test.local`);
        const service = new GuiaAccionService();
        const guia = await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "Título",
            categoriaBadgeTexto: "Badge",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.BORRADOR,
            creadaPorAdminId: admin.id,
        });
        await service.enviarAComite(guia.id, admin.id);
        await service.aprobar(guia.id, { usuarioId: comite1.id, email: comite1.email, aprobadoEn: new Date().toISOString() });
        const rechazada = await service.rechazar(guia.id, { usuarioId: comite1.id, email: comite1.email, aprobadoEn: new Date().toISOString() }, "No aplica");
        expect(rechazada.estado).toBe(EstadoGuiaAccion.BORRADOR);
    });

    it("consulta pública devuelve solo guía ACTIVA", async () => {
        const admin = await crearAdmin();
        const service = new GuiaAccionService();
        await service.crear({
            categoria: "GROOMING",
            versionSecuencial: 1,
            tituloEmocional: "Activa",
            categoriaBadgeTexto: "Activa",
            pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
            botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
            estado: EstadoGuiaAccion.ACTIVA,
            creadaPorAdminId: admin.id,
        });
        const publica = await service.consultaPublica("GROOMING");
        expect(publica).not.toBeNull();
        expect(publica?.tituloEmocional).toBe("Activa");
    });
});
