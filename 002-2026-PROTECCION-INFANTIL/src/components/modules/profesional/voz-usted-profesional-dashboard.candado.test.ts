/**
 * SPEC-550 (I · decisión de Jelkin) · CANDADO de voz: el ÁREA LOGUEADA del
 * profesional (psicólogo) habla de «usted» — sin voseo Y sin tuteo.
 *
 * SPEC-505 barrió solo el registro/perfil (voseo). El pase visual halló el
 * DASHBOARD del profesional entero en «tú» (tuteo), que 505 no miraba. Este
 * candado cubre el hueco: escanea el árbol del área logueada y vigila la CLASE
 * completa (voseo + tuteo), no una lista — la lección de 527 (clase) + 529
 * (área completa). Muere si reaparece cualquier forma de la clase.
 *
 * Alcance = exactamente el que fijó el mapa de Diseño (SPEC-550): NO toca
 * registro/perfil/api del profesional (ésos tienen su propio estado y no son de
 * este radicado).
 *   - app/dashboard/profesional/**
 *   - components/modules/profesional/**
 *   - components/modules/verificacion/EstadoVerificacionProfesionalClient.tsx
 *
 * Detector: borde de letra UNICODE `(?<![\p{L}])…(?![\p{L}])/u` (mismo que 504/
 * 505/529). La CLASE se caza con lexemas INEQUÍVOCOS (2ª singular, voseo,
 * posesivos/enclíticos que la 3ª no comparte). Los IMPERATIVOS ambiguos con 3ª
 * (Publica/Revisa/Indica) y los enclíticos/posesivos compartidos con voseo
 * (tu/te/ves) NO se barren a ciegas: se candan por ANCLA POSITIVA sobre las
 * cadenas concretas que tocó 550. Verificado por MUTACIÓN en ambos sentidos.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const DIRS = [
    path.join(SRC, "app/dashboard/profesional"),
    path.join(SRC, "components/modules/profesional"),
];
const ARCHIVOS = [
    path.join(SRC, "components/modules/verificacion/EstadoVerificacionProfesionalClient.tsx"),
];

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}
function archivosDelAlcance(): string[] {
    const out = new Set<string>();
    for (const d of DIRS) for (const f of recorrer(d)) out.add(f);
    for (const f of ARCHIVOS) if (fs.existsSync(f)) out.add(f);
    return [...out];
}
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
const rx = (l: string) => new RegExp(B + l + E, "iu");

// Voseo (subset de 505, inequívoco).
const VOSEO = [
    "recordás", "querés", "necesitás", "podés", "tenés", "buscás", "elegís",
    "sabés", "vivís", "completás", "subís", "sentís", "ponés", "hacés", "decís",
    "elegí", "contá", "escribí", "indicá", "adjuntá", "revisá", "intentá",
    "reenviá", "mirá", "volvé", "avisá", "completá", "cargá", "sos", "debés",
    "creá", "dejanos", "abrilo", "armás",
];
// Tuteo INEQUÍVOCO (2ª singular / posesivos-enclíticos que la 3ª no comparte).
// NO incluye tu/te/ves (compartidos con voseo) ni imperativos ambiguos: ésos
// van por ancla positiva abajo.
const TUTEO = [
    "tú", "tienes", "puedes", "debes", "quieres", "necesitas", "sabes",
    "prefieres", "deseas", "atiendes", "vas", "estás", "eres",
    "tus", "tuyo", "tuya", "tuyos", "tuyas", "contigo",
];
const PATRONES = [...VOSEO, ...TUTEO].map(rx);

describe("SPEC-550 · el área logueada del profesional habla de «usted» (sin voseo ni tuteo)", () => {
    const archivos = archivosDelAlcance();

    it("anti-falso-verde: el alcance resolvió los archivos del mapa", () => {
        const clave = [
            "dashboard/profesional/page.tsx",
            "profesional/PanelProfesional.tsx",
            "profesional/CalendarioProfesional.tsx",
            "verificacion/EstadoVerificacionProfesionalClient.tsx",
        ];
        for (const c of clave) {
            expect(archivos.some((a) => a.replace(/\\/g, "/").endsWith(c)), `falta ${c}`).toBe(true);
        }
    });

    it("ningún lexema de voseo NI de tuteo (clase) aparece en el árbol logueado", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            for (const [i, linea] of codigo.split("\n").entries()) {
                for (const patron of PATRONES) {
                    const m = linea.match(patron);
                    if (m) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(
            hits,
            ["SPEC-550 — voz informal (voseo/tuteo) en el área logueada del profesional:", ...hits,
                "", "El profesional logueado habla de USTED. Pase a usted (tienes→tiene, atiendes→atiende,",
                "podés→puede). Los imperativos y tu/te/ves de estas cadenas van en la contraprueba."].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: las cadenas con tu/te/ves e imperativos quedaron en «usted» (ancla positiva)", () => {
        const panel = fs.readFileSync(path.join(SRC, "components/modules/profesional/PanelProfesional.tsx"), "utf-8");
        const cal = fs.readFileSync(path.join(SRC, "components/modules/profesional/CalendarioProfesional.tsx"), "utf-8");
        const page = fs.readFileSync(path.join(SRC, "app/dashboard/profesional/page.tsx"), "utf-8");
        const calPage = fs.readFileSync(path.join(SRC, "app/dashboard/profesional/calendario/page.tsx"), "utf-8");
        const verif = fs.readFileSync(path.join(SRC, "components/modules/verificacion/EstadoVerificacionProfesionalClient.tsx"), "utf-8");

        // presentes (usted) — mueren si se revierte la corrección
        expect(page).toContain("Sus solicitudes de primera cita, su agenda y su verificación.");
        expect(panel).toContain("Le compartió el expediente de su hijo");
        expect(panel).toContain("Su tarifa por consulta");
        expect(panel).toContain("la familia le entrega en la sesión. Desde aquí");
        expect(panel).toContain("solo ve quién se lo compartió.");
        expect(cal).toContain("Publique las franjas en las que puede atender.");
        expect(cal).toContain("Primero indique en su ficha si atiende virtual o presencial.");
        expect(cal).toContain("Revise su conexión.");
        expect(cal).toContain("según su ficha.");
        expect(cal).toContain("puede agendar una cita.");
        expect(calPage).toContain("Publique y retire las franjas en las que atiende.");
        expect(verif).toContain("Verificación de su perfil");
        // SPEC-691: se quitó «por correo» (el correo no entrega — MAPA §Correo; el aviso
        // real es in-app) y se corrigió «hagas»→«haga» (tuteo). Ancla a la copia nueva (usted).
        expect(verif).toContain("Ya estamos revisando sus documentos. Le avisamos apenas haya novedad");
        // SPEC-691 · las pantallas nuevas por estado, en usted (mueren si se revierten).
        expect(verif).toContain("Su verificación venció.");
        // SPEC-691 · no conformidad de Diseño (FORMA-SPEC691 · certificación 09af30a · vigencia.ts:66):
        // lo que vence es la VERIFICACIÓN, no un documento. Se envía «la verificación» de nuevo, no «el documento».
        expect(verif).toContain("envíela de nuevo a revisión");
        // El texto que miente sostiene el hueco: la vieja frase que hablaba de un «documento» que
        // vence no puede volver (no colisiona con «revisando sus documentos» del estado en revisión).
        expect(verif).not.toContain("actualice el documento que");
        expect(verif).toContain("Su perfil profesional está suspendido");

        // vetados (tú) — mueren si reaparecen
        for (const veto of ["Tu tarifa", "te entrega en la sesión", "ves quién te lo", "Revisa tu conexión", "según tu ficha", "agendar contigo", "Le compartió".replace("Le", "Te"), "Te avisamos"]) {
            expect(panel.includes(veto) || cal.includes(veto) || page.includes(veto) || verif.includes(veto) || calPage.includes(veto),
                `reapareció el tuteo: «${veto}»`).toBe(false);
        }
    });
});
