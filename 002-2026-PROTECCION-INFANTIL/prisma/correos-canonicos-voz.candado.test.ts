/**
 * CANDADO · SPEC-920 — VOZ del registro de correos, POR AUDIENCIA.
 *
 * Diseño (riesgo de 920): el candado de voz vigente (SPEC-915) escanea las PANTALLAS del colegio, NO el
 * seed de correos. El barrido interno (comité/operador) y el de colegio (919) hornean la voz USTED en el
 * copy canónico; este candado lo AMARRA sobre el registro. Muere con el defecto: una entrada que deba ir
 * en usted/impersonal y vuelva a «tú» → rojo.
 *
 * ── Qué prohibía la versión ANTERIOR de este candado (enumerado antes de reescribir, D-«reescribir un
 * candado pierde invariantes del viejo») ──────────────────────────────────────────────────────────────
 *   V1. `cuerpoMarkdown` de CADA entrada de `CORREOS_CANONICOS`: cero marcadores de tuteo.
 *   V2. `asunto` de cada entrada (cuando lo hay): cero marcadores de tuteo.
 *   V3. Detector MORFOLÓGICO (no lista de frases): pronombres/posesivos de 2ª persona informal + formas
 *       verbales informales, con límite de palabra unicode, case-insensitive.
 *   V4. Control POSITIVO: el detector dispara con «tú» y NO dispara con usted/impersonal.
 *
 * ── Qué cambia (decisión B del CEO: audiencia por entrada + voz por audiencia) ──────────────────────────
 *   - V1/V2 dejan de aplicar a TODAS las entradas y pasan a aplicar a las de audiencia ≠ `padre`: la
 *     familia `auth.*` de padres (SPEC-923) tutea A PROPÓSITO (voz informal aprobada por la FORMA), así que
 *     exigirle usted sería revertir su FORMA. La exención es ESTRUCTURAL (el campo `audiencia`, requerido
 *     por el tipo), no una lista de claves ni de frases: una entrada nueva que no declare su audiencia no
 *     compila, y una que la declare `padre` es una decisión explícita y revisable.
 *   - V3 y V4 se CONSERVAN intactos (mismo detector, mismo control positivo).
 *   - Se AÑADE mutación en ambos sentidos (control por cambio del discriminador): tuteo en una entrada de
 *     audiencia usted → rojo; y re-etiquetar una entrada de `padre` a una audiencia de usted → rojo.
 *
 * Unit puro (lee el registro).
 */
import { describe, it, expect } from "vitest";
import { CORREOS_CANONICOS, type Audiencia, type CopyCanonico } from "./correos-canonicos.seed-data";

// Pronombres/posesivos de TÚ (jamás aparecen en usted ni en impersonal).
const PRONOMBRES_TU = ["tú", "tu", "tus", "ti", "te", "tuyo", "tuya", "tuyos", "tuyas", "contigo"];
// Verbos informales (2ª persona singular) que el barrido pasó a usted (ingresa→ingrese, etc.).
const VERBOS_TU = [
    "tienes", "ingresa", "ingresás", "revisa", "revisá", "cambia", "cambiá", "avisas", "creas",
    "verifica", "verificá", "puedes", "podés", "quieres", "querés", "necesitas", "debes", "entrá", "entras",
];
const PATRONES = [...PRONOMBRES_TU, ...VERBOS_TU].map((w) => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, "iu"));

function tuteoEn(texto: string): string[] {
    return PATRONES.filter((re) => re.test(texto)).map((re) => re.source);
}
function marcadores(c: CopyCanonico): string[] {
    return [...tuteoEn(c.cuerpoMarkdown), ...tuteoEn(c.asunto ?? "")];
}

/** Única audiencia que admite tú (voz informal aprobada por la FORMA). El resto va en usted/impersonal. */
const AUDIENCIA_INFORMAL: Audiencia = "padre";

/** Entradas que VIOLAN la voz: audiencia ≠ padre Y con marcadores de tuteo. */
function violacionesVoz(registro: readonly CopyCanonico[]): string[] {
    return registro
        .filter((c) => c.audiencia !== AUDIENCIA_INFORMAL)
        .map((c) => ({ clave: c.clave, m: marcadores(c) }))
        .filter((x) => x.m.length > 0)
        .map((x) => `${x.clave} [${x.m.join(", ")}]`);
}

/** Inyecta un «tú» inequívoco para las mutaciones. */
function conTuteo(c: CopyCanonico): CopyCanonico {
    return { ...c, cuerpoMarkdown: c.cuerpoMarkdown + "\n\nIngresa a tu panel cuando quieras." };
}

describe("SPEC-920 · la voz del registro de correos respeta la audiencia", () => {
    it("ninguna entrada de audiencia usted/impersonal (≠ padre) contiene marcadores de tuteo", () => {
        const v = violacionesVoz(CORREOS_CANONICOS);
        expect(v, v.join(" · ")).toEqual([]);
    });

    it("la exención de `padre` es real: las entradas padre SÍ tutean y NO se marcan como violación", () => {
        const padres = CORREOS_CANONICOS.filter((c) => c.audiencia === AUDIENCIA_INFORMAL);
        // Hoy la familia auth de padres existe y tutea (si deja de existir, esta aserción avisa).
        expect(padres.length).toBeGreaterThan(0);
        expect(padres.every((c) => marcadores(c).length > 0)).toBe(true);
        // …y aun así el candado no las cuenta como violación (la exención estructural funciona).
        expect(violacionesVoz(padres)).toEqual([]);
    });

    it("control POSITIVO: el detector dispara con una frase en tú", () => {
        expect(tuteoEn("Ingresa en el panel y cambia tu contraseña").length).toBeGreaterThan(0);
        expect(tuteoEn("Se te asignó un caso").length).toBeGreaterThan(0);
        expect(tuteoEn("Tienes 3 casos pendientes").length).toBeGreaterThan(0);
        // y NO dispara con usted / impersonal
        expect(tuteoEn("Ingrese a su panel y revise los casos")).toEqual([]);
        expect(tuteoEn("Se registró la aceptación de los términos")).toEqual([]);
    });

    describe("MUTACIÓN en ambos sentidos (control por cambio del discriminador)", () => {
        it("tuteo en una entrada de audiencia usted (colegio) → ROJO", () => {
            const colegio = CORREOS_CANONICOS.find((c) => c.audiencia === "colegio");
            expect(colegio, "se esperaba al menos una entrada de audiencia colegio").toBeDefined();
            expect(violacionesVoz([colegio!])).toEqual([]); // base: hoy va en usted
            expect(violacionesVoz([conTuteo(colegio!)]).length).toBeGreaterThan(0); // mutada → cae
        });

        it("re-etiquetar una entrada de `padre` como audiencia de usted (colegio) → ROJO", () => {
            const padre = CORREOS_CANONICOS.find((c) => c.clave === "auth.bienvenida_padre.email");
            expect(padre, "se esperaba la entrada auth.bienvenida_padre.email").toBeDefined();
            expect(violacionesVoz([padre!])).toEqual([]); // base: exenta por ser padre
            const reEtiquetada: CopyCanonico = { ...padre!, audiencia: "colegio" };
            expect(violacionesVoz([reEtiquetada]).length).toBeGreaterThan(0); // su tú deja de estar permitido
        });
    });
});
