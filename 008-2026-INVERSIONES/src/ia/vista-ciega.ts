/**
 * La vista ciega: lo ÚNICO que ve un modelo, sea de la puerta local o de la nube. Por hecho lleva el id, la clave,
 * la etiqueta del catálogo, el sujeto (un id), la dirección, la cercanía, la frescura, la calidad y si es obligatorio;
 * del paquete, solo el tipo. Ni valores, ni presentaciones, ni unidades, ni fuentes, ni fechas, ni `hoy`, ni avisos,
 * ni el hash. Tampoco `version`: «hechos-v1» lleva un dígito, y la versión queda en el paquete completo del registro.
 *
 * La guarda (`fugasDeVistaCiega` y `asegurarVistaCiega`) prueba la CONDUCTA sobre el JSON que saldría, contra el
 * paquete completo, sin confiar en cómo se armó la vista. Cierra en fallo y junta todos los códigos:
 * - FORMA_INVALIDA: no es JSON de objetos planos con datos (sin getters, prototipos raros, ciclos ni bigint);
 * - CAMPO_NO_PERMITIDO: un campo fuera de la lista cerrada (`CAMPOS_PAQUETE_CIEGO` y `CAMPOS_HECHO_CIEGO`);
 * - DIGITO_FUERA_DE_REFERENCIA: un dígito (de cualquier sistema de numeración) fuera de los ids «H» con dos dígitos;
 * - VALOR_DEL_PAQUETE, PRESENTACION_DEL_PAQUETE y NOMBRE_DE_ESPECIE: aparece un valor, una presentación o un nombre;
 * - CLAVE_PROHIBIDA: una clave de `CLAVES_PROHIBIDAS` a cualquier profundidad;
 * - NO_CORRESPONDE: no es la vista de ESE paquete (tipo, ids, claves, sujetos, marcas o etiqueta del catálogo);
 * - HASH_NO_COINCIDE: el paquete de referencia no cuadra con su hash.
 * Ningún mensaje lleva datos: solo los códigos.
 */
import { CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, type Hecho, type HechoCiego, type PaqueteCiego, type PaqueteHechos, type TipoResumen } from "./contrato";
import { entradaDeCatalogo, type ClaveHecho } from "./catalogo";
import { esObjetoPlano, type Registro } from "./formas";
import { hashPaquete } from "./hash";
import { clavesProhibidasEn } from "./prohibidas";

export const CODIGOS_FUGA_VISTA = Object.freeze([
  "FORMA_INVALIDA", "CAMPO_NO_PERMITIDO", "DIGITO_FUERA_DE_REFERENCIA", "VALOR_DEL_PAQUETE", "PRESENTACION_DEL_PAQUETE",
  "NOMBRE_DE_ESPECIE", "CLAVE_PROHIBIDA", "NO_CORRESPONDE", "HASH_NO_COINCIDE",
] as const);
export type CodigoFugaVista = (typeof CODIGOS_FUGA_VISTA)[number];

/** Los ids son la única cifra permitida, y solo como valor completo de un campo («"H07"»). */
const ID_COMO_TEXTO = /"H[0-9]{2}"/g;
const CUALQUIER_DIGITO = /\p{N}/u;
const CAMPOS_EXIGIDOS_HECHO: readonly string[] = CAMPOS_HECHO_CIEGO.filter((campo) => campo !== "sujeto");

export class ErrorVistaCiega extends Error {
  override readonly name = "ErrorVistaCiega";
  constructor(readonly codigos: readonly CodigoFugaVista[]) {
    super(`Vista ciega rechazada: ${codigos.join(", ")}.`);
  }
}


const soloCampos = (registro: Registro, permitidos: readonly string[]): boolean => Object.keys(registro).every((clave) => permitidos.includes(clave));

/** La forma: objetos planos de datos, y si sobra algún campo. null si no se puede ni leer. */
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

const CAMPOS_COMPARADOS: readonly (keyof HechoCiego)[] = CAMPOS_HECHO_CIEGO.filter((campo) => campo !== "etiqueta");

/** ¿Es la vista de ESTE paquete? Mismo tipo, mismos hechos en el mismo orden y la etiqueta del catálogo. */
function corresponde(vista: Registro, hechos: readonly Registro[], paquete: PaqueteHechos): boolean {
  if (vista.tipo !== paquete.tipo || hechos.length !== paquete.hechos.length) return false;
  return hechos.every((ciego, i) => {
    const hecho = paquete.hechos[i] as Hecho;
    const iguales = CAMPOS_COMPARADOS.every((campo) => ciego[campo] === hecho[campo]);
    return iguales && ciego.etiqueta === entradaDeCatalogo(paquete.tipo, hecho.clave)?.etiqueta;
  });
}

function serializar(vista: unknown): string | null {
  try {
    return JSON.stringify(vista) ?? null;
  } catch {
    return null;
  }
}

/** CLAVE_PROHIBIDA si hay alguna; FORMA_INVALIDA si no se puede recorrer (demasiado profunda). */
function codigoDeClaves(vista: unknown): CodigoFugaVista | null {
  try {
    return clavesProhibidasEn(vista).length > 0 ? "CLAVE_PROHIBIDA" : null;
  } catch {
    return "FORMA_INVALIDA";
  }
}

/** Todos los códigos de fuga de la vista frente al paquete; vacío si la vista es ciega y es la de ese paquete. */
export function fugasDeVistaCiega(vista: unknown, paquete: PaqueteHechos): readonly CodigoFugaVista[] {
  const codigos: CodigoFugaVista[] = [];
  if (hashPaquete(paquete) !== paquete.hash) codigos.push("HASH_NO_COINCIDE");
  const json = serializar(vista);
  const forma = json === null ? null : revisarForma(vista);
  if (json === null || forma === null) return Object.freeze([...codigos, "FORMA_INVALIDA"]);
  if (forma.sobran) codigos.push("CAMPO_NO_PERMITIDO");
  const sinIds = minusculas(json.replace(ID_COMO_TEXTO, '""'));
  if (CUALQUIER_DIGITO.test(sinIds)) codigos.push("DIGITO_FUERA_DE_REFERENCIA");
  codigos.push(...fugasDeDatos(sinIds, paquete));
  const deClaves = codigoDeClaves(vista);
  if (deClaves !== null) codigos.push(deClaves);
  if (!corresponde(vista as Registro, forma.hechos, paquete)) codigos.push("NO_CORRESPONDE");
  return Object.freeze(codigos);
}

/** Cierra en fallo: si la vista no es ciega o no es la de ese paquete, lanza `ErrorVistaCiega` con sus códigos. */
export function asegurarVistaCiega(vista: unknown, paquete: PaqueteHechos): asserts vista is PaqueteCiego {
  const codigos = fugasDeVistaCiega(vista, paquete);
  if (codigos.length > 0) throw new ErrorVistaCiega(codigos);
}

/** La anotación de tipo hace que TypeScript rechace un campo de más (verificación por exceso de propiedades). */
function proyectar<C extends ClaveHecho>(hecho: Hecho<C>): HechoCiego<C> {
  const ciego: HechoCiego<C> = {
    id: hecho.id,
    clave: hecho.clave,
    etiqueta: hecho.etiqueta,
    ...(hecho.sujeto === undefined ? {} : { sujeto: hecho.sujeto }),
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
  const vista: PaqueteCiego<T> = Object.freeze({ tipo: paquete.tipo, hechos: Object.freeze(paquete.hechos.map(proyectar)) });
  asegurarVistaCiega(vista, paquete);
  return vista;
}
