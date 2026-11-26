// Lista única de los permisos de inv_ia (el servicio de los resúmenes con IA, fase E) que deben quedar en la base. La
// usan tests/unit/produccion/privilegios-ia.test.ts (contra el texto de docker/migrador/privilegios.sql),
// tests/integracion/ia/privilegios-ia.test.ts (los lectores reales con solo estos permisos) y roles-base.test.ts (contra
// el catálogo de una PostgreSQL 16 real, solo CI). No es una prueba (no termina en .test.ts).
//
// Lectura: las columnas que tocan los lectores que arman las entradas de los armadores de hechos, medidas el 2026-11-22
// con el registro de consultas de Prisma 5.22 (incluye las llaves de enlace, los `where` y los `orderBy` que agrega
// Prisma; con órdenes, lotes, una venta, un dividendo y un cierre de 2027, para que corran también las consultas de
// las relaciones) más el SQL crudo de los cierres (src/tablero/datos.ts y src/plan/lectura.ts); la conciliación, por su
// `select` (la medida corrió sin certificaciones):
//  - DIARIO: obtenerResumen y obtenerEvolucion (src/tablero), ultimaConciliacion (src/conciliacion/leer.ts) y las series
//    oficiales (src/datos-oficiales/series/leer.ts);
//  - REGLAS: ultimosCierres y calendarioBvc (src/plan/lectura.ts), leerProximos (src/datos-oficiales/decretos/leer.ts) y
//    la versión vigente y sus reglas SIN la acción, la cantidad, el detalle ni el motivo (leerVersiones y leerReglas de
//    src/plan/lectura.ts sí los leen: con inv_ia dan 42501; el export de hechos usa los suyos, con `select` acotado:
//    versionVigenteParaHechos y reglasParaHechos de src/ia/evaluacion/exportar/plan.ts);
//  - ESCENARIOS: leerEntradas (src/proyecciones/leer.ts) y leerFondosHistoria y leerHistoria (src/app/proyecciones/datos.ts).
// Nada de usuario, filas crudas (`crudo`), el `encargo`, la certificación por especie, los lotes de A&V, la caja ni los
// símbolos. Escritura: solo INSERT en resumen_ia, sin "generadoEn" (lo pone la base); de resumen_ia lee solo lo de
// yaPublicado, gastoDelMes y el RETURNING (RESUMEN_IA_SELECT_IA). Sin UPDATE, DELETE, TRUNCATE ni permisos de tabla
// completa.

export type Permiso = { readonly tabla: string; readonly privilegio: "SELECT" | "INSERT"; readonly columnas: readonly string[] };

export const RESUMEN_IA_COLUMNAS = [
  "id", "tipo", "fechaNegocio", "estado", "puerta", "texto", "salidaModelo", "hechos", "hechosHash", "hechosVersion", "modelo",
  "modeloDigest", "opciones", "promptVersion", "promptHash", "validadorVersion", "motivos", "latenciaMs", "tokensEntrada",
  "tokensSalida", "generadoEn",
] as const;

/**
 * Lo que inv_ia LEE de resumen_ia: solo lo que usan yaPublicado (la clave), gastoDelMes (la puerta, la hora y los tokens)
 * y el RETURNING del INSERT (id y hora). Ni el texto, ni la salida del modelo, ni los hechos: la pantalla (inv_app) los
 * lee con ultimoPublicado; el servicio no los necesita.
 */
export const RESUMEN_IA_SELECT_IA = [
  "id", "tipo", "fechaNegocio", "estado", "puerta", "hechosHash", "promptHash", "modeloDigest", "tokensEntrada", "tokensSalida", "generadoEn",
] as const;

