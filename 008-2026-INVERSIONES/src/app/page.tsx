import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "./_comun/sin-base";
import { aVista } from "./tablero/serializar";
import { Tablero } from "./tablero/Tablero";

// Lee la base en cada visita: los datos son locales y cambian con cada carga.
export const dynamic = "force-dynamic";

export default async function Inicio() {
  let resumen: Resumen;
  try {
    // Revalida la sesión contra la base (D-014). Sin sesión, `redirect` lanza y el catch la deja pasar.
    await exigirSesion();
    resumen = await obtenerResumen(db);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("tablero", error);
    return <SinBase />;
  }
  return <Tablero vista={aVista(resumen)} />;
}
