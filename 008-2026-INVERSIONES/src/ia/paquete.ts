/**
 * Construcción validada del paquete de hechos (`hechos-v1`). Cierra en fallo: ante la primera falla lanza
 * `ErrorPaquete` con un código cerrado, la posición del hecho y el nombre del campo del contrato. El mensaje nunca
 * repite un valor, una presentación, un nombre ni una clave recibida: solo el código, el hecho y el campo.
 *
 * Valida la entrada como `unknown` (los tipos de TypeScript no llegan al tiempo de ejecución), toma la etiqueta y la
 * unidad del catálogo, copia campo por campo (nada de `...entrada`), congela todo, calcula el hash y registra el
 * paquete: la vista ciega y las puertas solo aceptan paquetes construidos aquí (`esPaqueteConstruido`), no copias.
 *
 * Aditivo de E1b: la presentación debe ser exactamente `presentar(valor, unidad)` (PRESENTACION_NO_COINCIDE), y un
 * hecho de regla (`CLAVES_DE_REGLA`) puede citar como sujeto al ancla de su regla (REGLA_DEL_PLAN), además de a la
 * especie. El ancla solo cita a una especie y, como el nombre de la especie, puede repetirse (una por regla).
 */
import { CALIDADES, CERCANIAS, DIRECCIONES, FRESCURAS, MAX_AVISOS, MAX_HECHOS, MAX_LARGO_FUENTE, MAX_LARGO_PRESENTACION,
  MAX_VERSIONES_CALCULO, PATRON_ID_HECHO, TIPOS_RESUMEN, VERSION_HECHOS,
  type EntradaPaquete, type Hecho, type IdHecho, type PaqueteHechos, type TipoResumen } from "./contrato";
import { CLAVE_ANCLA_REGLA, CLAVE_NOMBRE_ESPECIE, entradaDeCatalogo, esClaveDeRegla, type ClaveDe, type EntradaCatalogo } from "./catalogo";
import { esDe, esDecimalCanonico, esDiaIso, esNombreEspecie, esObjetoPlano, esTextoSeguro, type Registro } from "./formas";
import { hashPaquete } from "./hash";
import { ENTERO, UNIDADES_ENTERAS, UNIDADES_NO_NEGATIVAS, presentar } from "./presentar";
import { esClaveProhibida } from "./prohibidas";

export const CODIGOS_ERROR_PAQUETE = Object.freeze([
  "FORMA_INVALIDA", "CAMPO_DESCONOCIDO", "CAMPO_FALTANTE", "CLAVE_PROHIBIDA", "TIPO_INVALIDO", "HOY_INVALIDO",
  "VERSIONES_CALCULO_INVALIDAS", "AVISOS_INVALIDOS", "SIN_HECHOS", "DEMASIADOS_HECHOS", "ID_NO_CONSECUTIVO",
  "CLAVE_FUERA_DE_CATALOGO", "SUJETO_FALTANTE", "SUJETO_NO_PERMITIDO", "SUJETO_INEXISTENTE", "SUJETO_NO_ES_ESPECIE",
  "VALOR_NO_DECIMAL", "VALOR_NO_FECHA", "VALOR_NO_ENTERO", "VALOR_NEGATIVO", "NOMBRE_INVALIDO", "ESPECIE_REPETIDA",
  "PRESENTACION_INVALIDA", "FUENTE_INVALIDA", "FECHA_INVALIDA", "FECHA_FUTURA", "CALIDAD_INVALIDA", "DIRECCION_INVALIDA",
  "CERCANIA_INVALIDA", "FRESCURA_INVALIDA", "DIRECCION_NO_APLICA", "CERCANIA_NO_APLICA", "OBLIGATORIO_INVALIDO",
  "HECHO_REPETIDO", "VERSION_DISTINTA", "GUARDADO_NO_COINCIDE", "PRESENTACION_NO_COINCIDE",
] as const);
export type CodigoErrorPaquete = (typeof CODIGOS_ERROR_PAQUETE)[number];

const CAMPOS_RAIZ = Object.freeze(["tipo", "hoy", "versionesCalculo", "avisos", "hechos"] as const);
const CAMPOS_HECHO = Object.freeze(["id", "clave", "valor", "presentacion", "fuente", "fecha", "calidad", "direccion", "cercania", "frescura", "obligatorio"] as const);
const CAMPO_OPCIONAL_HECHO = "sujeto";
const CLAVE_VERSION = /^[a-z][a-zA-Z]{0,31}$/;
const VALOR_VERSION = /^[a-z][a-z0-9.-]{0,63}$/;
const CODIGO_AVISO = /^[A-Z][A-Z0-9_]{0,63}$/;
const DIGITO = /[0-9]/;

