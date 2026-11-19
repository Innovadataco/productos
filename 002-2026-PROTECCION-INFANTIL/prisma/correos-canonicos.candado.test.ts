/**
 * SPEC-922 · CANDADO ESTRUCTURAL EXTENSIBLE del REGISTRO ÚNICO de copys canónicos.
 *
 * UN verificador puro, `violacionesDeForma(entrada)`, audita CADA entrada de `CORREOS_CANONICOS`:
 * una familia nueva del barrido que appendea su entrada queda cubierta SIN tocar este archivo.
 * Muere con el defecto (URL pelada / CTA inline / exención sin declarar / fuente duplicada):
 *   (1) Cero `{{url…}}` ni URL http FUERA de un `[texto](…)` — en cuerpo y asunto, SIN excepciones.
 *   (2) CTA: el `[etiqueta]({{variable}})` va A SOLAS en su párrafo (`\n\n` antes; fin o `\n\n` después).
 *   (3) CTA · CONDUCTA del motor (SPEC-909): `markdownAHtml` pinta EXACTAMENTE UN botón bulletproof
 *       (firma `padding:15px 28px`) y su `href` es la URL de la variable declarada — no otra.
 *   (4) Sin CTA: el motor no pinta botón; y un CORREO con enlaces sin botón debe declarar su
 *       exención `sinBoton` (ALLOWLIST anti-enumeración / seguridad). Exención ≠ permiso de URL cruda.
 *   (5) Contenido OPACO (`variablesOpacas`, armado aguas arriba): no se le exige forma, pero el
 *       envoltorio sí; una URL nunca es opaca; una opaca declarada debe existir en la plantilla.
 *   (6) ⚖️ [NORMA]: las variables de la constancia legal (`constanciaNorma`) siguen en el cuerpo.
 * Más: el motor `\n\n` → botón / `\n` → inline (trampa de SPEC-918); control POSITIVO con los copys
 * VIEJOS de prod; fixtures sintéticos de los casos que vienen (anti-enum, opaco) por el MISMO
 * verificador; SEED CREATE-ONLY por CONDUCTA (una fila editada en el panel sigue editada); y FUENTE
 * ÚNICA (seed + corrector sourcean del registro).
 *
 * Puro (data + render + texto del seed/corrector). En el allowlist de unit (`test:unit`, CORRE y
 * BLOQUEA en CI).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { CORREOS_CANONICOS, sembrarCorreosCanonicos, type CopyCanonico, type CtaCopy } from "./correos-canonicos.seed-data";
import { markdownAHtml } from "../src/lib/notificaciones/render-html";

const FIRMA_BOTON = /padding:15px 28px/;
const ENLACE_MD = /\[[^\]]*\]\([^)]*\)/g;

/** URL absoluta de prueba para una variable `{{url…}}` (el motor solo pinta botón con http/https). */
function urlDePrueba(variable: string): string {
    return `https://app.pi.test/${variable}`;
}

/** Sustituye `{{var}}` como el motor: `{{url…}}` → URL absoluta; el resto → texto inerte. */
function sustituir(md: string): string {
    return md.replace(/\{\{([A-Za-z]+)\}\}/g, (_, v: string) => (v.startsWith("url") ? urlDePrueba(v) : `«${v}»`));
}

