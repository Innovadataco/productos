// src/lib/bi/capacidad.ts · Capacidad operativa: cola de moderación en vivo
// Producto 006 · BI v2 · Rediseño 2026-09-03 (espejo honesto de PI)
//
// Fuente: tablas replicadas de PI en bi-db (solo lectura):
//   Reporte(estado, eliminado, operadorId)  — operadorId replica desde PI
//     (publicación bi_replica, SPEC de réplica 2026-09-03); NULL = sin asignar
//   PerfilOperador(usuarioId, cupoMaximo)   — cupo real por operador
//
// QUÉ MIDE: la cola de MODERACIÓN, con la MISMA semántica que el panel de
// asignación de PI (src/lib/operadores de 002, referencia SOLO LECTURA):
//   · Carga del operador = reportes en REVISION_MANUAL + POSIBLE_SPAM no
//     eliminados (ESTADOS_CARGA_OPERADOR de PI).
//   · Casos en gestión = los de esa cola con operadorId NOT NULL.
//   · Sin asignar = los de esa cola con operadorId NULL.
//   · Cupo por operador = PerfilOperador.cupoMaximo replicado — NUNCA un
//     número quemado: el parámetro bi_config bi.capacidad.casos_max_operario
//     quedó SIN EFECTO en esta tarjeta (era un placeholder que desvirtuaba
//     la cifra frente al cupo real de PI).
//
// Candados:
//   9  — honestidad con el vacío y con la brecha: CERO operarios con casos o
//        cupo aún no sincronizado se dice en la cara (mensaje propio), no se
//        disimula ni se rellena con un default inventado;
//        si una consulta falla, su sección degrada a ceros con warn (jamás un
//        dato inventado para rellenar la tarjeta).
//   10 — TODA cifra sale del ResultSet; los únicos números derivados son
//        cupoTotal/cupoLibre (sumas documentadas) y el semáforo.
//   PII — la tabla Usuario NO se replica (Ley 1581): la identidad del
//        operario JAMÁS se resuelve. Lo único visible es un seudónimo
//        determinista: "Operario #" + últimos 4 chars del cuid (mismo estilo
//        que la referencia #XXXXXX del ticker del Pulso).
//
// DIFERENCIAS con la capa de alertas (a propósito, documentadas):
//   Esta tarjeta es SOLO moderación (cola del operador). Las alertas de
//   colegio viven en su propia sección del tablero de Operación (semáforo de
//   colegios + sin-asignar por colegio, abajo en este mismo archivo): son
//   capas distintas con asignaciones distintas (asignadoAId del colegio vs
//   operadorId del moderador) y mezclarlas produjo cifras que contradecían
//   el panel de PI (hallazgo Jelkin 2026-09-03).
//
// Semáforo (función pura semaforoCapacidad, la UI no calcula):
//   rubí  — sinAsignar > cupoLibre: la cola sin operario supera el cupo
//           disponible (con cupoLibre 0 y sin asignar > 0, brecha total).
//   ámbar — uso ≥ 80% del cupo total sin superarlo (constante de
//           PRESENTACIÓN) o cupo aún desconocido (PerfilOperador vacío en
//           la réplica: no se afirma suficiencia sin conocer el cupo).
//   pino  — el resto.

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI (Pulso y Operación) ───────────────────────────
export interface CasoOperario {
    /** Seudónimo determinista "Operario #XXXX" (Ley 1581) */
    id: string;
    /** Casos activos (REVISION_MANUAL + POSIBLE_SPAM) asignados */
    activos: number;
    /** Cupo real del perfil replicado; null = perfil aún no sincronizado */
    cupo: number | null;
}

