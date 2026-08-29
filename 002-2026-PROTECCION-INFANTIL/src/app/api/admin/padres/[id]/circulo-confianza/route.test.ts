import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import * as routeModule from "./route";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import {
    findAuditNuevaAccion,
    ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN,
} from "@/lib/audit-nuevas-acciones";
import type { RolUsuario } from "@prisma/client";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

function getCirculo(padreId: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (activeToken) headers.cookie = `token=${activeToken}`;
    return GET(new Request(`http://localhost:5005/api/admin/padres/${padreId}/circulo-confianza`, { headers }), {
        params: Promise.resolve({ id: padreId }),
    });
}

async function revocarModulo(rol: RolUsuario, clave: string) {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    await prisma.permisoModulo.update({
        where: { rol_moduloId: { rol, moduloId: modulo!.id } },
        data: { activo: false },
    });
}

async function crearPadreConCirculo() {
    const plataforma = await crearPlataforma();
    const padre = await crearUsuario("PARENT", "padre-circulo@example.com");
    const contacto = await prisma.contactoConfianza.create({
        data: {
            usuarioId: padre.id,
            etiqueta: "Mamá de prueba",
            nota: "Nota de soporte",
            identificadores: {
                create: [
                    { valor: "+573001234567", tipo: "telefono", plataformaId: plataforma.id },
                    { valor: "nick_prueba", tipo: "nick" },
                ],
            },
        },
        include: { identificadores: true },
    });
    return { padre, contacto, plataforma };
}

describe("GET /api/admin/padres/[id]/circulo-confianza (SPEC-141, N-1)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin token; 403 para PARENT ajeno, SCHOOL_ADMIN y OPERADOR", async () => {
        const { padre } = await crearPadreConCirculo();
        expect((await getCirculo(padre.id)).status).toBe(401);

        for (const rol of ["PARENT", "SCHOOL_ADMIN", "OPERADOR"] as const) {
            const usuario = await crearUsuario(rol);
            activeToken = await crearTokenUsuario(usuario.id, rol);
            expect((await getCirculo(padre.id)).status).toBe(403);
        }
    });

    it("403 para ADMIN sin el módulo soporte_lectura (denegar por defecto)", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "soporte_lectura");
        const { padre } = await crearPadreConCirculo();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getCirculo(padre.id)).status).toBe(403);
    });

    it("404 si el id no existe o no es PARENT (no oráculo)", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getCirculo("c".padEnd(25, "1"))).status).toBe(404);
        expect((await getCirculo(operador.id)).status).toBe(404);
    });

    it("200: mismo contenido que ve el dueño (contactos + identificadores + estado) y UNA fila de auditoría sin PII", async () => {
        const admin = await crearUsuario("ADMIN");
        const { padre } = await crearPadreConCirculo();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getCirculo(padre.id);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.contactos).toHaveLength(1);
        const contacto = body.contactos[0];
        expect(contacto.etiqueta).toBe("Mamá de prueba");
        expect(contacto.estado).toBe("sinReportes");
        expect(contacto.identificadores).toHaveLength(2);
        const valores = contacto.identificadores.map((i: { valor: string }) => i.valor).sort();
        expect(valores).toEqual(["+573001234567", "nick_prueba"]);
        expect(body.resumen.activos).toBe(1);

        // US3: exactamente una fila AuditLog, sin valores de identificadores en metadatos.
        const eventos = await findAuditNuevaAccion(ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN, { recursoId: padre.id });
        expect(eventos).toHaveLength(1);
        expect(eventos[0].usuarioId).toBe(admin.id);
        const metadatos = JSON.stringify(eventos[0].metadatos);
        expect(metadatos).not.toContain("+573001234567");
        expect(metadatos).not.toContain("nick_prueba");
        expect(metadatos).not.toContain("Mamá de prueba");
        expect(eventos[0].metadatos).toMatchObject({ contactos: 1 });
    });

    it("200 con padre sin contactos: lista vacía (no es error) y también audita", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre-vacio@example.com");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getCirculo(padre.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.contactos).toEqual([]);

        const eventos = await findAuditNuevaAccion(ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN, { recursoId: padre.id });
        expect(eventos).toHaveLength(1);
    });

    it("un acceso denegado (403/404) NO genera fila de auditoría", async () => {
        const admin = await crearUsuario("ADMIN");
        await revocarModulo("ADMIN", "soporte_lectura");
        const { padre } = await crearPadreConCirculo();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await getCirculo(padre.id)).status).toBe(403);
        expect((await getCirculo("c".padEnd(25, "1"))).status).toBe(403); // guard antes del 404

        const eventos = await findAuditNuevaAccion(ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN);
        expect(eventos).toHaveLength(0);
    });

    it("SC-004: la ruta NO exporta verbos de escritura (cero mutaciones para ADMIN)", () => {
        const verbos = Object.keys(routeModule).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k));
        expect(verbos).toEqual([]);
    });
});
