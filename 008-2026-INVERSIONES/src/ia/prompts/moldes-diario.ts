/**
 * Los moldes de frase del DIARIO para los datos de una especie (prompt v5). Cada etiqueta de especie del catálogo ya trae
 * «de la especie»; el nombre de la especie va justo después, y el modelo no repite esas palabras ni escribe «misma».
 * Puro: las claves y las etiquetas salen del catálogo; solo el género del artículo está escrito aquí.
 *
 * Forma: «El valor de la especie [nombre] es [dato].», donde [nombre] es la referencia del campo especie y [dato], la del
 * propio dato.
 */
import { CATALOGO, type ClaveDiario } from "../catalogo";

const DE_LA_ESPECIE = "de la especie";
const MARCA_NOMBRE = "[nombre]";
const MARCA_DATO = "[dato]";
const SEPARADOR_DE_MOLDES = " ";

type Articulo = "El" | "La";

/** El artículo de la etiqueta de cada dato de especie del DIARIO (el catálogo no lleva artículos). */
const ARTICULOS = {
  VALOR_ESPECIE: "El",
  PESO_ESPECIE: "El",
  RENTABILIDAD_ESPECIE: "La",
  CIERRE_ESPECIE: "El",
  FECHA_CIERRE_ESPECIE: "La",
  VARIACION_DIA_ESPECIE: "La",
} as const satisfies Partial<Record<ClaveDiario, Articulo>>;

type ClaveDeEspecieDiario = keyof typeof ARTICULOS;

/** Las claves del DIARIO cuyo hecho es de una especie (política de sujeto EXIGIDO), en el orden del catálogo. */
export const CLAVES_DE_ESPECIE_DIARIO: readonly ClaveDeEspecieDiario[] = Object.freeze(
  (Object.keys(CATALOGO.DIARIO) as ClaveDiario[]).filter(
    (clave): clave is ClaveDeEspecieDiario => CATALOGO.DIARIO[clave].politicaSujeto === "EXIGIDO",
  ),
);

/** El molde de la clave: el artículo, la etiqueta con el nombre justo después de «de la especie», y el dato. */
export function moldeDiario(clave: ClaveDeEspecieDiario): string {
  const [antes, despues] = CATALOGO.DIARIO[clave].etiqueta.split(DE_LA_ESPECIE).map((parte) => parte.trim());
  if (antes === undefined || despues === undefined) throw new RangeError("La etiqueta del dato de especie no lleva «de la especie».");
  const etiqueta = [antes, DE_LA_ESPECIE, MARCA_NOMBRE, ...(despues === "" ? [] : [despues])].join(" ");
  return `${ARTICULOS[clave]} ${etiqueta} es ${MARCA_DATO}.`;
}

/** Los moldes de todos los datos de especie, en una línea (para el prompt). */
export const textoDeMoldesDiario = (): string => CLAVES_DE_ESPECIE_DIARIO.map(moldeDiario).join(SEPARADOR_DE_MOLDES);
