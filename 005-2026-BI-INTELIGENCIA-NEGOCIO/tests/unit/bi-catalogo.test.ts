import { describe, it, expect } from "vitest";
import { construirSchemaJSON } from "@/lib/bi/catalogo";

function stubPrisma(tablas: Array<{
    nombreFuente: string;
    activo: boolean;
    rolesPermitidos: string[];
    columnas: Array<{ nombreFuente: string; excluida: boolean }>;
}>) {
    return {
        bICatalogoTabla: {
            findMany: async (args: { where: { rolesPermitidos: { has: string } } }) => {
                return tablas.filter(
                    (t) => t.activo && t.rolesPermitidos.includes(args.where.rolesPermitidos.has),
                );
            },
        },
        bICatalogoMetrica: { findMany: async () => [] },
        bICatalogoEjemplo: { findMany: async () => [] },
    } as unknown as import("@prisma/client").PrismaClient;
}

describe("construirSchemaJSON (candado 1 + 8)", () => {
    it("aserta additionalProperties:false en cada objeto anidado", async () => {
        const prisma = stubPrisma([
            {
                nombreFuente: "bi_reporte_diario",
                activo: true,
                rolesPermitidos: ["ADMIN"],
                columnas: [
                    { nombreFuente: "fecha", excluida: false },
                    { nombreFuente: "total", excluida: false },
                    { nombreFuente: "nombre_padre", excluida: true },
                ],
            },
        ]);
        const { schema, catalogoResuelto } = await construirSchemaJSON(prisma, "ADMIN");
        expect(catalogoResuelto.tablasPermitidas).toContain("bi_reporte_diario");
        expect(catalogoResuelto.columnasPorTabla["bi_reporte_diario"]).toEqual(["fecha", "total"]);
        expect(catalogoResuelto.columnasExcluidas["bi_reporte_diario"]).toEqual(["nombre_padre"]);
        const s = schema as { additionalProperties: boolean };
        expect(s.additionalProperties).toBe(false);
    });

    it("filtra por rol", async () => {
        const prisma = stubPrisma([
            {
                nombreFuente: "solo_admin",
                activo: true,
                rolesPermitidos: ["ADMIN"],
                columnas: [{ nombreFuente: "x", excluida: false }],
            },
        ]);
        const { catalogoResuelto } = await construirSchemaJSON(prisma, "SCHOOL_ADMIN");
        expect(catalogoResuelto.tablasPermitidas).toHaveLength(0);
    });

    it("ignora tablas activo:false", async () => {
        const prisma = stubPrisma([
            {
                nombreFuente: "inactiva",
                activo: false,
                rolesPermitidos: ["ADMIN"],
                columnas: [{ nombreFuente: "x", excluida: false }],
            },
        ]);
        const { catalogoResuelto } = await construirSchemaJSON(prisma, "ADMIN");
        expect(catalogoResuelto.tablasPermitidas).toHaveLength(0);
    });
});
