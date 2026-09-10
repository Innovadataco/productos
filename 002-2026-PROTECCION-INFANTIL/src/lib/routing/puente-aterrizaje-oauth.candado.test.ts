/**
 * SPEC-617 (I-371 · D-131) · CANDADO DE CONDUCTA — el retorno de Google aterriza en el home del rol,
 * NO en /login. Sin base ni env pesado (middleware Edge, jose, HMAC).
 *
 * El JWT de sesión es `SameSite=Strict` a propósito (protege la bitácora de auditoría de GET
 * cross-site — D-129/SPEC-611). El retorno de Google es una navegación TOP-LEVEL cross-site: un `302`
 * del callback al destino heredaría ese origen cross-site → el navegador NO manda el JWT recién sellado
 * → el Paso 2 del middleware no lo ve → /login (I-371). El arreglo NO es aflojar la cookie sino un
 * PUENTE same-site: el callback devuelve una página 200 del MISMO origen que navega ella misma al
 * destino; esa navegación es same-site, el JWT Strict viaja y el middleware lo ve.
 *
 * El candado NO mira palabras: modela la navegación del puente con el ATRIBUTO REAL de su respuesta
 * (200 = página same-origin que navega same-site; 3xx = redirect cross-site) y corre el MIDDLEWARE
 * real contra el destino. Con el puente (200) el JWT viaja → home del rol; si alguien lo vuelve un
 * redirect (3xx) el JWT no viaja → /login. Un `control` (sin JWT SÍ cae en /login) prueba que el
 * destino EXIGE el JWT y no pasa trivial. Y un ancla de fuente mata el regreso al 302.
 *
 * MUTACIÓN (verificada aparte): volver `construirAterrizajeOAuth` a un redirect, o el callback a
 * `NextResponse.redirect`, pone este candado ROJO.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "../../../middleware";
import { firmarSesionEstado, NOMBRE_COOKIE } from "@/lib/routing/vigencia-cookie";
import { htmlPuenteAterrizaje, construirAterrizajeOAuth, origenPublicoPuente } from "@/lib/auth/puente-aterrizaje-oauth";
import { sessionCookieAttributes } from "@/lib/auth/session-cookie-attrs";

const SRC = path.resolve(__dirname, "../.."); // src/lib/routing → src
const CALLBACK = path.join(SRC, "app/api/auth/oauth/google/callback/route.ts");

const JWT_SECRET_TEST =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
        ? process.env.JWT_SECRET
        : "test-secret-32-chars-puente-oauth-617!";

beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET_TEST;
});

async function jwt(rol: string): Promise<string> {
    return new SignJWT({ sub: "u-617", rol })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(JWT_SECRET_TEST));
}

async function estadoSano(): Promise<string> {
    return firmarSesionEstado(
        { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino: null },
        JWT_SECRET_TEST,
    );
}

// Home del PARENT (ruta gateada): con JWT + estado pasa; sin JWT cae en /login.
const DESTINO = "/dashboard/padre";
const DEST_URL = `http://localhost:5005${DESTINO}`;

/**
 * ¿La navegación que produce el aterrizaje es same-site? El puente devuelve 200 (página del mismo
 * origen que navega ella misma → same-site → el JWT Strict viaja). Un 3xx sería un redirect que hereda
 * el origen cross-site del retorno de Google → el JWT no viaja. Se decide con el STATUS REAL, no con
 * una constante del test.
 */
function navegacionSameSite(statusDelAterrizaje: number): boolean {
    return statusDelAterrizaje === 200;
}

