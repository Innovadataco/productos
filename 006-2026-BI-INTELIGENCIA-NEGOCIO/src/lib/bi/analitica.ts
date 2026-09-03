// src/lib/bi/analitica.ts · Capa de datos de Analítica (predictiva + detector
// de fenómenos) · Producto 006 · BI v2 · SPEC-006
//
// Alimenta la pantalla "Analítica" (mockup-bi-v4.html) con datos REALES de la
// réplica read-only de PI: "Reporte", "ClasificacionIA", "Suscripcion",
// "Hijo", "Ciudad", "Plataforma". La réplica es chica: toda regla es honesta
// con poca base y con el vacío.
//
// Candado 9 (honestidad): toda cifra sale del ResultSet. Sin base estadística
// el valor es NULL (la UI dice "sin base", jamás inventa un número); sin
// fenómenos detectados el detector devuelve [] (NUNCA se fabrica uno).
// Candado 10: ninguna cifra se genera fuera de las filas devueltas; en JS
// solo se computan estadísticos SOBRE esas filas (media, desvío, regresión)
// y DIFERENCIAS entre instantes (que no dependen de timezone).
//
// Queries: $queryRaw parametrizadas con identificadores SIEMPRE citados;
// conteos casteados a ::int y medias/desvíos a ::float. Las ventanas
// temporales se calculan EN SQL (date_trunc/interval con la TZ de sesión);
// los umbrales de negocio llegan como PARÁMETROS ($1...) desde bi_config (B3).
//
// Reglas deterministas (cada una con su fórmula documentada junto al código):
//   (a) anomaliaHoy    · z-score del día contra los 28 días completos previos
//   (b) proyeccion     · tendencia N semanas (4/8/12) + regresión lineal
//                        ± desvío residual · getProyeccion reutilizable
//   (c) riesgoCategorias · frecuencia 12 m × sensibilidad (lista en bi_config)
//   (d) fenomenos      · plataforma×categoría / ráfaga / geografía fuera de rango
//   (e) frentePadre    · padres como actores (agregados, sin identidades · Ley 1581)
//   (f) vencimientos   · Suscripcion ACTIVA por ventana de fechaFin + freemium
//   (g) cronologia     · 12 meses móviles con marcador de mes con fenómeno activo
//   (h) detalleMes     · drill-down de un mes 'YYYY-MM' (timeline interactiva):
//                        total, categoría top, alertas/escaladas del mes,
//                        anónimos y fenómenos detectados EN ese mes

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { formatearCategoria, redondear1 } from "@/lib/bi/pulso";

// ─── Contrato expuesto a la UI de Analítica ──────────────────────────────────
export interface AnaliticaData {
    /**
     * Anomalía del día: z-score = (hoy − media28d) / desvío28d sobre los 28
     * días COMPLETOS previos (la jornada en curso no contamina la base).
     * sigma y media28d son NULL cuando el histórico no alcanza 28 días
     * (primer reporte dentro de la ventana o sin reportes) o cuando el
     * desvío es 0/NULL (sin dispersión no hay z-score honesto). esAnomalo se
     * decide con el sigma CRUDO contra el umbral `bi.analitica.sigma`; el
     * sigma expuesto va redondeado a 1 decimal (candado 9: la decisión no
     * depende del redondeo de pantalla).
     */
    anomaliaHoy: {
        sigma: number | null;
        totalHoy: number;
        media28d: number | null;
        esAnomalo: boolean;
    };
    /**
     * Proyección de la próxima semana con el horizonte default de 8 semanas
     * COMPLETAS cerradas (la en curso está incompleta y sesgaría la
     * tendencia), huecos rellenados con 0 en SQL. min/max = ŷ de la regresión
     * lineal simple ± desvío de residuos (fórmula junto a proyectarSemana).
     * hayBase=false si <4 semanas con actividad → min/max NULL (la serie
     * igual se expone, con sus 0 reales). La lógica vive en getProyeccion,
     * reutilizable con horizonte 4/8/12 (filtro de tiempo de la UI).
     */
    proyeccion: {
        semanaProximaMin: number | null;
        semanaProximaMax: number | null;
        tendenciaSemanas: { semana: string; total: number }[];
        hayBase: boolean;
    };
    /**
     * Riesgo por categoría: total de los últimos 12 meses (join
     * ClasificacionIA) con severidad determinista (criterio junto a
     * severidadCategoria). `categoria` es el ENUM crudo de PI; la UI lo
     * formatea con formatearCategoria (mismo criterio que Pulso).
     */
    riesgoCategorias: {
        categoria: string;
        total: number;
        severidad: "critica" | "alta" | "vigilar" | "baja";
    }[];
    /**
     * Detector de fenómenos: máx MAX_FENOMENOS, ordenados por severidad
     * (alta → media → informativa) y deduplicados por foco (una plataforma =
     * un fenómeno, se queda el cruce más fuerte). Vacío → [] (jamás se
     * fabrica evidencia). `evidencia` cita las cifras del ResultSet que
     * dispararon la regla.
     */
    fenomenos: {
        tipo: "plataforma" | "rafaga" | "geo";
        titulo: string;
        detalle: string;
        evidencia: string;
        sev: "alta" | "media" | "informativa";
    }[];
    /**
     * Frente padre (agregados, sin identidades): reportes con origenRol
     * 'PARENT' vs. el resto (mockup: "reportes de colegios"), suscripciones
     * de titular PADRE (cualquier estado: mide relación comercial abierta,
     * no solo vigente) y menores activos en círculo de confianza.
     */
    frentePadre: {
        reportesPadres: number;
        reportesColegios: number;
        suscripcionesPadre: number;
        hijosCirculo: number;
    };
    /**
     * Vencimientos comerciales: Suscripcion ACTIVA con fechaFin en (0,7],
     * (7,15], (15,30] días (ventanas disjuntas calculadas EN SQL) +
     * freemiumActivo (esFreemium AND ACTIVA, independiente de fechaFin).
     */
    vencimientos: {
        estaSemana: number;
        en15d: number;
        en30d: number;
        freemiumActivo: number;
    };
    /**
     * Cronología: 12 meses móviles (incluye el en curso) con 0s rellenados en
     * SQL. conFenomeno=true si el mes intersecta la ventana de algún fenómeno
     * activo detectado por las reglas (d); las reglas miran ventanas
     * RECIENTES, así que en la práctica solo los meses actuales pueden
     * marcarse — el pasado sin fenómeno vivo queda false (honesto: no se
     * reconstruye historia que el detector no evaluó).
     */
    cronologia: { mes: string; total: number; conFenomeno: boolean }[];
}

