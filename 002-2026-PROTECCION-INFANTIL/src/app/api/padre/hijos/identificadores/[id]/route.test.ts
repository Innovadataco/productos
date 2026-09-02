/**
 * SPEC-363 (I-259) — La bitácora del menor puede atar los hitos de identificador
 * al menor correcto.
 *
 * El `recursoId` de estos audits es el del IDENTIFICADOR, no el del hijo. Sin un
 * `hijoId` en el valor, la bitácora del menor (F10) no sabe de qué menor era la
 * cuenta que se activó, pausó o quitó — y en el caso de "quitar" la fila ya no
 * existe para preguntarle. Estos tests recorren las rutas REALES y afirman que el
 * audit lleva `hijoId`, nunca el valor del identificador (PII).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { PATCH, DELETE } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { registrarHijo, agregarIdentificador } from "@/lib/dal/services/hijos";

function reqPatch(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
    return [
        new Request(`http://localhost:5005/api/padre/hijos/identificadores/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) },
    ];
}

function reqDelete(id: string): [Request, { params: Promise<{ id: string }> }] {
    return [
        new Request(`http://localhost:5005/api/padre/hijos/identificadores/${id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id }) },
    ];
}

const VALOR_PII = "anaroblox2011";

async function sembrarMenorConIdentificador() {
    const padre = await crearUsuario("PARENT");
    mockToken = await crearTokenUsuario(padre.id, "PARENT");
    const { hijoId } = await registrarHijo(padre.id, {
        nombre: "Ana",
        apellidos: "Ramírez",
        documentoTipo: "TI",
        documentoNumero: "1030512345",
    });
    await agregarIdentificador(padre.id, hijoId, { valor: VALOR_PII });
    const ident = await prisma.identificadorHijo.findFirstOrThrow({ where: { hijoId } });
    return { padre, hijoId, identId: ident.id };
}

describe("identificadores del menor · el audit lleva hijoId (SPEC-363 · I-259)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        mockToken = undefined;
    });

    it("PATCH activo/inactivo audita { hijoId, activo } — se puede atar al menor", async () => {
        const { hijoId, identId } = await sembrarMenorConIdentificador();

        expect((await PATCH(...reqPatch(identId, { activo: false }))).status).toBe(200);
        expect((await PATCH(...reqPatch(identId, { activo: true }))).status).toBe(200);

        const audits = await prisma.auditLog.findMany({
            where: { tipoRecurso: "IdentificadorHijo", recursoId: identId },
            orderBy: { creadoEn: "asc" },
        });
        const valores = audits.map((a) => JSON.parse(a.valorNuevo ?? "{}"));
        expect(valores).toContainEqual({ hijoId, activo: false });
        expect(valores).toContainEqual({ hijoId, activo: true });
        // El valor del identificador (PII) nunca entra al log.
        expect(JSON.stringify(audits)).not.toContain(VALOR_PII);
    });

    it("DELETE (quitar la cuenta) audita { hijoId } aunque la fila se borre — sin PII", async () => {
        const { hijoId, identId } = await sembrarMenorConIdentificador();

        expect((await DELETE(...reqDelete(identId))).status).toBe(200);
        // La fila ya no existe.
        expect(await prisma.identificadorHijo.findUnique({ where: { id: identId } })).toBeNull();

        const audit = await prisma.auditLog.findFirstOrThrow({
            where: { accion: "HIJO_IDENTIFICADOR_DESVINCULADO", recursoId: identId },
        });
        expect(JSON.parse(audit.valorNuevo ?? "{}")).toEqual({ hijoId });
        expect(audit.valorNuevo ?? "").not.toContain(VALOR_PII);
    });
});
