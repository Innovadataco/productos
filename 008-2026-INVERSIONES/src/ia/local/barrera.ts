/**
 * Segunda barrera de la puerta local, SIN el paquete: lo último antes de la red. No reemplaza a la guarda de
 * `generarConPuertas` (que coteja la vista contra el paquete completo y es la única entrada de los generadores);
 * solo cierra en fallo si al cliente le llega, por el camino que sea, un pedido que no es ciego:
 * - el pedido se revisa con `revisarPedido` del contrato (forma, prompt con su hash, esquema y límite): si no,
 *   PEDIDO_INVALIDO;
 * - la vista son datos puros, con solo los campos ciegos del contrato, un tipo de la lista, ningún dígito fuera de
 *   los ids «"Hnn"» y ninguna clave prohibida: si no, PEDIDO_NO_CIEGO.
 * No lanza. Lo que sigue es la copia revisada y congelada, no el objeto recibido.
 */
import { CAMPOS_HECHO_CIEGO, CAMPOS_PAQUETE_CIEGO, TIPOS_RESUMEN } from "../contrato";
import { esDe, esObjetoPlano, soloCampos, sonDatosPuros } from "../formas";
import { revisarPedido, type PedidoGeneracion } from "../generador";
import { clonCongelado } from "../hash";
import { clavesProhibidasEn } from "../prohibidas";
import { falloLocal, type FalloLocal } from "./errores";

/** Los ids son la única cifra permitida, y solo como valor completo de un campo. */
const ID_COMO_TEXTO = /"H[0-9]{2}"/g;
const CUALQUIER_DIGITO = /\p{N}/u;

function esVistaCiega(vista: unknown): boolean {
  if (!sonDatosPuros(vista) || !esObjetoPlano(vista) || !soloCampos(vista, CAMPOS_PAQUETE_CIEGO)) return false;
  if (!esDe(TIPOS_RESUMEN, vista.tipo) || !Array.isArray(vista.hechos)) return false;
  if (!(vista.hechos as readonly unknown[]).every((hecho) => esObjetoPlano(hecho) && soloCampos(hecho, CAMPOS_HECHO_CIEGO))) return false;
  if (CUALQUIER_DIGITO.test(JSON.stringify(vista).replace(ID_COMO_TEXTO, '""'))) return false;
  return clavesProhibidasEn(vista).length === 0;
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