export class ErrorPaquete extends Error {
  override readonly name = "ErrorPaquete";
  constructor(
    readonly codigo: CodigoErrorPaquete,
    readonly hecho: IdHecho | null = null,
    readonly campo: string | null = null,
  ) {
    super(`Paquete de hechos rechazado: ${codigo}${hecho ? ` en ${hecho}` : ""}${campo ? ` (campo ${campo})` : ""}.`);
  }
}

/** El id del hecho en la posición dada (1 → «H01»); fuera de 1 a 99, RangeError. */
export function idDeHecho(posicion: number): IdHecho {
  if (!Number.isInteger(posicion) || posicion < 1 || posicion > MAX_HECHOS) throw new RangeError("La posición de un hecho va de 1 a 99.");
  return `H${String(posicion).padStart(2, "0")}` as IdHecho;
}

/** Solo los campos del contrato: los demás son CLAVE_PROHIBIDA o CAMPO_DESCONOCIDO (sin repetir su nombre). */
function exigirCampos(registro: Registro, exigidos: readonly string[], opcional: string | null, hecho: IdHecho | null): void {
  for (const clave of Object.keys(registro)) {
    if (exigidos.includes(clave) || clave === opcional) continue;
    throw new ErrorPaquete(esClaveProhibida(clave) ? "CLAVE_PROHIBIDA" : "CAMPO_DESCONOCIDO", hecho);
  }
  const faltante = exigidos.find((campo) => !Object.hasOwn(registro, campo) || registro[campo] === undefined);
  if (faltante !== undefined) throw new ErrorPaquete("CAMPO_FALTANTE", hecho, faltante);
}

function validarVersiones(valor: unknown): Readonly<Record<string, string>> {
  if (!esObjetoPlano(valor)) throw new ErrorPaquete("VERSIONES_CALCULO_INVALIDAS", null, "versionesCalculo");
  const pares = Object.entries(valor);
  const valido = pares.length <= MAX_VERSIONES_CALCULO
    && pares.every(([clave, version]) => CLAVE_VERSION.test(clave) && !esClaveProhibida(clave) && typeof version === "string" && VALOR_VERSION.test(version));
  if (!valido) throw new ErrorPaquete("VERSIONES_CALCULO_INVALIDAS", null, "versionesCalculo");
  return Object.freeze(Object.fromEntries(pares as [string, string][]));
}

function validarAvisos(valor: unknown): readonly string[] {
  if (!Array.isArray(valor) || valor.length > MAX_AVISOS) throw new ErrorPaquete("AVISOS_INVALIDOS", null, "avisos");
  const avisos = Array.from(valor, (aviso: unknown) => aviso);
  const valido = avisos.every((aviso) => typeof aviso === "string" && CODIGO_AVISO.test(aviso)) && new Set(avisos).size === avisos.length;
  if (!valido) throw new ErrorPaquete("AVISOS_INVALIDOS", null, "avisos");
  return Object.freeze(avisos as string[]);
}

function validarHechosCrudos(valor: unknown): readonly unknown[] {
  if (!Array.isArray(valor)) throw new ErrorPaquete("FORMA_INVALIDA", null, "hechos");
  if (valor.length === 0) throw new ErrorPaquete("SIN_HECHOS", null, "hechos");
  if (valor.length > MAX_HECHOS) throw new ErrorPaquete("DEMASIADOS_HECHOS", null, "hechos");
  return Array.from(valor, (hecho: unknown) => hecho);
}

interface Contexto {
  readonly tipo: TipoResumen;
  readonly hoy: string;
  readonly previos: readonly Hecho[];
  readonly especies: ReadonlySet<string>;
}

/** El sujeto apunta a un nombre de especie o, si el hecho es de una regla, también al ancla de esa regla. */
const destinoValido = (clave: string, apuntado: Hecho): boolean =>
  apuntado.clave === CLAVE_NOMBRE_ESPECIE || (apuntado.clave === CLAVE_ANCLA_REGLA && esClaveDeRegla(clave));

