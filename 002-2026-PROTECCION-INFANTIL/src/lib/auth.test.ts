import { describe, it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword, isSecureRequest, getCookieName, sessionCookieAttributes } from "./auth";

describe("auth utils", () => {
    beforeEach(() => {
        delete process.env.COOKIE_SECURE;
    });

    it("hashes and verifies password", async () => {
        const hash = await hashPassword("password123");
        expect(await verifyPassword("password123", hash)).toBe(true);
        expect(await verifyPassword("wrong", hash)).toBe(false);
    });

    it("getCookieName usa nombre seguro cuando secure es true", () => {
        expect(getCookieName(true)).toBe("__Host-token");
        expect(getCookieName(false)).toBe("token");
    });

    it("sessionCookieAttributes refleja secure", () => {
        expect(sessionCookieAttributes(true)).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            path: "/",
        });
        expect(sessionCookieAttributes(false)).toEqual({
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
        });
    });

    it("isSecureRequest respeta COOKIE_SECURE", () => {
        process.env.COOKIE_SECURE = "true";
        expect(isSecureRequest(new Request("http://localhost/api"))).toBe(true);
        process.env.COOKIE_SECURE = "false";
        expect(isSecureRequest(new Request("https://example.com/api"))).toBe(false);
    });

    it("isSecureRequest usa x-forwarded-proto", () => {
        expect(
            isSecureRequest(
                new Request("http://localhost/api", { headers: { "x-forwarded-proto": "https" } })
            )
        ).toBe(true);
        expect(
            isSecureRequest(
                new Request("https://example.com/api", { headers: { "x-forwarded-proto": "http" } })
            )
        ).toBe(false);
    });

    it("isSecureRequest usa el protocolo de la URL", () => {
        expect(isSecureRequest(new Request("https://example.com/api"))).toBe(true);
        expect(isSecureRequest(new Request("http://example.com/api"))).toBe(false);
    });
});