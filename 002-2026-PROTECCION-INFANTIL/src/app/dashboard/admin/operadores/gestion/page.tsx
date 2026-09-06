import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { homeAccesoDenegado } from "../acceso-denegado";
import GestionClient from "./GestionClient";

/**
 * SPEC-571 (I-353): guardia de rol A NIVEL PÁGINA. Un componente cliente no
 * puede correr la comprobación de servidor, así que la envuelve este wrapper
 * (patrón SPEC-564). El módulo "operadores" es el que ya exige su API
 * (verifyAuth("ADMIN") + assertModulo("operadores")); denegado redirige como el
 * resto del área (I-129), no muestra la tarjeta de error.
 */
export default async function Page() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido) redirect(homeAccesoDenegado(acceso.rol));
    return <GestionClient />;
}
