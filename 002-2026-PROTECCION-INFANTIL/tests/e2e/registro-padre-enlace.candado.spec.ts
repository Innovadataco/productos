/**
 * SPEC-809 · Candados del registro de PADRE por ENLACE.
 *
 * El defecto que cerramos: el arnés registraba al padre por el código del colegio y leía `devCode`
 * de la respuesta — un campo que SOLO aparece cuando el correo FALLA al salir. El verde medía un
 * mailer roto, no el registro. Estos candados impiden que eso vuelva, en tres frentes:
 *
 *  (A) ANTI-ENUMERACIÓN (SPEC-338) VIVA + sin fuga de token: `/api/auth/registro/solicitar` responde
 *      IDÉNTICO exista o no el correo, y el cuerpo NO trae el token. Afirmado con un correo REAL
 *      plantado (el caso «existente» es genuino) y sobre el cuerpo real, no por ausencia de campo en
 *      un tipo (criterio de auditoría b del radicado).
 *  (B) CONTROL NEGATIVO: `registro/completar` con un token inexistente FALLA. Con (A), las dos
 *      direcciones del contrato quedan cubiertas.
 *  (C) IMPOSIBILIDAD ESTRUCTURAL: ningún archivo del arnés DEPENDE del camino de error — `devCode`/
 *      `devToken` no se leen en NINGÚN lado (se escanea el código, sin comentarios). Quitar las dos
 *      llamadas viejas no bastaba: la tercera la escribe quien no sabía; este candado la caza.
 *
 * Solo `tests/e2e/**`. La guardia SPEC-770 del globalSetup garantiza BD `*_test`.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { registrarPadre, limpiarPadre, type PadreRegistrado } from "./fixtures/registrar-padre";

const padres: PadreRegistrado[] = [];

/** Quita comentarios (bloque y línea) para que el escaneo mida CÓDIGO, no las notas que explican
 *  por qué NO se usa `devCode` (esos comentarios viven a propósito en varios archivos). */
function sinComentarios(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/([^:"'`\\])\/\/.*$/gm, "$1");
}

/** Lista recursiva de archivos .ts bajo un directorio. */
function archivosTs(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name);
        if (entrada.isDirectory()) salida.push(...archivosTs(ruta));
        else if (entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx")) salida.push(ruta);
    }
    return salida;
}

test.describe("SPEC-809 · candados del registro de padre por enlace", () => {
    test.afterAll(async () => {
        for (const p of padres) await limpiarPadre(p);
        padres.length = 0;
    });

    test("(A) registro/solicitar: anti-enumeración viva y SIN fuga de token", async ({ request }) => {
        const existente = `e2e-candado-exists-${Date.now()}@example.com`;
        const nuevo = `e2e-candado-new-${Date.now()}@example.com`;

        // Correo REAL plantado en contexto efímero (el caso «existente» es genuino; la page/`request`
        // del test queda limpia).
        const reqReg = await playwrightRequest.newContext();
        try {
            padres.push(await registrarPadre({ request: reqReg, email: existente, password: "TestPass123" }));
        } finally {
            await reqReg.dispose();
        }

        const resExistente = await request.post("/api/auth/registro/solicitar", { data: { email: existente } });
        const resNuevo = await request.post("/api/auth/registro/solicitar", { data: { email: nuevo } });
        expect(resExistente.status(), "solicitar existente → 202").toBe(202);
        expect(resNuevo.status(), "solicitar nuevo → 202").toBe(202);

        const bodyExistente = await resExistente.json();
        const bodyNuevo = await resNuevo.json();
        // Anti-enum: respuesta IDÉNTICA exista o no el correo.
        expect(bodyExistente).toEqual(bodyNuevo);
        // Sin fuga: el cuerpo es SOLO el mensaje — ni token ni devCode — aun para el correo REAL. Se
        // afirma sobre el cuerpo real (keys), no por ausencia de campo en un tipo.
        expect(Object.keys(bodyExistente).sort()).toEqual(["message"]);
        expect(typeof bodyExistente.message).toBe("string");
    });

    test("(B) control negativo: registro/completar con token inexistente FALLA", async ({ request }) => {
        const res = await request.post("/api/auth/registro/completar", {
            data: { token: "token-que-no-existe-jamas", password: "TestPass123", passwordConfirmacion: "TestPass123" },
        });
        expect(res.status(), "un token inexistente no puede crear cuenta").toBeGreaterThanOrEqual(400);
    });

    // DEUDA DECLARADA (salida autoexigida): archivos del MISMO defecto (registran un usuario por CÓDIGO
    // con devCode) que quedan FUERA del alcance de un lote. Se declaran acá para que el candado quede
    // VERDE en lo cerrado y SIGA cazando cualquier archivo NUEVO. Cuando su unidad los arregle y dejen de
    // leer el dev-field, el ratchet de abajo EXIGE quitarlos (si no, la lista miente sobre la deuda viva).
    //
    // VACÍO a propósito: `auth.spec.ts` —el último pendiente— se reescribió al flujo de ENLACE (registro
    // por la UI, sin `devCode`) y SALIÓ de esta lista en el MISMO commit, como el ratchet lo exige. La
    // maquinaria se queda para cazar al próximo archivo que nazca leyendo el camino de error.
    const ALLOWLIST_PENDIENTES = new Map<string, string>([]);

    test("(C) imposibilidad estructural: el arnés NO depende de devCode/devToken (camino de error)", () => {
        const raizE2e = join(process.cwd(), "tests", "e2e");
        const culpables: string[] = [];

        for (const ruta of archivosTs(raizE2e)) {
            if (ruta.endsWith("registro-padre-enlace.candado.spec.ts")) continue; // este candado los nombra a propósito
            const codigo = sinComentarios(readFileSync(ruta, "utf8"));
            if (/\bdevCode\b/.test(codigo) || /\bdevToken\b/.test(codigo)) {
                culpables.push(ruta.replace(process.cwd() + "/", ""));
            }
        }

        // (1) Ningún archivo NUEVO (fuera del allowlist) puede depender del camino de error.
        const nuevos = culpables.filter((f) => !ALLOWLIST_PENDIENTES.has(f));
        expect(
            nuevos,
            "Archivo(s) del arnés que LEEN devCode/devToken (solo llega si el correo FALLA → el verde mide " +
                "un mailer roto). Registrá/recuperá por el flujo de ENLACE (registrarPadre / plantarTokenRecuperacion), " +
                `nunca por el dev-field. Nuevos: ${nuevos.join(", ")}.`,
        ).toEqual([]);

        // (2) Ratchet de salida autoexigida: un allowlisted que YA no lee el dev-field debe SALIR del
        //     allowlist (si no, la lista miente sobre la deuda viva).
        const allowlistYaLimpios = [...ALLOWLIST_PENDIENTES.keys()].filter((f) => !culpables.includes(f));
        expect(
            allowlistYaLimpios,
            `Estos están en el allowlist pero YA no leen devCode/devToken: quitalos del allowlist (deuda saldada): ${allowlistYaLimpios.join(", ")}.`,
        ).toEqual([]);
    });
});
