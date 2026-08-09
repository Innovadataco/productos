/**
 * SPEC-149 (T005, FR-007/FR-009): tests de GET/PATCH /api/colegio/preferencias-avisos.
 * A/B con dos colegios: B nunca ve ni pisa lo de A. Upsert único por
 * {colegioId, tipoEvento} (nunca defaults duplicados). Audit en cada cambio.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/preferencias-avisos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET sin filas devuelve los 4 tipos con los defaults de la spec y el email del SCHOOL_ADMIN", async () => {
        const { admin } = await setupSchoolAdmin();

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/preferencias-avisos", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.emailPorDefecto).toBe(admin.email);
        expect(json.items).toHaveLength(4);
        const porTipo = Object.fromEntries(json.items.map((i: { tipoEvento: string }) => [i.tipoEvento, i]));
        expect(porTipo.REPORTE_NUEVO).toMatchObject({ habilitado: true, emailDestino: null, emailEfectivo: admin.email });
        expect(porTipo.UMBRAL_CURSO).toMatchObject({ habilitado: true, umbral: 3, ventanaDias: 7 });
        expect(porTipo.ESTUDIANTE_REPETIDO).toMatchObject({ habilitado: true, umbral: 2, ventanaDias: 30 });
        expect(porTipo.RESUMEN_SEMANAL).toMatchObject({ habilitado: true });
    });

    it("PATCH hace upsert por tipo (nunca duplica), audita y el siguiente GET refleja el cambio", async () => {
        const { colegio } = await setupSchoolAdmin();
        const url = "http://localhost:5005/api/colegio/preferencias-avisos";

        const patch1 = await PATCH(request("PATCH", url, { tipoEvento: "UMBRAL_CURSO", umbral: 2, ventanaDias: 5 }, mockToken));
        expect(patch1.status).toBe(200);
        const json1 = await patch1.json();
        expect(json1.item).toMatchObject({ tipoEvento: "UMBRAL_CURSO", habilitado: true, umbral: 2, ventanaDias: 5 });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_AVISO_PREFERENCIA_ACTUALIZADA", colegioId: colegio.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorNuevo).toContain("UMBRAL_CURSO");

        // Segundo PATCH sobre el mismo tipo: actualiza la MISMA fila.
        const patch2 = await PATCH(request("PATCH", url, { tipoEvento: "UMBRAL_CURSO", habilitado: false }, mockToken));
        expect(patch2.status).toBe(200);
        const filas = await prisma.preferenciaAlertaColegio.findMany({ where: { colegioId: colegio.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].habilitado).toBe(false);
        expect(filas[0].umbral).toBe(2); // campo ausente ≡ no tocarlo

        const getRes = await GET(request("GET", url, undefined, mockToken));
        const getJson = await getRes.json();
        const umbralCurso = getJson.items.find((i: { tipoEvento: string }) => i.tipoEvento === "UMBRAL_CURSO");
        expect(umbralCurso).toMatchObject({ habilitado: false, umbral: 2, ventanaDias: 5 });
    });

    it("PATCH con emailDestino válido lo fija como destino efectivo; null vuelve al default", async () => {
        const { admin } = await setupSchoolAdmin();
        const url = "http://localhost:5005/api/colegio/preferencias-avisos";

        await PATCH(request("PATCH", url, { tipoEvento: "REPORTE_NUEVO", emailDestino: "rectoria@colegio.edu.co" }, mockToken));
        let getRes = await GET(request("GET", url, undefined, mockToken));
        let item = (await getRes.json()).items.find((i: { tipoEvento: string }) => i.tipoEvento === "REPORTE_NUEVO");
        expect(item.emailEfectivo).toBe("rectoria@colegio.edu.co");

        await PATCH(request("PATCH", url, { tipoEvento: "REPORTE_NUEVO", emailDestino: null }, mockToken));
        getRes = await GET(request("GET", url, undefined, mockToken));
        item = (await getRes.json()).items.find((i: { tipoEvento: string }) => i.tipoEvento === "REPORTE_NUEVO");
        expect(item.emailDestino).toBeNull();
        expect(item.emailEfectivo).toBe(admin.email);
    });

    it("rechaza email mal formado y umbrales fuera de rango (400)", async () => {
        await setupSchoolAdmin();
        const url = "http://localhost:5005/api/colegio/preferencias-avisos";

        const resEmail = await PATCH(request("PATCH", url, { tipoEvento: "REPORTE_NUEVO", emailDestino: "no-es-email" }, mockToken));
        expect(resEmail.status).toBe(400);

        const resUmbral = await PATCH(request("PATCH", url, { tipoEvento: "UMBRAL_CURSO", umbral: 0 }, mockToken));
        expect(resUmbral.status).toBe(400);

        const resVentana = await PATCH(request("PATCH", url, { tipoEvento: "UMBRAL_CURSO", ventanaDias: 91 }, mockToken));
        expect(resVentana.status).toBe(400);

        const resTipo = await PATCH(request("PATCH", url, { tipoEvento: "TIPO_INVENTADO" }, mockToken));
        expect(resTipo.status).toBe(400);
    });

    it("A/B: el colegio B no ve las preferencias del colegio A y su PATCH no pisa las de A", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        const url = "http://localhost:5005/api/colegio/preferencias-avisos";
        await PATCH(request("PATCH", url, { tipoEvento: "REPORTE_NUEVO", habilitado: false, emailDestino: "a@colegio.edu.co" }, mockToken));

        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const getB = await GET(request("GET", url, undefined, mockToken));
        const jsonB = await getB.json();
        const reporteNuevoB = jsonB.items.find((i: { tipoEvento: string }) => i.tipoEvento === "REPORTE_NUEVO");
        // B ve SUS defaults, no la fila de A.
        expect(reporteNuevoB).toMatchObject({ habilitado: true, emailDestino: null, emailEfectivo: adminB.email });

        await PATCH(request("PATCH", url, { tipoEvento: "REPORTE_NUEVO", habilitado: true }, mockToken));

        const filaA = await prisma.preferenciaAlertaColegio.findUnique({
            where: { colegioId_tipoEvento: { colegioId: colegioA.id, tipoEvento: "REPORTE_NUEVO" } },
        });
        expect(filaA?.habilitado).toBe(false);
        expect(filaA?.emailDestino).toBe("a@colegio.edu.co");
        const filaB = await prisma.preferenciaAlertaColegio.findUnique({
            where: { colegioId_tipoEvento: { colegioId: colegioB.id, tipoEvento: "REPORTE_NUEVO" } },
        });
        expect(filaB?.habilitado).toBe(true);
    });

    it("sin sesión devuelve 401", async () => {
        const res = await GET(request("GET", "http://localhost:5005/api/colegio/preferencias-avisos", undefined));
        expect(res.status).toBe(401);
    });
});