describe("SPEC-617 · el puente same-site: el retorno de Google llega al home del rol, no a /login", () => {
    it("modelando el puente, el destino con el JWT que la navegación same-site deja viajar NO cae en /login", async () => {
        const sameSite = navegacionSameSite(construirAterrizajeOAuth(DEST_URL).status);
        const token = await jwt("PARENT");
        const estado = await estadoSano();
        // El JWT viaja SOLO si el aterrizaje es same-site (el puente lo garantiza). `sesion_estado` (lax)
        // viaja siempre — es la firma del bug: el encabezado saludaba parado en /login.
        const cookie = sameSite
            ? `__Host-token=${token}; ${NOMBRE_COOKIE}=${estado}`
            : `${NOMBRE_COOKIE}=${estado}`;
        const res = await middleware(new NextRequest(DEST_URL, { headers: { cookie } }));
        const loc = res.headers.get("location");
        const pathname = loc ? new URL(loc).pathname : null;
        expect(
            pathname,
            "El aterrizaje de Google cae en /login (I-371). El callback debe entregar el PUENTE same-site " +
                "(construirAterrizajeOAuth, 200), no un 302 cross-site que pierde el JWT Strict.",
        ).not.toBe("/login");
    });

    it("control: sin el JWT (retorno cross-site sin puente), el MISMO destino SÍ cae en /login", async () => {
        const estado = await estadoSano();
        const res = await middleware(new NextRequest(DEST_URL, { headers: { cookie: `${NOMBRE_COOKIE}=${estado}` } }));
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    });

    it("el puente navega al destino derivado (meta-refresh + enlace), sin JS de navegación (no smuggling, CSP-safe)", () => {
        const html = htmlPuenteAterrizaje(DEST_URL);
        expect(html).toContain(`http-equiv="refresh" content="0; url=${DEST_URL}"`);
        expect(html).toContain(`href="${DEST_URL}"`);
        expect(html, "el puente no corre JS de navegación (evita CSP-nonce y smuggling)").not.toMatch(/location\.(href|replace|assign)/);
    });

    it("(Regla 1+3 de Diseño) el fondo pinta de una; el CONTENIDO se revela DIFERIDO (umbral, no parpadea)", () => {
        // Regresó una vez (b4b7b1355→a0b1f44e3): al sacar el umbral, el escudo+texto aparecían de una en
        // TODO login, incluido el instantáneo → parpadeo. El FONDO papel sí pinta desde el pixel 1
        // (evita el flash en blanco); el CONTENIDO arranca oculto y entra con animación diferida.
        const html = htmlPuenteAterrizaje(DEST_URL);
        expect(html, "el fondo (body) tiene color desde el pixel 1 — nunca blanco").toMatch(/body\{[^}]*background:/);
        expect(html, "el contenido arranca oculto (umbral)").toContain("opacity:0");
        expect(html, "y se revela por una animación diferida (sacarla trae de vuelta el parpadeo)").toContain("@keyframes");
    });

    it("(Regla 2 de Diseño) el puente JAMÁS enlaza a /login — SOSTIENE, no rebota al bug original", () => {
        // El único destino es el home del rol. Reconstruir un enlace/rebote a /login sería reconstruir
        // I-371 y, peor, hacerlo ver como conducta normal.
        expect(htmlPuenteAterrizaje("/dashboard/padre")).not.toContain("/login");
        expect(htmlPuenteAterrizaje("/consentimiento")).not.toContain("/login");
    });

    it("construirAterrizajeOAuth es 200 text/html sin caché (una PÁGINA, no un redirect)", () => {
        const res = construirAterrizajeOAuth(DEST_URL);
        expect(res.status, "200 = página same-origin; un 3xx sería el redirect cross-site que rompe todo").toBe(200);
        expect(res.headers.get("content-type") ?? "").toContain("text/html");
        expect(res.headers.get("cache-control") ?? "").toContain("no-store");
    });

    it("el puente ESCAPA el destino: no rompe el atributo ni inyecta markup", () => {
        const html = htmlPuenteAterrizaje('http://x/a"><script>alert(1)</script>');
        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).toContain("&quot;");
    });

    it("(ancla de fuente) el callback aterriza por el PUENTE, no por un redirect cross-site (I-371)", () => {
        const src = fs
            .readFileSync(CALLBACK, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:])\/\/.*$/gm, "$1");
        expect(src, "el callback debe aterrizar con el puente same-site").toContain("construirAterrizajeOAuth");
        expect(
            /NextResponse\.redirect/.test(src),
            "un 302 al destino heredaría el origen cross-site del retorno de Google y perdería el JWT Strict → /login (I-371)",
        ).toBe(false);
    });
});

describe("SPEC-617 · el JWT de sesión SIGUE Strict (ratchet — no aflojar sin el chequeo de Origin)", () => {
    it("sessionCookieAttributes(true).sameSite === 'strict'", () => {
        // D-131: el JWT se queda en Strict. Pasa a Lax SOLO cuando entre el chequeo de Origin
        // (SPEC-619, radicado aparte), que cierra la clase «GET que muta» por construcción. Si alguien
        // lo afloja a Lax ANTES de esa defensa, deja 18 GET disparables cross-site (entradas FALSAS en
        // AuditLog/LecturaReporte) y este candado MUERE en CI — que es el punto.
        expect(sessionCookieAttributes(true).sameSite).toBe("strict");
        expect(sessionCookieAttributes(true).secure, "el prefijo __Host- exige Secure").toBe(true);
        expect(sessionCookieAttributes(true).httpOnly).toBe(true);
    });
});

describe("SPEC-617 · el origen del puente falla RUIDOSO si NEXT_PUBLIC_APP_URL falta (I-361)", () => {
    const previo = process.env.NEXT_PUBLIC_APP_URL;
    afterEach(() => {
        if (previo === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
        else process.env.NEXT_PUBLIC_APP_URL = previo;
    });

    it("ausente → ABORTA, no cae a request.url (el host interno 0.0.0.0 del contenedor)", () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        expect(() => origenPublicoPuente()).toThrow(/NEXT_PUBLIC_APP_URL/);
    });

    it("valor no-absoluto → ABORTA (una ruta relativa no es un origen)", () => {
        process.env.NEXT_PUBLIC_APP_URL = "/no-absoluta";
        expect(() => origenPublicoPuente()).toThrow(/NEXT_PUBLIC_APP_URL/);
    });

    it("origen público válido → devuelve su origin", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://pi.innovadataco.com/algo";
        expect(origenPublicoPuente()).toBe("https://pi.innovadataco.com");
    });
});
