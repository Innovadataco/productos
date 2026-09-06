/**
 * C12 · SPEC-519 (antes tests/e2e/admin-comite-abrir-caso.spec.ts) — el comité de
 * validación abre casos, pero el árbol de módulos manda.
 *
 * POR QUÉ ESTÁ ACÁ Y NO EN tests/e2e/**:
 *  - El e2e no corre en CI (ci.yml no tiene job de playwright) → era un candado
 *    que no se disparaba solo.
 *  - Y sembraba un ROL INVENTADO (`E2E_C12_ROL_<uuid>`) para aislarse de la base
 *    COMPARTIDA. Con el enum `RolUsuario` en `PermisoModulo.rol` (SPEC-509) eso
 *    deja de compilar/insertarse.
 *  Al mudarlo a integración la base es PROPIA y se resetea, así que se usa el ROL
 *  REAL + MÓDULOS REALES y se REVOCA el grant para provocar el deny — sin pisar a
 *  nadie y aterrizando el enum. Además prueba que el ENDPOINT siga cableado al
 *  resolver: si una ruta deja de llamar a `assertAnyModulo`, este test cae (un
 *  test de `puedeAccederAModulo` a secas no lo cazaría).
 *
 * Origen operativo (I-278/I-279/I-275, 03-09): en prod el comité no abría NINGÚN
 * caso porque `PermisoModulo{rol:COMITE_VALIDACION, modulo:comite_bandeja}` estaba
 * activo=false con el padre `comite` en activo=true. El árbol AND deniega.
 *
 * TOKEN REAL (no mockea verifyAuth); solo se inyecta la cookie, como SPEC-452.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { syncModulosYGrants } from "../../../../../../prisma/seed-modulos-grants";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://localhost:5005/api/admin/reportes-revision/x");

async function plataformaId(): Promise<string> {
    const p = await prisma.plataforma.findFirst({ select: { id: true } });
    if (!p) throw new Error("No hay Plataforma sembrada (corre prisma db seed)");
    return p.id;
}

async function crearReporteDeComite(comiteId: string, sufijo: string): Promise<string> {
    const r = await prisma.reporte.create({
        data: {
            identificador: `c12-${sufijo}`,
            plataformaId: await plataformaId(),
            texto: `c12 ${sufijo}: reporte del candado de gating`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-C12-${sufijo}-${randomUUID().slice(0, 6).toUpperCase()}`,
            estado: "REVISION_MANUAL",
            comiteId,
        },
    });
    return r.id;
}

/** Revoca (activo=false) un grant REAL del comité por clave de módulo. */
async function desactivarModuloComite(clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave }, select: { id: true } });
    if (!modulo) throw new Error(`módulo '${clave}' no existe (corre prisma db seed / syncModulosYGrants)`);
    await prisma.permisoModulo.updateMany({
        where: { rol: "COMITE_VALIDACION", moduloId: modulo.id },
        data: { activo: false },
    });
}

async function comiteConToken() {
    const comite = await crearUsuario("COMITE_VALIDACION");
    mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
    return comite;
}

describe("C12 · SPEC-519 · el comité abre su caso, y el árbol de módulos lo gatea", () => {
    beforeEach(async () => {
        await resetDatabase();
        // Mapa REAL de grants (no el arnés permisivo): comité = comite + comite_bandeja.
        await prisma.permisoModulo.deleteMany();
        await syncModulosYGrants(prisma);
        mockToken = undefined;
    });

    it("A · el comité abre su caso PROPIO → 200", async () => {
        const comite = await comiteConToken();
        const id = await crearReporteDeComite(comite.id, "propio");
        const res = await GET(req(), params(id));
        expect(res.status).toBe(200);
    });

    it("B · el comité NO abre un caso AJENO → 403 «No tiene permiso para ver este caso»", async () => {
        const comite = await comiteConToken();
        const otro = await crearUsuario("COMITE_VALIDACION");
        const id = await crearReporteDeComite(otro.id, "ajeno");
        const res = await GET(req(), params(id));
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toBe("No tiene permiso para ver este caso");
    });

    it("D · hijo `comite_bandeja` apagado con padre `comite` activo → 403 (candado I-278)", async () => {
        const comite = await comiteConToken();
        const id = await crearReporteDeComite(comite.id, "d");
        await desactivarModuloComite("comite_bandeja");
        const res = await GET(req(), params(id));
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toBe("Sin acceso al módulo");
    });

    it("E · padre `comite` apagado con hijo `comite_bandeja` activo → 403 (agujero jerárquico)", async () => {
        const comite = await comiteConToken();
        const id = await crearReporteDeComite(comite.id, "e");
        await desactivarModuloComite("comite");
        const res = await GET(req(), params(id));
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error?: { message?: string } };
        expect(body.error?.message).toBe("Sin acceso al módulo");
    });
});
