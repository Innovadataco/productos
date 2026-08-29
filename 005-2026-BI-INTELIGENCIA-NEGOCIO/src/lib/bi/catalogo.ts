import { PrismaClient } from "@prisma/client";
import type { Rol, SchemaJSON, CatalogoTablaResuelto } from "./tipos";

export async function construirSchemaJSON(
    prisma: PrismaClient,
    rol: Rol,
): Promise<SchemaJSON> {
    const tablas = await prisma.bICatalogoTabla.findMany({
        where: {
            activo: true,
            rolesPermitidos: { has: rol },
        },
        include: {
            columnas: true,
        },
        orderBy: { nombreFuente: "asc" },
    });

    const tablasPermitidas = tablas.map((t) => t.nombreFuente);
    const columnasPorTabla: Record<string, string[]> = {};
    const columnasExcluidas: Record<string, string[]> = {};

    for (const t of tablas) {
        columnasPorTabla[t.nombreFuente] = t.columnas
            .filter((c) => !c.excluida)
            .map((c) => c.nombreFuente);
        columnasExcluidas[t.nombreFuente] = t.columnas
            .filter((c) => c.excluida)
            .map((c) => c.nombreFuente);
    }

    const catalogoResuelto: CatalogoTablaResuelto = {
        tablasPermitidas,
        columnasPorTabla,
        columnasExcluidas,
    };

    const tablasSchema = tablas.map((t) => ({
        type: "object",
        properties: {
            tabla: { type: "string", enum: [t.nombreFuente] },
            columnas: {
                type: "array",
                items: {
                    type: "string",
                    enum: columnasPorTabla[t.nombreFuente].length > 0
                        ? columnasPorTabla[t.nombreFuente]
                        : ["__sin_columnas__"],
                },
            },
        },
        required: ["tabla", "columnas"],
        additionalProperties: false,
    }));

    const schema = {
        type: "object",
        properties: {
            seleccion: {
                type: "array",
                items:
                    tablasSchema.length > 0
                        ? { oneOf: tablasSchema, additionalProperties: false }
                        : { type: "object", additionalProperties: false },
            },
            filtros: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        columna: { type: "string" },
                        operador: {
                            type: "string",
                            enum: ["=", "!=", "<", ">", "<=", ">=", "LIKE", "IN"],
                        },
                        valor: {},
                    },
                    required: ["columna", "operador"],
                    additionalProperties: false,
                },
            },
            agregacion: {
                type: ["string", "null"],
                enum: ["COUNT", "SUM", "AVG", "MIN", "MAX", null],
            },
            agrupacion: {
                type: "array",
                items: { type: "string" },
            },
            limite: { type: "integer", minimum: 1, maximum: 1000 },
        },
        required: ["seleccion"],
        additionalProperties: false,
    };

    return { schema, catalogoResuelto };
}
