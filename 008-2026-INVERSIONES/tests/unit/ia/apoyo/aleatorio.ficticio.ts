/**
 * Paquetes de hechos AL AZAR, con semilla (PRNG de `src/proyecciones/prng.ts`, sin modificarlo): especies FICTICIA-*,
 * valores decimales con signo y no redondos, fechas de 2027 o de 2015 a 2021, fuentes, avisos y versiones de cálculo
 * con dígitos, y presentaciones es-CO de `presentar` (E1b: el paquete no acepta otra). Los hechos de regla citan a
 * veces al ancla de una regla (REGLA_DEL_PLAN) en vez de a la especie. Todo inventado.
 */
import { CLAVE_ANCLA_REGLA, CLAVE_NOMBRE_ESPECIE, clavesDe, entradaDeCatalogo, esClaveDeRegla, type ClaveHecho, type EntradaCatalogo } from "@/ia/catalogo";
import { CALIDADES, CERCANIAS, DIRECCIONES, FRESCURAS, TIPOS_DIARIOS, type EntradaHecho, type EntradaPaquete, type IdHecho, type PaqueteHechos, type TipoResumen } from "@/ia/contrato";
import { construirPaquete, idDeHecho } from "@/ia/paquete";
import { presentar } from "@/ia/presentar";
import type { Prng } from "@/proyecciones/prng";

const GRIEGAS = ["ALFA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA", "ETA", "TETA", "IOTA", "KAPA", "LAMBDA", "OMEGA"] as const;
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ESPECIES = 5;
const MAX_HECHOS_AZAR = 40;
const MAX_INTENTOS = 2_000;
const DIA_MS = 86_400_000;
const INICIO_VIEJO = Date.UTC(2015, 0, 1);
const FIN_VIEJO = Date.UTC(2021, 11, 31);
const INICIO_2027 = Date.UTC(2027, 0, 1);

export const elegir = <T>(prng: Prng, lista: readonly T[]): T => lista[prng.enteroMenorQue(lista.length)] as T;

const diaIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Un día de 2015 a 2021, o de 2027 hasta `hoy` (incluido). */
function diaAlAzar(prng: Prng, hoyMs: number): string {
  if (prng.uniforme() < 0.5) return diaIso(INICIO_VIEJO + prng.enteroMenorQue((FIN_VIEJO - INICIO_VIEJO) / DIA_MS + 1) * DIA_MS);
  return diaIso(INICIO_2027 + prng.enteroMenorQue((hoyMs - INICIO_2027) / DIA_MS + 1) * DIA_MS);
}

/** Entero no redondo (la última cifra nunca es 0) con hasta seis cifras. */
function enteroNoRedondo(prng: Prng): number {
  const base = 1 + prng.enteroMenorQue(99_999);
  return base * 10 + 1 + prng.enteroMenorQue(9);
}

/** Decimal canónico con signo: «-37911.47», «4613.3», «417». */
function decimalAlAzar(prng: Prng, conSigno: boolean): string {
  const entero = String(prng.uniforme() < 0.15 ? 0 : enteroNoRedondo(prng));
  const cifras = prng.enteroMenorQue(3);
  const intermedias = Array.from({ length: Math.max(cifras - 1, 0) }, () => String(prng.enteroMenorQue(10))).join("");
  const fraccion = cifras === 0 ? "" : `.${intermedias}${1 + prng.enteroMenorQue(9)}`;
  const texto = `${entero}${fraccion}`;
  return conSigno && texto !== "0" && prng.uniforme() < 0.4 ? `-${texto}` : texto;
}

function nombreAlAzar(prng: Prng, usados: ReadonlySet<string>): string {
  for (;;) {
    const nombre = `FICTICIA-${elegir(prng, GRIEGAS)}-${elegir(prng, [...LETRAS])}${elegir(prng, [...LETRAS])}`;
    if (!usados.has(nombre)) return nombre;
  }
}

/** El valor al azar de la unidad (los sorteos son los mismos de antes de E1b; la presentación no sortea nada). */
function valorAlAzar(prng: Prng, catalogo: EntradaCatalogo, hoyMs: number, nombre: string): string {
  switch (catalogo.unidad) {
    case "NOMBRE":
      return nombre;
    case "FECHA":
      return diaAlAzar(prng, hoyMs);
    case "DIAS":
      return String(enteroNoRedondo(prng) % 997 - (prng.uniforme() < 0.3 ? 613 : 0));
    case "MESES":
    case "ESPECIES":
      return String(1 + prng.enteroMenorQue(97));
    case "PORCENTAJE":
    case "PESOS":
      return decimalAlAzar(prng, true);
    case "PESOS_POR_DOLAR":
    case "VECES":
    case "PUNTOS":
      return decimalAlAzar(prng, false);
  }
}

