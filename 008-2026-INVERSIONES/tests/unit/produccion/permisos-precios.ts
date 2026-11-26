// Lista única de los permisos de inv_precios (servicio de precios, PR 3) que deben quedar en la base. La usan
// privilegios.test.ts (contra el texto de docker/migrador/privilegios.sql) y roles-base.test.ts (contra el catálogo
// de una PostgreSQL 16 real). No es una prueba (no termina en .test.ts).
//
// Salen del SQL que genera Prisma 5.22 en precios:actualizar (src/precios/actualizar.ts y guardar.ts) y en
// actualizar-fondo (src/fondo/actualizar.ts y clase.ts), medido con el registro de consultas de Prisma:
//  - instrumento: las especies (acción activa con nemotécnico) y los fondos (FIC activo con codigoFic);
//  - lote: solo "instrumentoId", por el filtro `lotes: { some: {} }` de las especies (ni cantidad, ni costos, ni fechas);
//  - simbolo_precio: el símbolo de Yahoo y la clase de la SFC vigentes (findFirst también lee el id);
//  - calendario_bvc: los días hábiles; certificacion y certificacion_posicion: el precio de valoración del día de corte
//    de la certificación VIGENTE ("retiradaEn", frente certificacion-corte-real; ni la cantidad, ni el valor de
//    mercado, ni el saldo);
//  - precio_cierre: SELECT de todas sus columnas, porque create() hace INSERT … RETURNING de todas; INSERT de las que
//    escribe create() (sin "reemplazadoEn": lo insertado nace vigente) y UPDATE solo de "reemplazadoEn";
//  - valor_unidad_fondo: lo que leen la comparación y el último dato; INSERT de lo que escribe createMany() (sin
//    "reemplazadoEn") y UPDATE solo de "reemplazadoEn".
//  - precio_intradia (precios cada minuto, src/precios/intradia/): SELECT de todas las columnas (createMany con
//    skipDuplicates hace ON CONFLICT DO NOTHING) e INSERT de todas MENOS "traidoEn" (la pone la base); y la ÚNICA
//    excepción de la lista, el DELETE de tabla (no existe por columna) para la depuración de la retención: el disparador
//    precio_intradia_retiro solo deja borrar filas de más de 60 días y nunca editar;
//  - plan_version y regla_plan: SELECT de lo mínimo para saber qué especies tienen regla en el plan vigente (la versión
//    y su vigencia; de la regla, solo la especie): ni la acción, ni la cantidad, ni el nivel, ni el detalle.
// Nada de usuario, órdenes, filas crudas, cantidades ni costos. Sin TRUNCATE, y de tabla completa solo ese DELETE.

// DELETE no existe por columna: su lista de columnas va vacía y `filasPermisos` lo escribe como «tabla.* DELETE».
export type Permiso = { readonly tabla: string; readonly privilegio: "SELECT" | "INSERT" | "UPDATE" | "DELETE"; readonly columnas: readonly string[] };

export const PRECIO_CIERRE_COLUMNAS = [
  "id", "instrumentoId", "fecha", "precio", "fuente", "estado", "fuenteReferencia", "precioReferencia", "desviacionPct", "traidoEn", "reemplazadoEn", "moneda",
] as const;

export const PRECIO_INTRADIA_COLUMNAS = ["id", "instrumentoId", "instante", "precio", "fuente", "conRetraso", "traidoEn"] as const;

export const PERMISOS_PRECIOS: readonly Permiso[] = [
  { tabla: "instrumento", privilegio: "SELECT", columnas: ["id", "tipo", "nemotecnico", "activo", "codigoFic"] },
  { tabla: "lote", privilegio: "SELECT", columnas: ["instrumentoId"] },
  { tabla: "simbolo_precio", privilegio: "SELECT", columnas: ["id", "instrumentoId", "proveedor", "simbolo", "vigenteDesde", "vigenteHasta"] },
  { tabla: "calendario_bvc", privilegio: "SELECT", columnas: ["dia", "esHabil"] },
  { tabla: "certificacion", privilegio: "SELECT", columnas: ["id", "fechaCorte", "retiradaEn"] },
  { tabla: "certificacion_posicion", privilegio: "SELECT", columnas: ["certificacionId", "instrumentoId", "precioValoracion"] },
  { tabla: "precio_cierre", privilegio: "SELECT", columnas: PRECIO_CIERRE_COLUMNAS },
  { tabla: "precio_cierre", privilegio: "INSERT", columnas: PRECIO_CIERRE_COLUMNAS.filter((c) => c !== "reemplazadoEn") },
  { tabla: "precio_cierre", privilegio: "UPDATE", columnas: ["reemplazadoEn"] },
  { tabla: "valor_unidad_fondo", privilegio: "SELECT", columnas: ["id", "fondoId", "fechaValor", "valorUnidad", "valorFondo", "reemplazadoEn"] },
  { tabla: "valor_unidad_fondo", privilegio: "INSERT", columnas: ["id", "fondoId", "fechaValor", "valorUnidad", "valorFondo", "fuente", "traidoEn"] },
  { tabla: "valor_unidad_fondo", privilegio: "UPDATE", columnas: ["reemplazadoEn"] },
  { tabla: "plan_version", privilegio: "SELECT", columnas: ["id", "version", "vigenteDesde"] },
  { tabla: "regla_plan", privilegio: "SELECT", columnas: ["planVersionId", "instrumentoId"] },
  { tabla: "precio_intradia", privilegio: "SELECT", columnas: PRECIO_INTRADIA_COLUMNAS },
  { tabla: "precio_intradia", privilegio: "INSERT", columnas: PRECIO_INTRADIA_COLUMNAS.filter((c) => c !== "traidoEn") },
  { tabla: "precio_intradia", privilegio: "DELETE", columnas: [] },
];

/** Una línea por (tabla, privilegio, columna), ordenada: así se comparan la lista, el SQL y el catálogo. */
export const filasPermisos = (permisos: readonly Permiso[]): string[] =>
  permisos.flatMap((p) => (p.columnas.length === 0 ? [`${p.tabla}.* ${p.privilegio}`] : p.columnas.map((c) => `${p.tabla}.${c} ${p.privilegio}`))).sort();
