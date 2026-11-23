/**
 * La vista ciega: lo ÚNICO que ve un modelo, sea de la puerta local o de la nube. Por hecho lleva el id, la clave,
 * la etiqueta del catálogo, el sujeto (un id), la especie (el id del nombre de la especie, ya resuelto con `especieDe`;
 * solo en los datos de una especie, no en el propio nombre), la dirección, la cercanía, la frescura, la calidad y si es obligatorio;
 * del paquete, solo el tipo. Ni valores, ni presentaciones, ni unidades, ni fuentes, ni fechas, ni `hoy`, ni avisos,
 * ni el hash. Tampoco `version`: «hechos-v1» lleva un dígito, y la versión queda en el paquete completo del registro.
 *
 * La guarda (`fugasDeVistaCiega` y `asegurarVistaCiega`) prueba la CONDUCTA sobre el JSON que saldría, contra el
 * paquete completo, sin confiar en cómo se armó la vista. Cierra en fallo y junta todos los códigos:
 * - PAQUETE_NO_CONSTRUIDO: el paquete de referencia no salió de `construirPaquete` (una copia o uno armado a mano);
 * - FORMA_INVALIDA: no son datos puros (`sonDatosPuros`: sin Proxy, getters, `toJSON`, símbolos ni propiedades de más
 *   en los arreglos), o no tiene la forma de una vista. Se revisa sin ejecutar código de la vista: lo revisado es lo que
 *   se lee después;
 * - CAMPO_NO_PERMITIDO: un campo fuera de la lista cerrada (`CAMPOS_PAQUETE_CIEGO` y `CAMPOS_HECHO_CIEGO`);
 * - DIGITO_FUERA_DE_REFERENCIA: un dígito (de cualquier sistema de numeración) fuera de los ids «H» con dos dígitos;
 * - VALOR_DEL_PAQUETE, PRESENTACION_DEL_PAQUETE y NOMBRE_DE_ESPECIE: aparece un valor, una presentación o un nombre;
 * - CLAVE_PROHIBIDA: una clave de `CLAVES_PROHIBIDAS` a cualquier profundidad. Única excepción: `especie` como campo
 *   directo de un hecho y con un id «Hnn» por valor (un nombre, otro texto o un objeto ahí siguen siendo una fuga);
 * - NO_CORRESPONDE: no es la vista de ESE paquete (tipo, ids, claves, sujetos, especies, marcas o etiqueta del catálogo);
 * - DATOS_EN_EL_PEDIDO (`fugasDelPedido`): el prompt o el esquema llevan un nombre, un valor o una presentación del
 *   paquete (los valores y presentaciones de menos de cuatro caracteres no se cotejan: el prompt lleva cifras propias).
 * Ningún mensaje lleva datos: solo los códigos.
 */
import { CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, esIdHecho, type Hecho, type IdHecho, type HechoCiego, type PaqueteCiego, type PaqueteHechos, type TipoResumen } from "./contrato";
import { CLAVE_NOMBRE_ESPECIE, entradaDeCatalogo, type ClaveHecho } from "./catalogo";
import { esObjetoPlano, soloCampos, sonDatosPuros, type Registro } from "./formas";
import { esPaqueteConstruido, especieDe } from "./paquete";
import { clavesProhibidasEn } from "./prohibidas";

export const CODIGOS_FUGA_VISTA = Object.freeze([
  "PAQUETE_NO_CONSTRUIDO", "FORMA_INVALIDA", "CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE",
  "PRESENTACION_DEL_PAQUETE", "NOMBRE_DE_ESPECIE", "CLAVE_PROHIBIDA", "NO_CORRESPONDE", "DATOS_EN_EL_PEDIDO",
] as const);
export type CodigoFugaVista = (typeof CODIGOS_FUGA_VISTA)[number];

/** Los ids son la única cifra permitida, y solo como valor completo de un campo («"H07"»). */
const ID_COMO_TEXTO = /"H[0-9]{2}"/g;
const CUALQUIER_DIGITO = /\p{N}/u;
/** `sujeto` y `especie` son opcionales: solo los llevan los hechos que se refieren a otro o a una especie. */
const CAMPOS_EXIGIDOS_HECHO: readonly string[] = CAMPOS_HECHO_CIEGO.filter((campo) => campo !== "sujeto" && campo !== "especie");


export class ErrorVistaCiega extends Error {
  override readonly name = "ErrorVistaCiega";
  constructor(readonly codigos: readonly CodigoFugaVista[]) {
    super(`Vista ciega rechazada: ${codigos.join(", ")}.`);
  }
}