export interface CapacidadData {
    /** Casos activos asignados a operadores (REVISION_MANUAL + POSIBLE_SPAM) */
    casosEnGestion: number;
    /** Casos activos SIN operador asignado (la cola real de espera) */
    sinAsignar: number;
    /** Operadores DISTINTOS con al menos un caso activo asignado */
    operariosConCasos: number;
    /** Suma de cupoMaximo de los operadores con casos (cero si aún no sincroniza) */
    cupoTotal: number;
    /** Cupo libre = cupoTotal - casosEnGestion (nunca negativo) */
    cupoLibre: number;
    /** Operadores con casos cuyo perfil/cupo aún no llega a la réplica */
    operariosSinPerfil: number;
    /** Casos activos por operario (seudonimizado), mayor carga primero */
    casosPorOperario: CasoOperario[];
    /** sinAsignar > cupoLibre */
    demandaExcede: boolean;
    /** Frase determinista y honesta del estado de la cola (ver casos abajo) */
    mensaje: string;
}

export type SemaforoCapacidad = "rubi" | "ambar" | "pino";

// ─── Filas crudas de las consultas ───────────────────────────────────────────
interface FilaCola {
    en_gestion: number;
    sin_asignar: number;
}
interface FilaCasosOperario {
    operario_id: string;
    activos: number;
}
interface FilaCupo {
    operario_id: string;
    cupo: number;
}
interface FilaSinAsignarColegio {
    colegio_id: string;
    colegio: string;
    sin_asignar: number;
}

// Fallbacks de degradación (consulta rota → ceros con warn, candado 9).
const COLA_VACIA: FilaCola = { en_gestion: 0, sin_asignar: 0 };

/** Constante de presentación del semáforo: uso ≥ 80% del cupo → "cerca". */
const UMBRAL_CERCANIA = 0.8;

// Estados de Reporte que componen la carga del operador (ESPEJO del
// ESTADOS_CARGA_OPERADOR de PI, 002 · src/lib/operadores/estados.ts): la
// bandeja del operador = revisión manual + posible spam. Van como LITERALES
// inline en el SQL (enums de PI, no parámetros de usuario — mismo criterio
// que los literales de estado en pulso.ts/operacion.ts); interpolarlos como
// ${} los convertiría en parámetros enlazados y rompería el IN.

/**
 * Ejecuta un sondeo de capacidad; si falla degrada a vacío con warn y el
 * resto de la vista vive (mismo patrón que `intentar` de pulso.ts).
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Capacidad] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Seudónimo determinista del operario: "Operario #" + últimos 4 chars del
 * cuid en mayúscula. JAMÁS se resuelve la identidad (Usuario no se replica).
 * Colisiones de 4 chars entre dos operarios son posibles en teoría; con los
 * volúmenes reales de la réplica no se dan y el impacto sería solo visual
 * (dos filas con el mismo seudónimo, ambas con su conteo real).
 */
export function pseudonimoOperario(operadorId: string): string {
    return `Operario #${operadorId.slice(-4).toUpperCase()}`;
}

/**
 * Mensaje determinista según el caso (candado 9: la brecha se dice en
 * palabras, no solo en color).
 */