function valorYPresentacion(prng: Prng, catalogo: EntradaCatalogo, hoyMs: number, nombre: string): readonly [string, string] {
  const valor = valorAlAzar(prng, catalogo, hoyMs, nombre);
  return [valor, presentar(valor, catalogo.unidad)];
}

function marcas(prng: Prng, catalogo: EntradaCatalogo): Pick<EntradaHecho, "calidad" | "direccion" | "cercania" | "frescura" | "obligatorio"> {
  return {
    calidad: elegir(prng, CALIDADES),
    direccion: catalogo.admiteDireccion ? elegir(prng, DIRECCIONES) : "NO_APLICA",
    cercania: catalogo.admiteCercania ? elegir(prng, CERCANIAS) : "NO_APLICA",
    frescura: elegir(prng, FRESCURAS),
    obligatorio: prng.uniforme() < 0.5,
  };
}

/** La entrada de un paquete al azar del tipo dado (o de uno al azar). Siempre válida para `construirPaquete`. */
export function entradaAlAzar(prng: Prng, tipoFijo?: TipoResumen): EntradaPaquete {
  const tipo = tipoFijo ?? elegir(prng, TIPOS_DIARIOS);
  const hoyMs = INICIO_2027 + (30 + prng.enteroMenorQue(330)) * DIA_MS;
  const hoy = diaIso(hoyMs);
  const claves = clavesDe(tipo) as readonly ClaveHecho[];
  const hechos: EntradaHecho[] = [];
  const especies: { readonly id: IdHecho; readonly nombre: string }[] = [];
  const anclas: { readonly id: IdHecho }[] = [];
  const usados = new Set<string>();
  const total = 1 + prng.enteroMenorQue(MAX_HECHOS_AZAR);
  // Con tope de intentos: en ESCENARIOS hay menos pares (clave, sujeto) distintos que el máximo de hechos.
  for (let intentos = 0; hechos.length < total && intentos < MAX_INTENTOS; intentos += 1) {
    let clave = elegir(prng, claves);
    let catalogo = entradaDeCatalogo(tipo, clave) as EntradaCatalogo;
    const faltaEspecie = catalogo.politicaSujeto === "EXIGIDO" && especies.length === 0;
    if (faltaEspecie || (clave === CLAVE_NOMBRE_ESPECIE && especies.length >= MAX_ESPECIES)) {
      if (especies.length >= MAX_ESPECIES) continue;
      clave = CLAVE_NOMBRE_ESPECIE;
      catalogo = entradaDeCatalogo(tipo, clave) as EntradaCatalogo;
    }
    const id = idDeHecho(hechos.length + 1);
    const nombre = clave === CLAVE_NOMBRE_ESPECIE ? nombreAlAzar(prng, new Set(especies.map((e) => e.nombre))) : "";
    const [valor, presentacion] = valorYPresentacion(prng, catalogo, hoyMs, nombre);
    // Un hecho de regla puede citar a la especie o al ancla de una regla; los demás, solo a la especie.
    const destinos: readonly { readonly id: IdHecho }[] = esClaveDeRegla(clave) ? [...especies, ...anclas] : especies;
    const conSujeto = catalogo.politicaSujeto === "EXIGIDO" || (catalogo.politicaSujeto === "OPCIONAL" && destinos.length > 0 && prng.uniforme() < 0.5);
    const sujeto = conSujeto ? elegir(prng, destinos).id : undefined;
    // Un hecho por (clave, sujeto): si ya está, se sortea otro (el nombre de la especie y el ancla pueden repetirse).
    const par = `${clave}|${sujeto ?? ""}`;
    if (clave !== CLAVE_NOMBRE_ESPECIE && clave !== CLAVE_ANCLA_REGLA && usados.has(par)) continue;
    usados.add(par);
    const fuente = `FUENTE-FICTICIA-${1 + prng.enteroMenorQue(97)}`;
    hechos.push({ id, clave, ...(sujeto === undefined ? {} : { sujeto }), valor, presentacion, fuente, fecha: diaAlAzar(prng, hoyMs), ...marcas(prng, catalogo) });
    if (clave === CLAVE_NOMBRE_ESPECIE) especies.push({ id, nombre });
    if (clave === CLAVE_ANCLA_REGLA) anclas.push({ id });
  }
  const avisos = Array.from({ length: prng.enteroMenorQue(4) }, (_, i) => `AVISO_FICTICIO_${i}${1 + prng.enteroMenorQue(9)}`);
  return { tipo, hoy, versionesCalculo: { calculo: `calculo-ficticio-v${1 + prng.enteroMenorQue(97)}` }, avisos, hechos };
}

export function paqueteAlAzar(prng: Prng, tipoFijo?: TipoResumen): PaqueteHechos {
  return construirPaquete(entradaAlAzar(prng, tipoFijo));
}
