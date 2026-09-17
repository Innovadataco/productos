/**
 * SPEC-690-B (I-414) · Candado de CONDUCTA: TODA ruta OPERATIVA del profesional
 * pasa por la compuerta `exigirProfesionalHabilitadoApi` (responde 403 si el
 * profesional no está habilitado). El defecto que caza: una ruta operativa nueva
 * que se olvide de gatear — un SUSPENDIDO/VENCIDO/EN_REVISION operaría (vería el
 * panel, publicaría franjas, confirmaría citas) por una puerta sin cerrar.
 *
 * DERIVA DEL ÁRBOL de `app/api/profesional/**`, no de una lista a mano: recorre
 * cada `route.ts` y exige que O gatee con la compuerta O esté DECLARADA como
 * ruta de registro/autoservicio. Una ruta nueva que no haga ninguna de las dos
 * pone el candado ROJO — no hay olvido silencioso (ver
 * [[ceo-el-candado-contra-listas-a-mano-empezo-siendo-una-lista]]).
 *
 * Exige la LLAMADA, no el import: se buscan invocaciones `exigirProfesional-
 * HabilitadoApi(` DESPUÉS de quitar comentarios; un `import` suelto (sin `(`) o
 * una llamada comentada NO cuentan (lección de la primera versión del candado de
 * páginas de Dev 2, [[dev-candado-conducta-no-palabras]]). Muere con el defecto:
 * quitar el `await exigirProfesionalHabilitadoApi(...)` de panel/franjas/
 * solicitudes deja esa ruta sin gatear y fuera de la allowlist → rojo.
 *
 * Las rutas de REGISTRO/autoservicio (perfil, autorización, documentos,
 * verificación) NO llevan la compuerta A PROPÓSITO: un profesional en BORRADOR o
 * EN_REVISION tiene que poder construir y mantener su expediente para avanzar
 * hacia ACTIVO. Van en RUTAS_REGISTRO con su razón; sumar una es un acto
 * consciente y revisado, y la allowlist se limpia sola (una entrada que ya no
 * exista pone el candado rojo).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = __dirname; // src/app/api/profesional
const LLAMADA = /exigirProfesionalHabilitadoApi\s*\(/;

/**
 * Rutas de REGISTRO/autoservicio: alcanzables por un profesional NO habilitado a
 * propósito. Clave = ruta relativa a `app/api/profesional`; valor = por qué no
 * gatea. Sumar una entrada es declarar, con razón, que la ruta es de registro.
 */
const RUTAS_REGISTRO: Record<string, string> = {
    "perfil/route.ts": "Crear/editar el propio perfil (BORRADOR → EN_REVISION).",
    "autorizacion/route.ts": "Subir la autorización firmada (transiciona a EN_REVISION).",
    "documentos/route.ts": "Cargar/listar los propios documentos de verificación.",
    "documentos/[clave]/route.ts": "Descargar un documento propio.",
    "verificacion/route.ts": "Consultar el estado de la propia verificación.",
    "verificacion/reenviar/route.ts": "Reenviar a revisión tras corregir (reintento del ciclo).",
};

/** Las 6 rutas operativas conocidas — control positivo explícito del alcance. */
const OPERATIVAS_CONOCIDAS = [
    "panel/route.ts",
    "franjas/route.ts",
    "franjas/[id]/route.ts",
    "solicitudes/route.ts",
    "solicitudes/[id]/confirmar/route.ts",
    "solicitudes/[id]/rechazar/route.ts",
];

function rutasBajo(dir: string, base = dir): string[] {
    const out: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            out.push(...rutasBajo(abs, base));
        } else if (entrada.name === "route.ts") {
            out.push(path.relative(base, abs));
        }
    }
    return out.sort();
}

/** Fuente sin comentarios de bloque ni de línea, para no contar una llamada comentada. */
function fuenteSinComentarios(abs: string): string {
    return fs
        .readFileSync(abs, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
}

describe("SPEC-690-B · la compuerta cubre TODA ruta operativa del profesional", () => {
    const rutas = rutasBajo(RAIZ);

    it("hay rutas para revisar (el escaneo no quedó vacío = falso verde)", () => {
        expect(rutas.length).toBeGreaterThanOrEqual(OPERATIVAS_CONOCIDAS.length + Object.keys(RUTAS_REGISTRO).length);
    });

    it("cada ruta del árbol O gatea con la compuerta O está declarada de registro", () => {
        const problemas: string[] = [];
        for (const rel of rutas) {
            const gatea = LLAMADA.test(fuenteSinComentarios(path.join(RAIZ, rel)));
            const esRegistro = rel in RUTAS_REGISTRO;
            if (gatea && esRegistro) {
                problemas.push(`${rel}: gatea Y está en RUTAS_REGISTRO — decidí una sola cosa.`);
            }
            if (!gatea && !esRegistro) {
                problemas.push(
                    `${rel}: NO llama a exigirProfesionalHabilitadoApi() y NO está declarada de registro. ` +
                        "Si es operativa, gateala; si es de registro/autoservicio, agregala a RUTAS_REGISTRO con su razón.",
                );
            }
        }
        expect(problemas, `\n${problemas.join("\n")}`).toEqual([]);
    });

    it("RUTAS_REGISTRO no tiene entradas obsoletas (se limpia sola)", () => {
        const faltantes = Object.keys(RUTAS_REGISTRO).filter((rel) => !rutas.includes(rel));
        expect(faltantes, `RUTAS_REGISTRO cita rutas inexistentes: ${faltantes.join(", ")}`).toEqual([]);
    });

    it("control positivo: las 6 rutas operativas conocidas gatean", () => {
        for (const op of OPERATIVAS_CONOCIDAS) {
            expect(rutas, `falta la ruta operativa conocida ${op}`).toContain(op);
            const gatea = LLAMADA.test(fuenteSinComentarios(path.join(RAIZ, op)));
            expect(gatea, `${op} debe llamar a exigirProfesionalHabilitadoApi()`).toBe(true);
        }
    });

    it("canjar (cruza el árbol) gatea al actor PROFESIONAL", () => {
        // La ruta MÁS grave vive fuera de profesional/**: un pase abre el
        // expediente de un menor. Gatea condicionada al rol PROFESIONAL.
        const canjar = path.resolve(RAIZ, "../reportes/acceso/canjar/route.ts");
        expect(fs.existsSync(canjar), "no encuentro canjar/route.ts").toBe(true);
        expect(LLAMADA.test(fuenteSinComentarios(canjar)), "canjar debe llamar a la compuerta").toBe(true);
    });
});
