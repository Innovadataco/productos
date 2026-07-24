import { describe, it, expect, beforeEach, vi } from "vitest";
import { PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { RUBRICA_SEMILLA, type SetsRubrica } from "@/lib/ai/rubrica-semilla";
import * as auth from "@/lib/auth";

const URL = "http://localhost/api/admin/ia/rubrica/preguntas";

const SET_NUEVO = [
    { texto: "¿El texto menciona publicar datos personales de alguien?", activo: true },
    { texto: "¿Los datos permiten localizar a la persona afectada?", activo: false },
];

describe("PUT /api/admin/ia/rubrica/preguntas", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.restoreAllMocks();
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        await prisma.parametroSistema.create({
            data: {
                clave: "ia.rubrica.preguntas",
                valor: JSON.stringify(RUBRICA_SEMILLA),
                tipo: "JSON",
                categoria: "SYSTEM",
            },
        });
    });

    it("reemplaza el set de una categoría y persiste el JSON completo", async () => {
        const res = await PUT(
            crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: SET_NUEVO })
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.categoria).toBe("DOXING");
        expect(body.preguntas).toEqual(SET_NUEVO);

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.preguntas" } });
        const sets = JSON.parse(param!.valor) as SetsRubrica;
        expect(sets.DOXING).toEqual(SET_NUEVO);
        // Las demás categorías quedan intactas
        expect(sets.CONTACTO_INSISTENTE).toEqual(RUBRICA_SEMILLA.CONTACTO_INSISTENTE);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "PARAM_UPDATE" } });
        expect(audit).not.toBeNull();
        expect(audit?.metadatos).toMatchObject({ clave: "ia.rubrica.preguntas", categoria: "DOXING" });
    });

    it("crea el parámetro si no existe (a partir de la semilla)", async () => {
        await prisma.parametroSistema.delete({ where: { clave: "ia.rubrica.preguntas" } });

        const res = await PUT(
            crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: SET_NUEVO })
        );
        expect(res.status).toBe(200);

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.preguntas" } });
        const sets = JSON.parse(param!.valor) as SetsRubrica;
        expect(sets.DOXING).toEqual(SET_NUEVO);
        expect(sets.EXTORSION).toEqual(RUBRICA_SEMILLA.EXTORSION);
    });

    it("400 con texto de pregunta demasiado corto", async () => {
        const res = await PUT(
            crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: [{ texto: "corta", activo: true }] })
        );
        expect(res.status).toBe(400);
    });

    it("400 con categoría fuera del enum", async () => {
        const res = await PUT(
            crearRequestAutenticado("PUT", URL, { categoria: "INVENTADA", preguntas: SET_NUEVO })
        );
        expect(res.status).toBe(400);
    });

    it("400 con set vacío o con más de 10 preguntas", async () => {
        const vacio = await PUT(crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: [] }));
        expect(vacio.status).toBe(400);

        const demasiadas = Array.from({ length: 11 }, (_, i) => ({
            texto: `¿Pregunta de relleno número ${i} con texto suficiente?`,
            activo: true,
        }));
        const res = await PUT(crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: demasiadas }));
        expect(res.status).toBe(400);
    });

    it("403 cuando el rol no tiene el módulo ia_rubrica", async () => {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "ia_rubrica" } });
        await prisma.permisoModulo.update({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: modulo!.id } },
            data: { activo: false },
        });

        const res = await PUT(
            crearRequestAutenticado("PUT", URL, { categoria: "DOXING", preguntas: SET_NUEVO })
        );
        expect(res.status).toBe(403);
    });
});
