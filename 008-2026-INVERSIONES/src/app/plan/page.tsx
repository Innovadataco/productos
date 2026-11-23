import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { resumenDelDia } from "../_comun/resumen-ia/leer";
import type { VistaResumenIa } from "../_comun/resumen-ia/tipos";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import type { DatosPlan } from "../_plan/tipos";
import { datosDelPlan } from "./datos";
import { Plan } from "./Plan";

// Lee la base en cada visita: el plan, los cierres y la fecha de referencia cambian con cada carga.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaPlan({ searchParams }: Props) {
  let datos: DatosPlan;
  let soloLectura: boolean;
  let resumenIa: VistaResumenIa | undefined;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    const { version } = await searchParams;
    datos = await datosDelPlan(db, version);
    // El resumen REGLAS (E5) es del plan vigente hoy: con `?version=` (otra versión) no se muestra.
    resumenIa = version === undefined ? await resumenDelDia(db, "REGLAS", usuario.id) : undefined;
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("plan", error);
    return <SinBase />;
  }
  return <Plan datos={datos} soloLectura={soloLectura} resumenIa={resumenIa} />;
}
