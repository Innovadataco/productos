import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import {
    GRUPOS_CATEGORIA_FALLBACK,
    obtenerGruposCategoria,
    categoriaAGrupo,
    nombreGrupoCategoria,
    nombreGrupoParaCategoria,
    agruparCategorias,
} from "./categoria-grupos";

async function crearParametroGrupos(valor: string) {
    await prisma.parametroSistema.create({
        data: {
            clave: "ui.grupos_categoria",
            valor,
            tipo: "JSON",
            categoria: "SYSTEM",
            esPublico: true,
            descripcion: "Grupos de categorías de conducta",
        },
    });
}

describe("categoria-grupos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    describe("obtenerGruposCategoria", () => {
        it("usa el fallback cuando no existe el parámetro", async () => {
            const grupos = await obtenerGruposCategoria();
            expect(grupos).toEqual(GRUPOS_CATEGORIA_FALLBACK);
        });

        it("lee la definición desde ParametroSistema", async () => {
            await crearParametroGrupos(
                JSON.stringify({
                    grupos: [
                        {
                            clave: "contacto_sexual",
                            nombre: "Contacto sexual",
                            orden: 1,
                            categorias: ["SOLICITUD_MATERIAL"],
                        },
                        {
                            clave: "otro",
                            nombre: "Otro",
                            orden: 2,
                            categorias: ["OTRO"],
                        },
                    ],
                })
            );
            const grupos = await obtenerGruposCategoria();
            expect(grupos).toHaveLength(2);
            expect(grupos[0].nombre).toBe("Contacto sexual");
        });

        it("cae al fallback si el JSON es inválido", async () => {
            await crearParametroGrupos("no es json");
            const grupos = await obtenerGruposCategoria();
            expect(grupos).toEqual(GRUPOS_CATEGORIA_FALLBACK);
        });

        it("cae al fallback si la definición no es válida", async () => {
            await crearParametroGrupos(JSON.stringify({ grupos: [{ clave: "" }] }));
            const grupos = await obtenerGruposCategoria();
            expect(grupos).toEqual(GRUPOS_CATEGORIA_FALLBACK);
        });
    });

    describe("categoriaAGrupo", () => {
        it("devuelve el grupo de una categoría interna", () => {
            const grupo = categoriaAGrupo(GRUPOS_CATEGORIA_FALLBACK, "SOLICITUD_MATERIAL");
            expect(grupo).not.toBeNull();
            expect(grupo?.clave).toBe("contacto_sexual");
        });

        it("devuelve null para SPAM", () => {
            expect(categoriaAGrupo(GRUPOS_CATEGORIA_FALLBACK, "SPAM")).toBeNull();
        });

        it("devuelve null para categoría desconocida", () => {
            expect(categoriaAGrupo(GRUPOS_CATEGORIA_FALLBACK, "DESCONOCIDA")).toBeNull();
        });
    });

    describe("nombreGrupoCategoria", () => {
        it("devuelve el nombre de un grupo por clave", () => {
            expect(nombreGrupoCategoria(GRUPOS_CATEGORIA_FALLBACK, "contacto_sexual")).toBe(
                "Contacto sexual"
            );
        });

        it("devuelve la clave si no existe", () => {
            expect(nombreGrupoCategoria(GRUPOS_CATEGORIA_FALLBACK, "inexistente")).toBe(
                "inexistente"
            );
        });
    });

    describe("nombreGrupoParaCategoria", () => {
        it("devuelve el nombre del grupo al que pertenece una categoría", () => {
            expect(nombreGrupoParaCategoria(GRUPOS_CATEGORIA_FALLBACK, "EXTORSION")).toBe(
                "Amenazas o extorsión"
            );
        });

        it("devuelve la categoría si no tiene grupo", () => {
            expect(nombreGrupoParaCategoria(GRUPOS_CATEGORIA_FALLBACK, "SPAM")).toBe("SPAM");
        });
    });

    describe("agruparCategorias", () => {
        it("agrega items por grupo y respeta el orden", () => {
            const items = [
                { categoria: "SOLICITUD_MATERIAL", total: 3 },
                { categoria: "COMPARTIMIENTO_SEXUAL", total: 2 },
                { categoria: "EXTORSION", total: 5 },
                { categoria: "OTRO", total: 1 },
                { categoria: "SPAM", total: 10 },
            ];
            const agregado = agruparCategorias(GRUPOS_CATEGORIA_FALLBACK, items);

            expect(agregado).toHaveLength(3);
            expect(agregado[0]).toMatchObject({ clave: "contacto_sexual", total: 5 });
            expect(agregado[1]).toMatchObject({ clave: "amenazas_extorsion", total: 5 });
            expect(agregado[2]).toMatchObject({ clave: "otro", total: 1 });
        });

        it("devuelve array vacío si no hay items agrupables", () => {
            const agregado = agruparCategorias(GRUPOS_CATEGORIA_FALLBACK, [
                { categoria: "SPAM", total: 10 },
            ]);
            expect(agregado).toEqual([]);
        });
    });
});