// ─── Filas crudas de las consultas (alias snake_case del ResultSet) ──────────
interface FilaAnomaliaBase {
    media_28d: number | null;
    desvio_28d: number | null;
}
interface FilaHoyPrimer {
    hoy: number;
    primer_reporte: Date | null;
}
interface FilaSemana {
    semana: string;
    total: number;
}
interface FilaRiesgo {
    categoria: string;
    total: number;
}
interface FilaPlataformaPar {
    plataforma: string;
    categoria: string;
    reciente_14d: number;
    previa_14d: number;
}
interface FilaRafaga {
    total: number;
}
interface FilaRafagaPlataforma {
    plataforma: string;
    total: number;
}
interface FilaGeo {
    ciudad: string;
    actual: number;
    media: number;
    desvio: number;
}
interface FilaFrentePadreReportes {
    reportes_padres: number;
    reportes_colegios: number;
}
interface FilaFrentePadreComercial {
    suscripciones_padre: number;
    hijos_circulo: number;
}
interface FilaVencimientos {
    esta_semana: number;
    en_15d: number;
    en_30d: number;
    freemium_activo: number;
}
interface FilaCronologia {
    mes: string;
    total: number;
}
interface FilaDetalleTotales {
    total: number;
    anonimos: number;
}
interface FilaDetalleAlertas {
    total: number;
    escaladas: number;
}

// ─── Constantes documentadas ─────────────────────────────────────────────────
/** Tope de fenómenos visibles (forma de la vista del mockup v4). */
const MAX_FENOMENOS = 3;
/** Mínimo de reportes recientes (14 d) para evaluar un cruce plataforma×categoría. */
const MIN_RECIENTES_PLATAFORMA = 5;
/** Tope de filas crudas del sondeo plataforma×categoría (prefiltro SQL). */
const TOPE_PARES_PLATAFORMA = 25;
/** Mínimo de semanas con actividad para proyectar (hayBase). */
const MIN_SEMANAS_BASE = 4;
/** Mínimo de semanas previas con datos para evaluar el fenómeno geo. */
const MIN_SEMANAS_PREVIAS_GEO = 3;
/** Posición de ranking hasta la que una categoría no sensible queda "vigilar". */
const TOP_VIGILAR = 5;
const MS_DIA = 86_400_000;
const DIAS_BASE_ANOMALIA = 28;
/** Horizonte por defecto de la proyección semanal (el histórico del mockup v4). */
const SEMANAS_PROYECCION_DEFAULT = 8;
/** Formato canónico del parámetro mes de la timeline interactiva. */
export const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// Defaults B3: solo se usan si la clave falta en bi_config o no parsea (warn).
const DEFAULT_SIGMA = 2;
const DEFAULT_RIESGO_MINIMO = 50;
const DEFAULT_SUBIDA_PCT = 100;
const DEFAULT_RAFAGA_HORAS = 48;

// Fallbacks de degradación (consulta rota → vacío honesto con warn, candado 9).
const HOY_PRIMER_VACIO: FilaHoyPrimer = { hoy: 0, primer_reporte: null };
const FRENTE_REPORTES_VACIO: FilaFrentePadreReportes = {
    reportes_padres: 0,
    reportes_colegios: 0,
};
const FRENTE_COMERCIAL_VACIO: FilaFrentePadreComercial = {
    suscripciones_padre: 0,
    hijos_circulo: 0,
};
const VENCIMIENTOS_VACIOS: FilaVencimientos = {
    esta_semana: 0,
    en_15d: 0,
    en_30d: 0,
    freemium_activo: 0,
};

// ─── Helpers puros ───────────────────────────────────────────────────────────

/**
 * Lee un umbral numérico de bi_config. Clave ausente o valor no numérico →
 * default con warn (B3: el parámetro manda, pero un valor corrupto jamás
 * rompe la pantalla ni se traduce en un umbral inventado distinto del
 * documentado).
 */
