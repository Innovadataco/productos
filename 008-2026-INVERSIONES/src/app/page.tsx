import { exigirSesion } from "@/auth/sesion";
import { ultimaConciliacion } from "@/conciliacion/leer";
import { db } from "@/lib/db";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "./_comun/sin-base";
import { aLineaDelTablero } from "./conciliacion/serializar";
import { aVista } from "./tablero/serializar";
import { Tablero } from "./tablero/Tablero";
import type { LineaConciliacionVista } from "./tablero/tipos";

// Lee la base en cada visita: los datos son locales y cambian con cada carga.
export const dynamic = "force-dynamic";

export default async function Inicio() {
  let resumen: Resumen;
  let conciliacion: LineaConciliacionVista;
  try {
    // Revalida la sesión contra la base (D-014). Sin sesión, `redirect` lanza y el catch la deja pasar.
    await exigirSesion();
    resumen = await obtenerResumen(db);
    // Lo guardado de la última conciliación, sin recalcular (la frescura se ve en /conciliacion).
    conciliacion = aLineaDelTablero(await ultimaConciliacion(db));
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("tablero", error);
    return <SinBase />;
  }
  return <Tablero vista={aVista(resumen)} conciliacion={conciliacion} />;
}
