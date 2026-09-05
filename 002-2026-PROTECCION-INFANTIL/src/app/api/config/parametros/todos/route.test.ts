import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

describe("GET /api/config/parametros/todos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("ADMIN → 200 con todos los parámetros sin paginación", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        // SPEC-443: el arnés siembra `seguridad.permisos_roles_protegidos`; limpiamos para
        // controlar el conteo exacto del escenario (3 params).
        await prisma.parametroSistema.deleteMany();
        // Sembrar 3 parámetros en distintas categorías para validar orden y ausencia de paginación.
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "visibility.report_threshold", valor: "3", tipo: "INTEGER", categoria: "VISIBILITY", esPublico: true },
                { clave: "security.rate_limit_window_ms", valor: "60000", tipo: "INTEGER", categoria: "SECURITY", esPublico: false },
                { clave: "system.ollama_base_url", valor: "http://localhost:11435", tipo: "STRING", categoria: "SYSTEM", esPublico: false },
            ],
        });

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("items");
        expect(body).not.toHaveProperty("pagination");
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items).toHaveLength(3);
        // Orden por CategoriaParametro asc (orden de declaración del enum en Postgres):
        // VISIBILITY, SECURITY, LEGAL, EMAIL, SYSTEM.
        expect(body.items[0].categoria).toBe("VISIBILITY");
        expect(body.items[1].categoria).toBe("SECURITY");
        expect(body.items[2].categoria).toBe("SYSTEM");
    });

    it("no-ADMIN → 403", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403)
        );

        const res = await GET();
        expect(res.status).toBe(403);
    });
});
