/**
 * SPEC-587 — GET /api/auth/oauth/google (arranque, integración con BD real
 * por el rate limit). Redirige 302 a accounts.google.com y sella la cookie
 * httpOnly del state (10 min).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

describe("GET /api/auth/oauth/google (SPEC-587)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        process.env.GOOGLE_CLIENT_ID ??= "test-client-id-google";
        if (rateLimitDisabled) process.env.DISABLE_RATE_LIMIT = "false";
    });

    afterEach(() => {
        if (rateLimitDisabled) process.env.DISABLE_RATE_LIMIT = "true";
    });

    it("redirige 302 a accounts.google.com con state y sella la cookie oauth_state", async () => {
        const res = await GET(new Request("http://localhost:5005/api/auth/oauth/google", {
            method: "GET",
            headers: { "X-Forwarded-For": "203.0.113.60" },
        }));

        expect(res.status).toBe(302);
        const location = res.headers.get("location") ?? "";
        expect(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
        const params = new URL(location).searchParams;
        expect(params.get("client_id")).toBe("test-client-id-google");
        expect(params.get("state")).toBeTruthy();
        expect(params.get("redirect_uri")).toBe("http://localhost:5005/api/auth/oauth/google/callback");

        const setCookie = res.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("oauth_state=");
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("Max-Age=600");
    });
});
