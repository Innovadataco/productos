import { getTokenProveedor } from "@/lib/integracion/token-proveedor";
import { resolverContextoEfectivo } from "@/lib/integracion/contexto-usuario";

/// Las 3 cabeceras del esquema de doble token (+ Content-Type).
export interface CabecerasTransaccionales {
  Authorization: string; // Bearer <tokenExterno> (proveedor)
  token: string; // <tokenAutorizado> (vigilado)
  documento: string; // <nitVigilado>
  "Content-Type": string;
  [k: string]: string;
}

/// Construye las cabeceras resolviendo el token de proveedor (cache/refresh) y la herencia rol 3.
export async function construirCabeceras(
  identificacion: string,
  idRol: number,
): Promise<CabecerasTransaccionales> {
  const tokenExterno = await getTokenProveedor();
  const { tokenAutorizado, nitVigilado } = await resolverContextoEfectivo(identificacion, idRol);
  return {
    Authorization: `Bearer ${tokenExterno}`,
    token: tokenAutorizado,
    documento: nitVigilado,
    "Content-Type": "application/json",
  };
}
