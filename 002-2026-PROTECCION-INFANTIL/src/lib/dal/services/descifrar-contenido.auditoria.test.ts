import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { descifrarCampoReporte, descifrarCamposReporte } from "./descifrar-contenido";
import { conActor } from "@/lib/auditoria-lectura/actor";
import { hashContenidoVisto } from "@/lib/acceso-codigo";

/**
 * SPEC-584 (Fase 2) · El descifrado por la frontera DAL escribe la auditoría de
 * lectura: quién (actor ALS), qué campo y hash del contenido — nunca el texto.
 */
describe("SPEC-584 · auditoría de lectura en la frontera del descifrado", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    async function crearReporteDePrueba(usuarioId?: string) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        return crearReporteFixture(prisma, {
            data: {
                identificador: `+57300584${Date.now()}`,
                plataformaId: plataforma!.id,
                texto: "Texto de auditoría SPEC-584",
                fechaIncidente: new Date("2026-09-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: !usuarioId,
                ...(usuarioId ? { usuarioId } : {}),
                estado: "REVISION_MANUAL",
            },
        });
    }

    it("descifrarCampoReporte registra la lectura con el actor del hilo ALS", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba();
        const contenido = await prisma.contenidoReporte.findUniqueOrThrow({ where: { id: reporte.contenidoId } });

        const texto = await conActor(
            { usuarioId: operador.id, rol: "OPERADOR", ip: "10.0.0.1", userAgent: "vitest" },
            () => descifrarCampoReporte(contenido.id, "texto")
        );
        expect(texto).toBe("Texto de auditoría SPEC-584");

        const auditoria = await prisma.lecturaReporte.findMany({ where: { contenidoId: contenido.id } });
        expect(auditoria).toHaveLength(1);
        expect(auditoria[0]).toMatchObject({
            reporteId: reporte.id,
            campo: "texto",
            tipoActor: "PLATAFORMA",
            usuarioId: operador.id,
            rol: "OPERADOR",
            ip: "10.0.0.1",
            userAgent: "vitest",
            hashContenido: hashContenidoVisto("Texto de auditoría SPEC-584"),
        });
        // NUNCA el texto literal en la auditoría.
        expect(JSON.stringify(auditoria[0])).not.toContain("Texto de auditoría");
    });

    it("descifrarCampoReporte sin actor ALS audita con usuario null (fail-loud de identidad, no de lectura)", async () => {
        const reporte = await crearReporteDePrueba();
        await descifrarCampoReporte(reporte.contenidoId, "textoOriginal");
        const auditoria = await prisma.lecturaReporte.findMany({ where: { contenidoId: reporte.contenidoId } });
        expect(auditoria).toHaveLength(1);
        expect(auditoria[0].usuarioId).toBeNull();
        expect(auditoria[0].tipoActor).toBe("PLATAFORMA");
    });

    it("descifrarCamposReporte escribe una fila por reporte (batch)", async () => {
        const admin = await crearUsuario("ADMIN");
        const r1 = await crearReporteDePrueba();
        const r2 = await crearReporteDePrueba();
        await conActor({ usuarioId: admin.id, rol: "ADMIN" }, () =>
            descifrarCamposReporte([r1.contenidoId, r2.contenidoId], "texto")
        );
        const total = await prisma.lecturaReporte.count();
        expect(total).toBe(2);
    });

    it("la lectura EXTERNO (tipoActor del ALS) queda marcada y vinculable a su código", async () => {
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const codigo = await prisma.codigoAccesoContenido.create({
            data: {
                reporteId: reporte.id,
                codigoHash: "hash-de-prueba",
                solicitadoPorId: padre.id,
                vigenteHasta: new Date(Date.now() + 30 * 60 * 1000),
            },
        });
        const profesional = await crearUsuario("PROFESIONAL");
        await conActor(
            { usuarioId: profesional.id, rol: "PROFESIONAL", tipoActor: "EXTERNO", codigoAccesoId: codigo.id },
            () => descifrarCampoReporte(reporte.contenidoId, "texto")
        );
        const auditoria = await prisma.lecturaReporte.findFirstOrThrow({ where: { reporteId: reporte.id } });
        expect(auditoria.tipoActor).toBe("EXTERNO");
        expect(auditoria.codigoAccesoId).toBe(codigo.id);
        expect(auditoria.usuarioId).toBe(profesional.id);
    });
});
