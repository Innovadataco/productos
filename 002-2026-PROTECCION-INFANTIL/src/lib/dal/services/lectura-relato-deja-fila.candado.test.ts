/**
 * SPEC-701 (I-421) · Candado de CONDUCTA derivado de los LLAMADORES del descifrado:
 * ningún camino de descifrado del relato hacia una PERSONA DEL PERSONAL se salta la
 * fila en `LecturaReporte`. Los delitos sexuales contra menores no prescriben; la
 * pregunta «¿quién del personal leyó este relato?» tiene que tener respuesta.
 *
 * Dos frentes, dos checks:
 *
 * (1) El PRIMITIVO `descifrarCampo(s)` (`@/lib/reporte-texto-contenido`) NO deja fila
 *     por sí mismo. Todo archivo que lo llame DIRECTO tiene que estar declarado con su
 *     razón: o es la propia frontera auditada, o es una EXCEPCIÓN escrita (lecturas del
 *     PROPIO padre y procesos AUTOMÁTICOS — clasificar, anonimizar, motor). Un llamador
 *     nuevo sin declarar (p. ej. una pantalla del personal que lea por el primitivo,
 *     saltándose la auditoría) pone el candado ROJO.
 *
 * (2) La FRONTERA AUDITADA `descifrarCampoReporte(s)` (`descifrar-contenido.ts`) deja
 *     fila SALVO que le pasen `registrarLectura: false` (pensado para RENDER, SPEC-592).
 *     Tras SPEC-701 ese escape ya no lo usa NINGÚN camino del personal (la bandeja de
 *     revisión dejó de usarlo). El candado exige CERO `registrarLectura: false`.
 *     CONTROL POSITIVO (el que pide el radicado): volver a ponerlo en la bandeja → rojo.
 *
 * `descifrarCampos?\(` NO caza `descifrarCampo*Reporte(` (tras «Campo/Campos» viene
 * «Reporte», no «(»): el primitivo y la frontera auditada se distinguen solos.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const LLAMADA_PRIMITIVO = /descifrarCampos?\(/; // descifrarCampo(  |  descifrarCampos(   — NO el *Reporte
const REGISTRAR_LECTURA_FALSE = /registrarLectura\s*:\s*false/;

/**
 * Llamadores DIRECTOS autorizados del primitivo `descifrarCampo(s)`, con su razón.
 * Clave = ruta relativa a `src/`. Sumar una entrada es declarar, con razón, que ese
 * camino NO deja fila a propósito (frontera auditada, lector propio, o proceso máquina).
 */
const LLAMADORES_PRIMITIVO: Record<string, string> = {
    "lib/dal/services/descifrar-contenido.ts": "LA FRONTERA AUDITADA: envuelve el primitivo y deja la fila (registrarLecturaTexto).",
    "lib/reporte-texto-contenido.ts": "El archivo del primitivo: `resellarCampo` descifra el original para re-sellar el trabajo (interno, sin lector humano).",
    "lib/dal/repositories/expediente-motor-repository.ts": "MOTOR — proceso automático (el motor no se toca, decisión de I-421).",
    "lib/dal/repositories/timeline-circulo-repository.ts": "El PADRE lee lo suyo: timeline de su círculo de confianza (filtra padreUsuarioId).",
    "lib/dal/repositories/expediente-repository.ts": "El PADRE lee lo suyo: PDF de su propia carpeta.",
    "lib/dal/services/expediente-vivo.ts": "El PADRE lee lo suyo: su propio relato (where filtra usuarioId; /api/padre/reportes/[id]/texto).",
    "lib/dal/services/reporte-lifecycle.ts": "AUTOMÁTICO: al reactivar un reporte regenera el embedding del original (máquina, sin lector humano).",
    "lib/dal/services/reporte-processing/seguridad.ts": "AUTOMÁTICO: clasificación del relato.",
    "lib/dal/services/reporte-processing/anonimizacion.ts": "AUTOMÁTICO: anonimización del relato.",
    "lib/e2e/helpers.ts": "Arnés E2E: no es una lectura de producción.",
};

/**
 * Quita SOLO comentarios (bloque y línea) — NO cadenas. Quitar cadenas con regex es
 * frágil: una comilla suelta se come el código de al lado y produce FALSOS NEGATIVOS
 * (un llamador real que el candado deja pasar). Un `descifrarCampo(` o un
 * `registrarLectura: false` dentro de una cadena literal no existe en este árbol
 * (las menciones en cadenas usan `descifrarCampos:`/`descifrarCampo/`, sin `(`), así que
 * basta con no contar los COMENTADOS.
 */
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function archivosFuente(dir: string, base = SRC): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...archivosFuente(abs, base));
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(path.relative(base, abs));
    }
    return out;
}

describe("SPEC-701 · ninguna lectura del relato por el personal se salta la fila", () => {
    const archivos = archivosFuente(SRC).map((r) => r.replace(/\\/g, "/"));

    it("anti-falso-verde: el escaneo encontró la frontera y los llamadores esperados", () => {
        expect(archivos.length).toBeGreaterThan(100);
        // La frontera auditada tiene que existir donde el candado la espera.
        expect(archivos).toContain("lib/dal/services/descifrar-contenido.ts");
    });

    it("(1) todo llamador DIRECTO del primitivo descifrarCampo(s) está declarado con su razón", () => {
        const problemas: string[] = [];
        for (const rel of archivos) {
            const codigo = sinComentarios(fs.readFileSync(path.join(SRC, rel), "utf-8"));
            if (!LLAMADA_PRIMITIVO.test(codigo)) continue;
            if (!(rel in LLAMADORES_PRIMITIVO)) {
                problemas.push(
                    `${rel}: llama a descifrarCampo(s) DIRECTO (se salta la auditoría) y NO está declarado. ` +
                        "Si es lectura del personal, pásalo por la frontera auditada (descifrarCampoReporte/descifrarCamposReporte). " +
                        "Si es lectura del propio padre o un proceso automático, agrégalo a LLAMADORES_PRIMITIVO con su razón.",
                );
            }
        }
        expect(problemas, `\n${problemas.join("\n")}`).toEqual([]);
    });

    it("(1b) LLAMADORES_PRIMITIVO no tiene entradas obsoletas (se limpia sola)", () => {
        const faltan = Object.keys(LLAMADORES_PRIMITIVO).filter((rel) => {
            if (!archivos.includes(rel)) return true; // el archivo ya no existe
            return !LLAMADA_PRIMITIVO.test(sinComentarios(fs.readFileSync(path.join(SRC, rel), "utf-8"))); // ya no llama al primitivo
        });
        expect(faltan, `entradas de LLAMADORES_PRIMITIVO que ya no aplican: ${faltan.join(", ")}`).toEqual([]);
    });

    it("(2) ningún camino usa registrarLectura:false — la frontera auditada SIEMPRE deja fila", () => {
        const conEscape = archivos.filter((rel) =>
            REGISTRAR_LECTURA_FALSE.test(sinComentarios(fs.readFileSync(path.join(SRC, rel), "utf-8"))),
        );
        expect(
            conEscape,
            "registrarLectura:false salta la fila. Tras SPEC-701 ningún camino del personal lo usa. " +
                `Si de verdad hace falta un RENDER sin fila, decídelo aquí explícitamente. Archivos: ${conEscape.join(", ")}`,
        ).toEqual([]);
    });
});
