import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { errorToResponse, withErrorHandler } from "./api-handler";
import { AppError, ERROR_CODES } from "./errors";
import { ValidationError } from "./validation";

/**
 * Réplica EXACTA de la lógica legacy de los ~27 bloques catch que colapsaban
 * a 403 (ver spec 121). Sirve como oráculo de equivalencia: para los casos
 * legítimos el wrapper debe producir el mismo status y el mismo cuerpo.
 */
function legacyCatch(error: unknown): { status: number; body: unknown } {
    if (error instanceof AppError) {
        return { status: error.statusCode, body: error.toJSON() };
    }
    if (error instanceof Error && "code" in error && typeof error.code === "string") {
        return {
            status: 403,
            body: { error: { message: "Error interno", code: error.code } },
        };
    }
    return {
        status: 500,
        body: { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
    };
}

async function actual(error: unknown): Promise<{ status: number; body: unknown }> {
    const res = errorToResponse(error, "[TEST]");
    return { status: res.status, body: await res.json() };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("errorToResponse — equivalencia con la lógica legacy", () => {
    const casosLegitimos: [string, AppError][] = [
        ["400 VALIDATION_ERROR", new AppError("Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400)],
        ["401 AUTH_INVALID", new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401)],
        ["401 AUTH_EXPIRED", new AppError("Sesión expirada", ERROR_CODES.AUTH_EXPIRED, 401)],
        ["403 FORBIDDEN", new AppError("Sin permisos", ERROR_CODES.FORBIDDEN, 403)],
        ["404 NOT_FOUND", new AppError("No encontrado", ERROR_CODES.NOT_FOUND, 404)],
        ["409 CONFLICT", new AppError("Ya existe", ERROR_CODES.CONFLICT, 409)],
        ["429 RATE_LIMITED", new AppError("Demasiadas solicitudes", ERROR_CODES.RATE_LIMITED, 429)],
        ["500 INTERNAL_ERROR", new AppError("Fallo controlado", ERROR_CODES.INTERNAL_ERROR, 500)],
    ];

    it.each(casosLegitimos)("AppError %s: mismo status y mismo contrato que legacy", async (_nombre, appError) => {
        const legacy = legacyCatch(appError);
        const wrapper = await actual(appError);

        expect(wrapper.status).toBe(legacy.status);
        expect(wrapper.body).toEqual(legacy.body);
        expect(wrapper.body).toEqual({
            error: { message: appError.message, code: appError.code },
        });
    });

    it("ValidationError (Zod vía withValidation): mismo 400 con detalles que legacy", async () => {
        const validationError = new ValidationError("Datos inválidos", [
            { message: "Requerido", path: "nombre" },
        ]);
        const legacy = legacyCatch(validationError);
        const wrapper = await actual(validationError);

        expect(wrapper.status).toBe(400);
        expect(wrapper.status).toBe(legacy.status);
        expect(wrapper.body).toEqual(legacy.body);
        expect(wrapper.body).toEqual({
            error: {
                message: "Datos inválidos",
                code: ERROR_CODES.VALIDATION_ERROR,
                details: [{ message: "Requerido", path: "nombre" }],
            },
        });
    });

    it("Error plano sin code: mismo 500 genérico que legacy", async () => {
        const error = new Error("boom");
        const legacy = legacyCatch(error);
        vi.spyOn(console, "error").mockImplementation(() => {});
        const wrapper = await actual(error);

        expect(wrapper.status).toBe(500);
        expect(wrapper.status).toBe(legacy.status);
        expect(wrapper.body).toEqual(legacy.body);
    });

    it("valor no-Error (string, null, objeto plano con code): mismo 500 genérico que legacy", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const raro of ["fallo", null, { code: "P2002" }]) {
            const legacy = legacyCatch(raro);
            const wrapper = await actual(raro);
            expect(wrapper.status).toBe(legacy.status);
            expect(wrapper.body).toEqual(legacy.body);
        }
    });
});

describe("errorToResponse — el colapso indiscriminado a 403 desaparece", () => {
    it("Error con code (Prisma P2002): legacy daba 403 filtrando el código; ahora 500 genérico", async () => {
        const prismaLike = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        const legacy = legacyCatch(prismaLike);
        expect(legacy.status).toBe(403);
        expect(legacy.body).toEqual({ error: { message: "Error interno", code: "P2002" } });

        vi.spyOn(console, "error").mockImplementation(() => {});
        const wrapper = await actual(prismaLike);

        expect(wrapper.status).toBe(500);
        expect(wrapper.body).toEqual({
            error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR },
        });
        expect(JSON.stringify(wrapper.body)).not.toContain("P2002");
    });

    it("no expone error.message de excepciones internas al cliente", async () => {
        const interno = new Error('relation "usuarios" does not exist');
        vi.spyOn(console, "error").mockImplementation(() => {});
        const wrapper = await actual(interno);

        expect(wrapper.status).toBe(500);
        expect(JSON.stringify(wrapper.body)).not.toContain("usuarios");
        expect(wrapper.body).toEqual({
            error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR },
        });
    });

    it("registra el detalle en el log del servidor solo para errores no controlados", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        await actual(new Error("detalle interno sensible"));
        expect(spy).toHaveBeenCalledOnce();
        expect(String(spy.mock.calls[0][0])).toContain("detalle interno sensible");

        spy.mockClear();
        await actual(new AppError("Sin permisos", ERROR_CODES.FORBIDDEN, 403));
        expect(spy).not.toHaveBeenCalled();
    });
});

describe("errorToResponse — ZodError crudo", () => {
    it("mapea a 400 VALIDATION_ERROR con detalles { message, path }", async () => {
        const schema = z.object({ nombre: z.string().min(2), edad: z.number() });
        const resultado = schema.safeParse({ nombre: "x" });
        expect(resultado.success).toBe(false);
        if (resultado.success) return;

        const wrapper = await actual(resultado.error);

        expect(wrapper.status).toBe(400);
        const cuerpo = wrapper.body as { error: { message: string; code: string; details: unknown[] } };
        expect(cuerpo.error.message).toBe("Datos inválidos");
        expect(cuerpo.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
        expect(Array.isArray(cuerpo.error.details)).toBe(true);
        expect(cuerpo.error.details.length).toBeGreaterThan(0);
        expect(cuerpo.error.details[0]).toMatchObject({ path: expect.any(String) });
    });
});

describe("withErrorHandler", () => {
    it("deja pasar la respuesta exitosa del handler intacta", async () => {
        const handler = withErrorHandler(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
        const res = await handler(new Request("http://localhost:5005/api/test"));

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ ok: true });
    });

    it("AppError lanzado dentro del handler sale con su status y contrato", async () => {
        const handler = withErrorHandler(async () => {
            throw new AppError("Ya existe", ERROR_CODES.CONFLICT, 409);
        });
        const res = await handler(new Request("http://localhost:5005/api/test"));

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: { message: "Ya existe", code: ERROR_CODES.CONFLICT } });
    });

    it("error no controlado dentro del handler sale 500 genérico (no 403, sin fuga)", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const handler = withErrorHandler(async () => {
            throw Object.assign(new Error("secreto interno"), { code: "XX123" });
        });
        const res = await handler(new Request("http://localhost:5005/api/test"));

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body).toEqual({ error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } });
        expect(JSON.stringify(body)).not.toContain("XX123");
        expect(JSON.stringify(body)).not.toContain("secreto interno");
    });
});
