import { esSoloLectura } from "@/auth/roles";
import { exigirSesion } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../_comun/sin-base";
import { Conciliacion } from "./Conciliacion";
import { datosDeConciliacion, type DatosConciliacion } from "./datos";

// Lee la base en cada visita: la conciliación cambia con cada carga y con cada corrida de `conciliar`.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaConciliacion({ searchParams }: Props) {
  let datos: DatosConciliacion;
  let soloLectura: boolean;
  try {
    // Revalida la sesión contra la base (D-014) antes de leer nada. Sin sesión, `redirect` lanza y pasa.
    const usuario = await exigirSesion();
    soloLectura = esSoloLectura(usuario);
    datos = await datosDeConciliacion(db, (await searchParams).corte);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("conciliacion", error);
    return <SinBase />;
  }
  return <Conciliacion datos={datos} soloLectura={soloLectura} />;
}
