// scripts/verify-catalogo.ts · Guardián del contrato catálogo ↔ esquema real
// Producto 006 · BI v2 · Auditoría BI vs PI 2026-09-03 (DEFECTO 2) · candados
//
// Dos chequeos contra la base bi-db:
//
// 1. CONTRATO (siempre): toda tabla activa del catálogo del chat y toda su
//    columna no excluida deben EXISTIR en information_schema. Nació del
//    desfase que hacía que el chat respondiera CERO con seguridad: el catálogo
//    declaró 26 tablas y 3 no existían, con 24 columnas fantasma encima
//    (auditoría: "el panel dice 26 tablas; funcionan 23").
//
// 2. FREScura (--frescura): las tablas de flujo operativo deben seguir
//    recibiendo escrituras. Nació del DEFECTO 1: PI dejó de escribir HijoPadre
//    el 31-08-2026 y BI siguió contándola 5 días sin que nadie se enterara.
//    En la CI (BD vacía) este chequeo no aplica — por eso es opt-in.
//
// Uso:
//   npm run verify:catalogo                 # contrato (CI, BD vacía ok)
//   npm run verify:catalogo -- --frescura   # contrato + frescura (deploy)
//
// Falla (exit 1) listando cada desfase. La CI y el deploy script lo usan como
// ratchet: si el catálogo se desfía del esquema real o una tabla de flujo se
// congela, el pipeline se pone rojo ANTES de que el chat mienta otra vez.

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CON_FRESURA = process.argv.includes("--frescura");

/**
 * Tablas de flujo operativo que DEBEN seguir recibiendo escrituras.
 * Columna temporal = nombre real verificado en information_schema.
 * Umbral común: 14 días (absorbe fines de semana largos y pausas cortas;
 * una tabla de flujo silenciosa por más de eso merece investigación, no
 * datos congelados presentados como vivos).
 */
const TABLAS_FLUJO: Array<{ tabla: string; columnaTemporal: string }> = [
    { tabla: "Reporte", columnaTemporal: "creadoEn" },
    { tabla: "ClasificacionIA", columnaTemporal: "creadoEn" },
    { tabla: "TransicionReporte", columnaTemporal: "creadoEn" },
    { tabla: "SolicitudComite", columnaTemporal: "creadoEn" },
    { tabla: "AlertaColegio", columnaTemporal: "creadoEn" },
    { tabla: "CorreccionAdmin", columnaTemporal: "creadoEn" },
    { tabla: "clasificacion_rubrica_votos", columnaTemporal: "creadoEn" },
];

const DIAS_UMBRAL = 14;

interface Desfase {
    tipo: "tabla" | "columna" | "frescura";
    detalle: string;
}

async function verificarContrato(desfases: Desfase[]): Promise<void> {
    // Tablas activas declaradas que no existen en el esquema real.
    const tablasRotas = await prisma.$queryRaw<Array<{ nombreFuente: string }>>`
        SELECT t."nombreFuente"
          FROM bi_catalogo_tabla t
         WHERE t.activo = true
           AND NOT EXISTS (
               SELECT 1 FROM information_schema.tables i
                WHERE i.table_schema = 'public' AND i.table_name = t."nombreFuente"
           )
         ORDER BY 1`;
    for (const t of tablasRotas) {
        desfases.push({ tipo: "tabla", detalle: `tabla activa del catálogo que NO existe en bi-db: "${t.nombreFuente}"` });
    }

    // Columnas no excluidas de tablas activas que no existen en su tabla.
    const columnasRotas = await prisma.$queryRaw<Array<{ tabla: string; columna: string }>>`
        SELECT t."nombreFuente" AS tabla, c."nombreFuente" AS columna
          FROM bi_catalogo_columna c
          JOIN bi_catalogo_tabla t ON t.id = c."tablaId"
         WHERE t.activo = true
           AND c.excluida = false
           AND NOT EXISTS (
               SELECT 1 FROM information_schema.columns i
                WHERE i.table_schema = 'public'
                  AND i.table_name = t."nombreFuente"
                  AND i.column_name = c."nombreFuente"
           )
         ORDER BY 1, 2`;
    for (const c of columnasRotas) {
        desfases.push({ tipo: "columna", detalle: `columna declarada que NO existe: "${c.tabla}"."${c.columna}"` });
    }
}

async function verificarFrescura(desfases: Desfase[]): Promise<void> {
    for (const f of TABLAS_FLUJO) {
        // La tabla debe existir (el contrato ya lo reporta si no); acá solo
        // medimos recencia. Una fila por tabla, parametrizada vía Prisma.
        const filas = await prisma.$queryRaw<Array<{ tabla: string; ultima: Date | null }>>(
            Prisma.raw(
                `SELECT '${f.tabla}' AS tabla, max("${f.columnaTemporal}") AS ultima FROM "${f.tabla}"`,
            ),
        );
        const ultima = filas[0]?.ultima ?? null;
        if (!ultima) {
            desfases.push({ tipo: "frescura", detalle: `tabla de flujo "${f.tabla}" sin escrituras o vacía: no hay max("${f.columnaTemporal}")` });
            continue;
        }
        const dias = (Date.now() - new Date(ultima).getTime()) / 86_400_000;
        if (dias > DIAS_UMBRAL) {
            desfases.push({
                tipo: "frescura",
                detalle: `tabla de flujo "${f.tabla}" congelada: última escritura hace ${Math.floor(dias)} días (${ultima.toISOString().slice(0, 10)} > umbral ${DIAS_UMBRAL} días)`,
            });
        }
    }
}

async function main(): Promise<void> {
    const desfases: Desfase[] = [];
    await verificarContrato(desfases);
    if (CON_FRESURA) await verificarFrescura(desfases);

    if (desfases.length > 0) {
        console.error(`[VERIFY-CATALOGO] FALLO: ${desfases.length} desfase(s) catálogo↔esquema:`);
        for (const d of desfases) console.error(`  · [${d.tipo}] ${d.detalle}`);
        console.error("[VERIFY-CATALOGO] Corregir el seed/migración del catálogo antes de desplegar.");
        process.exitCode = 1;
    } else {
        console.log(`[VERIFY-CATALOGO] OK: contrato catálogo↔esquema en verde${CON_FRESURA ? " · frescura de tablas de flujo en verde" : ""}.`);
    }
}

main()
    .catch((e: unknown) => {
        console.error(`[VERIFY-CATALOGO] Error al verificar (no se pudo completar): ${e instanceof Error ? e.message : String(e)}`);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
