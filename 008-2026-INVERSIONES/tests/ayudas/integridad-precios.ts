// Escenario y casos de la integridad de los precios (migración *_precios_integridad): lo que un rol que NO es dueño
// de las tablas (inv_precios) no puede afirmar en precio_cierre y valor_unidad_fondo, y lo que sí entra (con la hora
// de la base). Lo usan dos corredores con el MISMO texto SQL:
//  - tests/integracion/precios-integridad.test.ts (Mac y CI): como el rol predefinido pg_write_all_data, dentro de
//    una transacción que siempre se deshace (no crea roles: los roles son globales del clúster);
//  - tests/unit/produccion/roles-base.test.ts (solo CI y el ensayo en inv-008-prueba): como inv_precios REAL.
// Todo inventado; fechas de 2018 para no cruzarse con otras pruebas; las especies nacen inactivas (ningún
// actualizar las toma). Cada caso que entra usa su propio día. No es una prueba (no termina en .test.ts).

/** Hoy en Colombia (UTC−5 fijo), calculado por la base: igual que la migración. */
export const HOY_COT = "(((now() AT TIME ZONE 'UTC') - interval '5 hours')::date)";

export interface Ids {
  readonly sufijo: string;
  readonly usuario: string;
  readonly inst: string;
  readonly fondo: string;
  /** precio_cierre: un retirado, dos vigentes (uno se retira en un caso que entra). */
  readonly retirado: string;
  readonly vigente: string;
  readonly vigente2: string;
  /** valor_unidad_fondo: lo mismo. */
  readonly vufRetirado: string;
  readonly vufVigente: string;
  readonly vufVigente2: string;
}

export function idsDe(sufijo: string): Ids {
  const id = (n: string) => `int-${n}-${sufijo}`;
  return {
    sufijo, usuario: id("usuario"), inst: id("inst"), fondo: id("fondo"),
    retirado: id("pc-retirado"), vigente: id("pc-vigente"), vigente2: id("pc-vigente2"),
    vufRetirado: id("vuf-retirado"), vufVigente: id("vuf-vigente"), vufVigente2: id("vuf-vigente2"),
  };
}

/** Días con certificación de A&V y su precio de valoración (una certificación por día). */
export const CERTIFICACIONES: ReadonlyArray<readonly [dia: string, valoracion: string]> = [
  ["2018-05-08", "4613.27"],
  ["2018-05-14", "4613.27"],
  ["2018-05-15", "4613.27"],
  ["2018-05-16", "4613.27"],
  ["2018-05-17", "0"],
  ["2018-05-18", "237.13"],
  ["2018-05-21", "237.13"],
];
const SIN_CERTIFICACION = "2018-05-09";

