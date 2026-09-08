/**
 * SPEC-587 — unitarios de src/lib/auth-oauth.ts (sin BD).
 *
 * Firma/verificación del state OAuth: válido, expirado, con payload alterado,
 * con firma alterada y mal formado; y la auth URL de Google (scope, prompt).
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
    buildGoogleAuthUrl,
    firmarState,
    OAUTH_STATE_TTL_SEG,
    verificarState,
} from "./auth-oauth";

beforeAll(() => {
    process.env.JWT_SECRET ??= "test-secret-oauth-de-32-caracteres-minimo!!";
    process.env.GOOGLE_CLIENT_ID ??= "test-client-id-google";
});

describe("auth-oauth · state (SPEC-587)", () => {
    it("state firmado verifica contra sí mismo", () => {
        const state = firmarState();
        expect(verificarState(state)).toBe(true);
    });

    it("state expirado no verifica", () => {
        const haceOnceMinutos = Date.now() - (OAUTH_STATE_TTL_SEG + 60) * 1000;
        const state = firmarState(haceOnceMinutos);
        expect(verificarState(state)).toBe(false);
    });

    it("state con payload alterado no verifica (HMAC no coincide)", () => {
        const state = firmarState();
        const [datos, firma] = state.split(".");
        const corrupto = datos.startsWith("A") ? `B${datos.slice(1)}` : `A${datos.slice(1)}`;
        expect(verificarState(`${corrupto}.${firma}`)).toBe(false);
    });

    it("state con firma alterada no verifica", () => {
        const state = firmarState();
        const [datos, firma] = state.split(".");
        const otraFirma = firmarState().split(".")[1];
        expect(otraFirma).not.toBe(firma);
        expect(verificarState(`${datos}.${otraFirma}`)).toBe(false);
    });

    it("state mal formado no verifica", () => {
        expect(verificarState("")).toBe(false);
        expect(verificarState("sin-punto")).toBe(false);
        expect(verificarState(".solo-firma")).toBe(false);
        expect(verificarState("solo-datos.")).toBe(false);
    });

    it("states distintos tienen nonces distintos", () => {
        expect(firmarState()).not.toBe(firmarState());
    });
});

describe("auth-oauth · auth URL (SPEC-587)", () => {
    it("arma la URL de Google con scope y redirect, sin prompt (SPEC-597)", () => {
        const url = buildGoogleAuthUrl("state-123", "http://localhost:5005/api/auth/oauth/google/callback");
        expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
        const params = new URL(url).searchParams;
        expect(params.get("client_id")).toBe("test-client-id-google");
        expect(params.get("redirect_uri")).toBe("http://localhost:5005/api/auth/oauth/google/callback");
        expect(params.get("response_type")).toBe("code");
        expect(params.get("scope")).toBe("openid email profile");
        expect(params.get("state")).toBe("state-123");
        expect(params.get("prompt")).toBeNull();
        expect(url).not.toContain("select_account");
    });
});

describe("auth-oauth · callbackUriDe (SPEC-587 · fix prod)", () => {
    const appUrlOriginal = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
        if (appUrlOriginal === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = appUrlOriginal;
    });

    it("usa NEXT_PUBLIC_APP_URL aunque el request venga del host interno (0.0.0.0:3000)", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://pi.innovadataco.com";
        const { callbackUriDe } = await import("./auth-oauth");
        const request = new Request("https://0.0.0.0:3000/api/auth/oauth/google");
        expect(callbackUriDe(request)).toBe("https://pi.innovadataco.com/api/auth/oauth/google/callback");
    });

    it("sin NEXT_PUBLIC_APP_URL cae al origen del request", async () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        const { callbackUriDe } = await import("./auth-oauth");
        const request = new Request("http://localhost:5005/api/auth/oauth/google");
        expect(callbackUriDe(request)).toBe("http://localhost:5005/api/auth/oauth/google/callback");
    });
});
