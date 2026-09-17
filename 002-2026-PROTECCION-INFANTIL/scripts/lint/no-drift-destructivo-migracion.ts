/**
 * I-420 · CANDADO (ratchet) · rechaza una migración con el DRIFT DESTRUCTIVO que
 * `prisma migrate dev` genera y `migrate deploy` aplicaría EN SILENCIO.
 *
 * MEDIDO (I-420, base scratch): el schema NO modela varias features → `migrate dev` genera una
 * migración que las DESTRUYE para «reconciliar» la BD con el schema: 8 DROP INDEX (trigram,
 * pgvector ×2, 5 custom), 144 `ALTER COLUMN … SET DATA TYPE TIMESTAMP(3)` (timestamptz→timestamp,
 * pierde zona horaria), 0 CREATE. `migrate deploy` NO genera nada — solo aplica archivos; el
 * peligro es COMMITEAR esa migración generada sin notar los DROP/ALTER extra.
 *
 * Este candado es imposibilidad estructural, no una nota que alguien recuerde: si una migración
 * trae uno de esos patrones y NO está en el allowlist correspondiente, CI falla. Un drop LEGÍTIMO
 * se agrega al allowlist en ESTE archivo — y ese cambio lo revisa DATOS en el PR (D-121).
 *
 * (Nota: los índices ÚNICOS PARCIALES con `WHERE` NO entran acá — Prisma los IGNORA, no los
 * dropea; ver [[dev-prisma-ignora-indices-parciales-con-where]]. El drift es sobre trigram/vector/
 * custom/timestamptz.)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/**
 * BASELINE (I-420, 16-09-2026): migraciones EXISTENTES con `DROP INDEX` al instaurar el candado
 * — todas históricas y ya en `main`. Una migración NUEVA con `DROP INDEX` NO entra sola: se
 * agrega acá tras revisión de Datos (por eso el candado obliga a que Datos vea todo drop de índice).
 */
const DROP_INDEX_PERMITIDAS = new Set<string>([
    "20260714003146_fix_embedding_hnsw_index",
    "20260716071229_remove_vector_btree_index",
    "20260717002004_add_pgvector_hnsw_indexes",
    "20260717011303_add_reporte_baja",
    "20260717020000_add_caso_eval",
    "20260718094450_add_reintento_reporte",
    "20260719030000_circulo_confianza_multiples_identificadores",
    "20260809060000_avisos_colegio",
    "20260809120000_seguimiento_caso",
    "20260809160000_informe_mensual_pdf_audit",
    "20260812051055_spec_163_acudiente_completo",
    "20260812052407_add_materia_curso_materia",
    "20260830192902_spec_320_unicidad_identificador_por_colegio",
    "20260901000100_spec_339_hijo_dueno_propio",
    "20260905210000_spec_509_permisomodulo_rol_enum",
    "20260908000829_spec589_hijo_sin_documento",
    "20260910130000_spec610_pase_por_expediente",
    "20260913120000_spec693_documentos_versionados",
]);

/** DROP EXTENSION (vector/pg_trgm/…): ninguna histórica. Cualquiera nueva se rechaza. */
const DROP_EXTENSION_PERMITIDAS = new Set<string>([]);

/** timestamptz→timestamp: ninguna histórica (el drift de I-420 son 144). Cualquiera nueva se rechaza. */
const TIMESTAMPTZ_A_TIMESTAMP_PERMITIDAS = new Set<string>([]);

export interface Hallazgo {
    migracion: string;
    patron: string;
    linea: number;
    texto: string;
    allowlist: string;
}

const RE_DROP_INDEX = /\bDROP\s+INDEX\b/i;
const RE_DROP_EXTENSION = /\bDROP\s+EXTENSION\b/i;
// timestamptz→timestamp: `SET DATA TYPE TIMESTAMP(n)` o `TYPE timestamp` SIN tz/with time zone.
const RE_A_TIMESTAMP = /(SET DATA TYPE|\bTYPE)\s+TIMESTAMP(?!TZ)/i;
const RE_ES_TIMESTAMPTZ = /TIMESTAMPTZ|WITH TIME ZONE/i;

