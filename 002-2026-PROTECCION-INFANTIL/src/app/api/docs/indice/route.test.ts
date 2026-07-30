/**
 * SPEC-017 — GET /api/docs/indice: el índice JSON se filtra por el acceso del
 * llamante (divulgación progresiva). Tokens firmados en memoria (sin BD).
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { GET } from "./route";

async function tokenParaRol(rol: string): Promise<string> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    return new SignJWT({ sub: "test-docs-indice", rol })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);
}

function requestIndice(token?: string): Request {
    return new Request("http://localhost:5005/api/docs/indice", {
        headers: token ? { cookie: `token=${token}` } : {},
    });
}

describe("GET /api/docs/indice (SPEC-017)", () => {
    it("anónimo: solo capa 1", async () => {
        const res = await GET(requestIndice());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.autenticado).toBe(false);
        expect(body.temas.length).toBeGreaterThan(0);
        expect(body.temas.every((t: { capa: number }) => t.capa === 1)).toBe(true);
    });

    it("PARENT autenticado: capas 1 y 2", async () => {
        const res = await GET(requestIndice(await tokenParaRol("PARENT")));
        const body = await res.json();
        expect(body.autenticado).toBe(true);
        const capas = new Set(body.temas.map((t: { capa: number }) => t.capa));
        expect(capas.has(1)).toBe(true);
        expect(capas.has(2)).toBe(true);
        expect(capas.has(3)).toBe(false);
    });

    it("ADMIN: las 3 capas", async () => {
        const res = await GET(requestIndice(await tokenParaRol("ADMIN")));
        const body = await res.json();
        const capas = new Set(body.temas.map((t: { capa: number }) => t.capa));
        expect(capas.has(3)).toBe(true);
    });
});