function validarSujeto(registro: Registro, catalogo: EntradaCatalogo, id: IdHecho, previos: readonly Hecho[]): IdHecho | undefined {
  const sujeto = registro[CAMPO_OPCIONAL_HECHO];
  if (sujeto === undefined) {
    if (catalogo.politicaSujeto === "EXIGIDO") throw new ErrorPaquete("SUJETO_FALTANTE", id, "sujeto");
    return undefined;
  }
  if (catalogo.politicaSujeto === "NINGUNO") throw new ErrorPaquete("SUJETO_NO_PERMITIDO", id, "sujeto");
  const apuntado = typeof sujeto === "string" && PATRON_ID_HECHO.test(sujeto) ? previos.find((h) => h.id === sujeto) : undefined;
  if (apuntado === undefined) throw new ErrorPaquete("SUJETO_INEXISTENTE", id, "sujeto");
  if (!destinoValido(String(registro.clave), apuntado)) throw new ErrorPaquete("SUJETO_NO_ES_ESPECIE", id, "sujeto");
  return apuntado.id;
}

function validarValor(valor: unknown, catalogo: EntradaCatalogo, id: IdHecho, especies: ReadonlySet<string>): string {
  const { unidad } = catalogo;
  if (unidad === "NOMBRE") {
    if (!esNombreEspecie(valor)) throw new ErrorPaquete("NOMBRE_INVALIDO", id, "valor");
    if (especies.has(valor.toLowerCase())) throw new ErrorPaquete("ESPECIE_REPETIDA", id, "valor");
    return valor;
  }
  if (unidad === "FECHA") {
    if (typeof valor !== "string" || !esDiaIso(valor)) throw new ErrorPaquete("VALOR_NO_FECHA", id, "valor");
    return valor;
  }
  if (typeof valor !== "string" || !esDecimalCanonico(valor)) throw new ErrorPaquete("VALOR_NO_DECIMAL", id, "valor");
  if (UNIDADES_ENTERAS.has(unidad) && !ENTERO.test(valor)) throw new ErrorPaquete("VALOR_NO_ENTERO", id, "valor");
  if (UNIDADES_NO_NEGATIVAS.has(unidad) && valor.startsWith("-")) throw new ErrorPaquete("VALOR_NEGATIVO", id, "valor");
  return valor;
}

/** Presentación (la de `presentar`, sobre el valor ya validado), fuente, fecha, calidad, dirección, cercanía, frescura y si es obligatorio. */
function validarResto(registro: Registro, catalogo: EntradaCatalogo, id: IdHecho, hoy: string, valor: string): void {
  const { presentacion, fuente, fecha } = registro;
  const presentacionValida = esTextoSeguro(presentacion, MAX_LARGO_PRESENTACION) && (catalogo.unidad === "NOMBRE" || DIGITO.test(presentacion));
  if (!presentacionValida) throw new ErrorPaquete("PRESENTACION_INVALIDA", id, "presentacion");
  if (presentacion !== presentar(valor, catalogo.unidad)) throw new ErrorPaquete("PRESENTACION_NO_COINCIDE", id, "presentacion");
  if (!esTextoSeguro(fuente, MAX_LARGO_FUENTE)) throw new ErrorPaquete("FUENTE_INVALIDA", id, "fuente");
  if (typeof fecha !== "string" || !esDiaIso(fecha)) throw new ErrorPaquete("FECHA_INVALIDA", id, "fecha");
  if (fecha > hoy) throw new ErrorPaquete("FECHA_FUTURA", id, "fecha");
  if (!esDe(CALIDADES, registro.calidad)) throw new ErrorPaquete("CALIDAD_INVALIDA", id, "calidad");
  if (!esDe(DIRECCIONES, registro.direccion)) throw new ErrorPaquete("DIRECCION_INVALIDA", id, "direccion");
  if (!esDe(CERCANIAS, registro.cercania)) throw new ErrorPaquete("CERCANIA_INVALIDA", id, "cercania");
  if (!esDe(FRESCURAS, registro.frescura)) throw new ErrorPaquete("FRESCURA_INVALIDA", id, "frescura");
  if (!catalogo.admiteDireccion && registro.direccion !== "NO_APLICA") throw new ErrorPaquete("DIRECCION_NO_APLICA", id, "direccion");
  if (!catalogo.admiteCercania && registro.cercania !== "NO_APLICA") throw new ErrorPaquete("CERCANIA_NO_APLICA", id, "cercania");
  if (typeof registro.obligatorio !== "boolean") throw new ErrorPaquete("OBLIGATORIO_INVALIDO", id, "obligatorio");
}

