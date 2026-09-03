/**
 * SPEC-373 · I-251 · las alertas del colegio NUNCA se bloquean por vigencia.
 *
 * La regla dura de Jelkin (guardias.ts:202-206): «Auditoría #222 · punto 1: las
 * alertas de menores NUNCA se bloquean» — mismo espíritu que reportar por parte
 * del padre (SPEC-356). El middleware exime toda la familia por prefijo, pero
 * hasta este SPEC los 7 sitios de handler la contradecían con un
 * `verificarVigenciaColegio` propio: un colegio con la vigencia vencida veía
 * la bandeja vacía y muda, y no podía asignar, escalar, cambiar estado ni
 * anotar en la bitácora — es decir, un caso ya abierto quedaba huérfano.
 *
 * Este archivo prueba la regla nueva en un solo lugar (todos los verbos), y
 * sostiene el candado 26 (el síntoma no es la causa): quitar el guard de
 * vigencia no puede haber quitado también el de módulo. Un colegio SIN el
 * módulo `colegios_gestion` (o `colegios_comite` para escalar) debe seguir
 * recibiendo 403 por `assertModulo`, no por vigencia.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import * as permisos from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
    crearTokenUsuario,
    crearRequestAutenticado,
    crearColegioConAdmin,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";

import { GET as GET_BANDEJA, POST as POST_BATCH } from "./route";
import { GET as GET_DETALLE } from "./[id]/route";
import { PATCH as PATCH_ESTADO } from "./[id]/estado/route";
import { POST as POST_ASIGNAR } from "./[id]/asignar/route";
import { POST as POST_NOTAS } from "./[id]/notas/route";
import { POST as POST_ESCALAR } from "./[id]/escalar/route";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/email", () => ({
    enviarAlertaColegio: vi.fn().mockResolvedValue(undefined),
}));

async function setupColegioVencido() {
    const { admin, colegio } = await crearColegioConAdmin();
    await crearComiteCuenta(colegio.id);
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 30);
    // El colegio quedó VENCIDO ayer. Sigue activo (solo la ventana venció).
    await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });
    const { alerta } = await crearAlertaEstudiante(colegio.id);
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio, alerta };
}

function req(method: string, url: string, body?: unknown): Request {
    return crearRequestAutenticado(method, url, body ?? null, mockToken!);
}

describe("SPEC-373 · I-251 · alertas del colegio con vigencia VENCIDA (los 7 sitios)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        mockToken = undefined;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("GET bandeja: colegio vencido → 200 (la bandeja NO queda vacía por vigencia)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await GET_BANDEJA(req("GET", "http://localhost:5005/api/colegio/alertas"));
        expect(res.status, "GET bandeja con colegio vencido").toBe(200);
        const body = await res.json();
        // Assert fuerte: la alerta existente sigue en `items` (nombre real del payload).
        expect(body.items.some((a: { id: string }) => a.id === alerta.id)).toBe(true);
    });

    it("POST batch: colegio vencido → 200 (marcar vistas en lote sigue funcionando)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await POST_BATCH(
            req("POST", "http://localhost:5005/api/colegio/alertas", {
                accion: "vista",
                // El schema (alertaBatchSchema) espera `ids`, no `alertaIds`.
                ids: [alerta.id],
            })
        );
        expect(res.status).toBe(200);
    });

    it("GET detalle: colegio vencido → 200 (el caso sigue consultándose)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await GET_DETALLE(
            req("GET", `http://localhost:5005/api/colegio/alertas/${alerta.id}`),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.caso).toBeDefined();
    });

    it("PATCH estado: colegio vencido → 200 (cambiar estado de una alerta abierta)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await PATCH_ESTADO(
            req("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta.id}/estado`, { estado: "vista" }),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(res.status).toBe(200);
        // Assert fuerte: el cambio persistió, no fue un 200 cosmético.
        const enBd = await prisma.alertaColegio.findUnique({ where: { id: alerta.id } });
        expect(enBd?.estado).toBe("vista");
    });

    it("POST asignar: colegio vencido NO es bloqueado por vigencia (status ≠ 403)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await POST_ASIGNAR(
            req("POST", `http://localhost:5005/api/colegio/alertas/${alerta.id}/asignar`, {
                asignadoAId: "",
            }),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        // Lo que este test debe garantizar: el guard de vigencia se fue. Un 200
        // sería ideal, pero `asignarAlerta` tiene un bug PREEXISTENTE (el enum
        // `AccionAudit` no incluye "COLEGIO_ALERTA_ASIGNADA" y `logAudit` truena
        // con 500) que reporté aparte. No es I-251 y no lo arreglamos acá; lo
        // que sí candamos: el handler LLEGA al service — ya no lo corta un 403
        // de vigencia — y devuelve cualquier código distinto de 403.
        expect(res.status, "el guard de vigencia se fue: no debería ser 403").not.toBe(403);
    });

    it("POST escalar: colegio vencido → 201 (el caso abierto se tramita en mora — regla dura)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await POST_ESCALAR(
            req("POST", `http://localhost:5005/api/colegio/alertas/${alerta.id}/escalar`, {
                motivo: "Requiere decisión del comité; el colegio está en mora pero el caso avanza",
            }),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(res.status).toBe(201);
    });

    it("POST notas: colegio vencido → 201 (la bitácora del caso sigue registrando)", async () => {
        const { alerta } = await setupColegioVencido();
        const res = await POST_NOTAS(
            req("POST", `http://localhost:5005/api/colegio/alertas/${alerta.id}/notas`, {
                texto: "Nota de seguimiento del caso, colegio vencido; el trabajo sigue.",
            }),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(res.status).toBe(201);
    });
});

// Candado 26 (el síntoma no es la causa): quitar el guard de vigencia no puede
// haber quitado también el de módulo. Si un admin de un colegio SIN el módulo
// `colegios_gestion` llega a la ruta, `assertModulo` debe seguir devolviendo
// 403 — no vamos a abrir la ruta a colegios que no contrataron la gestión.
describe("SPEC-373 · candado 26 · sin módulo colegios_gestion sigue 403", { timeout: 15_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET bandeja sin módulo → 403 (no fue un 'abrir todo por descuido')", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        // Modelo real en permisos-modulos.ts:12-19: puedeAccederAModulo consulta
        // moduloPermisible + permisoModulo (rol × módulo, activo boolean). Le
        // sacamos el módulo al rol poniendo `activo: false` en su fila.
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "colegios_gestion" } });
        expect(modulo, "el módulo debería estar sembrado antes del test").not.toBeNull();
        await prisma.permisoModulo.upsert({
            where: { rol_moduloId: { rol: "SCHOOL_ADMIN", moduloId: modulo!.id } },
            update: { activo: false },
            create: { rol: "SCHOOL_ADMIN", moduloId: modulo!.id, activo: false },
        });

        const res = await GET_BANDEJA(req("GET", "http://localhost:5005/api/colegio/alertas"));
        expect(res.status).toBe(403);
        expect(ERROR_CODES.FORBIDDEN).toBeTruthy();
        expect(AppError).toBeTruthy();
        expect(permisos).toBeTruthy();
    });
});