function construirMensaje(c: {
    colaOk: boolean;
    sinAsignar: number;
    casosEnGestion: number;
    operariosConCasos: number;
    cupoTotal: number;
    cupoLibre: number;
    operariosSinPerfil: number;
    demandaExcede: boolean;
    cerca: boolean;
}): string {
    // Cola ilegible (sondeo roto): no se afirma vacío ni lleno — se dice que
    // no se pudo leer. Candado 9: un vacío NO comprobado no se presenta como hecho.
    if (!c.colaOk) {
        return (
            `No se pudo leer la cola de moderación (consulta fallida): ` +
            `${c.operariosConCasos} operarios con casos, cupo total ${c.cupoTotal}.`
        );
    }
    if (c.sinAsignar === 0 && c.casosEnGestion === 0) {
        return "Cola de moderación vacía: sin casos activos en gestión ni esperando asignación.";
    }
    if (c.cupoTotal === 0) {
        // PerfilOperador aún no sincroniza en la réplica: se dice, no se inventa.
        return (
            `Cupo no disponible en la réplica: ${c.casosEnGestion} casos en gestión de ` +
            `${c.operariosConCasos} operarios, sin asignar ${c.sinAsignar}. ` +
            "La sincronización de PerfilOperador lo completará."
        );
    }
    if (c.operariosSinPerfil > 0) {
        // Cupo parcial: falta el perfil de algunos operarios con casos.
        return (
            `Cupo parcialmente visible (${c.operariosSinPerfil} operario(s) sin perfil en la ` +
            `réplica): ${c.casosEnGestion} casos en gestión, ${c.sinAsignar} sin asignar, ` +
            `${c.cupoLibre} cupos libres confirmados de ${c.cupoTotal}.`
        );
    }
    if (c.sinAsignar === 0 && c.casosEnGestion === 0) {
        return "Cola de moderación vacía: sin casos activos en gestión ni esperando asignación.";
    }
    const cuantos = c.operariosConCasos === 1 ? "1 operario" : `${c.operariosConCasos} operarios`;
    if (c.demandaExcede) {
        return (
            `La cola sin asignar (${c.sinAsignar} casos) supera el cupo libre ` +
            `(${c.cupoLibre}): ${cuantos} con cupo total de ${c.cupoTotal} casos`
        );
    }
    if (c.cerca) {
        return (
            `Cupo al límite: ${c.cupoLibre} libres de ${c.cupoTotal} ` +
            `(${cuantos}, ${c.casosEnGestion} casos en gestión)`
        );
    }
    return (
        `Capacidad suficiente: ${c.cupoLibre} cupos libres de ${c.cupoTotal} ` +
        `(${cuantos}, ${c.casosEnGestion} casos en gestión, ${c.sinAsignar} sin asignar)`
    );
}

/**
 * Semáforo de la cola de moderación (función pura: la UI no calcula).
 * Con cupo desconocido (cupoTotal 0) se muestra ámbar: no se afirma
 * suficiencia sin conocer el cupo (candado 9).
 */
export function semaforoCapacidad(c: CapacidadData): SemaforoCapacidad {
    if (c.cupoTotal === 0) return c.casosEnGestion > 0 || c.sinAsignar > 0 ? "ambar" : "pino";
    if (c.demandaExcede) return "rubi";
    // Cerca del límite: lo que entra en el cupo (en gestión + cola) ≥ 80% de él.
    if (c.casosEnGestion + c.sinAsignar >= c.cupoTotal * UMBRAL_CERCANIA) return "ambar";
    return "pino";
}

/**
 * Cola de moderación en vivo. Tres sondeos independientes en paralelo; cada
 * uno degrada a ceros por su cuenta si falla. Los estados activos van como
 * literales SQL (enums de PI, no parámetros de usuario); los identificadores
 * de tabla/columna van SIEMPRE citados. El cupo sale SOLO de PerfilOperador
 * replicado — jamás un default quemado (B3: parámetros en BD, aquí la BD es
 * la réplica de PI).
 */