/** Lo que siembra el dueño (o el superusuario): exento de los disparadores. */
export function sembrar(ids: Ids): string[] {
  const certs = CERTIFICACIONES.flatMap(([dia, valoracion], i) => {
    const carga = `int-carga-${i}-${ids.sufijo}`;
    const cert = `int-cert-${i}-${ids.sufijo}`;
    return [
      `INSERT INTO carga_archivo (id, "tipoFuente", "nombreArchivo", sha256, estado, "cargadoPorId") VALUES ('${carga}', 'AV_CERTIFICACION', 'cert.ficticio.pdf', '${String(i).padStart(64, "a")}', 'CARGADO', '${ids.usuario}')`,
      `INSERT INTO certificacion (id, "cargaId", "fechaCorte", "saldoEfectivo") VALUES ('${cert}', '${carga}', DATE '${dia}', 0)`,
      `INSERT INTO certificacion_posicion ("certificacionId", "instrumentoId", cantidad, "precioValoracion", "valorMercado") VALUES ('${cert}', '${ids.inst}', 37, ${valoracion}, ${valoracion} * 37)`,
    ];
  });
  return [
    `INSERT INTO usuario (id, email, rol) VALUES ('${ids.usuario}', 'integridad-${ids.sufijo}@ejemplo.invalid', 'DUENO')`,
    `INSERT INTO instrumento (id, tipo, nemotecnico, nombre, activo) VALUES ('${ids.inst}', 'ACCION', 'FICTINT${ids.sufijo.toUpperCase()}', 'Ficticia integridad', false)`,
    `INSERT INTO instrumento (id, tipo, "codigoFic", nombre, activo) VALUES ('${ids.fondo}', 'FIC', 'fict-int-${ids.sufijo}', 'Fondo ficticio integridad', false)`,
    ...certs,
    `INSERT INTO precio_cierre (id, "instrumentoId", fecha, precio, fuente, estado, "reemplazadoEn") VALUES ('${ids.retirado}', '${ids.inst}', DATE '2018-05-22', 3719.41, 'yahoo', 'NO_VERIFICADO', now())`,
    `INSERT INTO precio_cierre (id, "instrumentoId", fecha, precio, fuente, estado) VALUES ('${ids.vigente}', '${ids.inst}', DATE '2018-05-23', 3719.41, 'yahoo', 'NO_VERIFICADO')`,
    `INSERT INTO precio_cierre (id, "instrumentoId", fecha, precio, fuente, estado) VALUES ('${ids.vigente2}', '${ids.inst}', DATE '2018-05-24', 3719.41, 'yahoo', 'NO_VERIFICADO')`,
    `INSERT INTO valor_unidad_fondo (id, "fondoId", "fechaValor", "valorUnidad", "reemplazadoEn") VALUES ('${ids.vufRetirado}', '${ids.fondo}', DATE '2018-05-22', 13711.4737, now())`,
    `INSERT INTO valor_unidad_fondo (id, "fondoId", "fechaValor", "valorUnidad") VALUES ('${ids.vufVigente}', '${ids.fondo}', DATE '2018-05-23', 13711.4737)`,
    `INSERT INTO valor_unidad_fondo (id, "fondoId", "fechaValor", "valorUnidad") VALUES ('${ids.vufVigente2}', '${ids.fondo}', DATE '2018-05-24', 13711.4737)`,
  ];
}

const texto = (v: string | null) => (v === null ? "NULL" : `'${v}'`);
const numero = (v: string | null) => (v === null ? "NULL" : v);

interface Cierre {
  readonly id: string;
  readonly fecha: string; // expresión SQL de fecha
  readonly precio: string;
  readonly estado: "VERIFICADO" | "NO_VERIFICADO";
  readonly fuente?: string;
  readonly fuenteReferencia?: string | null;
  readonly precioReferencia?: string | null;
  readonly desviacionPct?: string | null;
  readonly traidoEn?: string;
  readonly reemplazadoEn?: string;
}

/** INSERT de un cierre con solo las columnas que inv_precios puede insertar (más las que se pidan). */
export function insertarCierre(ids: Ids, c: Cierre): string {
  const columnas = ["id", '"instrumentoId"', "fecha", "precio", "fuente", "estado", '"fuenteReferencia"', '"precioReferencia"', '"desviacionPct"'];
  const valores = [`'${c.id}-${ids.sufijo}'`, `'${ids.inst}'`, c.fecha, c.precio, `'${c.fuente ?? "yahoo"}'`, `'${c.estado}'`, texto(c.fuenteReferencia ?? null), numero(c.precioReferencia ?? null), numero(c.desviacionPct ?? null)];
  if (c.traidoEn) (columnas.push('"traidoEn"'), valores.push(c.traidoEn));
  if (c.reemplazadoEn) (columnas.push('"reemplazadoEn"'), valores.push(c.reemplazadoEn));
  return `INSERT INTO precio_cierre (${columnas.join(", ")}) VALUES (${valores.join(", ")})`;
}

interface Valor {
  readonly id: string;
  readonly fecha: string;
  readonly fuente?: string;
  readonly traidoEn?: string;
  readonly reemplazadoEn?: string;
}

