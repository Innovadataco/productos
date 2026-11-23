import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { ultimaConciliacion } from "@/conciliacion/leer";
import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";
import { resumenDelDia } from "./_comun/resumen-ia/leer";
import type { VistaResumenIa } from "./_comun/resumen-ia/tipos";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "./_comun/sin-base";
import { aLineaDelTablero } from "./conciliacion/serializar";
import { aEvolucionVista, aVista } from "./tablero/serializar";
import { Tablero } from "./tablero/Tablero";
import type { EvolucionVista, LineaConciliacionVista } from "./tablero/tipos";

// Lee la base en cada visita: los datos son locales y cambian con cada carga.
export const dynamic = "force-dynamic";

/**
 * La evolución es secundaria: si su cálculo falla (un dato que no cuadra, no la base), el tablero se pinta igual con
 * un aviso y se registra solo el nombre del error (el mensaje podría traer cifras). Un fallo de la base sí se propaga.
 */
async function leerEvolucion(base: PrismaClient, resumen: Resumen): Promise<EvolucionVista | null> {
  try {
    return aEvolucionVista(await obtenerEvolucion(base, resumen));
  } catch (error) {
    if (esErrorDeBase(error)) throw error;
    console.error(`[tablero] no se pudo calcular la evolución (${error instanceof Error ? error.name : "desconocido"})`);
    return null;
  }
}

export default async function Inicio() {
  let resumen: Resumen;
  let conciliacion: LineaConciliacionVista;
  let evolucion: EvolucionVista | null;
  let soloLectura: boolean;
  let resumenIa: VistaResumenIa;
  try {
    // Revalida la sesión contra la base (D-014). Sin sesión, `redirect` lanza y el catch la deja pasar. El familiar,
    // en solo lectura (frente familia-lectura): ve la marca; lo que escribe lo bloquea el servidor.
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    resumen = await obtenerResumen(db);
    // La evolución diaria y la TWR sobre el mismo universo y la misma referencia del resumen (frente graficas-tablero),
    // y lo guardado de la última conciliación, sin recalcular (la frescura se ve en /conciliacion); las dos en paralelo.
    // La tarjeta del resumen DIARIO (E5) va después: su export proyecta bajo el turno y no compite con estas lecturas.
    const [evo, ultima] = await Promise.all([leerEvolucion(db, resumen), ultimaConciliacion(db)]);
    resumenIa = await resumenDelDia(db, "DIARIO", usuario.id);
    evolucion = evo;
    conciliacion = aLineaDelTablero(ultima);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("tablero", error);
    return <SinBase />;
  }
  return <Tablero vista={aVista(resumen)} conciliacion={conciliacion} evolucion={evolucion} soloLectura={soloLectura} resumenIa={resumenIa} />;
}