export async function getCapacidad(): Promise<CapacidadData> {
    // La cola lleva try/catch propio (no `intentar`): necesitamos distinguir
    // "cola vacía" (hecho) de "cola ilegible" (el sondeo falló) — candado 9:
    // un vacío no comprobado jamás se presenta como dato.
    let colaOk = true;
    const filasCola = await prisma.$queryRaw<FilaCola[]>`
        SELECT count(*)::int                                      AS en_gestion,
               count(*) FILTER (WHERE "operadorId" IS NULL)::int   AS sin_asignar
        FROM "Reporte"
        WHERE "estado" IN ('REVISION_MANUAL', 'POSIBLE_SPAM')
          AND "eliminado" = false`.catch((error: unknown) => {
        colaOk = false;
        console.warn(
            `[Capacidad] Sección 'cola-moderacion' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    });

    const [filasPorOperario, filasCupos] = await Promise.all([
        intentar(
            "casos-por-operario",
            prisma.$queryRaw<FilaCasosOperario[]>`
                SELECT "operadorId" AS operario_id, count(*)::int AS activos
                FROM "Reporte"
                WHERE "estado" IN ('REVISION_MANUAL', 'POSIBLE_SPAM')
                  AND "eliminado" = false
                  AND "operadorId" IS NOT NULL
                GROUP BY "operadorId"
                ORDER BY activos DESC, "operadorId" ASC`,
        ),
        intentar(
            "cupos-perfil-operador",
            prisma.$queryRaw<FilaCupo[]>`
                SELECT "usuarioId" AS operario_id, "cupoMaximo"::int AS cupo
                FROM "PerfilOperador"`,
        ),
    ]);

    const cola = filasCola[0] ?? COLA_VACIA;
    const casosEnGestion = cola.en_gestion;
    const sinAsignar = cola.sin_asignar;

    const cupoPorOperario = new Map(filasCupos.map((f) => [f.operario_id, f.cupo]));
    const operariosConCasos = filasPorOperario.length;
    // Candado 9: un operario con casos pero sin perfil en la réplica NO recibe
    // un cupo inventado — cuenta como "sin perfil" y queda fuera de la suma.
    const operariosSinPerfil = filasPorOperario.filter((f) => !cupoPorOperario.has(f.operario_id)).length;
    const cupoTotal = filasPorOperario.reduce(
        (acc, f) => acc + (cupoPorOperario.get(f.operario_id) ?? 0),
        0,
    );
    const cupoLibre = Math.max(0, cupoTotal - casosEnGestion);
    const demandaExcede = cupoTotal > 0 && sinAsignar > cupoLibre;
    const cerca =
        !demandaExcede && cupoTotal > 0 && casosEnGestion + sinAsignar >= cupoTotal * UMBRAL_CERCANIA;

    return {
        casosEnGestion,
        sinAsignar,
        operariosConCasos,
        cupoTotal,
        cupoLibre,
        operariosSinPerfil,
        casosPorOperario: filasPorOperario.map((f) => ({
            id: pseudonimoOperario(f.operario_id),
            activos: f.activos,
            cupo: cupoPorOperario.get(f.operario_id) ?? null,
        })),
        demandaExcede,
        mensaje: construirMensaje({
            colaOk,
            sinAsignar,
            casosEnGestion,
            operariosConCasos,
            cupoTotal,
            cupoLibre,
            operariosSinPerfil,
            demandaExcede,
            cerca,
        }),
    };
}

/**
 * Alertas activas SIN asignar por colegio, para la columna "Sin asignar" del
 * tablero de Operación. La agregación es por "colegioId" (exacta); la llave
 * del Map es el NOMBRE del colegio porque la fila del tablero
 * (FilaOperacion) no expone el id por contrato y la UI solo puede unir por
 * nombre. Colegios homónimos consolidarían su conteo en una sola entrada —
 * en la réplica actual los nombres son únicos. Un colegio sin alertas sin
 * asignar NO aparece en el Map: la ausencia ES el conteo real en cero.
 */
export async function alertasSinAsignarPorColegio(): Promise<Map<string, number>> {
    const filas = await intentar(
        "sin-asignar-por-colegio",
        prisma.$queryRaw<FilaSinAsignarColegio[]>`
            SELECT a."colegioId" AS colegio_id,
                   c."nombre"    AS colegio,
                   count(*)::int AS sin_asignar
            FROM "AlertaColegio" a
            JOIN "Colegio" c ON c."id" = a."colegioId"
            WHERE a."estado" IN ('nueva', 'vista', 'escalada') AND a."asignadoAId" IS NULL
            GROUP BY a."colegioId", c."nombre"
            ORDER BY sin_asignar DESC, c."nombre" ASC`,
    );
    return new Map(filas.map((f) => [f.colegio, f.sin_asignar]));
}