export function insertarValor(ids: Ids, v: Valor): string {
  const columnas = ["id", '"fondoId"', '"fechaValor"', '"valorUnidad"', '"valorFondo"', "fuente"];
  const valores = [`'${v.id}-${ids.sufijo}'`, `'${ids.fondo}'`, v.fecha, "13719.2213", "731946.18", `'${v.fuente ?? "sfc:qhpu-8ixx"}'`];
  if (v.traidoEn) (columnas.push('"traidoEn"'), valores.push(v.traidoEn));
  if (v.reemplazadoEn) (columnas.push('"reemplazadoEn"'), valores.push(v.reemplazadoEn));
  return `INSERT INTO valor_unidad_fondo (${columnas.join(", ")}) VALUES (${valores.join(", ")})`;
}

const dia = (d: string) => `DATE '${d}'`;
const ref = (d: string) => `certificacion:${d}`;
// 4637,11 contra 4613,27: |23,84| ≤ 46,1327 (1 %): VERIFICADO; desviación 0,516770 %.
const CUADRA = { precio: "4637.11", precioReferencia: "4613.27", desviacionPct: "0.516770" } as const;
// 4691,37 contra 4613,27: 78,10 > 46,1327: NO_VERIFICADO; desviación 1,692942 %.
const NO_CUADRA = { precio: "4691.37", precioReferencia: "4613.27", desviacionPct: "1.692942" } as const;
/** Un precio cualquiera de un día sin referencia. */
const PRECIO = "3719.41";

export const VERIFICACION_FALSA = /la verificación no es la que da la certificación de A&V de ese día/;

/** Lo que se rechaza. `deMas`: necesita un privilegio que inv_precios no tiene (dado por error). */
export interface Rechazo {
  readonly nombre: string;
  readonly deMas?: boolean;
  readonly sql: (ids: Ids) => readonly string[];
  readonly error: RegExp;
}

