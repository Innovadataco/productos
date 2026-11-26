import type { Metadata } from "next";
import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { fechaEnBogota } from "@/precios/horario";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { Alertas } from "./Alertas";
import { datosDeAlertas } from "./datos";
import { TEXTOS_ALERTAS_PANTALLA } from "./textos";
import type { VistaAlertas } from "./vista";

// Lee la base en cada visita: las alertas y las marcas cambian en el día.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: TEXTOS_ALERTAS_PANTALLA.TITULO };

/**
 * /alertas · las alertas de los últimos 30 días. Revalida la sesión contra la base (D-014) ANTES de leer nada; sin sesión,
 * `redirect` lanza y pasa. La familia la ve en solo lectura (sin botones). Un fallo de la base se muestra como en las otras
 * pantallas; otro error se propaga.
 */
export default async function PaginaAlertas() {
  let vista: VistaAlertas;
  let soloLectura: boolean;
  try {
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    vista = await datosDeAlertas(db, fechaEnBogota(new Date()));
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("alertas", error);
    return <SinBase />;
  }
  return <Alertas vista={vista} soloLectura={soloLectura} />;
}
