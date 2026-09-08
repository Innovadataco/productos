/**
 * SPEC-587 — unitarios de src/lib/auth-oauth.ts (sin BD).
 *
 * Firma/verificación del state OAuth: válido, expirado, con payload alterado,
 * con firma alterada y mal formado; y la auth URL de Google (scope, prompt).
 */
import { describe, it, expect, beforeAll } from "vitest";
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
    it("arma la URL de Google con scope, prompt y redirect", () => {
        const url = buildGoogleAuthUrl("state-123", "http://localhost:5005/api/auth/oauth/google/callback");
        expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
        const params = new URL(url).searchParams;
        expect(params.get("client_id")).toBe("test-client-id-google");
        expect(params.get("redirect_uri")).toBe("http://localhost:5005/api/auth/oauth/google/callback");
        expect(params.get("response_type")).toBe("code");
        expect(params.get("scope")).toBe("openid email profile");
        expect(params.get("prompt")).toBe("select_account");
        expect(params.get("state")).toBe("state-123");
    });
});
