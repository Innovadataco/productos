import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { datosEdicionIa } from "./datos";
import { EstadoPuertas } from "./EstadoPuertas";
import { FormularioIa } from "./FormularioIa";
import { Fijos, Historia, Resumen } from "./Informacion";
import { TEXTOS_IA } from "./textos-ia";
import type { DatosEdicionIa } from "./tipos-ia";
import "./ia.css";

// Lee la base en cada visita: la vigente, la historia y el gasto cambian.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /edicion/ia · la configuración de la IA, solo del dueño (la familia recibe 404 antes de leer nada). */
export default async function PaginaEdicionIa({ searchParams }: Props) {
  let datos: DatosEdicionIa;
  try {
    await exigirDueno();
    datos = await datosEdicionIa(db, process.env, (await searchParams).guardada);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-ia", error);
    return <SinBase />;
  }
  return (
    <PaginaEdicion seccion="configuracion" titulo={TEXTOS_IA.TITULO} volver={{ href: "/plan", texto: "Volver al plan" }}>
      <Resumen datos={datos} />
      <EstadoPuertas puertas={datos.puertas} />
      <FormularioIa datos={datos} />
      <Fijos />
      <Historia historia={datos.historia} />
    </PaginaEdicion>
  );
}
