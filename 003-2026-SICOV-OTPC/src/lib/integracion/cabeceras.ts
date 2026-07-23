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

/// Cabeceras del API externo de MANTENIMIENTOS (contrato verificado en el legacy, distinto de
/// despachos — R2 del spec 005): `Authorization` + `token` SIEMPRE; `vigiladoId` (NIT) SOLO en los
/// POST de detalle (guardar-preventivo/correctivo). NUNCA lleva la cabecera `documento`.
export interface CabecerasMantenimiento {
  Authorization: string;
  token: string;
  "Content-Type": string;
  vigiladoId?: string;
  [k: string]: string | undefined;
}

export async function construirCabecerasMantenimiento(
  identificacion: string,
  idRol: number,
  opts: { conVigiladoId?: boolean } = {},
): Promise<{ cabeceras: CabecerasMantenimiento; nitVigilado: string }> {
  const tokenExterno = await getTokenProveedor();
  const { tokenAutorizado, nitVigilado } = await resolverContextoEfectivo(identificacion, idRol);
  const cabeceras: CabecerasMantenimiento = {
    Authorization: `Bearer ${tokenExterno}`,
    token: tokenAutorizado,
    "Content-Type": "application/json",
  };
  if (opts.conVigiladoId) cabeceras.vigiladoId = nitVigilado;
  return { cabeceras, nitVigilado };
}
