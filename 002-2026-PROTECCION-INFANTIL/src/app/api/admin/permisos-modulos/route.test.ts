import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

async function crearModulo(clave: string, esCritico = false) {
    return prisma.moduloPermisible.create({
        data: { clave, nombre: clave, categoria: "admin", esCritico },
    });
}

async function seedPermiso(rol: string, moduloId: string, activo: boolean) {
    return prisma.permisoModulo.create({ data: { rol, moduloId, activo } });
}

function patchReq(cambios: unknown) {
    return crearRequestAutenticado("PATCH", "http://localhost/api/admin/permisos-modulos", { cambios });
}

describe("/api/admin/permisos-modulos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        vi.restoreAllMocks();
    });

    it("GET devuelve la matriz roles × módulos × permisos", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const modulo = await crearModulo("m1", true);
        await seedPermiso("ADMIN", modulo.id, true);

        const res = await GET(crearRequestAutenticado("GET", "http://localhost/api/admin/permisos-modulos", null));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.roles).toContain("ADMIN");
        expect(body.rolesProtegidos).toEqual(["ADMIN"]);
        expect(body.modulos.map((m: { clave: string }) => m.clave)).toContain("m1");
        const permisoM1 = body.permisos.find((p: { moduloId: string }) => p.moduloId === modulo.id);
        expect(permisoM1).toMatchObject({ rol: "ADMIN", moduloId: modulo.id, activo: true });
    });

    it("PATCH aplica cambios y registra auditoría", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const modulo = await crearModulo("m2");
        await seedPermiso("OPERADOR", modulo.id, false);

        const res = await PATCH(patchReq([{ rol: "OPERADOR", moduloId: modulo.id, activo: true }]));
        expect(res.status).toBe(200);

        const permiso = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "OPERADOR", moduloId: modulo.id } },
        });
        expect(permiso?.activo).toBe(true);
        expect(permiso?.actualizadoPorId).toBe(admin.id);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "PERMISOS_MODULO_ACTUALIZADOS" } });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("PATCH rechaza rol desconocido con 400 claro (sin fila fantasma)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const modulo = await crearModulo("m3");

        const res = await PATCH(patchReq([{ rol: "ADMN", moduloId: modulo.id, activo: true }]));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("ADMN");

        const filas = await prisma.permisoModulo.findMany({ where: { rol: "ADMN" } });
        expect(filas).toHaveLength(0);
    });

    it("PATCH anti-lockout: 409 si deja a los roles protegidos sin módulo crítico", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const critico = await crearModulo("critico", true);
        await seedPermiso("ADMIN", critico.id, true);

        const res = await PATCH(patchReq([{ rol: "ADMIN", moduloId: critico.id, activo: false }]));
        expect(res.status).toBe(409);

        const permiso = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: critico.id } },
        });
        expect(permiso?.activo).toBe(true); // no se aplicó
    });

    it("anti-lockout con 2 roles protegidos: permite si al menos uno conserva acceso", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        // SPEC-443: el arnés (sembrarPermisosDeProduccion) ya siembra este param con
        // ["ADMIN"]; el escenario lo lleva a ["ADMIN","SCHOOL_ADMIN"] con upsert.
        await prisma.parametroSistema.upsert({
            where: { clave: "seguridad.permisos_roles_protegidos" },
            update: { valor: JSON.stringify(["ADMIN", "SCHOOL_ADMIN"]) },
            create: {
                clave: "seguridad.permisos_roles_protegidos",
                valor: JSON.stringify(["ADMIN", "SCHOOL_ADMIN"]),
                tipo: "STRING_ARRAY",
                categoria: "SECURITY",
            },
        });
        const critico = await crearModulo("critico2", true);
        await seedPermiso("ADMIN", critico.id, true);
        await seedPermiso("SCHOOL_ADMIN", critico.id, true);

        // Desactivar solo ADMIN → permitido (SCHOOL_ADMIN conserva)
        const ok = await PATCH(patchReq([{ rol: "ADMIN", moduloId: critico.id, activo: false }]));
        expect(ok.status).toBe(200);

        // Desactivar también SCHOOL_ADMIN → 409
        const conflict = await PATCH(patchReq([{ rol: "SCHOOL_ADMIN", moduloId: critico.id, activo: false }]));
        expect(conflict.status).toBe(409);
    });

    // SPEC-435 (Jelkin vivo 04-09) · anti-crecimiento para roles cerrados. La
    // refutación adversarial cazó que el candado `verificador-modulos` era
    // cosmético — el ADMIN podía contaminar VERIFICADOR desde la UI. Este par
    // de tests bloquea el vector en runtime.
    it("PATCH · 409 si intenta activar un módulo prohibido a un rol cerrado (VERIFICADOR)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        // SPEC-443: en el mapa real VERIFICADOR NO tiene "operadores" (sin fila) —
        // ese es el estado de partida real; el guard debe rechazar activarlo.
        const operadores = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave: "operadores" } });

        const res = await PATCH(patchReq([{ rol: "VERIFICADOR", moduloId: operadores.id, activo: true }]));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.message).toContain("VERIFICADOR");
        expect(body.error.message).toContain("operadores");

        const fila = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "VERIFICADOR", moduloId: operadores.id } },
        });
        // El guard rechazó ANTES del upsert: VERIFICADOR sigue sin acceso activo (fila ausente).
        expect(fila?.activo ?? false).toBe(false);
    });

    it("PATCH · 409 si intenta desactivar el único módulo permitido de un rol cerrado", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const suyo = await prisma.moduloPermisible.findUniqueOrThrow({ where: { clave: "admin_verificacion_profesionales" } });

        const res = await PATCH(patchReq([{ rol: "VERIFICADOR", moduloId: suyo.id, activo: false }]));
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.message).toContain("VERIFICADOR");

        const fila = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: "VERIFICADOR", moduloId: suyo.id } },
        });
        expect(fila?.activo).toBe(true);
    });

    it("GET/PATCH rechazan no-ADMIN", async () => {
        const operador = await crearUsuario("OPERADOR");
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new (await import("@/lib/errors")).AppError("Permisos insuficientes", "FORBIDDEN" as never, 403));

        const res = await GET(crearRequestAutenticado("GET", "http://localhost/api/admin/permisos-modulos", null));
        expect(res.status).toBe(403);
        expect(operador).toBeDefined();
    });
});