/** La forma (sobre datos puros): objetos planos, los campos exigidos y si sobra alguno. null si no es una vista. */
function revisarForma(vista: unknown): { readonly hechos: readonly Registro[]; readonly sobran: boolean } | null {
  if (!esObjetoPlano(vista) || !Array.isArray(vista.hechos) || !Object.hasOwn(vista, "tipo")) return null;
  const hechos = Array.from(vista.hechos as unknown[], (hecho: unknown) => hecho);
  if (!hechos.every(esObjetoPlano)) return null;
  if (!hechos.every((hecho) => CAMPOS_EXIGIDOS_HECHO.every((campo) => Object.hasOwn(hecho, campo)))) return null;
  const sobran = !soloCampos(vista, CAMPOS_PAQUETE_CIEGO) || !hechos.every((hecho) => soloCampos(hecho, CAMPOS_HECHO_CIEGO));
  return { hechos, sobran };
}

const minusculas = (texto: string): string => texto.normalize("NFC").toLowerCase();
const escaparRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** El nombre como palabra completa (sin letras ni dígitos pegados), sin distinguir mayúsculas. */
function apareceNombre(texto: string, nombre: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(minusculas(nombre))}(?![\\p{L}\\p{N}])`, "u").test(texto);
}

/** Valores, presentaciones y nombres del paquete que aparecen en el JSON de la vista (ya sin los ids). */
function fugasDeDatos(texto: string, paquete: PaqueteHechos): CodigoFugaVista[] {
  const codigos = new Set<CodigoFugaVista>();
  for (const hecho of paquete.hechos) {
    const esNombre = hecho.unidad === "NOMBRE";
    if (esNombre ? apareceNombre(texto, hecho.valor) : texto.includes(minusculas(hecho.valor))) codigos.add(esNombre ? "NOMBRE_DE_ESPECIE" : "VALOR_DEL_PAQUETE");
    const presentacion = minusculas(hecho.presentacion);
    if (esNombre ? apareceNombre(texto, presentacion) : texto.includes(presentacion)) codigos.add(esNombre ? "NOMBRE_DE_ESPECIE" : "PRESENTACION_DEL_PAQUETE");
  }
  return [...codigos];
}

const CAMPOS_COMPARADOS: readonly (keyof Hecho & keyof HechoCiego)[] = CAMPOS_HECHO_CIEGO.filter(
  (campo): campo is Exclude<typeof campo, "etiqueta" | "especie"> => campo !== "etiqueta" && campo !== "especie",
);

/**
 * La especie que lleva cada hecho en la vista, en el orden del paquete: el id de su nombre (`especieDe`), salvo en el
 * propio nombre; o undefined. Se calcula una vez por paquete.
 */
function especiesDeLaVista(paquete: PaqueteHechos): readonly (IdHecho | undefined)[] {
  return paquete.hechos.map((hecho) => (hecho.clave === CLAVE_NOMBRE_ESPECIE ? undefined : especieDe(paquete, hecho.id)?.id));
}

/** ¿Es la vista de ESTE paquete? Mismo tipo, mismos hechos en el mismo orden, la etiqueta del catálogo y la especie. */
function corresponde(vista: Registro, hechos: readonly Registro[], paquete: PaqueteHechos): boolean {
  if (vista.tipo !== paquete.tipo || hechos.length !== paquete.hechos.length) return false;
  const especies = especiesDeLaVista(paquete);
  return hechos.every((ciego, i) => {
    const hecho = paquete.hechos[i] as Hecho;
    const iguales = CAMPOS_COMPARADOS.every((campo) => ciego[campo] === hecho[campo]);
    const especie = especies[i];
    const mismaEspecie = especie === undefined ? !Object.hasOwn(ciego, "especie") : ciego.especie === especie;
    return iguales && mismaEspecie && ciego.etiqueta === entradaDeCatalogo(paquete.tipo, hecho.clave)?.etiqueta;
  });
}

/**
 * La vista sin el campo `especie` de los hechos que lo llevan con un id: la única clave prohibida que se deja pasar.
 * Se quita por estructura (campo directo de un hecho de `hechos`), nunca por el texto de una ruta.
 */
function sinEspecieConId(vista: Registro, hechos: readonly Registro[]): Registro {
  const limpiar = (hecho: Registro): Registro => {
    if (typeof hecho.especie !== "string" || !esIdHecho(hecho.especie)) return hecho;
    const { especie: _especie, ...resto } = hecho;
    return resto;
  };
  return { ...vista, hechos: hechos.map(limpiar) };
}

/** Todos los códigos de fuga de la vista frente al paquete; vacío si la vista es ciega y es la de ese paquete. */
export function fugasDeVistaCiega(vista: unknown, paquete: PaqueteHechos): readonly CodigoFugaVista[] {
  if (!esPaqueteConstruido(paquete)) return Object.freeze(["PAQUETE_NO_CONSTRUIDO"]);
  const forma = sonDatosPuros(vista) ? revisarForma(vista) : null;
  if (forma === null) return Object.freeze(["FORMA_INVALIDA"]);
  const codigos: CodigoFugaVista[] = [];
  if (forma.sobran) codigos.push("CAMPO_NO_PERMITIDO");
  const sinIds = minusculas(JSON.stringify(vista).replace(ID_COMO_TEXTO, '""'));
  if (CUALQUIER_DIGITO.test(sinIds)) codigos.push("DIGITO_FUERA_DE_REFERENCIA");
  codigos.push(...fugasDeDatos(sinIds, paquete));
  if (clavesProhibidasEn(sinEspecieConId(vista as Registro, forma.hechos)).length > 0) codigos.push("CLAVE_PROHIBIDA");
  if (!corresponde(vista as Registro, forma.hechos, paquete)) codigos.push("NO_CORRESPONDE");
  return Object.freeze(codigos);
}

/** Valores y presentaciones más cortos no se cotejan en el prompt ni en el esquema: allí hay cifras propias («seis frases»). */
export const MIN_LARGO_COTEJO_TEXTO = 4;

/** ¿Lleva el texto (un prompt, un esquema en JSON) un nombre, un valor o una presentación del paquete? */
export function hayDatosDelPaqueteEn(texto: string, paquete: PaqueteHechos): boolean {
  const enMinusculas = minusculas(texto);
  const aparece = (dato: string): boolean => dato.length >= MIN_LARGO_COTEJO_TEXTO && enMinusculas.includes(minusculas(dato));
  return paquete.hechos.some((hecho) => (hecho.unidad === "NOMBRE"
    ? apareceNombre(enMinusculas, hecho.valor) || apareceNombre(enMinusculas, hecho.presentacion)
    : aparece(hecho.valor) || aparece(hecho.presentacion)));
}

/** La guarda del pedido entero: la vista (`fugasDeVistaCiega`) y los textos que la acompañan (prompt y esquema). */
export function fugasDelPedido(vista: unknown, textos: readonly string[], paquete: PaqueteHechos): readonly CodigoFugaVista[] {
  const deLaVista = fugasDeVistaCiega(vista, paquete);
  if (!esPaqueteConstruido(paquete) || !textos.some((texto) => hayDatosDelPaqueteEn(texto, paquete))) return deLaVista;
  return Object.freeze([...deLaVista, "DATOS_EN_EL_PEDIDO"]);
}

/** Cierra en fallo: si la vista no es ciega o no es la de ese paquete, lanza `ErrorVistaCiega` con sus códigos. */
export function asegurarVistaCiega(vista: unknown, paquete: PaqueteHechos): asserts vista is PaqueteCiego {
  const codigos = fugasDeVistaCiega(vista, paquete);
  if (codigos.length > 0) throw new ErrorVistaCiega(codigos);
}

/** La anotación de tipo hace que TypeScript rechace un campo de más (verificación por exceso de propiedades). */
function proyectar<C extends ClaveHecho>(hecho: Hecho<C>, especie: IdHecho | undefined): HechoCiego<C> {
  const ciego: HechoCiego<C> = {
    id: hecho.id,
    clave: hecho.clave,
    etiqueta: hecho.etiqueta,
    ...(hecho.sujeto === undefined ? {} : { sujeto: hecho.sujeto }),
    ...(especie === undefined ? {} : { especie }),
    direccion: hecho.direccion,
    cercania: hecho.cercania,
    frescura: hecho.frescura,
    calidad: hecho.calidad,
    obligatorio: hecho.obligatorio,
  };
  return Object.freeze(ciego);
}

/** La vista ciega del paquete, ya pasada por la guarda (si la proyección filtrara algo, lanza). Congelada. */
export function vistaCiega<T extends TipoResumen>(paquete: PaqueteHechos<T>): PaqueteCiego<T> {
  if (!esPaqueteConstruido(paquete)) throw new ErrorVistaCiega(["PAQUETE_NO_CONSTRUIDO"]);
  const especies = especiesDeLaVista(paquete);
  const vista: PaqueteCiego<T> = Object.freeze({ tipo: paquete.tipo, hechos: Object.freeze(paquete.hechos.map((hecho, i) => proyectar(hecho, especies[i]))) });
  asegurarVistaCiega(vista, paquete);
  return vista;
}
