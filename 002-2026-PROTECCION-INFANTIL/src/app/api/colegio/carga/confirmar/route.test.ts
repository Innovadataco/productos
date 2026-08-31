/**
 * SPEC-132 (S-4/O-2): confirmar lee el roster por id de sesión (sin PII en el
 * token) y lo consume single-use: la segunda confirmación no duplica.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearPlataforma,
    crearParametrosReportes,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import { crearSesionRoster } from "@/lib/colegio/carga/sesion-roster";
import { generarTokenCarga } from "@/lib/colegio/carga/token";
import type { FilaCargaEstudiante } from "@/lib/colegio/carga/parser";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function filasValidas(plataformaId: string): FilaCargaEstudiante[] {
    return [
        {
            fila: 2,
            curso: { nombre: "6A", grado: "Sexto", anioLectivo: "2026" },
            alumno: { nombre: "María", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "CONF-1" },
            identificador: { tipo: "telefono", valor: "+573001234567", etiquetaRelacion: "ESTUDIANTE", plataformaId },
        },
    ];
}

function requestConfirmar(tokenConfirmacion: string, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request("http://localhost:5005/api/colegio/carga/confirmar", {
        method: "POST",
        headers,
        body: JSON.stringify({ tokenConfirmacion }),
    });
}

describe("POST /api/colegio/carga/confirmar (SPEC-132)", () => {
    // SPEC-283 (002-PI-180): reset POR PRUEBA. Idem colegio-resumen: la
    // concurrencia entre archivos rompe el beforeAll (mutex por test, no por
    // archivo). Ver comentario largo en test-setup.ts sobre vitest 3.2.x.
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("confirma por id de sesión, consume el roster (single-use) y no duplica (O-2)", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const plat = await crearPlataforma("whatsapp", "WhatsApp");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const sesionId = await crearSesionRoster(colegio.id, filasValidas(plat.id));
        const token = await generarTokenCarga({ sesionId, colegioId: colegio.id });

        const primera = await POST(requestConfirmar(token, mockToken));
        expect(primera.status).toBe(201);

        // La sesión quedó borrada en la misma transacción del import.
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } })).toBeNull();
        const alumnosTrasPrimera = await prisma.estudiante.count({ where: { colegioId: colegio.id } });
        expect(alumnosTrasPrimera).toBe(1);

        // Segunda confirmación con el MISMO token: no duplica (sesión consumida).
        const segunda = await POST(requestConfirmar(token, mockToken));
        expect(segunda.status).toBe(400);
        const body = await segunda.json();
        expect(body.error.message).toContain("vuelve a validar");
        expect(await prisma.estudiante.count({ where: { colegioId: colegio.id } })).toBe(alumnosTrasPrimera);
    });

    it("rechaza una sesión de otro colegio (aislamiento)", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const plat = await crearPlataforma("whatsapp", "WhatsApp");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        // La FK de CargaRosterSesion exige un colegio real: se crea uno segundo
        // (la sesión ajena solo puede existir para un colegio que existe).
        const { pais: paisB, ciudad: ciudadB } = await crearPaisCiudad();
        const tenantB = await prisma.tenant.create({ data: { nombre: "Colegio B", estado: "activo" } });
        const colegioB = await prisma.colegio.create({
            data: {
                nombre: "Colegio B",
                nit: "NIT-COLEGIO-B",
                paisId: paisB.id,
                ciudadId: ciudadB.id,
                representanteLegalNombre: "Representante B",
                representanteLegalIdentificacion: "987654321",
                representanteLegalEmail: "rep-b@test.com",
                inicioServicio: new Date(),
                finServicio: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                tipoPeriodo: "ANUAL",
                estado: "activo",
                tenantId: tenantB.id,
            },
        });

        const sesionId = await crearSesionRoster(colegioB.id, filasValidas(plat.id));
        const token = await generarTokenCarga({ sesionId, colegioId: colegioB.id });

        const res = await POST(requestConfirmar(token, mockToken));
        expect(res.status).toBe(403);
        expect(await prisma.estudiante.count({ where: { colegioId: colegio.id } })).toBe(0);
    });

    it("rechaza un token sin sesión válida (vencida o inexistente)", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        const plat = await crearPlataforma("whatsapp", "WhatsApp");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        // Sesión del MISMO colegio pero vencida: pasa la guarda de tenant y cae en la de expiración.
        const sesionId = await crearSesionRoster(colegio.id, filasValidas(plat.id));
        await prisma.cargaRosterSesion.update({
            where: { id: sesionId },
            data: { expiraEn: new Date(Date.now() - 1000) },
        });
        const token = await generarTokenCarga({ sesionId, colegioId: colegio.id });

        const res = await POST(requestConfirmar(token, mockToken));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("vuelve a validar");
    });
});
