/**
 * Salidas de modelo INVENTADAS para las pruebas del validador. Nunca llevan literales de presentación ni de ids: los
 * hechos se buscan por su clave en paquetes armados con los ayudantes de `tests/unit/ia/apoyo/hechos.ficticio.ts` y
 * `construirPaquete` (así un cambio de las presentaciones en E1b no rompe estas pruebas). Una cita se escribe en la
 * plantilla de la frase como `{CLAVE}` y se reemplaza por `{Hnn}` del hecho de esa clave.
 */
import type { ClaveHecho } from "@/ia/catalogo";
import type { EntradaHecho, EntradaPaquete, Hecho, IdHecho, PaqueteHechos, TipoResumen } from "@/ia/contrato";
import { construirPaquete } from "@/ia/paquete";
import { segmentosDe } from "@/ia/validador/segmentos";
import type { Prng } from "@/proyecciones/prng";
import { entradaAlAzar } from "../../apoyo/aleatorio.ficticio";
import { ENTRADAS_FICTICIAS } from "../../apoyo/hechos.ficticio";

export interface FraseFicticia {
  readonly texto: string;
  readonly hechos: readonly string[];
}

const CITA = /\{H[0-9]{2}\}/g;
const CLAVE_EN_PLANTILLA = /\{([A-Z_]+)\}/g;

/** El hecho único de la clave en el paquete (si hay cero o varios, la prueba está mal armada). */
export function hechoDe(paquete: PaqueteHechos, clave: ClaveHecho): Hecho {
  const hallados = paquete.hechos.filter((h) => h.clave === clave);
  if (hallados.length !== 1) throw new Error(`La prueba espera un solo hecho de la clave ${clave}.`);
  return hallados[0] as Hecho;
}

export const idDe = (paquete: PaqueteHechos, clave: ClaveHecho): IdHecho => hechoDe(paquete, clave).id;
export const presentacionDe = (paquete: PaqueteHechos, clave: ClaveHecho): string => hechoDe(paquete, clave).presentacion;

/** Las citas «{Hnn}» del texto, sin repetir, en orden. */
export const citasDe = (texto: string): readonly string[] => [...new Set([...texto.matchAll(CITA)].map((m) => m[0].slice(1, -1)))];

/** La frase con cada `{CLAVE}` cambiada por la cita de su hecho; `hechos`, las citas del texto (o las dadas). */
export function frase(paquete: PaqueteHechos, plantilla: string, hechos?: readonly string[]): FraseFicticia {
  const texto = plantilla.replace(CLAVE_EN_PLANTILLA, (_todo, clave: string) => `{${idDe(paquete, clave as ClaveHecho)}}`);
  return { texto, hechos: hechos ?? citasDe(texto) };
}

/**
 * La salida cruda `salida-v2`: el texto de cada frase se parte en segmentos (cada `{Hnn}` es una ref; lo demás, texto).
 * `hechos` ya no viaja en la salida (la forma vieja es SALIDA_INVALIDA): solo lo usan las pruebas de la plantilla.
 */
export const salida = (...frases: readonly FraseFicticia[]): string =>
  JSON.stringify({ frases: frases.map((f) => ({ segmentos: segmentosDe(f.texto) })) });

/** La salida cruda de frases dadas por plantilla. */
export const salidaDe = (paquete: PaqueteHechos, ...plantillas: readonly string[]): string =>
  salida(...plantillas.map((p) => frase(paquete, p)));

/** El texto renderizado esperado: cada `{CLAVE}` por la presentación del paquete. */
export const renderizado = (paquete: PaqueteHechos, plantilla: string): string =>
  plantilla.replace(CLAVE_EN_PLANTILLA, (_todo, clave: string) => presentacionDe(paquete, clave as ClaveHecho));

type Marcas = Partial<Pick<EntradaHecho, "direccion" | "cercania" | "frescura" | "calidad" | "obligatorio">>;

/** La entrada ficticia del tipo con las marcas de una clave cambiadas (nada más: ni valores ni presentaciones). */
export function entradaConMarcas<T extends TipoResumen>(tipo: T, cambios: Partial<Record<ClaveHecho, Marcas>>): EntradaPaquete<T> {
  const entrada = ENTRADAS_FICTICIAS[tipo]() as EntradaPaquete<T>;
  const hechos = entrada.hechos.map((h) => ({ ...h, ...(cambios[h.clave] ?? {}) }));
  return { ...entrada, hechos };
}

export const paqueteFicticio = <T extends TipoResumen>(tipo: T, cambios: Partial<Record<ClaveHecho, Marcas>> = {}): PaqueteHechos<T> =>
  construirPaquete(entradaConMarcas(tipo, cambios));

/** Frases válidas (texto de modelo) por tipo, con las marcas de las entradas ficticias. */
export const FRASES_VALIDAS: { readonly [T in TipoResumen]: readonly string[] } = {
  DIARIO: [
    "El valor de las acciones subió a {VALOR_ACCIONES}.",
    "{ESPECIE_NOMBRE}: el valor de la especie subió a {VALOR_ESPECIE} y su peso de la especie en el portafolio se mantuvo en {PESO_ESPECIE}.",
    "La ganancia total bajó a {GANANCIA_TOTAL}.",
    "Las especies con cierre atrasado son {ESPECIES_ATRASADAS}.",
  ],
  REGLAS: [
    "{ESPECIE_NOMBRE}: la distancia al nivel de la regla es {REGLA_DISTANCIA} y está cerca.",
    "Faltan {REGLA_DIAS_AL_PLAZO} para el plazo de la regla, que está lejos.",
  ],
  ESCENARIOS: [
    "En el escenario central a corto plazo, el valor quedaría en {ESCENARIO_CENTRAL_CORTO}.",
    "La probabilidad de terminar por debajo de lo aportado es {PROBABILIDAD_BAJO_APORTADO}.",
    "{ESPECIE_NOMBRE} tiene {DIAS_HISTORIA_ESPECIE} de historia.",
  ],
};

/**
 * Los armadores marcan obligatorio solo lo mínimo de cada tipo; el paquete al azar marca la mitad. Este tope deja
 * obligatorios solo los primeros (cambia solo la marca `obligatorio`, nada de valores ni presentaciones): con él, los
 * obligatorios caben siempre en los límites de la salida. Que no quepan cuando son muchos lo prueba otra prueba.
 */
export const TOPE_OBLIGATORIOS = 6;

export function paqueteAlAzarConTope(prng: Prng, tipo?: TipoResumen): PaqueteHechos {
  const entrada = entradaAlAzar(prng, tipo);
  const marcados = entrada.hechos.flatMap((h, i) => (h.obligatorio ? [i] : [])).slice(0, TOPE_OBLIGATORIOS);
  return construirPaquete({ ...entrada, hechos: entrada.hechos.map((h, i) => ({ ...h, obligatorio: marcados.includes(i) })) });
}
