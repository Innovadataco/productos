/**
 * SPEC-419 (I-296) · candado: los dos correos de la puerta del profesional
 * tienen su regla y su plantilla en el seed.
 *
 * `email-profesional.ts` falla en cerrado (`programadas === 0` → throw). SPEC-391
 * lo escribió así, correctamente, pero el seed nunca recibió el catálogo — y como
 * la ruta atrapa el throw y responde 202 igual (anti-enumeración de SPEC-338),
 * el defecto era **invisible desde afuera**: el profesional llenaba el
 * formulario, leía «te enviamos un enlace», y no llegaba nada.
 *
 * Lo cazó `reglas:check` (SPEC-418) en su primer uso. Este candado evita que se
 * pierda otra vez: si alguien borra el bloque del seed, o renombra un evento en
 * `email-profesional.ts` sin sembrarlo, el gate lo grita.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");

const seed = leer("prisma/seed.ts");
const emisor = leer("src/lib/email-profesional.ts");

/** Los eventos que el emisor dispara, leídos de la fuente y no escritos a mano. */
const EVENTOS = [...emisor.matchAll(/evento: "([^"]+)"/g)].map((m) => m[1]);

describe("SPEC-419 · la puerta del profesional está sembrada", () => {
    it("el emisor dispara exactamente dos eventos", () => {
        expect(EVENTOS).toEqual(["auth.registro_enlace_profesional", "auth.bienvenida_profesional"]);
    });

    it.each(EVENTOS)("%s tiene su REGLA en el seed", (evento) => {
        expect(seed, "sin regla, el registro del profesional se rompe en silencio").toContain(
            `evento: "${evento}", plantillaClave: "${evento}.email"`,
        );
    });

    it.each(EVENTOS)("%s tiene su PLANTILLA en el seed", (evento) => {
        expect(seed).toContain(`clave: "${evento}.email"`);
    });

    it("las dos reglas son del rol PROFESIONAL y OBLIGATORIAS", () => {
        for (const evento of EVENTOS) {
            const linea = seed.split("\n").find((l) => l.includes(`evento: "${evento}"`));
            expect(linea, `no se encontró la regla de ${evento}`).toBeDefined();
            expect(linea).toContain('rol: "PROFESIONAL"');
            // Es la puerta: sin el correo no puede entrar, así que no admite opt-out.
            expect(linea).toContain("obligatoria: true");
        }
    });

    it("la plantilla del enlace lleva la variable {{url}} que el emisor envía", () => {
        // Si la plantilla no la nombra, el correo sale sin enlace: sirve tanto
        // como no mandarlo.
        const bloque = seed.slice(seed.indexOf('clave: "auth.registro_enlace_profesional.email"'));
        expect(bloque.slice(0, 900)).toContain("{{url}}");
        expect(emisor).toContain("variables: { url }");
    });

    it("la bienvenida lleva las dos variables que el emisor envía", () => {
        const bloque = seed.slice(seed.indexOf('clave: "auth.bienvenida_profesional.email"'));
        expect(bloque.slice(0, 900)).toContain("{{urlLogin}}");
        expect(bloque.slice(0, 900)).toContain("{{urlCompletarPerfil}}");
    });

    it("el emisor sigue fallando en cerrado — es lo correcto, no se ablanda", () => {
        // El arreglo era sembrar, no dejar de fallar. Si alguien "arregla" esto
        // quitando el throw, el correo vuelve a perderse en silencio.
        const throws = emisor.match(/programadas === 0/g) ?? [];
        expect(throws).toHaveLength(2);
    });
});
