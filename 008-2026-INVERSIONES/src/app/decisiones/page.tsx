import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import type { VistaDiario } from "../_plan/tipos";
import { datosDelDiario } from "./datos";
import { Diario } from "./Diario";

// Lee la base en cada visita: los resultados dependen de la fecha de hoy y de los cierres cargados.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaDiario({ searchParams }: Props) {
  let vista: VistaDiario;
  let soloLectura: boolean;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    vista = await datosDelDiario(db, (await searchParams).regla);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("decisiones", error);
    return <SinBase />;
  }
  return <Diario vista={vista} soloLectura={soloLectura} />;
}
