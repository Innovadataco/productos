/**
 * SPEC-221 (002-PI-122): tests de integración del servicio de resolución humana
 * de recomendaciones (transición PENDIENTE → APLICADA | IGNORADA + AuditLog).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { resolverRecomendacion } from "./resolver";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearReglaYRecomendacion(adminId: string, estado: "PENDIENTE" | "APLICADA" | "EXPIRADA" = "PENDIENTE") {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.resolver"),
            nombre: "Regla",
            descripcion: "Regla",
            categoria: "churn",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
    const recomendacion = await prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: "Recomendación",
            descripcion: "Descripción",
            categoria: "churn",
            prioridad: 50,
            datosContexto: { dedupKey: unico("k") },
            estado,
            expiraEn: new Date(Date.now() + 86_400_000),
        },
    });
    return { regla, recomendacion };
}

describe("resolverRecomendacion (SPEC-221)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("resuelve una PENDIENTE como APLICADA con motivo y registra AuditLog", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const { regla, recomendacion } = await crearReglaYRecomendacion(admin.id);

        const resuelta = await resolverRecomendacion({
            id: recomendacion.id,
            estado: "APLICADA",
            motivo: "Llamé al rector, renueva mañana",
            adminId: admin.id,
        });

        expect(resuelta.estado).toBe("APLICADA");
        expect(resuelta.resueltaEn).not.toBeNull();
        expect(resuelta.resueltaPorAdminId).toBe(admin.id);
        expect(resuelta.motivoResolucion).toBe("Llamé al rector, renueva mañana");

        const audits = await prisma.auditLog.findMany({
            where: { accion: "RECOMENDACION_RESUELTA", recursoId: recomendacion.id },
        });
        expect(audits).toHaveLength(1);
        const metadatos = audits[0]!.metadatos as Record<string, unknown>;
        expect(metadatos).toMatchObject({ reglaId: regla.id, categoria: "churn", estado: "APLICADA" });
        // Nunca datosContexto ni datos del sujeto.
        expect(metadatos).not.toHaveProperty("datosContexto");
        expect(metadatos).not.toHaveProperty("sujetoId");
    });

    it("resuelve como IGNORADA sin motivo", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const { recomendacion } = await crearReglaYRecomendacion(admin.id);

        const resuelta = await resolverRecomendacion({
            id: recomendacion.id,
            estado: "IGNORADA",
            motivo: null,
            adminId: admin.id,
        });
        expect(resuelta.estado).toBe("IGNORADA");
        expect(resuelta.motivoResolucion).toBeNull();
    });

    it("rechaza con 404 un id inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        await expect(
            resolverRecomendacion({ id: "cl_inexistente_000000000000", estado: "APLICADA", motivo: null, adminId: admin.id })
        ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    });

    it.each(["APLICADA", "EXPIRADA"] as const)(
        "rechaza con 409 una recomendación ya %s sin cambiar su estado",
        async (estadoInicial) => {
            const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
            const { recomendacion } = await crearReglaYRecomendacion(admin.id, estadoInicial);

            await expect(
                resolverRecomendacion({ id: recomendacion.id, estado: "IGNORADA", motivo: null, adminId: admin.id })
            ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });

            const recargada = await prisma.recomendacion.findUnique({ where: { id: recomendacion.id } });
            expect(recargada?.estado).toBe(estadoInicial);
            expect(
                await prisma.auditLog.count({ where: { accion: "RECOMENDACION_RESUELTA", recursoId: recomendacion.id } })
            ).toBe(0);
        }
    );
});
