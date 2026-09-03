/**
 * SPEC-412 · configuración del poblador v5 — el primero que marca lo que siembra.
 *
 * Qué lo separa de v1…v4, y es toda la spec:
 *  · **No hay mapa de ids.** Las llaves las pone Prisma con `cuid()`; el script
 *    las recupera con `createManyAndReturn` y las registra en `demo_marcado`.
 *    Compará este archivo con `_common.ts:166-181` (el mapa `id` de v1): ese
 *    mapa es la falla que dejó 254 casos del comité sin poder abrir (I-292).
 *  · La idempotencia ya no la da el id determinista: la da la corrida marcada.
 *  · La reversibilidad no la da el prefijo: la da `demo_marcado`.
 *
 * Lo que SÍ se reusa de las versiones anteriores: los catálogos. Los relatos
 * por categoría, los pesos y la geografía ya están probados y no tienen PII —
 * se importan, no se copian.
 *
 * ## Volúmenes y forma de los datos — pedido de BI (CEO, 03-09-2026 16:0x)
 * Kimi verificó que BI no guarda ningún identificador de PI, así que las llaves
 * pueden cambiar. A cambio, la resiembra tiene que reponer lo que sus tableros
 * ya consumían: volumen, geografía, las 14 categorías, **reincidencia**,
 * **asignación desigual de alertas** y **transiciones escalonadas**.
 */
import { RELATOS, NICKS_DEMO2, PESOS_CATEGORIA, elegirPonderado } from "./_common-v2";
import { CIUDADES_DEMO4, PAISES_DEMO4 } from "./_common-v4";

export { elegirPonderado, CIUDADES_DEMO4, PAISES_DEMO4 };

export const DEMO5 = {
    /**
     * Marca visible para el ojo humano. El brief lo permite explícitamente
     * ("el nombre es cortesía; el marcador es el mecanismo") y por eso NADA
     * del camino de borrado la lee: se borra por `demo_marcado`, no por acá.
     */
    etiquetaHumana: "Demo",
    emailMarca: "+demo5-",
    dominio: "innovadataco.com",
    /** La misma contraseña sin sentido de v1: estas cuentas no hacen login real. */
    passwordSimulada: "PruebaDemo2026!",

    // ── Volúmenes pedidos por BI ────────────────────────────────────────────
    nColegios: 50,
    cursosPorColegio: 4,
    profesoresPorColegio: 6, // 50 × 6 = 300
    alumnosPorColegio: 40, // 50 × 40 = 2.000
    /** 40 % de los alumnos lleva dos acudientes → 2.000 × 1,4 ≈ 2.800. */
    fraccionDosAcudientes: 0.4,
    nReportes: 4200,
    /** Padres con expediente propio (brief §5: hoy hay 4 en producción). */
    nPadres: 60,
    /** Ventana de fechas: los últimos 12 meses (orden del CEO 03-09 16:0x). */
    mesesAtras: 12,

    /** Fracción de reportes que apunta a un sujeto sembrado → nace `AlertaColegio`. */
    reportesASujetoDemo: 0.83,
    /**
     * **Reincidencia deliberada** (BI · patrones): de los reportes que apuntan a
     * un sujeto sembrado, esta fracción reusa un sujeto YA reportado en vez de
     * tomar uno nuevo. Sin esto, el reparto uniforme deja casi cero repetición
     * y los patrones institucionales quedan vacíos.
     */
    reincidenciaPct: 0.35,
    /** De los reincidentes, cuántos quedan encadenados por `reportePrincipalId`. */
    cadenaPct: 0.4,

    /**
     * **Asignación desigual** (BI · semáforo de capacidad): la fracción de
     * alertas activas que se asigna al comité de cada colegio, cíclica. Uno casi
     * al tope, otro a la mitad, otro casi libre — igual que en v3, que era lo que
     * hacía que el semáforo mostrara sus tres estados.
     */
    fraccionesAsignacion: [0.95, 0.9, 0.8, 0.65, 0.2] as const,
    /** De las alertas escaladas, cuántas quedan con la solicitud aún PENDIENTE. */
    fraccionSolicitudesPendientes: 0.4,

    /**
     * Series numéricas DISJUNTAS de las que ya usaron v1 (NIT 900.000.001-050,
     * documentos `10NN…` y `20NN…`) y v2 (NIT desde 900.000.051). Arrancar en
     * 201 deja 150 de colchón por si alguien resembró con las viejas.
     */
    nitInicio: 900_000_201,
    documentoEstudianteBase: 15_000_000,
    documentoProfesorBase: 25_000_000,
} as const;

/**
 * Las **14 categorías** de `CategoriaConducta` que el producto usa para conducta
 * (más SPAM como fracción benigna). v2 pesaba 13 + SPAM: le faltaba `OTRO`, y BI
 * lo necesita para que no quede una columna muerta en sus tableros.
 */