/** `{{url…}}` / URL http que quedan FUERA de un `[texto](…)` (URL pelada). */
export function urlsCrudas(md: string): string[] {
    const sinEnlaces = md.replace(ENLACE_MD, "");
    const hallazgos = [...sinEnlaces.matchAll(/\{\{(url[A-Za-z]*)\}\}/g)].map((m) => `{{${m[1]}}}`);
    if (/https?:\/\//.test(sinEnlaces)) hallazgos.push("http(s)://");
    return hallazgos;
}

/** El `href` de cada BOTÓN bulletproof que pintó el motor (el `<a>` con la firma del padding). */
export function hrefsDeBotones(html: string): string[] {
    return [...html.matchAll(/<a href="([^"]+)" style="[^"]*padding:15px 28px/g)].map((m) => m[1]);
}

/** Coherencia de canal: EMAIL lleva asunto; IN_APP (campana) sin asunto, sin botón, sin exención. */
function violacionesDeCanal(c: CopyCanonico): string[] {
    if (c.canal === "EMAIL") return c.asunto?.trim() ? [] : ["EMAIL sin asunto"];
    const v: string[] = [];
    if (c.asunto !== undefined) v.push("IN_APP con asunto");
    if (c.cta) v.push("IN_APP con botón");
    if (c.sinBoton) v.push("IN_APP con exención de botón (no aplica a la campana)");
    return v;
}

/** (1) Cero URL cruda, en cuerpo y asunto, SIN excepciones. */
function violacionesDeUrl(c: CopyCanonico): string[] {
    return [
        ...urlsCrudas(c.cuerpoMarkdown).map((u) => `URL cruda en el cuerpo: ${u}`),
        ...urlsCrudas(c.asunto ?? "").map((u) => `URL cruda en el asunto: ${u}`),
    ];
}

/** (5) Contenido opaco: sin exigencia de forma, pero nunca una URL y nunca una declaración muerta. */
function violacionesOpacas(c: CopyCanonico): string[] {
    const plantilla = `${c.asunto ?? ""}\n${c.cuerpoMarkdown}`;
    return (c.variablesOpacas ?? []).flatMap((o) => [
        ...(o.startsWith("url") || o === c.cta?.variable ? [`{{${o}}} no puede ser opaca: es una URL`] : []),
        ...(plantilla.includes(`{{${o}}}`) ? [] : [`opaca {{${o}}} declarada pero no está en la plantilla`]),
    ]);
}

/** (6) ⚖️ [NORMA]: la constancia sigue en el cuerpo y nunca es opaca. */
function violacionesNorma(c: CopyCanonico): string[] {
    return (c.constanciaNorma ?? []).flatMap((n) => [
        ...(c.cuerpoMarkdown.includes(`{{${n}}}`) ? [] : [`[NORMA] falta {{${n}}} de la constancia`]),
        ...((c.variablesOpacas ?? []).includes(n) ? [`[NORMA] {{${n}}} no puede ser opaca`] : []),
    ]);
}

/** (2)+(3) CTA: a solas en su párrafo, y el motor pinta UN botón hacia la variable declarada. */
function violacionesDelCta(c: CopyCanonico, cta: CtaCopy, botones: string[]): string[] {
    const v: string[] = c.sinBoton ? ["declara botón Y exención de botón a la vez"] : [];
    const enlace = `[${cta.etiqueta}]({{${cta.variable}}})`;
    const i = c.cuerpoMarkdown.indexOf(enlace);
    if (i < 0) {
        v.push(`falta el CTA ${enlace}`);
    } else {
        if (i < 2 || c.cuerpoMarkdown.slice(i - 2, i) !== "\n\n") v.push("falta `\\n\\n` ANTES del botón");
        const despues = c.cuerpoMarkdown.slice(i + enlace.length);
        if (despues !== "" && !despues.startsWith("\n\n")) v.push("falta `\\n\\n` DESPUÉS del botón");
    }
    if (JSON.stringify(botones) !== JSON.stringify([urlDePrueba(cta.variable)])) {
        v.push(`el motor no pinta UN botón hacia {{${cta.variable}}} (pinta: ${JSON.stringify(botones)})`);
    }
    return v;
}

/** (4) Sin CTA: sin botón; correo con enlaces exige su exención (allowlist), y la exención debe servir. */
function violacionesSinCta(c: CopyCanonico, botones: string[]): string[] {
    const enlaces = c.cuerpoMarkdown.match(ENLACE_MD)?.length ?? 0;
    const v: string[] = botones.length > 0 ? [`sin CTA pero el motor pinta botón: ${JSON.stringify(botones)}`] : [];
    if (c.canal === "EMAIL" && enlaces > 0 && !c.sinBoton) {
        v.push("correo con enlaces y sin botón: falta declarar la exención `sinBoton` (allowlist)");
    }
    if (c.sinBoton && enlaces === 0) v.push("exención `sinBoton` sin enlaces que eximir (declaración muerta)");
    if (c.sinBoton && !c.sinBoton.nota.trim()) v.push("exención `sinBoton` sin nota que la justifique");
    return v;
}

/** Todo lo que está MAL en la forma de una entrada del registro. `[]` = forma canónica. */
export function violacionesDeForma(c: CopyCanonico): string[] {
    const botones = hrefsDeBotones(markdownAHtml(sustituir(c.cuerpoMarkdown)));
    return [
        ...violacionesDeCanal(c),
        ...violacionesDeUrl(c),
        ...violacionesOpacas(c),
        ...violacionesNorma(c),
        ...(c.cta ? violacionesDelCta(c, c.cta, botones) : violacionesSinCta(c, botones)),
    ];
}

/** Claves del registro DEFINIDAS como plantilla en el texto del seed (`clave: "…"`), fuera del registro. */
export function clavesRedefinidasEnSeed(seedTexto: string, claves: readonly string[]): string[] {
    return claves.filter((k) => new RegExp(`\\bclave:\\s*["'\`]${k.replace(/\./g, "\\.")}["'\`]`).test(seedTexto));
}

const SEED = fs.readFileSync(path.resolve(__dirname, "seed.ts"), "utf-8");
const CORRECTOR = fs.readFileSync(path.resolve(__dirname, "../scripts/corregir-correos-canonicos.ts"), "utf-8");
const CLAVES = CORREOS_CANONICOS.map((c) => c.clave);

describe("SPEC-922 · registro único de copys canónicos", () => {
    it("el registro tiene entradas y sus claves son únicas", () => {
        expect(CORREOS_CANONICOS.length).toBeGreaterThan(0);
        expect(new Set(CLAVES).size).toBe(CLAVES.length);
    });

    describe.each(CORREOS_CANONICOS.map((c) => [c.clave, c] as [string, CopyCanonico]))("%s", (_clave, c) => {
        it("forma canónica: cero violaciones", () => {
            expect(violacionesDeForma(c)).toEqual([]);
        });
    });

    it("motor: `\\n\\n` → BOTÓN; `\\n` simple → enlace inline (trampa de SPEC-918)", () => {
        const conParrafo = "Para entrar:\n\n[Entrar](https://x/login)\n\nGracias.";
        const conSalto = "Para entrar:\n[Entrar](https://x/login)\nGracias.";
        expect(hrefsDeBotones(markdownAHtml(conParrafo))).toEqual(["https://x/login"]);
        expect(markdownAHtml(conSalto)).not.toMatch(FIRMA_BOTON);
    });

    it("control POSITIVO: los copys VIEJOS de prod (c58e970f) dan ROJO", () => {
        // Literales del seed de main antes de SPEC-922 (el defecto que cazó Jelkin en vivo).
        const viejos: Record<string, string> = {
            "colegio.bienvenida_rector.email":
                "Hola,\n\nLa cuenta del **{{nombreColegio}}** quedó creada. Desde aquí protegerá a sus estudiantes, profesores y acudientes.\n\nEntre cuando quiera:\n{{urlLogin}}\n\nLe faltan unos pocos pasos para terminar de configurarla. Los recorremos juntos.",
            "consentimiento.aceptado.email":
                "Hola {{nombreUsuario}},\n\nConfirmamos que aceptaste la versión {{version}} de los términos de tratamiento de datos personales el {{fechaAceptacion}}.\n\nPuedes consultar tu expediente y configuración en {{urlDashboard}}.",
        };
        for (const [clave, cuerpoViejo] of Object.entries(viejos)) {
            const entrada = CORREOS_CANONICOS.find((c) => c.clave === clave);
            expect(entrada, `${clave} en el registro`).toBeDefined();
            const v = violacionesDeForma({ ...entrada!, cuerpoMarkdown: cuerpoViejo });
            expect(v.some((x) => x.startsWith("URL cruda")), `${clave}: ${JSON.stringify(v)}`).toBe(true);
            expect(v.some((x) => x.startsWith("el motor no pinta UN botón")), `${clave}: ${JSON.stringify(v)}`).toBe(true);
        }
    });

    describe("soporta los casos que vienen (fixtures sintéticos, MISMO verificador)", () => {
        // Forma de las FORMAs de Diseño (SPEC-919 / BARRIDO-01/02): enlaces inline en la frase.
        const antiEnum: CopyCanonico = {
            clave: "fixture.cuenta_existente.email",
            canal: "EMAIL",
            asunto: "Ya existe una cuenta con este correo",
            cuerpoMarkdown:
                "Hola,\n\nAlguien intentó crear una cuenta con este correo.\n\n" +
                "Si fue usted, [inicie sesión aquí]({{urlLogin}}). ¿Olvidó su contraseña? [Recupérela aquí]({{urlRecuperar}}).\n\n" +
                "Si no fue usted, no tiene que hacer nada.",
            variablesSchema: {},
            cta: null,
            sinBoton: { motivo: "anti-enumeracion", nota: "no revela si la cuenta existe" },
            fuente: "fixture",
        };
        const opaco: CopyCanonico = {
            clave: "fixture.reporte_enriquecido.email",
            canal: "EMAIL",
            asunto: "{{asunto}}",
            cuerpoMarkdown: "{{cuerpo}}\n\nIngresa a tu panel para ver el contexto completo:\n\n[Ir a mi panel]({{urlPanel}})",
            variablesSchema: {},
            cta: { etiqueta: "Ir a mi panel", variable: "urlPanel" },
            variablesOpacas: ["cuerpo", "asunto"],
            fuente: "fixture",
        };

        it("anti-enum: enlaces inline + exención declarada → pasa", () => {
            expect(violacionesDeForma(antiEnum)).toEqual([]);
        });
        it("anti-enum: SIN declarar la exención → ROJO (la allowlist es explícita)", () => {
            const sinDeclarar: CopyCanonico = { ...antiEnum };
            delete sinDeclarar.sinBoton;
            expect(violacionesDeForma(sinDeclarar)).toEqual([
                "correo con enlaces y sin botón: falta declarar la exención `sinBoton` (allowlist)",
            ]);
        });
        it("anti-enum: la exención NO indulta una URL cruda", () => {
            const crudo = { ...antiEnum, cuerpoMarkdown: antiEnum.cuerpoMarkdown.replace("[inicie sesión aquí]({{urlLogin}})", "ingrese en {{urlLogin}}") };
            expect(violacionesDeForma(crudo)).toContain("URL cruda en el cuerpo: {{urlLogin}}");
        });
        it("anti-enum: exención sobre un correo SIN enlaces → ROJO (declaración muerta)", () => {
            expect(violacionesDeForma({ ...antiEnum, cuerpoMarkdown: "Hola,\n\nNada que enlazar." })).toContain(
                "exención `sinBoton` sin enlaces que eximir (declaración muerta)"
            );
        });

        it("opaco: no se le exige forma al contenido dinámico → pasa", () => {
            expect(violacionesDeForma(opaco)).toEqual([]);
        });
        it("opaco: el ENVOLTORIO se sigue exigiendo (URL pelada en vez de botón → ROJO)", () => {
            const v = violacionesDeForma({ ...opaco, cuerpoMarkdown: "{{cuerpo}}\n\nIngresa a tu panel:\n{{urlPanel}}" });
            expect(v).toContain("URL cruda en el cuerpo: {{urlPanel}}");
            expect(v.some((x) => x.startsWith("el motor no pinta UN botón"))).toBe(true);
        });
        it("opaco: una URL nunca es opaca, y una opaca debe existir en la plantilla", () => {
            expect(violacionesDeForma({ ...opaco, variablesOpacas: ["cuerpo", "asunto", "urlPanel"] })).toEqual([
                "{{urlPanel}} no puede ser opaca: es una URL",
            ]);
            expect(violacionesDeForma({ ...opaco, variablesOpacas: ["cuerpo", "asunto", "resumen"] })).toEqual([
                "opaca {{resumen}} declarada pero no está en la plantilla",
            ]);
        });
    });

    describe("SEED CREATE-ONLY (VEREDICTO CEO 19-11): crea lo que falta, NUNCA pisa lo existente", () => {
        interface FilaSeed {
            clave: string;
            asunto: string | null;
            cuerpoMarkdown: string;
            activa: boolean;
            version?: number;
            actualizadaPor?: string | null;
        }
        /** Base falsa: `update`/`upsert` REVIENTAN — el seed no puede escribir una fila existente. */
        function baseSeed(filas: Record<string, FilaSeed>) {
            const db = {
                notificacionPlantilla: {
                    findUnique: async ({ where: { clave } }: { where: { clave: string } }) => filas[clave] ?? null,
                    create: async ({ data }: { data: FilaSeed }) => (filas[data.clave] = { ...data }),
                    update: async () => {
                        throw new Error("el seed NO puede actualizar una fila existente");
                    },
                    upsert: async () => {
                        throw new Error("el seed NO puede hacer upsert (pisaría la fila existente)");
                    },
                },
            };
            return db as unknown as Parameters<typeof sembrarCorreosCanonicos>[0];
        }

        it("control POSITIVO: una fila EDITADA en el panel sigue editada después del seed", async () => {
            const editada: FilaSeed = {
                clave: CLAVES[0],
                asunto: "Asunto que escribió el admin",
                cuerpoMarkdown: "Cuerpo que editó el admin en el panel",
                activa: false,
                version: 4,
                actualizadaPor: "admin-1",
            };
            const filas: Record<string, FilaSeed> = { [CLAVES[0]]: { ...editada } };
            const r = await sembrarCorreosCanonicos(baseSeed(filas));
            expect(filas[CLAVES[0]]).toEqual(editada); // intacta: copy, activa y version
            expect(r.existentes).toEqual([CLAVES[0]]);
            expect(r.creadas).toEqual(CLAVES.slice(1));
        });

        it("crea las que faltan con su copy canónico, activas", async () => {
            const filas: Record<string, FilaSeed> = {};
            await sembrarCorreosCanonicos(baseSeed(filas));
            for (const c of CORREOS_CANONICOS) {
                expect(filas[c.clave]?.cuerpoMarkdown).toBe(c.cuerpoMarkdown);
                expect(filas[c.clave]?.asunto).toBe(c.asunto ?? null);
                expect(filas[c.clave]?.activa).toBe(true);
            }
        });

        it("idempotente: la 2ª corrida no crea nada", async () => {
            const filas: Record<string, FilaSeed> = {};
            await sembrarCorreosCanonicos(baseSeed(filas));
            const r = await sembrarCorreosCanonicos(baseSeed(filas));
            expect(r.creadas).toEqual([]);
            expect(r.existentes).toEqual(CLAVES);
        });

        it("una entrada DEROGADA nace INACTIVA", async () => {
            const filas: Record<string, FilaSeed> = {};
            const derogada: CopyCanonico = { ...CORREOS_CANONICOS[2]!, clave: "fixture.derogada.in_app", derogada: true };
            await sembrarCorreosCanonicos(baseSeed(filas), [derogada]);
            expect(filas["fixture.derogada.in_app"]?.activa).toBe(false);
        });

        it("el seed delega en la siembra create-only y no itera el registro por su cuenta", () => {
            expect(SEED).toMatch(/import\s*\{\s*sembrarCorreosCanonicos\s*\}\s*from\s*"\.\/correos-canonicos\.seed-data"/);
            expect(SEED).toMatch(/await\s+sembrarCorreosCanonicos\(prisma\)/);
            expect(SEED).toMatch(/await\s+seedCorreosCanonicos\(\)/);
            // Un segundo escritor que recorriera el registro con upsert volvería a pisar ediciones del panel.
            expect(SEED).not.toMatch(/\bCORREOS_CANONICOS\b/);
        });
    });

    it("FUENTE ÚNICA · seed: ninguna clave del registro se define en otro lado del seed", () => {
        // Control positivo del detector: una redefinición inline SÍ se caza.
        expect(clavesRedefinidasEnSeed(`{ clave: "${CLAVES[0]}", asunto: "x" }`, CLAVES)).toEqual([CLAVES[0]]);
        // Las REGLAS (`plantillaClave: "…"`) no cuentan como definición de plantilla.
        expect(clavesRedefinidasEnSeed(`{ plantillaClave: "${CLAVES[0]}" }`, CLAVES)).toEqual([]);
        expect(clavesRedefinidasEnSeed(SEED, CLAVES)).toEqual([]);
        // Y el copy viejo de esta familia ya no vive embebido en el seed.
        expect(SEED).not.toContain("Puedes consultar tu expediente");
        expect(SEED).not.toContain("Aceptaste los términos de tratamiento");
        expect(SEED).not.toContain("Entre cuando quiera:\\n{{urlLogin}}");
    });

    it("FUENTE ÚNICA · corrector: itera el registro y no hardcodea copy", () => {
        expect(CORRECTOR).toMatch(/import\s*\{\s*CORREOS_CANONICOS\s*\}\s*from\s*"\.\.\/prisma\/correos-canonicos\.seed-data"/);
        expect(CORRECTOR).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+CORREOS_CANONICOS\s*\)/);
        expect(CORRECTOR).not.toMatch(/cuerpoMarkdown:\s*["'`]/);
    });
});
