import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { fechaEnBogota } from "@/precios/horario";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { datosOficiales } from "./datos";
import { DatosOficiales } from "./DatosOficiales";
import type { VistaDatosOficiales } from "./tipos";

// Lee la base en cada visita: las series cambian con cada carga y la frescura, con el día.
export const dynamic = "force-dynamic";

/**
 * /datos-oficiales (frente datos-oficiales-pantalla, C6a): las series oficiales del catálogo, en solo lectura para el
 * dueño y la familia. Revalida la sesión contra la base (D-014) ANTES de leer nada; sin sesión, `redirect` lanza y pasa.
 * El «hoy» es el día de Colombia y se calcula una sola vez: la lectura y la pantalla usan el mismo. Un fallo de la base
 * se muestra como en las otras pantallas; otro error se propaga.
 */
export default async function PaginaDatosOficiales() {
  let datos: VistaDatosOficiales;
  let soloLectura: boolean;
  try {
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    datos = await datosOficiales(db, fechaEnBogota(new Date()));
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("datos-oficiales", error);
    return <SinBase />;
  }
  return <DatosOficiales datos={datos} soloLectura={soloLectura} />;
}
