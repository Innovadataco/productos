/**
 * Segunda barrera de la puerta local, SIN el paquete: lo último antes de la red. No reemplaza a la guarda de
 * `generarConPuertas` (que coteja la vista contra el paquete completo y es la única entrada de los generadores);
 * solo cierra en fallo si al cliente le llega, por el camino que sea, un pedido que no es ciego:
 * - el pedido se revisa con `revisarPedido` del contrato (forma, prompt con su hash, esquema y límite): si no,
 *   PEDIDO_INVALIDO;
 * - la vista son datos puros con solo los campos ciegos y SOLO valores cerrados del contrato: un tipo de la lista, a
 *   lo sumo MAX_HECHOS hechos, ids, sujetos y especies «Hnn», una clave del catálogo de ese tipo con SU etiqueta, y dirección,
 *   cercanía, frescura y calidad de sus listas, con `obligatorio` booleano. Así no pasa texto libre (un nombre en
 *   letras, una cifra): si no, PEDIDO_NO_CIEGO.
 * No lanza. Lo que sigue es la copia revisada y congelada, no el objeto recibido.
 *
 * Límite: el texto del prompt y el esquema no se pueden cotejar sin el paquete; los cubre la guarda
 * (`armarPedido` y `generarConPuertas`, DATOS_EN_EL_PEDIDO).
 */
import { entradaDeCatalogo } from "../catalogo";
import { CALIDADES, CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, CERCANIAS, DIRECCIONES, FRESCURAS, MAX_HECHOS, TIPOS_RESUMEN, esIdHecho, type TipoResumen } from "../contrato";
import { esDe, esObjetoPlano, soloCampos, sonDatosPuros, type Registro } from "../formas";
import { revisarPedido, type PedidoGeneracion } from "../generador";
import { clonCongelado } from "../hash";
import { falloLocal, type FalloLocal } from "./errores";

const esId = (valor: unknown): boolean => typeof valor === "string" && esIdHecho(valor);

function esHechoCiego(tipo: TipoResumen, hecho: unknown): boolean {
  if (!esObjetoPlano(hecho) || !soloCampos(hecho, CAMPOS_HECHO_CIEGO)) return false;
  const h: Registro = hecho;
  const entrada = typeof h.clave === "string" ? entradaDeCatalogo(tipo, h.clave) : null;
  return entrada !== null && h.etiqueta === entrada.etiqueta && esId(h.id) && (h.sujeto === undefined || esId(h.sujeto))
    && (!Object.hasOwn(h, "especie") || esId(h.especie))
    && esDe(DIRECCIONES, h.direccion) && esDe(CERCANIAS, h.cercania) && esDe(FRESCURAS, h.frescura) && esDe(CALIDADES, h.calidad)
    && typeof h.obligatorio === "boolean";
}

function esVistaCiega(vista: unknown): boolean {
  if (!sonDatosPuros(vista) || !esObjetoPlano(vista) || !soloCampos(vista, CAMPOS_PAQUETE_CIEGO)) return false;
  const { tipo, hechos } = vista;
  if (!esDe(TIPOS_RESUMEN, tipo) || !Array.isArray(hechos) || hechos.length > MAX_HECHOS) return false;
  return (hechos as readonly unknown[]).every((hecho) => esHechoCiego(tipo, hecho));
}

export function barreraLocal(pedido: unknown): { readonly ok: true; readonly pedido: PedidoGeneracion } | FalloLocal {
  let revisado: PedidoGeneracion;
  try {
    revisado = revisarPedido(pedido as PedidoGeneracion);
  } catch {
    return falloLocal("ERROR_PROVEEDOR", "PEDIDO_INVALIDO");
  }
  if (!esVistaCiega(revisado.vista)) return falloLocal("ERROR_PROVEEDOR", "PEDIDO_NO_CIEGO");
  return { ok: true, pedido: clonCongelado(revisado) };
}