async function umbralNumerico(clave: string, def: number): Promise<number> {
    try {
        const crudo = await getConfig(clave);
        if (crudo === null) return def;
        const valor = Number(crudo);
        if (!Number.isFinite(valor)) {
            console.warn(
                `[Analitica] Config '${clave}' no numérica ('${crudo}'): se usa default ${def}`,
            );
            return def;
        }
        return valor;
    } catch (error) {
        console.warn(
            `[Analitica] Config '${clave}' ilegible: default ${def} — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return def;
    }
}

/** Lista de categorías sensibles (CSV de enums en bi_config, ya seedeada). */
async function categoriasSensibles(): Promise<Set<string>> {
    try {
        const crudo = await getConfig("operacion.categorias_sensibles");
        if (!crudo) return new Set();
        return new Set(
            crudo
                .split(",")
                .map((c) => c.trim())
                .filter((c) => c.length > 0),
        );
    } catch (error) {
        console.warn(
            `[Analitica] Lista de sensibles ilegible: ninguna sensible — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return new Set();
    }
}

/**
 * Ejecuta un sondeo de una sección. Si falla (réplica caída, permisos), la
 * sección degrada a VACÍO con warn — nunca se inventa un dato para
 * rellenarla (candado 9) y el resto de Analítica vive. Mismo patrón que
 * `intentar` del Pulso.
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Analitica] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Proyección de la próxima semana por regresión lineal simple sobre las 8
 * semanas (fórmula determinista):
 *   x_i = 0..7 (índice de semana) · y_i = total semanal
 *   pendiente b = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)² · intercepto a = ȳ − b·x̄
 *   ŷ₈ = a + 8b  (estimación puntual de la semana siguiente)
 *   residuos e_i = y_i − (a + b·x_i) · s = √(Σe_i² / (n−2))
 *   (n−2 porque se estimaron 2 parámetros: desvío residual insesgado)
 *   rango = [max(0, round(ŷ₈ − s)), round(ŷ₈ + s)]
 * El piso en 0 es físico (no existen reportes negativos), no un invento.
 */
function proyectarSemana(totales: number[]): { min: number; max: number } {
    const n = totales.length;
    const mediaX = (n - 1) / 2;
    const mediaY = totales.reduce((acc, y) => acc + y, 0) / n;
    let numerador = 0;
    let denominador = 0;
    for (let x = 0; x < n; x++) {
        numerador += (x - mediaX) * (totales[x] - mediaY);
        denominador += (x - mediaX) ** 2;
    }
    const b = denominador > 0 ? numerador / denominador : 0;
    const a = mediaY - b * mediaX;
    const estimada = a + b * n;
    let sumaResiduos2 = 0;
    for (let x = 0; x < n; x++) {
        sumaResiduos2 += (totales[x] - (a + b * x)) ** 2;
    }
    const desvioResidual = Math.sqrt(sumaResiduos2 / (n - 2));
    return {
        min: Math.max(0, Math.round(estimada - desvioResidual)),
        max: Math.round(estimada + desvioResidual),
    };
}

/**
 * Severidad determinista de una categoría (criterio, en orden):
 *   1. sensible y total ≥ bi.analitica.riesgo_minimo → 'critica'
 *      (conducta de las más graves Y con volumen sostenido);
 *   2. sensible bajo el mínimo → 'alta' (grave pero con poca frecuencia);
 *   3. la no sensible más frecuente del ranking → 'alta' (domina el volumen
 *      real aunque no sea de las graves);
 *   4. no sensible dentro del top TOP_VIGILAR del ranking → 'vigilar'
 *      (visible en la vista, frecuencia a vigilar);
 *   5. el resto → 'baja'.
 * `sensibles` vacío (config ilegible) → nadie es 'critica' por la regla 1:
 * deny-by-default, no se eleva severidad sin la lista explícita.
 */
function severidadCategoria(
    fila: FilaRiesgo,
    posicion: number,
    sensibles: Set<string>,
    riesgoMinimo: number,
    primeraNoSensible: string | null,
): "critica" | "alta" | "vigilar" | "baja" {
    if (sensibles.has(fila.categoria)) {
        return fila.total >= riesgoMinimo ? "critica" : "alta";
    }
    if (fila.categoria === primeraNoSensible) return "alta";
    if (posicion < TOP_VIGILAR) return "vigilar";
    return "baja";
}

/** Clave 'YYYY-MM' de un instante en la TZ del servidor (= TZ de sesión SQL). */
function claveMes(instanteMs: number): string {
    const d = new Date(instanteMs);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Meses ('YYYY-MM') que intersecta una ventana [desdeMs, hastaMs]: sirve para
 * marcar en la cronología el/los meses con fenómeno activo.
 */
function mesesDeVentana(desdeMs: number, hastaMs: number): Set<string> {
    const claves = new Set<string>();
    const cursor = new Date(desdeMs);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= hastaMs) {
        claves.add(claveMes(cursor.getTime()));
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return claves;
}

/** Fenómeno candidato con su ventana (interna: alimenta la cronología). */
interface FenomenoInterno {
    tipo: "plataforma" | "rafaga" | "geo";
    titulo: string;
    detalle: string;
    evidencia: string;
    sev: "alta" | "media" | "informativa";
    /** Clave de deduplicación por foco (ej. 'plataforma:Roblox'). */
    foco: string;
    /** Inicio de la ventana de evidencia (para el marcador de cronología). */
    ventanaDesdeMs: number;
}

// ─── Proyección semanal con horizonte parametrizable ─────────────────────────

/** Horizontes de historia permitidos (filtro de tiempo de la UI: 4/8/12). */
export type HorizonteProyeccion = 4 | 8 | 12;

/** Contrato de la proyección (lo consume getAnalitica y GET .../proyeccion). */
export interface ProyeccionSemanal {
    /** min/max = ŷ ± desvío residual; NULL si hayBase=false (candado 9). */
    min: number | null;
    max: number | null;
    tendenciaSemanas: { semana: string; total: number }[];
    hayBase: boolean;
}

/**
 * (b) Proyección de la próxima semana sobre N semanas COMPLETAS cerradas
 * (la en curso, incompleta, sesgaría la tendencia), huecos rellenados con 0
 * en SQL. Misma regresión lineal simple ± desvío residual de siempre (la
 * fórmula está junto a proyectarSemana); solo cambia N. hayBase=false si
 * faltan semanas en la serie o hay menos de MIN_SEMANAS_BASE con actividad
 * → min/max NULL y la serie igual se expone con sus 0 reales.
 * La consulta degrada a vacío con warn si la réplica falla (misma regla
 * `intentar` que el resto de secciones).
 */
export async function getProyeccion(
    semanas: HorizonteProyeccion,
): Promise<ProyeccionSemanal> {
    const filasSemanas = await intentar(
        "proyeccion-semanas",
        prisma.$queryRaw<FilaSemana[]>`
            SELECT to_char(s."semana", 'YYYY-MM-DD') AS semana,
                   count(r."id")::int AS total
            FROM generate_series(
                   date_trunc('week', now()) - make_interval(weeks => ${semanas}),
                   date_trunc('week', now()) - interval '1 week',
                   interval '1 week'
                 ) AS s("semana")
            LEFT JOIN "Reporte" r
              ON r."creadoEn" >= s."semana"
             AND r."creadoEn" <  s."semana" + interval '1 week'
             AND r."eliminado" = false
            GROUP BY s."semana"
            ORDER BY s."semana"`,
    );
    const tendenciaSemanas = filasSemanas.map((f) => ({
        semana: f.semana,
        total: f.total,
    }));
    const semanasConActividad = tendenciaSemanas.filter((s) => s.total > 0).length;
    const hayBase =
        tendenciaSemanas.length === semanas && semanasConActividad >= MIN_SEMANAS_BASE;
    const rango = hayBase
        ? proyectarSemana(tendenciaSemanas.map((s) => s.total))
        : null;
    return {
        min: rango ? rango.min : null,
        max: rango ? rango.max : null,
        tendenciaSemanas,
        hayBase,
    };
}

// ─── Detalle de un mes (timeline interactiva) ────────────────────────────────

/** Contrato del drill-down de un mes 'YYYY-MM' (GET .../detalle-mes). */
export interface DetalleMes {
    mes: string;
    /** Reportes del mes (eliminados excluidos). */
    total: number;
    /** Categoría más frecuente del mes (join ClasificacionIA); NULL si ningún
     * reporte del mes quedó clasificado (candado 9: no se presume categoría). */
    categoriaTop: { categoria: string; total: number } | null;
    /** Alertas de colegio CREADAS en el mes. */
    alertasDelMes: number;
    /** De esas, las que quedaron en estado 'escalada'. */
    escaladasDelMes: number;
    /**
     * Fenómenos detectados EN el mes, como texto determinista:
     *   · ráfaga: reportes con marca esRafaga del antifraude en el mes;
     *   · pico: total del mes supera media + σ·desvío de los 12 meses de su
     *     año calendario (σ = bi.analitica.sigma, default 2; mismo umbral que
     *     anomaliaHoy). Los meses futuros del año en curso cuentan 0 real —
     *     se documenta, no se recorta historia que no existe.
     * Sin detecciones → [] (jamás se fabrica uno).
     */
    fenomenos: string[];
    /** Reportes anónimos del mes. */
    anonimos: number;
}

/**
 * (h) Detalle de un mes. Formato inválido → null; mes sin reportes → null
 * (la ruta lo traduce a 404 'sin_datos': no hay nada honesto que contar).
 * Los 5 sondeos corren en paralelo y cada uno degrada a vacío por su cuenta
 * (mismo patrón `intentar`); las ventanas del mes se calculan EN SQL a
 * partir del parámetro 'YYYY-MM' ya validado (TZ de sesión, como todo lo
 * demás del módulo).
 */
export async function getDetalleMes(mes: string): Promise<DetalleMes | null> {
    if (!MES_REGEX.test(mes)) return null;

    const sigmaUmbral = await umbralNumerico("bi.analitica.sigma", DEFAULT_SIGMA);

    const [filasTotales, filasCategoria, filasAlertas, filasRafaga, filasAnio] =
        await Promise.all([
            // Total del mes + anónimos (esAnonimo).
            intentar(
                "detalle-mes-totales",
                prisma.$queryRaw<FilaDetalleTotales[]>`
                    SELECT count(*)::int AS total,
                           count(*) FILTER (WHERE "esAnonimo" = true)::int AS anonimos
                    FROM "Reporte"
                    WHERE "eliminado" = false
                      AND "creadoEn" >= (${mes} || '-01')::date
                      AND "creadoEn" <  (${mes} || '-01')::date + interval '1 month'`,
            ),
            // Categoría top del mes: solo reportes CLASIFICADOS (sin
            // clasificación no hay categoría honesta que asignar).
            intentar(
                "detalle-mes-categoria",
                prisma.$queryRaw<FilaRiesgo[]>`
                    SELECT c."categoria"::text AS categoria,
                           count(*)::int AS total
                    FROM "Reporte" r
                    JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                    WHERE r."eliminado" = false
                      AND r."creadoEn" >= (${mes} || '-01')::date
                      AND r."creadoEn" <  (${mes} || '-01')::date + interval '1 month'
                    GROUP BY c."categoria"
                    ORDER BY total DESC, c."categoria"
                    LIMIT 1`,
            ),
            // Alertas creadas en el mes y cuántas quedaron escaladas.
            intentar(
                "detalle-mes-alertas",
                prisma.$queryRaw<FilaDetalleAlertas[]>`
                    SELECT count(*)::int AS total,
                           count(*) FILTER (WHERE "estado" = 'escalada')::int AS escaladas
                    FROM "AlertaColegio"
                    WHERE "creadoEn" >= (${mes} || '-01')::date
                      AND "creadoEn" <  (${mes} || '-01')::date + interval '1 month'`,
            ),
            // Marca esRafaga del antifraude activada en el mes.
            intentar(
                "detalle-mes-rafaga",
                prisma.$queryRaw<FilaRafaga[]>`
                    SELECT count(*)::int AS total
                    FROM "Reporte"
                    WHERE "eliminado" = false
                      AND "esRafaga" = true
                      AND "creadoEn" >= (${mes} || '-01')::date
                      AND "creadoEn" <  (${mes} || '-01')::date + interval '1 month'`,
            ),
            // Los 12 meses del año calendario del mes pedido (huecos a 0):
            // base del pico σ. La media/desvío se computan en JS SOBRE estas
            // filas (candado 10: ninguna cifra fuera del ResultSet).
            intentar(
                "detalle-mes-anio",
                prisma.$queryRaw<FilaCronologia[]>`
                    SELECT to_char(m."mes", 'YYYY-MM') AS mes,
                           count(r."id")::int AS total
                    FROM generate_series(
                           date_trunc('year', (${mes} || '-01')::date),
                           date_trunc('year', (${mes} || '-01')::date) + interval '11 months',
                           interval '1 month'
                         ) AS m("mes")
                    LEFT JOIN "Reporte" r
                      ON r."creadoEn" >= m."mes"
                     AND r."creadoEn" <  m."mes" + interval '1 month'
                     AND r."eliminado" = false
                    GROUP BY m."mes"
                    ORDER BY m."mes"`,
            ),
        ]);

    const totales = filasTotales[0] ?? { total: 0, anonimos: 0 };
    // Mes sin reportes: nada que detallar (la ruta responde 404 sin_datos).
    if (totales.total === 0) return null;

    const alertas = filasAlertas[0] ?? { total: 0, escaladas: 0 };

    // Fenómenos del mes (texto determinista; solo cifras del ResultSet y
    // estadísticos calculados sobre ellas).
    const fenomenos: string[] = [];

    const totalRafaga = filasRafaga[0]?.total ?? 0;
    if (totalRafaga > 0) {
        fenomenos.push(
            `${totalRafaga} reportes con marca de ráfaga (esRafaga) del antifraude en el mes`,
        );
    }

    // Pico: total del mes contra media + σ·desvío (muestral, n−1) de los 12
    // meses de su año. Sin dispersión (desvío 0) no hay σ honesto → no pico.
    if (filasAnio.length >= 2) {
        const totalesAnio = filasAnio.map((f) => f.total);
        const media =
            totalesAnio.reduce((acc, t) => acc + t, 0) / totalesAnio.length;
        const varianza =
            totalesAnio.reduce((acc, t) => acc + (t - media) ** 2, 0) /
            (totalesAnio.length - 1);
        const desvio = Math.sqrt(varianza);
        if (desvio > 0 && totales.total > media + sigmaUmbral * desvio) {
            const sigmaMes = (totales.total - media) / desvio;
            fenomenos.push(
                `Pico del año: ${totales.total} reportes, +${redondear1(sigmaMes)}σ sobre la media anual de ${redondear1(media)}`,
            );
        }
    }

    return {
        mes,
        total: totales.total,
        categoriaTop: filasCategoria[0]
            ? { categoria: filasCategoria[0].categoria, total: filasCategoria[0].total }
            : null,
        alertasDelMes: alertas.total,
        escaladasDelMes: alertas.escaladas,
        fenomenos,
        anonimos: totales.anonimos,
    };
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Datos vivos de Analítica. Los umbrales se leen de bi_config (B3) y los 11
 * sondeos corren en paralelo; cada uno degrada a vacío por su cuenta si
 * falla. Ningún valor se hardcodea: todo sale de las filas devueltas o de
 * estadísticos calculados sobre ellas (candados 9 y 10).
 */
export async function getAnalitica(): Promise<AnaliticaData> {
    const ahoraMs = Date.now();

    const [sigmaUmbral, riesgoMinimo, subidaPct, rafagaHoras, sensibles] =
        await Promise.all([
            umbralNumerico("bi.analitica.sigma", DEFAULT_SIGMA),
            umbralNumerico("bi.analitica.riesgo_minimo", DEFAULT_RIESGO_MINIMO),
            umbralNumerico("bi.analitica.subida_pct", DEFAULT_SUBIDA_PCT),
            umbralNumerico("bi.analitica.rafaga_horas", DEFAULT_RAFAGA_HORAS),
            categoriasSensibles(),
        ]);

    const [
        proyeccionBase,
        filasBaseAnomalia,
        filasHoyPrimer,
        filasRiesgo,
        filasPlataforma,
        filasRafaga,
        filasRafagaPlataforma,
        filasGeo,
        filasFrenteReportes,
        filasFrenteComercial,
        filasVencimientos,
        filasCronologia,
    ] = await Promise.all([
        // (b) Proyección: misma regla de siempre con el horizonte default de
        // 8 semanas (getProyeccion ya degrada a vacío por su cuenta).
        getProyeccion(SEMANAS_PROYECCION_DEFAULT),
        // (a) Base estadística del día: 28 días COMPLETOS previos, huecos a 0
        // (generate_series). La jornada en curso queda fuera: comparar hoy
        // contra una media que lo incluye diluiría la señal.
        intentar(
            "anomalia-base",
            prisma.$queryRaw<FilaAnomaliaBase[]>`
                SELECT avg(d.total)::float AS media_28d,
                       stddev_samp(d.total)::float AS desvio_28d
                FROM (
                  SELECT count(r."id")::int AS total
                  FROM generate_series(
                         date_trunc('day', now()) - interval '28 days',
                         date_trunc('day', now()) - interval '1 day',
                         interval '1 day'
                       ) AS s("dia")
                  LEFT JOIN "Reporte" r
                    ON r."creadoEn" >= s."dia"
                   AND r."creadoEn" <  s."dia" + interval '1 day'
                   AND r."eliminado" = false
                  GROUP BY s."dia"
                ) d`,
        ),
        // (a) Hoy + antigüedad del histórico: si el primer reporte cae dentro
        // de la ventana de 28 días, la base está incompleta → NULL honesto.
        intentar(
            "anomalia-hoy",
            prisma.$queryRaw<FilaHoyPrimer[]>`
                SELECT count(*) FILTER (
                         WHERE "creadoEn" >= date_trunc('day', now()))::int AS hoy,
                       min("creadoEn") AS primer_reporte
                FROM "Reporte"
                WHERE "eliminado" = false`,
        ),
        // (c) Frecuencia 12 m por categoría (join ClasificacionIA; el
        // reporte sin clasificar no entra: no hay categoría honesta que
        // asignarle). Orden: volumen DESC, desempate alfabético estable.
        intentar(
            "riesgo-categorias",
            prisma.$queryRaw<FilaRiesgo[]>`
                SELECT c."categoria"::text AS categoria,
                       count(*)::int AS total
                FROM "Reporte" r
                JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                WHERE r."eliminado" = false
                  AND r."creadoEn" >= now() - interval '12 months'
                GROUP BY c."categoria"
                ORDER BY total DESC, c."categoria"`,
        ),
        // (d·plataforma) Cruces plataforma×categoría con volumen reciente;
        // el umbral % se aplica en JS sobre las filas (candado 10: las cifras
        // son las del ResultSet; el filtro es aritmética sobre ellas).
        // previa = 0 no se evalúa (sin base no hay % honesto, candado 9).
        intentar(
            "fenomeno-plataforma",
            prisma.$queryRaw<FilaPlataformaPar[]>`
                SELECT p."nombre" AS plataforma,
                       c."categoria"::text AS categoria,
                       count(*) FILTER (
                         WHERE r."creadoEn" >= now() - interval '14 days')::int AS reciente_14d,
                       count(*) FILTER (
                         WHERE r."creadoEn" >= now() - interval '28 days'
                           AND r."creadoEn" <  now() - interval '14 days')::int AS previa_14d
                FROM "Reporte" r
                JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                JOIN "Plataforma" p ON p."id" = r."plataformaId"
                WHERE r."eliminado" = false
                  AND r."creadoEn" >= now() - interval '28 days'
                GROUP BY p."nombre", c."categoria"
                HAVING count(*) FILTER (
                         WHERE r."creadoEn" >= now() - interval '14 days') >= ${MIN_RECIENTES_PLATAFORMA}
                ORDER BY reciente_14d DESC, p."nombre", c."categoria"
                LIMIT ${TOPE_PARES_PLATAFORMA}`,
        ),
        // (d·ráfaga) Reportes marcados esRafaga por el antifraude de PI en la
        // ventana configurable. La marca YA es señal de campaña/ataque
        // coordinado: basta 1 para reportarlo (no se inventa umbral extra).
        intentar(
            "fenomeno-rafaga",
            prisma.$queryRaw<FilaRafaga[]>`
                SELECT count(*)::int AS total
                FROM "Reporte"
                WHERE "eliminado" = false
                  AND "esRafaga" = true
                  AND "creadoEn" >= now() - make_interval(hours => ${rafagaHoras})`,
        ),
        // (d·ráfaga) Plataforma dominante de la ventana (si hay): contexto
        // para el detalle, no condición del disparo.
        intentar(
            "fenomeno-rafaga-plataforma",
            prisma.$queryRaw<FilaRafagaPlataforma[]>`
                SELECT p."nombre" AS plataforma,
                       count(*)::int AS total
                FROM "Reporte" r
                JOIN "Plataforma" p ON p."id" = r."plataformaId"
                WHERE r."eliminado" = false
                  AND r."esRafaga" = true
                  AND r."creadoEn" >= now() - make_interval(hours => ${rafagaHoras})
                GROUP BY p."nombre"
                ORDER BY total DESC, p."nombre"
                LIMIT 1`,
        ),
        // (d·geo) Ciudad cuya semana EN CURSO supera media + σ·desvío de sus
        // 8 semanas previas (0s rellenados por ciudad), con mínimo
        // MIN_SEMANAS_PREVIAS_GEO previas con datos y desvío > 0 (sin
        // dispersión no hay σ honesto). El umbral llega parametrizado.
        intentar(
            "fenomeno-geo",
            prisma.$queryRaw<FilaGeo[]>`
                WITH ciudades AS (
                  SELECT DISTINCT "ciudadId"
                  FROM "Reporte"
                  WHERE "eliminado" = false
                    AND "ciudadId" IS NOT NULL
                    AND "creadoEn" >= now() - interval '9 weeks'
                ),
                previas AS (
                  SELECT ci."ciudadId", s."semana", count(r."id")::int AS total
                  FROM ciudades ci
                  CROSS JOIN generate_series(
                        date_trunc('week', now()) - interval '8 weeks',
                        date_trunc('week', now()) - interval '1 week',
                        interval '1 week'
                      ) AS s("semana")
                  LEFT JOIN "Reporte" r
                    ON r."ciudadId" = ci."ciudadId"
                   AND r."creadoEn" >= s."semana"
                   AND r."creadoEn" <  s."semana" + interval '1 week'
                   AND r."eliminado" = false
                  GROUP BY ci."ciudadId", s."semana"
                ),
                stats AS (
                  SELECT "ciudadId",
                         avg(total)::float AS media,
                         stddev_samp(total)::float AS desvio,
                         count(*) FILTER (WHERE total > 0)::int AS semanas_con_datos
                  FROM previas
                  GROUP BY "ciudadId"
                ),
                actual AS (
                  SELECT "ciudadId", count(*)::int AS total
                  FROM "Reporte"
                  WHERE "eliminado" = false
                    AND "ciudadId" IS NOT NULL
                    AND "creadoEn" >= date_trunc('week', now())
                  GROUP BY "ciudadId"
                )
                SELECT ciu."nombre" AS ciudad,
                       a.total::int AS actual,
                       s.media,
                       s.desvio
                FROM actual a
                JOIN stats s ON s."ciudadId" = a."ciudadId"
                JOIN "Ciudad" ciu ON ciu."id" = a."ciudadId"
                WHERE s.semanas_con_datos >= ${MIN_SEMANAS_PREVIAS_GEO}
                  AND s.desvio > 0
                  AND a.total > s.media + ${sigmaUmbral} * s.desvio
                ORDER BY (a.total - s.media) / s.desvio DESC, ciu."nombre"`,
        ),
        // (e) Frente padre · reportes: origenRol='PARENT' (literal del campo
        // String de PI, SPEC-295) vs. el resto (incluye anónimos NULL y
        // colegios — el mockup lo rotula "reportes de colegios").
        intentar(
            "frente-padre-reportes",
            prisma.$queryRaw<FilaFrentePadreReportes[]>`
                SELECT count(*) FILTER (WHERE "origenRol" = 'PARENT')::int AS reportes_padres,
                       count(*) FILTER (WHERE "origenRol" IS DISTINCT FROM 'PARENT')::int AS reportes_colegios
                FROM "Reporte"
                WHERE "eliminado" = false`,
        ),
        // (e) Frente padre · comercial y círculo: suscripciones de titular
        // PADRE (cualquier estado: relación comercial abierta) y menores
        // activos (mismo criterio 'activo' que Personas).
        intentar(
            "frente-padre-comercial",
            prisma.$queryRaw<FilaFrentePadreComercial[]>`
                SELECT
                  (SELECT count(*) FROM "Suscripcion"
                    WHERE "tipoTitular" = 'PADRE')::int AS suscripciones_padre,
                  (SELECT count(*) FROM "Hijo"
                    WHERE "estado" = 'activo')::int AS hijos_circulo`,
        ),
        // (f) Vencimientos: solo ACTIVA (mismo criterio estricto del Pulso:
        // EN_GRACIA/SUSPENDIDA/CANCELADA/PENDIENTE_AUTORIZACION no son
        // relación vigente). Ventanas disjuntas (0,7] · (7,15] · (15,30]
        // calculadas EN SQL; freemium independiente de fechaFin.
        intentar(
            "vencimientos",
            prisma.$queryRaw<FilaVencimientos[]>`
                SELECT count(*) FILTER (
                         WHERE "fechaFin" >  now()
                           AND "fechaFin" <= now() + interval '7 days')::int AS esta_semana,
                       count(*) FILTER (
                         WHERE "fechaFin" >  now() + interval '7 days'
                           AND "fechaFin" <= now() + interval '15 days')::int AS en_15d,
                       count(*) FILTER (
                         WHERE "fechaFin" >  now() + interval '15 days'
                           AND "fechaFin" <= now() + interval '30 days')::int AS en_30d,
                       count(*) FILTER (WHERE "esFreemium")::int AS freemium_activo
                FROM "Suscripcion"
                WHERE "estado" = 'ACTIVA'`,
        ),
        // (g) Cronología: 12 meses móviles (incluye el en curso), huecos a 0.
        intentar(
            "cronologia",
            prisma.$queryRaw<FilaCronologia[]>`
                SELECT to_char(m."mes", 'YYYY-MM') AS mes,
                       count(r."id")::int AS total
                FROM generate_series(
                       date_trunc('month', now()) - interval '11 months',
                       date_trunc('month', now()),
                       interval '1 month'
                     ) AS m("mes")
                LEFT JOIN "Reporte" r
                  ON r."creadoEn" >= m."mes"
                 AND r."creadoEn" <  m."mes" + interval '1 month'
                 AND r."eliminado" = false
                GROUP BY m."mes"
                ORDER BY m."mes"`,
        ),
    ]);

    // ── (a) Anomalía del día: z-score con base honesta ──
    const base = filasBaseAnomalia[0] ?? { media_28d: null, desvio_28d: null };
    const hoyPrimer = filasHoyPrimer[0] ?? HOY_PRIMER_VACIO;
    // Base completa: existe histórico y el primer reporte es anterior a la
    // ventana de 28 días (si no, la media/desvío estarían inflados de 0s).
    const hayBaseAnomalia =
        hoyPrimer.primer_reporte !== null &&
        ahoraMs - hoyPrimer.primer_reporte.getTime() >= DIAS_BASE_ANOMALIA * MS_DIA;
    const mediaOk =
        hayBaseAnomalia && base.media_28d !== null ? redondear1(base.media_28d) : null;
    const sigmaCrudo =
        hayBaseAnomalia &&
        base.media_28d !== null &&
        base.desvio_28d !== null &&
        base.desvio_28d > 0
            ? (hoyPrimer.hoy - base.media_28d) / base.desvio_28d
            : null;
    const anomaliaHoy: AnaliticaData["anomaliaHoy"] = {
        sigma: sigmaCrudo !== null ? redondear1(sigmaCrudo) : null,
        totalHoy: hoyPrimer.hoy,
        media28d: mediaOk,
        // La decisión usa el sigma CRUDO: el redondeo de pantalla jamás
        // cambia el veredicto (candado 9).
        esAnomalo: sigmaCrudo !== null && sigmaCrudo >= sigmaUmbral,
    };

    // ── (b) Proyección: getProyeccion(8) mapeado al contrato de Analítica ──
    const proyeccion: AnaliticaData["proyeccion"] = {
        semanaProximaMin: proyeccionBase.min,
        semanaProximaMax: proyeccionBase.max,
        tendenciaSemanas: proyeccionBase.tendenciaSemanas,
        hayBase: proyeccionBase.hayBase,
    };

    // ── (c) Riesgo por categoría: frecuencia × sensibilidad ──
    const primeraNoSensible =
        filasRiesgo.find((f) => !sensibles.has(f.categoria))?.categoria ?? null;
    const riesgoCategorias = filasRiesgo.map((f, i) => ({
        categoria: f.categoria,
        total: f.total,
        severidad: severidadCategoria(f, i, sensibles, riesgoMinimo, primeraNoSensible),
    }));

    // ── (d) Detector de fenómenos: candidatos por regla, dedupe, top 3 ──
    const candidatos: FenomenoInterno[] = [];

    // plataforma×categoría: reciente supera en subida_pct% a la previa
    // (ambas ventanas de 14 días; previa>0 ya filtrada abajo). Ordenadas por
    // factor de subida DESC: el cruce más fuerte primero (dedupe por foco).
    const paresValidos = filasPlataforma
        .filter(
            (f) =>
                f.previa_14d > 0 &&
                f.reciente_14d >= MIN_RECIENTES_PLATAFORMA &&
                f.reciente_14d >= f.previa_14d * (1 + subidaPct / 100),
        )
        .sort((a, b) => b.reciente_14d / b.previa_14d - a.reciente_14d / a.previa_14d);
    for (const f of paresValidos) {
        const subidaReal = Math.round((f.reciente_14d / f.previa_14d - 1) * 100);
        const categoriaLegible = formatearCategoria(f.categoria);
        candidatos.push({
            tipo: "plataforma",
            titulo: `${f.plataforma} × ${categoriaLegible}: +${subidaReal}% en 14 días`,
            detalle: `El cruce ${f.plataforma} × ${categoriaLegible.toLowerCase()} rompe su ritmo de las 2 semanas previas.`,
            // Evidencia semanalizada (ventanas de 14 d → ÷2): las cifras son
            // las del ResultSet, solo re-expresadas por semana.
            evidencia: `De ${Math.round(f.previa_14d / 2)} a ${Math.round(f.reciente_14d / 2)} reportes semanales (14 días vs. 14 previos)`,
            sev: "alta",
            foco: `plataforma:${f.plataforma}`,
            ventanaDesdeMs: ahoraMs - 14 * MS_DIA,
        });
    }

    // ráfaga: esRafaga en la ventana configurable (evidencia: N en N h).
    const totalRafaga = filasRafaga[0]?.total ?? 0;
    if (totalRafaga > 0) {
        const plataformaRafaga = filasRafagaPlataforma[0]?.plataforma ?? null;
        candidatos.push({
            tipo: "rafaga",
            titulo: `${totalRafaga} reportes en ráfaga en ${rafagaHoras} horas`,
            detalle: plataformaRafaga
                ? `Marca esRafaga del antifraude activa, concentrada en ${plataformaRafaga} — posible campaña o ataque coordinado.`
                : "Marca esRafaga del antifraude activa — posible campaña o ataque coordinado.",
            evidencia: plataformaRafaga
                ? `${totalRafaga} reportes esRafaga en ${rafagaHoras} h · plataforma: ${plataformaRafaga}`
                : `${totalRafaga} reportes esRafaga en ${rafagaHoras} h`,
            sev: "media",
            foco: "rafaga",
            ventanaDesdeMs: ahoraMs - rafagaHoras * 3_600_000,
        });
    }

    // geo: ciudad fuera de rango contra su propio histórico semanal.
    for (const f of filasGeo) {
        const sigmaCiudad = (f.actual - f.media) / f.desvio;
        candidatos.push({
            tipo: "geo",
            titulo: `${f.ciudad}: +${redondear1(sigmaCiudad)}σ sobre su histórico`,
            detalle:
                "No es el volumen absoluto: es que la ciudad rompe su propio patrón semanal.",
            evidencia: `${f.actual} reportes esta semana frente a su media de ${Math.round(f.media)} (8 semanas previas)`,
            sev: "informativa",
            foco: `geo:${f.ciudad}`,
            // La semana en curso se aproxima a los últimos 7 días SOLO para
            // el marcador de cronología (el cómputo real es date_trunc SQL).
            ventanaDesdeMs: ahoraMs - 7 * MS_DIA,
        });
    }

    // Dedupe por foco (una plataforma = un fenómeno: ya ordenados, gana el
    // primero) + orden por severidad (alta → media → informativa, estable)
    // + tope MAX_FENOMENOS. Los candidatos ya entran en orden de sev.
    const vistos = new Set<string>();
    const fenomenosInternos = candidatos
        .filter((c) => {
            if (vistos.has(c.foco)) return false;
            vistos.add(c.foco);
            return true;
        })
        .slice(0, MAX_FENOMENOS);
    const fenomenos: AnaliticaData["fenomenos"] = fenomenosInternos.map(
        ({ tipo, titulo, detalle, evidencia, sev }) => ({
            tipo,
            titulo,
            detalle,
            evidencia,
            sev,
        }),
    );

    // ── (e) Frente padre ──
    const frenteReportes = filasFrenteReportes[0] ?? FRENTE_REPORTES_VACIO;
    const frenteComercial = filasFrenteComercial[0] ?? FRENTE_COMERCIAL_VACIO;

    // ── (f) Vencimientos ──
    const venc = filasVencimientos[0] ?? VENCIMIENTOS_VACIOS;

    // ── (g) Cronología con marcadores de mes con fenómeno activo ──
    const mesesConFenomeno = new Set<string>();
    for (const f of fenomenosInternos) {
        for (const clave of mesesDeVentana(f.ventanaDesdeMs, ahoraMs)) {
            mesesConFenomeno.add(clave);
        }
    }
    const cronologia = filasCronologia.map((f) => ({
        mes: f.mes,
        total: f.total,
        conFenomeno: mesesConFenomeno.has(f.mes),
    }));

    return {
        anomaliaHoy,
        proyeccion,
        riesgoCategorias,
        fenomenos,
        frentePadre: {
            reportesPadres: frenteReportes.reportes_padres,
            reportesColegios: frenteReportes.reportes_colegios,
            suscripcionesPadre: frenteComercial.suscripciones_padre,
            hijosCirculo: frenteComercial.hijos_circulo,
        },
        vencimientos: {
            estaSemana: venc.esta_semana,
            en15d: venc.en_15d,
            en30d: venc.en_30d,
            freemiumActivo: venc.freemium_activo,
        },
        cronologia,
    };
}
