/**
 * SPEC-631 (I-378) · CANDADO — el rol de un alta por Google viaja FIRMADO en el `state` (HMAC), NUNCA
 * en la URL/query (gate 1 de Datos). Sin base ni env pesado (solo cripto pura + lectura de fuente).
 *
 * El defecto que cierra: si un parámetro editable de la URL decidiera el rol, cualquiera se ascendería
 * solo. Acá el rol lo FIJA cada endpoint de arranque en el servidor (una constante), se firma en el
 * state y el callback lo lee SOLO de ahí; `firmarState` re-valida el allowlist en el firmado.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { firmarState, leerState } from "@/lib/auth-oauth";

const SRC = path.resolve(__dirname, "../.."); // src/lib/auth → src
const DIR_OAUTH = path.join(SRC, "app/api/auth/oauth/google");

/** Atributos de CADA `<BotonContinuaConGoogle ...>` de un archivo (lo que hay entre el tag y su cierre). */
function botonesGoogle(archivo: string): string[] {
    const src = fs.readFileSync(path.join(SRC, archivo), "utf8");
    return [...src.matchAll(/<BotonContinuaConGoogle\b([^>]*?)\/?>/g)].map((m) => m[1]);
}
const traeRol = (attrs: string) => /\brol\s*=/.test(attrs);
/** Fuente de un archivo con los espacios colapsados (robusto al wrapping del JSX). */
const fuentePlano = (archivo: string) =>
    fs.readFileSync(path.join(SRC, archivo), "utf8").replace(/\s+/g, " ");

describe("SPEC-631 · el rol de Google viaja firmado en el state, nunca en la URL", () => {
    it("round-trip: firmarState(rol) → leerState().rol === rol; login (sin rol) → undefined", () => {
        expect(leerState(firmarState("PARENT")).rol).toBe("PARENT");
        expect(leerState(firmarState("PROFESIONAL")).rol).toBe("PROFESIONAL");
        const login = leerState(firmarState());
        expect(login.valido, "el state de login es válido").toBe(true);
        expect(login.rol, "pero NO trae rol → el callback no crea").toBeUndefined();
    });

    it("firmarState RECHAZA un rol no auto-registrable (defensa en el firmado)", () => {
        expect(() => firmarState("ADMIN")).toThrow(/no auto-registrable/);
        expect(() => firmarState("SCHOOL_ADMIN")).toThrow(/no auto-registrable/);
        expect(() => firmarState("OPERADOR")).toThrow(/no auto-registrable/);
    });

    it("(ancla de fuente, gate 1) los endpoints fijan el rol en el SERVIDOR, no lo leen de la URL", () => {
        const login = fs.readFileSync(path.join(DIR_OAUTH, "route.ts"), "utf8");
        const familia = fs.readFileSync(path.join(DIR_OAUTH, "registro/familia/route.ts"), "utf8");
        const profesional = fs.readFileSync(path.join(DIR_OAUTH, "registro/profesional/route.ts"), "utf8");

        // Rol FIJO (literal) en cada endpoint de registro; /login sin rol.
        expect(familia).toContain('arrancarOauthGoogle(request, "PARENT")');
        expect(profesional).toContain('arrancarOauthGoogle(request, "PROFESIONAL")');
        expect(login).toContain("arrancarOauthGoogle(request)");

        // NINGUNO deriva el rol de la URL/query.
        for (const src of [login, familia, profesional]) {
            expect(src, "el rol no puede salir de la URL").not.toMatch(/searchParams|nextUrl|params\.rol|\.query\b/);
        }
    });

    it("(ancla de UI) los botones de REGISTRO llevan su rol (familia=PARENT, profesional=PROFESIONAL); /login y recuperar NO llevan rol", () => {
        // Registro de familia: el botón DEBE crear → lleva rol (PARENT). Sin él, un padre nuevo por
        // Google rebotaría a /registro/inicio (regresión del happy path).
        const familia = botonesGoogle("app/registro/page.tsx");
        expect(familia, "hay un botón de Google en el registro de familia").toHaveLength(1);
        expect(familia[0]).toMatch(/rol\s*=\s*["']PARENT["']/);

        // Registro de profesional: mismo mecanismo, rol PROFESIONAL firmado en su endpoint.
        const profesional = botonesGoogle("app/registro-profesional/page.tsx");
        expect(profesional, "hay un botón de Google en el registro de profesional").toHaveLength(1);
        expect(profesional[0]).toMatch(/rol\s*=\s*["']PROFESIONAL["']/);

        // /login y recuperar: SOLO autentican. Un rol acá reabriría I-378 (el botón crearía cuenta en
        // silencio). El candado exige que NINGUNO de esos botones lleve rol.
        for (const archivo of ["app/login/page.tsx", "components/modules/RecuperarForm.tsx"]) {
            const botones = botonesGoogle(archivo);
            expect(botones.length, `hay un botón de Google en ${archivo}`).toBeGreaterThanOrEqual(1);
            for (const attrs of botones) {
                expect(traeRol(attrs), `${archivo} solo autentica → su botón NO lleva rol`).toBe(false);
            }
        }
    });

    it("(§2 Diseño) el rótulo por defecto del botón es el INFINITIVO «Continuar con Google», no el «tú»", () => {
        const boton = fuentePlano("components/modules/BotonContinuaConGoogle.tsx");
        expect(boton).toContain('label = "Continuar con Google"');
        // «Continúa» (con tilde en la a) es imperativo tú → defecto de voz en las puertas de usted.
        expect(boton, "el default NO puede ser el imperativo «Continúa»").not.toContain('label = "Continúa con Google"');
    });

    it("(§1 Diseño) el banner de /registro/inicio existe, va GATEADO por `desde=google` y el callback lo marca", () => {
        // El callback marca el rebote «Google sin cuenta» (y solo ese) con desde=google.
        const callback = fuentePlano("app/api/auth/oauth/google/callback/route.ts");
        expect(callback).toContain('searchParams.set("desde", "google")');

        // La página muestra el banner info SOLO con esa marca (gateado), con el copy aprobado (§1).
        const page = fuentePlano("app/registro/inicio/page.tsx");
        expect(page, "el banner va gateado, no siempre visible").toContain('.desde === "google"');
        expect(page, "banner en tono info (no error)").toContain('tono="info"');
        expect(page).toContain(
            "Iniciaste sesión con Google. Todavía no tienes un perfil en Protección Infantil — elige tu espacio y lo creamos ahora.",
        );
        // El encabezado público se conserva (no lo pisa el banner).
        expect(page).toContain("¿Quién eres?");
    });
});
