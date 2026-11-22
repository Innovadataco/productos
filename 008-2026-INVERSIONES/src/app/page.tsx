import { exigirSesion } from "@/auth/sesion";
import { ultimaConciliacion } from "@/conciliacion/leer";
import { db } from "@/lib/db";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "./_comun/sin-base";
import { aLineaDelTablero } from "./conciliacion/serializar";
import { aEvolucionVista, aVista } from "./tablero/serializar";
import { Tablero } from "./tablero/Tablero";
import type { EvolucionVista, LineaConciliacionVista } from "./tablero/tipos";

// Lee la base en cada visita: los datos son locales y cambian con cada carga.
export const dynamic = "force-dynamic";

export default async function Inicio() {
  let resumen: Resumen;
  let conciliacion: LineaConciliacionVista;
  let evolucion: EvolucionVista;
  try {
    // Revalida la sesión contra la base (D-014). Sin sesión, `redirect` lanza y el catch la deja pasar.
    await exigirSesion();
    resumen = await obtenerResumen(db);
    // La evolución diaria y la TWR sobre el mismo universo y la misma referencia del resumen (frente graficas-tablero),
    // y lo guardado de la última conciliación, sin recalcular (la frescura se ve en /conciliacion); las dos en paralelo.
    const [evo, ultima] = await Promise.all([obtenerEvolucion(db, resumen), ultimaConciliacion(db)]);
    evolucion = aEvolucionVista(evo);
    conciliacion = aLineaDelTablero(ultima);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("tablero", error);
    return <SinBase />;
  }
  return <Tablero vista={aVista(resumen)} conciliacion={conciliacion} evolucion={evolucion} />;
}