export const PERMISOS_IA: readonly Permiso[] = [
  { tabla: "asignacion_venta", privilegio: "SELECT", columnas: ["id", "ordenVentaId", "loteId", "cantidad", "costoBase"] },
  { tabla: "calendario_bvc", privilegio: "SELECT", columnas: ["dia", "esHabil"] },
  { tabla: "carga_archivo", privilegio: "SELECT", columnas: ["tipoFuente", "estado", "cargadoEn", "revertidaEn"] },
  { tabla: "certificacion", privilegio: "SELECT", columnas: ["id", "fechaCorte", "retiradaEn"] },
  { tabla: "conciliacion", privilegio: "SELECT", columnas: ["id", "certificacionId", "fechaCorte", "calculadaEn", "resultado"] },
  // E8: la configuración vigente de la IA (leerConfigIa, src/ia/config/leer.ts), sin el motivo ni el autor.
  {
    tabla: "config_ia",
    privilegio: "SELECT",
    columnas: [
      "id", "version", "modo", "ollamaHost", "ollamaPuerto", "temperaturaLocal", "tareas", "modeloNube", "topeMensualUsd", "horaResumen", "limiteSegundos",
      "analisisDemanda", "esfuerzoNube", "creadaEn",
    ],
  },
  { tabla: "dividendo", privilegio: "SELECT", columnas: ["id", "instrumentoId", "tipo", "fechaPago", "montoNeto", "decretadoId"] },
  {
    tabla: "dividendo_decretado",
    privilegio: "SELECT",
    columnas: ["id", "instrumentoId", "tipo", "cuota", "valorPorAccion", "fechaAnuncio", "fechaEx", "fechaPago", "referenciaOficial", "version", "anulada", "reemplazadoEn"],
  },
  { tabla: "evento_corporativo", privilegio: "SELECT", columnas: ["id", "tipo", "fecha", "origenId", "destinoId", "razon"] },
  { tabla: "instrumento", privilegio: "SELECT", columnas: ["id", "tipo", "nemotecnico", "nombre"] },
  { tabla: "lote", privilegio: "SELECT", columnas: ["id", "instrumentoId", "fechaCompra", "cantidad", "costoTotal", "ordenId", "origen"] },
  { tabla: "movimiento_fondo", privilegio: "SELECT", columnas: ["id", "fondoId", "fecha", "unidades", "tipo"] },
  {
    tabla: "orden",
    privilegio: "SELECT",
    columnas: ["id", "instrumentoId", "lado", "estado", "fechaOperacion", "cantidadCompletada", "totalInvertido", "totalEstimado", "comision"],
  },
  { tabla: "plan_version", privilegio: "SELECT", columnas: ["id", "version", "vigenteDesde", "creadaEn"] },
  { tabla: "precio_cierre", privilegio: "SELECT", columnas: ["id", "instrumentoId", "fecha", "precio", "fuente", "estado", "traidoEn", "reemplazadoEn"] },
  // Precios cada minuto (frente precios-minuto): lo que las alertas y su explicación leen del último precio intradía.
  { tabla: "precio_intradia", privilegio: "SELECT", columnas: ["id", "instrumentoId", "instante", "precio", "fuente", "conRetraso", "traidoEn"] },
  { tabla: "regla_plan", privilegio: "SELECT", columnas: ["id", "planVersionId", "instrumentoId", "condicion", "nivel", "plazoHasta"] },
  { tabla: "resumen_ia", privilegio: "SELECT", columnas: RESUMEN_IA_SELECT_IA },
  { tabla: "resumen_ia", privilegio: "INSERT", columnas: RESUMEN_IA_COLUMNAS.filter((c) => c !== "generadoEn") },
  { tabla: "valor_serie_oficial", privilegio: "SELECT", columnas: ["id", "serie", "desde", "hasta", "valor", "fuente", "traidoEn", "reemplazadoEn"] },
  { tabla: "valor_unidad_fondo", privilegio: "SELECT", columnas: ["id", "fondoId", "fechaValor", "valorUnidad", "reemplazadoEn"] },
];

/**
 * Columnas que inv_ia NUNCA lee, por tabla: lo cifrado, lo crudo, lo personal, el texto libre del plan y del diario, y la
 * acción y la cantidad de las reglas y de las decisiones. Las tablas que no están en PERMISOS_IA quedan enteras fuera.
 */
export const PROHIBIDAS_IA: Readonly<Record<string, readonly string[]>> = {
  config_ia: ["motivo", "autorId"],
  plan_version: ["motivo", "aprobadaPorId"],
  regla_plan: ["accion", "cantidad", "detalle"],
  carga_archivo: ["nombreArchivo", "sha256", "cargadoPorId", "revertidaPorId"],
};

/** Tablas que inv_ia no toca en absoluto (cifradas, crudas, personales o fuera de los armadores). */
export const TABLAS_FUERA_IA = [
  "usuario", "token_acceso", "intento_ingreso", "codigo_recuperacion", "fila_fuente", "fila_de_carga", "fila_lote_av",
  "certificacion_posicion", "certificacion_fondo", "control_conciliacion", "decision", "enlace_decision_orden", "movimiento_caja",
  "ajuste_caja", "rendimiento_fondo", "simbolo_precio", "_prisma_migrations",
] as const;

/** Una línea por (tabla, privilegio, columna), ordenada: así se comparan la lista, el SQL y el catálogo. */
export const filasPermisos = (permisos: readonly Permiso[]): string[] =>
  permisos.flatMap((p) => p.columnas.map((c) => `${p.tabla}.${c} ${p.privilegio}`)).sort();
