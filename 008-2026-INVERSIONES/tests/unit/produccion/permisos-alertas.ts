// Lista única de los permisos de inv_alertas (el servicio de las alertas, PR-B) y de los que inv_app recibe para las
// alertas, que deben quedar en la base. La usan tests/unit/produccion/privilegios-alertas.test.ts (contra el texto de
// docker/migrador/privilegios.sql), tests/integracion/alertas-leer.test.ts (los lectores reales con solo estos permisos) y
// roles-base.test.ts (contra el catálogo de una PostgreSQL 16 real, solo CI). No es una prueba (no termina en .test.ts).
//
// Lectura de inv_alertas: lo que toca leer-entrada.ts (src/alertas), por `select` explícito:
//  - las especies (instrumento) y la tenencia por operación (orden y lote, como movimientosDeEspecies de src/plan/resultados-lote.ts;
//    sumada por día y especie en una consulta cruda, sin la llave "id"; y la última barra de hoy por especie, también cruda);
//    los findMany de Prisma 5.22 sí agregan la llave "id" al SELECT (precio_cierre, regla_plan…, medido con el registro de consultas);
//  - los cierres vigentes y las barras intradía (precio_cierre, precio_intradia) con su hora de traída y su fuente;
//  - la versión vigente del plan y sus reglas CON el nivel y la condición pero SIN la acción, la cantidad, el plazo ni el detalle;
//  - los decretos (dividendo_decretado) con sus fechas y el calendario de la BVC;
//  - los umbrales vigentes (umbral_version) SIN el motivo ni el autor, y las alertas ya guardadas (alerta).
// Nada de usuario, filas crudas, caja, certificaciones ni diario. Escritura: solo INSERT en alerta, sin "detectadaEn" (la pone
// la base). Sin UPDATE, DELETE, TRUNCATE ni permisos de tabla completa.
//
// inv_app (la app): INSERT por columna en umbral_version (sin "creadaEn") y en alerta_vista (sin "vistaEn"); NUNCA en alerta.
import type { Permiso } from "./permisos-precios";

export type { Permiso };
export { filasPermisos } from "./permisos-precios";

export const ALERTA_COLUMNAS = [
  "id", "dia", "tipo", "instrumentoId", "reglaId", "decretoId", "sentido", "base", "precio", "referencia", "variacionPct", "umbral",
  "instanteDato", "traidoEn", "fuente", "conRetraso", "minutosDeEdad", "esFechaEx", "umbralVersionId", "motorVersion", "detectadaEn",
] as const;

export const UMBRAL_VERSION_COLUMNAS = [
  "id", "version", "alertaCercaPct", "alertaCercaActiva", "alertaNivelCruzadoActiva", "alertaMovimientoPct", "alertaMovimientoActiva",
  "alertaCaidaPct", "alertaCaidaActiva", "alertaDatoViejoMin", "alertaDatoViejoActiva", "alertaExDiasHabiles", "alertaExActiva",
  "motivo", "autorId", "creadaEn",
] as const;

export const ALERTA_VISTA_COLUMNAS = ["id", "alertaId", "usuarioId", "vistaEn"] as const;

/** Lo que inv_alertas lee de umbral_version: todo menos el motivo y el autor. */
export const UMBRAL_VERSION_SELECT_ALERTAS = UMBRAL_VERSION_COLUMNAS.filter((c) => c !== "motivo" && c !== "autorId");

export const PERMISOS_ALERTAS: readonly Permiso[] = [
  // Solo el id: el INSERT … ON CONFLICT DO NOTHING no lee nada y el «de a una» devuelve el id; las alertas ya guardadas no se leen.
  { tabla: "alerta", privilegio: "SELECT", columnas: ["id"] },
  { tabla: "alerta", privilegio: "INSERT", columnas: ALERTA_COLUMNAS.filter((c) => c !== "detectadaEn") },
  { tabla: "calendario_bvc", privilegio: "SELECT", columnas: ["dia", "esHabil"] },
  { tabla: "dividendo_decretado", privilegio: "SELECT", columnas: ["id", "instrumentoId", "fechaEx", "fechaPago", "anulada", "reemplazadoEn"] },
  { tabla: "instrumento", privilegio: "SELECT", columnas: ["id", "tipo", "nemotecnico", "activo"] },
  { tabla: "lote", privilegio: "SELECT", columnas: ["instrumentoId", "origen", "cantidad", "fechaCompra"] },
  { tabla: "orden", privilegio: "SELECT", columnas: ["instrumentoId", "lado", "estado", "fechaOperacion", "cantidadCompletada"] },
  { tabla: "plan_version", privilegio: "SELECT", columnas: ["id", "version", "vigenteDesde"] },
  { tabla: "precio_cierre", privilegio: "SELECT", columnas: ["id", "instrumentoId", "fecha", "precio", "fuente", "traidoEn", "reemplazadoEn"] },
  { tabla: "precio_intradia", privilegio: "SELECT", columnas: ["instrumentoId", "instante", "precio", "fuente", "conRetraso", "traidoEn"] },
  { tabla: "regla_plan", privilegio: "SELECT", columnas: ["id", "planVersionId", "instrumentoId", "condicion", "nivel"] },
  { tabla: "umbral_version", privilegio: "SELECT", columnas: UMBRAL_VERSION_SELECT_ALERTAS },
];

/** Las columnas que se le niegan a inv_alertas aunque la tabla se lea (existen en el modelo). */
export const PROHIBIDAS_ALERTAS: Readonly<Record<string, readonly string[]>> = {
  umbral_version: ["motivo", "autorId"],
  regla_plan: ["accion", "cantidad", "plazoHasta", "detalle"],
  orden: ["totalInvertido", "totalEstimado", "comision", "precioUnitario"],
  lote: ["costoTotal", "ordenId"],
};

/** Tablas que inv_alertas no toca. */
export const TABLAS_FUERA_ALERTAS = [
  "usuario", "fila_fuente", "carga_archivo", "token_acceso", "intento_ingreso", "codigo_recuperacion", "dividendo", "decision",
  "enlace_decision_orden", "config_ia", "resumen_ia", "tarifa_comision", "alerta_vista", "ajuste_caja", "certificacion", "certificacion_posicion",
  "simbolo_precio", "asignacion_venta",
] as const;

/** Los permisos nuevos de inv_app para las alertas (se suman a los de siempre; ver privilegios.test.ts). */
export const PERMISOS_APP_ALERTAS: readonly Permiso[] = [
  { tabla: "umbral_version", privilegio: "INSERT", columnas: UMBRAL_VERSION_COLUMNAS.filter((c) => c !== "creadaEn") },
  { tabla: "alerta_vista", privilegio: "INSERT", columnas: ALERTA_VISTA_COLUMNAS.filter((c) => c !== "vistaEn") },
];