function validarHecho(crudo: unknown, posicion: number, contexto: Contexto): Hecho {
  const id = idDeHecho(posicion);
  if (!esObjetoPlano(crudo)) throw new ErrorPaquete("FORMA_INVALIDA", id);
  exigirCampos(crudo, CAMPOS_HECHO, CAMPO_OPCIONAL_HECHO, id);
  if (crudo.id !== id) throw new ErrorPaquete("ID_NO_CONSECUTIVO", id, "id");
  const catalogo = typeof crudo.clave === "string" ? entradaDeCatalogo(contexto.tipo, crudo.clave) : null;
  if (catalogo === null) throw new ErrorPaquete("CLAVE_FUERA_DE_CATALOGO", id, "clave");
  const sujeto = validarSujeto(crudo, catalogo, id, contexto.previos);
  const valor = validarValor(crudo.valor, catalogo, id, contexto.especies);
  validarResto(crudo, catalogo, id, contexto.hoy, valor);
  const r = crudo as unknown as Hecho;
  return Object.freeze({
    id,
    clave: r.clave,
    ...(sujeto === undefined ? {} : { sujeto }),
    valor,
    unidad: catalogo.unidad,
    presentacion: r.presentacion,
    etiqueta: catalogo.etiqueta,
    fuente: r.fuente,
    fecha: r.fecha,
    calidad: r.calidad,
    direccion: r.direccion,
    cercania: r.cercania,
    frescura: r.frescura,
    obligatorio: r.obligatorio,
  });
}

/**
 * Un hecho por (clave, sujeto): dos «valor de las acciones», o dos «valor de la especie» de la misma especie, no. Los
 * nombres de especie y las anclas de regla quedan fuera: se distinguen por su id (dos reglas de una especie).
 */
function validarHechos(crudos: readonly unknown[], tipo: TipoResumen, hoy: string): readonly Hecho[] {
  const hechos: Hecho[] = [];
  const especies = new Set<string>();
  const pares = new Set<string>();
  crudos.forEach((crudo, i) => {
    const hecho = validarHecho(crudo, i + 1, { tipo, hoy, previos: hechos, especies });
    if (hecho.clave === CLAVE_NOMBRE_ESPECIE) especies.add(hecho.valor.toLowerCase());
    else if (hecho.clave !== CLAVE_ANCLA_REGLA) {
      const par = `${hecho.clave}|${hecho.sujeto ?? ""}`;
      if (pares.has(par)) throw new ErrorPaquete("HECHO_REPETIDO", hecho.id, "clave");
      pares.add(par);
    }
    hechos.push(hecho);
  });
  return Object.freeze(hechos);
}

/**
 * Los paquetes que salieron de `construirPaquete` (o de `leerPaquete`); congelados, no cambian después. El registro
 * es uno por proceso (`Symbol.for` en `globalThis`), no por instancia del módulo: si el empaquetador carga este
 * archivo dos veces (la app y un servicio), un paquete armado en una vale en la otra. Protege de copias y de paquetes
 * armados a mano por error, no de código hostil dentro del proceso (ese puede hacer cualquier cosa).
 */
const LLAVE_REGISTRO = Symbol.for("inv-008.ia.paquetes-construidos");
const globalConRegistro = globalThis as typeof globalThis & { [LLAVE_REGISTRO]?: WeakSet<object> };
const CONSTRUIDOS: WeakSet<object> = globalConRegistro[LLAVE_REGISTRO] ?? (globalConRegistro[LLAVE_REGISTRO] = new WeakSet<object>());

/** ¿Salió este objeto (el mismo, no una copia) de `construirPaquete` o de `leerPaquete`? */
export function esPaqueteConstruido(valor: unknown): valor is PaqueteHechos {
  return typeof valor === "object" && valor !== null && CONSTRUIDOS.has(valor);
}

/**
 * El paquete validado, congelado, con su hash y registrado. Orden de las validaciones: la raíz (campos, tipo, hoy,
 * versiones de cálculo, avisos, hechos) y después hecho por hecho, campo por campo.
 */
