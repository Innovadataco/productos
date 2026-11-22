import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { fechaEnBogota } from "@/precios/horario";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { datosDeOperar } from "./datos";
import { Operar } from "./Operar";
import type { VistaOperar } from "./tipos";

// Lee la base en cada visita: el portafolio, el plan, los cierres y los decretos cambian con cada carga.
export const dynamic = "force-dynamic";

/**
 * /operar (frente operar-informe, hito O1): el informe para el día de operar, calculado con el plan del dueño. Revalida
 * la sesión contra la base (D-014) ANTES de leer nada; sin sesión, `redirect` lanza y pasa. La familia lo ve en solo
 * lectura (la pantalla no escribe). Un fallo de la base se muestra como en las otras pantallas; otro error se propaga.
 */
export default async function PaginaOperar() {
  let vista: VistaOperar;
  let soloLectura: boolean;
  try {
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    vista = await datosDeOperar(db, fechaEnBogota(new Date()));
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("operar", error);
    return <SinBase />;
  }
  return <Operar vista={vista} soloLectura={soloLectura} />;
}
