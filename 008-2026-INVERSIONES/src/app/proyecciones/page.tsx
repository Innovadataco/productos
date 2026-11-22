import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
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
  try {
    const usuario = await exigirSesion();
    datos = await datosDeProyecciones(db, usuario.id);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("proyecciones", error);
    return <SinBase />;
  }
  return (
    <>
      <Encabezado actual="proyecciones" />
      <main className="wrap proy">
        <Simulador datos={datos} />
        <footer className="pie">{PIE}</footer>
      </main>
    </>
  );
}