export function construirPaquete<T extends TipoResumen>(entrada: EntradaPaquete<T>): PaqueteHechos<T> {
  const crudo: unknown = entrada;
  if (!esObjetoPlano(crudo)) throw new ErrorPaquete("FORMA_INVALIDA");
  exigirCampos(crudo, CAMPOS_RAIZ, null, null);
  if (!esDe(TIPOS_RESUMEN, crudo.tipo)) throw new ErrorPaquete("TIPO_INVALIDO", null, "tipo");
  if (typeof crudo.hoy !== "string" || !esDiaIso(crudo.hoy)) throw new ErrorPaquete("HOY_INVALIDO", null, "hoy");
  const versionesCalculo = validarVersiones(crudo.versionesCalculo);
  const avisos = validarAvisos(crudo.avisos);
  const hechos = validarHechos(validarHechosCrudos(crudo.hechos), crudo.tipo, crudo.hoy);
  const sinHash: Omit<PaqueteHechos<T>, "hash"> = { version: VERSION_HECHOS, tipo: crudo.tipo as T, hoy: crudo.hoy, versionesCalculo, avisos, hechos: hechos as readonly Hecho<ClaveDe<T>>[] };
  const paquete: PaqueteHechos<T> = Object.freeze({ ...sinHash, hash: hashPaquete(sinHash) });
  CONSTRUIDOS.add(paquete);
  return paquete;
}

const CAMPOS_GUARDADOS_RAIZ: readonly string[] = Object.freeze([...CAMPOS_RAIZ, "version", "hash"]);
const CAMPOS_GUARDADOS_HECHO: readonly string[] = Object.freeze([...CAMPOS_HECHO, "etiqueta", "unidad"]);

/** El hecho guardado sin lo que pone el catálogo (etiqueta y unidad), para volver a construirlo. */
function sinCatalogo(crudo: unknown, posicion: number): Registro {
  const id = idDeHecho(posicion);
  if (!esObjetoPlano(crudo)) throw new ErrorPaquete("FORMA_INVALIDA", id);
  exigirCampos(crudo, CAMPOS_GUARDADOS_HECHO, CAMPO_OPCIONAL_HECHO, id);
  const { etiqueta: _etiqueta, unidad: _unidad, ...resto } = crudo;
  return resto;
}

/**
 * Un paquete guardado (p. ej. el JSON de `resumen_ia`) que vuelve a entrar: se reconstruye con `construirPaquete` y
 * tiene que dar exactamente lo guardado (la versión, la etiqueta y la unidad del catálogo de hoy, y el hash). Si el
 * catálogo cambió desde que se guardó, da GUARDADO_NO_COINCIDE: cambiar el catálogo es otra versión del contrato.
 */
export function leerPaquete(guardado: unknown): PaqueteHechos {
  if (!esObjetoPlano(guardado)) throw new ErrorPaquete("FORMA_INVALIDA");
  exigirCampos(guardado, CAMPOS_GUARDADOS_RAIZ, null, null);
  if (guardado.version !== VERSION_HECHOS) throw new ErrorPaquete("VERSION_DISTINTA", null, "version");
  const hechosGuardados = validarHechosCrudos(guardado.hechos);
  const hechos = hechosGuardados.map((crudo, i) => sinCatalogo(crudo, i + 1));
  const { tipo, hoy, versionesCalculo, avisos } = guardado;
  const paquete = construirPaquete({ tipo, hoy, versionesCalculo, avisos, hechos } as unknown as EntradaPaquete);
  paquete.hechos.forEach((hecho, i) => {
    const original = hechosGuardados[i] as Registro;
    if (original.etiqueta !== hecho.etiqueta) throw new ErrorPaquete("GUARDADO_NO_COINCIDE", hecho.id, "etiqueta");
    if (original.unidad !== hecho.unidad) throw new ErrorPaquete("GUARDADO_NO_COINCIDE", hecho.id, "unidad");
  });
  if (guardado.hash !== paquete.hash) throw new ErrorPaquete("GUARDADO_NO_COINCIDE", null, "hash");
  return paquete;
}

/**
 * El nombre de la especie (hecho ESPECIE_NOMBRE) al que se refiere el hecho `id`, siguiendo su sujeto: directo, o a
 * través del ancla de su regla (dos saltos). El propio nombre devuelve el mismo hecho. null si no se refiere a una
 * especie (un hecho del portafolio, una regla de portafolio) o si el id no existe. Solo con paquetes construidos.
 */
export function especieDe(paquete: PaqueteHechos, id: IdHecho): Hecho | null {
  if (!esPaqueteConstruido(paquete)) throw new TypeError("especieDe necesita un paquete construido por construirPaquete.");
  const porId = (buscado: IdHecho | undefined): Hecho | undefined => paquete.hechos.find((h) => h.id === buscado);
  const hecho = porId(id);
  const sujeto = hecho?.clave === CLAVE_NOMBRE_ESPECIE ? hecho : porId(hecho?.sujeto);
  const especie = sujeto?.clave === CLAVE_ANCLA_REGLA ? porId(sujeto.sujeto) : sujeto;
  return especie?.clave === CLAVE_NOMBRE_ESPECIE ? especie : null;
}