export const PESOS_CATEGORIA_V5 = [
    ...PESOS_CATEGORIA,
    { categoria: "OTRO", peso: 0.02 },
] as const;

export type CategoriaV5 = (typeof PESOS_CATEGORIA_V5)[number]["categoria"];

/** Relatos por categoría. Se reusa el pool de v2 y se le agrega el de `OTRO`. */
export const RELATOS_V5: Record<CategoriaV5, readonly string[]> = {
    ...RELATOS,
    OTRO: [
        "Una cuenta desconocida insiste en agregar al menor y no queda claro qué busca.",
        "Recibió mensajes raros de un perfil que no reconoce; no hay amenaza explícita pero incomoda.",
        "Un contacto nuevo le hace preguntas sobre su rutina y sus horarios de salida del colegio.",
    ],
};

/** Nicks externos (los que no pertenecen a ningún sujeto sembrado). */
export const NICKS_EXTERNOS_V5 = NICKS_DEMO2;

/** Estados posibles de una alerta, tal como los escribe el flujo real. */
export const ESTADOS_ALERTA = ["nueva", "vista", "gestionada", "escalada", "cerrada"] as const;
export const PRIORIDADES_ALERTA = ["alta", "media", "baja"] as const;

/** La fracción de asignación del colegio i-ésimo. Cíclica, como en v3. */
export function fraccionAsignacionDe(indice: number): number {
    const f = DEMO5.fraccionesAsignacion;
    return f[indice % f.length];
}

/**
 * Número de solicitud del comité con la FORMA REAL que emite el producto:
 * `escalar/route.ts:24` hace `SOL-${randomBytes(4).toString("hex").toUpperCase()}`.
 *
 * v3 emitía `SOL-D3-000006` — único, pero de otra forma. Acá se respeta la del
 * producto: 8 hexadecimales en mayúscula, derivados del RNG sembrado para que
 * la corrida siga siendo reproducible.
 */
export function numeroSolicitudV5(r: () => number): string {
    let hex = "";
    for (let i = 0; i < 8; i++) {
        hex += Math.floor(r() * 16).toString(16).toUpperCase();
    }
    return `SOL-${hex}`;
}

/**
 * Número de seguimiento del reporte. Es también la CLAVE DE NEGOCIO con la que
 * el poblador vuelve a encontrar la fila que Prisma acaba de crear: es `@unique`
 * en el modelo, así que `createManyAndReturn` puede devolverlo junto al `cuid()`
 * y el mapeo no depende del orden de retorno.
 */
export function numeroSeguimientoV5(r: () => number): string {
    let s = "";
    const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < 10; i++) {
        s += alfabeto[Math.floor(r() * alfabeto.length)];
    }
    return `RPT-D5-${s}`;
}

/**
 * Fecha del incidente en los **últimos 12 meses** (orden del CEO 03-09 16:0x:
 * *"4.000+ reportes repartidos en 12 meses"*). Nunca futura; hora en punto
 * (G20: los minutos del hecho no se conocen).
 *
 * Nota de trazabilidad: v4 repartía en 2024/2025/2026 por pedido de Jelkin para
 * aquella corrida. Esta ventana es la que pidió BI para la resiembra; se cambia
 * en un solo lugar (`DEMO5.mesesAtras`) si hiciera falta volver atrás.
 */
export function fechaEnVentanaV5(r: () => number, ahora: Date): Date {
    const rangoMs = DEMO5.mesesAtras * 30 * 24 * 3600 * 1000;
    const fecha = new Date(ahora.getTime() - Math.floor(r() * rangoMs));
    fecha.setUTCMinutes(0, 0, 0);
    return fecha;
}

/** El texto del relato que corresponde a la categoría elegida. */
export function relatoDe(r: () => number, categoria: CategoriaV5): string {
    const pool = RELATOS_V5[categoria];
    return pool[Math.floor(r() * pool.length)];
}

export function nitColegioV5(indice: number): string {
    return String(DEMO5.nitInicio + indice - 1);
}

export function nombreColegioV5(indice: number): string {
    return `Colegio ${DEMO5.etiquetaHumana} ${String(indice).padStart(2, "0")} (SPEC-412)`;
}

export function emailAdminV5(indice: number): string {
    return `soporte${DEMO5.emailMarca}c${String(indice).padStart(2, "0")}@${DEMO5.dominio}`;
}

export function emailComiteV5(indice: number): string {
    return `soporte${DEMO5.emailMarca}c${String(indice).padStart(2, "0")}-comite@${DEMO5.dominio}`;
}

export function emailPadreV5(indice: number): string {
    return `soporte${DEMO5.emailMarca}padre${String(indice).padStart(3, "0")}@${DEMO5.dominio}`;
}
