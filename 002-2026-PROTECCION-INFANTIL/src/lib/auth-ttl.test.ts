import { describe, it, expect, beforeEach } from "vitest";
import { createToken } from "./auth";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { decodeJwt } from "jose";

describe("JWT TTL desde parámetro (spec 095-US2, D-21)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("usa security.jwt_ttl_hours del parámetro cuando existe", async () => {
        await prisma.parametroSistema.create({
            data: { clave: "security.jwt_ttl_hours", valor: "1", tipo: "INTEGER", categoria: "SECURITY" },
        });
        const token = await createToken({ sub: "u1", rol: "ADMIN" });
        const { exp, iat } = decodeJwt(token);
        expect((exp ?? 0) - (iat ?? 0)).toBe(3600);
    });

    it("fallback seguro 24h cuando el parámetro no existe", async () => {
        const token = await createToken({ sub: "u1", rol: "ADMIN" });
        const { exp, iat } = decodeJwt(token);
        expect((exp ?? 0) - (iat ?? 0)).toBe(24 * 3600);
    });

    it("fallback seguro 24h cuando el parámetro es inválido", async () => {
        await prisma.parametroSistema.create({
            data: { clave: "security.jwt_ttl_hours", valor: "abc", tipo: "STRING", categoria: "SECURITY" },
        });
        const token = await createToken({ sub: "u1", rol: "ADMIN" });
        const { exp, iat } = decodeJwt(token);
        expect((exp ?? 0) - (iat ?? 0)).toBe(24 * 3600);
    });
});