export interface ResultadoEscaneo {
    hallazgos: Hallazgo[];
    /** Cuántas migraciones (con `migration.sql` legible) se escanearon de verdad. 0 = candado CIEGO. */
    migracionesLeidas: number;
}

export function buscarDriftDestructivo(migrationsDir: string): ResultadoEscaneo {
    const hallazgos: Hallazgo[] = [];
    let migraciones: string[];
    try {
        migraciones = readdirSync(migrationsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
    } catch {
        return { hallazgos, migracionesLeidas: 0 };
    }
    let migracionesLeidas = 0;
    for (const mig of migraciones) {
        let sql: string;
        try {
            sql = readFileSync(path.join(migrationsDir, mig, "migration.sql"), "utf8");
        } catch {
            continue;
        }
        migracionesLeidas += 1;
        sql.split("\n").forEach((raw, i) => {
            const L = raw.trim();
            if (L.startsWith("--") || L === "") return; // comentario/vacío: no es un statement
            const linea = i + 1;
            if (RE_DROP_INDEX.test(L) && !DROP_INDEX_PERMITIDAS.has(mig)) {
                hallazgos.push({ migracion: mig, patron: "DROP INDEX", linea, texto: L, allowlist: "DROP_INDEX_PERMITIDAS" });
            }
            if (RE_DROP_EXTENSION.test(L) && !DROP_EXTENSION_PERMITIDAS.has(mig)) {
                hallazgos.push({ migracion: mig, patron: "DROP EXTENSION", linea, texto: L, allowlist: "DROP_EXTENSION_PERMITIDAS" });
            }
            if (RE_A_TIMESTAMP.test(L) && !RE_ES_TIMESTAMPTZ.test(L) && !TIMESTAMPTZ_A_TIMESTAMP_PERMITIDAS.has(mig)) {
                hallazgos.push({ migracion: mig, patron: "timestamptz→timestamp", linea, texto: L, allowlist: "TIMESTAMPTZ_A_TIMESTAMP_PERMITIDAS" });
            }
        });
    }
    return { hallazgos, migracionesLeidas };
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-drift-destructivo-migracion.ts") || process.argv[1].endsWith("no-drift-destructivo-migracion.js"));

if (esEntry) {
    const { hallazgos, migracionesLeidas } = buscarDriftDestructivo(MIGRATIONS_DIR);
    // El candado NO puede quedar ciego en silencio: leer 0 migraciones significa que no validó
    // NADA (carpeta equivocada, cwd distinto). Se trata como FALLO, no como verde (I-420, seguimiento).
    if (migracionesLeidas === 0) {
        console.error(
            `\n❌ I-420 · el candado leyó 0 migraciones en ${MIGRATIONS_DIR} — está CIEGO y no valida nada. ` +
                "Corré desde la raíz del producto (donde vive prisma/migrations). Se aborta, no pasa verde.\n",
        );
        process.exit(1);
    }
    if (hallazgos.length > 0) {
        console.error(`\n❌ I-420 · migración(es) con drift destructivo NO permitido (${hallazgos.length}):\n`);
        for (const h of hallazgos) {
            console.error(`  ${h.migracion}  [${h.patron}]  L${h.linea}: ${h.texto.slice(0, 100)}`);
        }
        console.error(
            "\nEsto suele ser el drift que 'prisma migrate dev' genera porque el schema NO modela trigram/" +
                "vector/índices-parciales ni anota @db.Timestamptz. NO commitees esa migración generada.\n" +
                "Si el drop/ALTER es INTENCIONAL y lo revisó DATOS, agregá la migración al allowlist " +
                "correspondiente en scripts/lint/no-drift-destructivo-migracion.ts.\n",
        );
        process.exit(1);
    }
    console.log(
        `✅ I-420 · ${migracionesLeidas} migraciones revisadas, sin drift destructivo ` +
            `(allowlist DROP INDEX: ${DROP_INDEX_PERMITIDAS.size}; DROP EXTENSION y timestamptz→timestamp: 0 permitidas).`,
    );
}