export const RECHAZOS: readonly Rechazo[] = [
  { nombre: "VERIFICADO sin certificación ese día", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a1", fecha: dia(SIN_CERTIFICACION), precio: PRECIO, estado: "VERIFICADO" })] },
  { nombre: "VERIFICADO con una desviación de 1,69 % (más del 1 %)", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a2", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-08"), ...NO_CUADRA })] },
  { nombre: "NO_VERIFICADO cuando cuadra (sub-declarar)", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a3", fecha: dia("2018-05-08"), estado: "NO_VERIFICADO", fuenteReferencia: ref("2018-05-08"), ...CUADRA })] },
  { nombre: "precioReferencia que no es la valoración de A&V", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a4a", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-08"), precio: "4637.11", precioReferencia: "4637.11", desviacionPct: "0" })] },
  { nombre: "fuenteReferencia de otro día", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a4b", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref(SIN_CERTIFICACION), ...CUADRA })] },
  { nombre: "una referencia inventada en un día sin certificación", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a4c", fecha: dia(SIN_CERTIFICACION), estado: "NO_VERIFICADO", precio: PRECIO, fuenteReferencia: ref(SIN_CERTIFICACION), precioReferencia: PRECIO, desviacionPct: "0" })] },
  { nombre: "desviacionPct falsa (0 en vez de 0,516770)", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a5a", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-08"), ...CUADRA, desviacionPct: "0" })] },
  { nombre: "desviacionPct nula cuando corresponde un valor", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a5b", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-08"), ...CUADRA, desviacionPct: null })] },
  { nombre: "desviacionPct corrida en 0,000002 (fuera de la tolerancia de un ulp)", error: VERIFICACION_FALSA,
    sql: (i) => [insertarCierre(i, { id: "a5c", fecha: dia("2018-05-08"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-08"), ...CUADRA, desviacionPct: "0.516772" })] },
  { nombre: "fuente 'manual'", error: /el servicio solo guarda cierres de yahoo/,
    sql: (i) => [insertarCierre(i, { id: "a6a", fecha: dia(SIN_CERTIFICACION), precio: PRECIO, estado: "NO_VERIFICADO", fuente: "manual" })] },
  { nombre: "fuente 'YAHOO' (otra forma)", error: /el servicio solo guarda cierres de yahoo/,
    sql: (i) => [insertarCierre(i, { id: "a6b", fecha: dia(SIN_CERTIFICACION), precio: PRECIO, estado: "NO_VERIFICADO", fuente: "YAHOO" })] },
  { nombre: "precio sobre el tope de cordura (PRECIO_MAXIMO_COP)", error: /precio_cierre: precio fuera de rango/,
    sql: (i) => [insertarCierre(i, { id: "a7c", fecha: dia(SIN_CERTIFICACION), precio: "10000000.000001", estado: "NO_VERIFICADO" })] },
  { nombre: "un cierre de mañana (en Colombia)", error: /no hay cierres de días futuros/,
    sql: (i) => [insertarCierre(i, { id: "a7a", fecha: `${HOY_COT} + 1`, precio: PRECIO, estado: "NO_VERIFICADO" })] },
  { nombre: "un cierre de mañana con otra zona horaria en la sesión (Kiritimati, UTC+14)", error: /no hay cierres de días futuros/,
    sql: (i) => ["SET LOCAL timezone = 'Pacific/Kiritimati'", insertarCierre(i, { id: "a7b", fecha: `${HOY_COT} + 1`, precio: PRECIO, estado: "NO_VERIFICADO" })] },
  { nombre: "VERIFICADO falso con SET LOCAL inv.reversion = 'on' (no hay salida por GUC)", error: VERIFICACION_FALSA,
    sql: (i) => ["SET LOCAL inv.reversion = 'on'", insertarCierre(i, { id: "a9", fecha: dia(SIN_CERTIFICACION), precio: PRECIO, estado: "VERIFICADO" })] },
  { nombre: "insertar un cierre ya retirado", deMas: true, error: /precio_cierre: lo que se inserta nace vigente/,
    sql: (i) => [insertarCierre(i, { id: "a10", fecha: dia(SIN_CERTIFICACION), precio: PRECIO, estado: "NO_VERIFICADO", reemplazadoEn: "now()" })] },
  { nombre: "reabrir un cierre retirado", error: /precio_cierre: lo retirado no se reabre ni se vuelve a fechar/,
    sql: (i) => [`UPDATE precio_cierre SET "reemplazadoEn" = NULL WHERE id = '${i.retirado}'`] },
  { nombre: "volver a fechar el retiro de un cierre", error: /precio_cierre: lo retirado no se reabre ni se vuelve a fechar/,
    sql: (i) => [`UPDATE precio_cierre SET "reemplazadoEn" = now() - interval '1 day' WHERE id = '${i.retirado}'`] },
  { nombre: "un UPDATE de un vigente que no lo retira", error: /precio_cierre: solo se puede marcar el retiro/,
    sql: (i) => [`UPDATE precio_cierre SET "reemplazadoEn" = NULL WHERE id = '${i.vigente}'`] },
  { nombre: "borrar un cierre", deMas: true, error: /precio_cierre: no se borra; se retira con reemplazadoEn/,
    sql: (i) => [`DELETE FROM precio_cierre WHERE id = '${i.vigente}'`] },
  { nombre: "cambiar el precio de un vigente sin retirarlo", deMas: true, error: /precio_cierre: solo se puede marcar el retiro/,
    sql: (i) => [`UPDATE precio_cierre SET precio = precio + 1 WHERE id = '${i.vigente}'`] },
  { nombre: "cambiar el precio al retirar", deMas: true, error: /precio_cierre: al retirar solo cambia reemplazadoEn/,
    sql: (i) => [`UPDATE precio_cierre SET precio = precio + 1, "reemplazadoEn" = now() WHERE id = '${i.vigente}'`] },
  { nombre: "cambiar el estado al retirar", deMas: true, error: /precio_cierre: al retirar solo cambia reemplazadoEn/,
    sql: (i) => [`UPDATE precio_cierre SET estado = 'VERIFICADO', "reemplazadoEn" = now() WHERE id = '${i.vigente}'`] },
  { nombre: "fondo: fuente distinta de la SFC", error: /valor_unidad_fondo: el servicio solo guarda valores de la SFC/,
    sql: (i) => [insertarValor(i, { id: "f1", fecha: dia(SIN_CERTIFICACION), fuente: "otra" })] },
  { nombre: "fondo: un valor de mañana (en Colombia)", error: /valor_unidad_fondo: no hay valores de días futuros/,
    sql: (i) => [insertarValor(i, { id: "f2", fecha: `${HOY_COT} + 1` })] },
  { nombre: "fondo: insertar un valor ya retirado", deMas: true, error: /valor_unidad_fondo: lo que se inserta nace vigente/,
    sql: (i) => [insertarValor(i, { id: "f5c", fecha: dia(SIN_CERTIFICACION), reemplazadoEn: "now()" })] },
  { nombre: "fondo: reabrir un valor retirado", error: /valor_unidad_fondo: lo retirado no se reabre ni se vuelve a fechar/,
    sql: (i) => [`UPDATE valor_unidad_fondo SET "reemplazadoEn" = NULL WHERE id = '${i.vufRetirado}'`] },
  { nombre: "fondo: volver a fechar un retiro", error: /valor_unidad_fondo: lo retirado no se reabre ni se vuelve a fechar/,
    sql: (i) => [`UPDATE valor_unidad_fondo SET "reemplazadoEn" = now() - interval '1 day' WHERE id = '${i.vufRetirado}'`] },
  { nombre: "fondo: un UPDATE de un vigente que no lo retira", error: /valor_unidad_fondo: solo se puede marcar el retiro/,
    sql: (i) => [`UPDATE valor_unidad_fondo SET "reemplazadoEn" = NULL WHERE id = '${i.vufVigente}'`] },
  { nombre: "fondo: borrar un valor", deMas: true, error: /valor_unidad_fondo: no se borra; se retira con reemplazadoEn/,
    sql: (i) => [`DELETE FROM valor_unidad_fondo WHERE id = '${i.vufVigente}'`] },
  { nombre: "fondo: cambiar el valor de unidad al retirar", deMas: true, error: /valor_unidad_fondo: al retirar solo cambia reemplazadoEn/,
    sql: (i) => [`UPDATE valor_unidad_fondo SET "valorUnidad" = "valorUnidad" + 1, "reemplazadoEn" = now() WHERE id = '${i.vufVigente}'`] },
];

/** Lo que entra. `verificar` es un SELECT (como dueño) que devuelve una fila con `ok` verdadero. */
export interface Aceptado {
  readonly nombre: string;
  readonly sql: (ids: Ids) => readonly string[];
  readonly verificar: (ids: Ids) => string;
}

const cierreOk = (i: Ids, id: string, condicion: string) => `SELECT (${condicion}) AS ok FROM precio_cierre WHERE id = '${id}-${i.sufijo}'`;
const reciente = (columna: string) => `"${columna}" > now() - interval '1 day' AND "${columna}" <= now() + interval '1 minute'`;

export const ACEPTADOS: readonly Aceptado[] = [
  { nombre: "VERIFICADO que cuadra con la certificación del día (1 % o menos)",
    sql: (i) => [insertarCierre(i, { id: "ok1", fecha: dia("2018-05-15"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-15"), ...CUADRA })],
    verificar: (i) => cierreOk(i, "ok1", `estado = 'VERIFICADO' AND "desviacionPct" = 0.516770`) },
  { nombre: "NO_VERIFICADO que no cuadra, con su referencia",
    sql: (i) => [insertarCierre(i, { id: "ok1b", fecha: dia("2018-05-16"), estado: "NO_VERIFICADO", fuenteReferencia: ref("2018-05-16"), ...NO_CUADRA })],
    verificar: (i) => cierreOk(i, "ok1b", `estado = 'NO_VERIFICADO' AND "precioReferencia" = 4613.27`) },
  { nombre: "desviacionPct corrida en un ulp (0,000001): dentro de la tolerancia",
    sql: (i) => [insertarCierre(i, { id: "ok2", fecha: dia("2018-05-14"), estado: "VERIFICADO", fuenteReferencia: ref("2018-05-14"), ...CUADRA, desviacionPct: "0.516771" })],
    verificar: (i) => cierreOk(i, "ok2", `estado = 'VERIFICADO'`) },
  { nombre: "valoración 0: NO_VERIFICADO con la referencia y sin desviación",
    sql: (i) => [insertarCierre(i, { id: "ok3", fecha: dia("2018-05-17"), estado: "NO_VERIFICADO", precio: PRECIO, fuenteReferencia: ref("2018-05-17"), precioReferencia: "0", desviacionPct: null })],
    verificar: (i) => cierreOk(i, "ok3", `"desviacionPct" IS NULL AND "precioReferencia" = 0`) },
  { nombre: "desviación de 999,999999 % (lo más que cabe): se guarda",
    sql: (i) => [insertarCierre(i, { id: "ok4", fecha: dia("2018-05-18"), estado: "NO_VERIFICADO", precio: "2608.429998", fuenteReferencia: ref("2018-05-18"), precioReferencia: "237.13", desviacionPct: "999.999999" })],
    verificar: (i) => cierreOk(i, "ok4", `"desviacionPct" = 999.999999`) },
  { nombre: "desviación de 1000 % (no cabe): NO_VERIFICADO con la referencia y sin desviación",
    sql: (i) => [insertarCierre(i, { id: "ok5", fecha: dia("2018-05-21"), estado: "NO_VERIFICADO", precio: "2608.43", fuenteReferencia: ref("2018-05-21"), precioReferencia: "237.13", desviacionPct: null })],
    verificar: (i) => cierreOk(i, "ok5", `"desviacionPct" IS NULL AND "precioReferencia" = 237.13`) },
  { nombre: "un traidoEn inventado: entra con la hora de la base",
    sql: (i) => [insertarCierre(i, { id: "ok6", fecha: dia("2018-05-10"), precio: PRECIO, estado: "NO_VERIFICADO", traidoEn: "TIMESTAMPTZ '2003-07-19 08:41:13+00'" })],
    verificar: (i) => cierreOk(i, "ok6", reciente("traidoEn")) },
  { nombre: "un cierre de hoy (en Colombia), con otra zona horaria en la sesión",
    sql: (i) => ["SET LOCAL timezone = 'Pacific/Kiritimati'", insertarCierre(i, { id: "ok7", fecha: HOY_COT, precio: PRECIO, estado: "NO_VERIFICADO" })],
    verificar: (i) => cierreOk(i, "ok7", `fecha = ${HOY_COT}`) },
  { nombre: "retirar un vigente con una fecha inventada: queda la hora de la base",
    sql: (i) => [`UPDATE precio_cierre SET "reemplazadoEn" = TIMESTAMPTZ '2003-07-19 08:41:13+00' WHERE id = '${i.vigente2}'`],
    verificar: (i) => `SELECT (${reciente("reemplazadoEn")}) AS ok FROM precio_cierre WHERE id = '${i.vigente2}'` },
  { nombre: "fondo: un traidoEn inventado entra con la hora de la base",
    sql: (i) => [insertarValor(i, { id: "okf3", fecha: dia("2018-05-10"), traidoEn: "TIMESTAMPTZ '2003-07-19 08:41:13+00'" })],
    verificar: (i) => `SELECT (${reciente("traidoEn")}) AS ok FROM valor_unidad_fondo WHERE id = 'okf3-${i.sufijo}'` },
  { nombre: "fondo: retirar un vigente con una fecha inventada: queda la hora de la base",
    sql: (i) => [`UPDATE valor_unidad_fondo SET "reemplazadoEn" = TIMESTAMPTZ '2003-07-19 08:41:13+00' WHERE id = '${i.vufVigente2}'`],
    verificar: (i) => `SELECT (${reciente("reemplazadoEn")}) AS ok FROM valor_unidad_fondo WHERE id = '${i.vufVigente2}'` },
];
