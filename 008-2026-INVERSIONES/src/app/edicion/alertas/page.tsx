import { exigirDueno } from "@/auth/sesion";
import { db } from "@/lib/db";
import { SinBase, esErrorDeBase, registrarFalloDeBase } from "../../_comun/sin-base";
import { PaginaEdicion } from "../Pagina";
import { datosEdicionAlertas } from "./datos";
import { FormularioAlertas } from "./FormularioAlertas";
import { Historia, Resumen } from "./Informacion";
import { TEXTOS_ALERTAS } from "./textos-alertas";
import type { DatosEdicionAlertas } from "./tipos-alertas";
import "./alertas.css";

// Lee la base en cada visita: las versiones cambian.
export const dynamic = "force-dynamic";

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /edicion/alertas · los umbrales de las alertas, solo del dueño (la familia recibe 404 antes de leer nada). */
export default async function PaginaEdicionAlertas({ searchParams }: Props) {
  let datos: DatosEdicionAlertas;
  try {
    await exigirDueno();
    datos = await datosEdicionAlertas(db, (await searchParams).guardada);
  } catch (error) {
    if (!esErrorDeBase(error)) throw error;
    registrarFalloDeBase("edicion-alertas", error);
    return <SinBase />;
  }
  return (
    <PaginaEdicion seccion="configuracion" titulo={TEXTOS_ALERTAS.TITULO} volver={{ href: "/alertas", texto: "Volver a las alertas" }}>
      <Resumen datos={datos} />
      <FormularioAlertas datos={datos} />
      <Historia datos={datos} />
    </PaginaEdicion>
  );
}
