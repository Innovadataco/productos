import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { resumenDelDia } from "../_comun/resumen-ia/leer";
import { TarjetaResumenIa } from "../_comun/resumen-ia/TarjetaResumenIa";
import type { VistaResumenIa } from "../_comun/resumen-ia/tipos";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { Encabezado } from "../_plan/Encabezado";
import { datosDeProyecciones, type DatosProyecciones } from "./datos";
import { Simulador } from "./Simulador";

// Lee la base en cada visita: la historia y la proyección cambian con cada carga de precios.
export const dynamic = "force-dynamic";

const PIE = "El sistema calcula y muestra; no recomienda comprar ni vender.";

/**
 * /proyecciones (frente proyecciones-pantalla; hito 3 del PRD): el escenario por defecto ya calculado en el servidor
 * (sin parpadeo al cargar) y el simulador. Revalida la sesión contra la base (D-014) ANTES de leer nada; sin sesión,
 * `redirect` lanza y pasa. Un fallo de la base se muestra como en las otras pantallas; otro error se propaga.
 */
export default async function PaginaProyecciones() {
  let datos: DatosProyecciones;
  let soloLectura: boolean;
  let resumenIa: VistaResumenIa;
  try {
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    datos = await datosDeProyecciones(db, usuario.id);
    // El resumen ESCENARIOS (E5), después del cálculo inicial: los dos usan el turno del usuario y en paralelo chocarían.
    resumenIa = await resumenDelDia(db, "ESCENARIOS", usuario.id);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("proyecciones", error);
    return <SinBase />;
  }
  return (
    <>
      <Encabezado actual="proyecciones" soloLectura={soloLectura} />
      <main className="wrap proy">
        <TarjetaResumenIa vista={resumenIa} />
        <Simulador datos={datos} />
        <footer className="pie">{PIE}</footer>
      </main>
    </>
  );
}
