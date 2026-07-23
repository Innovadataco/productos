/// Catálogo declarativo de la Consola de APIs (spec 013). Constante de CÓDIGO (no BD).
/// Cada entrada declara CÓMO se ejecutará en Fase 2 (método del cliente `ClienteSupertransporte`),
/// de modo que pasar a real = encender el gate, sin reestructurar la consola.
///
/// DOBLE CANDADO: además del gate de entorno (INTEGRACIONES_MODO/SUPERTRANSPORTE_HABILITADO), el
/// candado de FASE en CÓDIGO (`FASE_CONSOLA`) bloquea la ejecución "real" desde la consola: el
/// endpoint responde 403 mientras sea 1. Cambiarla exige un commit revisado (no un .env).
export const FASE_CONSOLA = 1 as const;

/// Ejecutores = métodos reales de `ClienteSupertransporte`. El mapeo ejecutor→método es una tabla,
/// no un switch disperso (se resuelve en `ejecutar.ts`).
export type Ejecutor =
  | "postTransaccional"
  | "postMantenimiento"
  | "getMantenimiento"
  | "consultarIntegradora"
  | "consultarRutasActivas"
  | "consultarAutorizaciones";

export interface OperacionCatalogo {
  clave: string;
  titulo: string;
  metodo: "GET" | "POST";
  /// Path externo declarado (NO secreto) — informativo para la UI y la bitácora.
  pathExterno: string;
  /// Solo NOMBRES de cabeceras aplicables, jamás valores.
  cabeceras: string[];
  ejemplo: Record<string, unknown>;
  ejecutor: Ejecutor;
  opciones?: { conVigiladoId?: boolean };
  /// Operaciones 006/007/008: listadas pero NO ejecutables en Fase 1.
  pendiente?: boolean;
}

const CABECERAS_DOBLE_TOKEN = ["Authorization", "token", "documento"];

export const CATALOGO: OperacionCatalogo[] = [
  {
    clave: "despachos",
    titulo: "Reportar despacho (salida)",
    metodo: "POST",
    pathExterno: "/despachosempresa",
    cabeceras: CABECERAS_DOBLE_TOKEN,
    ejemplo: { obj_despacho: { nitEmpresaTransporte: "900853057", fechaSalida: "2026-07-23", horaSalida: "08:00" }, obj_vehiculo: { placa: "ABC123" } },
    ejecutor: "postTransaccional",
  },
  {
    clave: "llegadas",
    titulo: "Reportar llegada",
    metodo: "POST",
    pathExterno: "/llegadasempresa",
    cabeceras: CABECERAS_DOBLE_TOKEN,
    ejemplo: { idTipollegada: "2", nitEmpresaTransporte: "900853057", placa: "ABC123", fechaLlegada: "2026-07-23", horaLlegada: "12:00" },
    ejecutor: "postTransaccional",
  },
  {
    clave: "mantenimiento-base",
    titulo: "Mantenimiento — base",
    metodo: "POST",
    pathExterno: "/mantenimiento",
    cabeceras: ["Authorization", "token"],
    ejemplo: { placa: "ABC123", tipoId: 1 },
    ejecutor: "postMantenimiento",
  },
  {
    clave: "mantenimiento-preventivo",
    titulo: "Mantenimiento — preventivo (detalle)",
    metodo: "POST",
    pathExterno: "/mantenimiento/preventivo",
    cabeceras: ["Authorization", "token", "vigiladoId"],
    ejemplo: { placa: "ABC123", fecha: "2026-07-20", detalleActividades: "Cambio de aceite" },
    ejecutor: "postMantenimiento",
    opciones: { conVigiladoId: true },
  },
  {
    clave: "mantenimiento-correctivo",
    titulo: "Mantenimiento — correctivo (detalle)",
    metodo: "POST",
    pathExterno: "/mantenimiento/correctivo",
    cabeceras: ["Authorization", "token", "vigiladoId"],
    ejemplo: { placa: "ABC123", fecha: "2026-07-20", detalleActividades: "Reparación de frenos" },
    ejecutor: "postMantenimiento",
    opciones: { conVigiladoId: true },
  },
  {
    clave: "integradora",
    titulo: "Consulta integradora (verificación en vivo)",
    metodo: "POST",
    pathExterno: "/api-integradora/resumen",
    cabeceras: CABECERAS_DOBLE_TOKEN,
    ejemplo: { placa: "ABC123", numeroIdentificacion: "123456" },
    ejecutor: "consultarIntegradora",
  },
  {
    clave: "maestras-rutas",
    titulo: "Maestras — rutas activas",
    metodo: "GET",
    pathExterno: "/rutas-activas",
    cabeceras: ["Authorization"],
    ejemplo: { nit: "900853057" },
    ejecutor: "consultarRutasActivas",
  },
  {
    clave: "maestras-autorizaciones",
    titulo: "Maestras — autorizaciones",
    metodo: "GET",
    pathExterno: "/autorizaciones",
    cabeceras: ["Authorization"],
    ejemplo: { nit: "900853057", placa: "ABC123", fecha: "2026-07-23" },
    ejecutor: "consultarAutorizaciones",
  },
  // ── Pendientes 006/007/008: listadas, NO ejecutables en Fase 1 ──────────────────────────────
  { clave: "alistamientos", titulo: "Alistamientos (pendiente spec 006)", metodo: "POST", pathExterno: "—", cabeceras: [], ejemplo: {}, ejecutor: "postTransaccional", pendiente: true },
  { clave: "autorizaciones-nna", titulo: "Autorizaciones NNA (pendiente spec 007)", metodo: "POST", pathExterno: "—", cabeceras: [], ejemplo: {}, ejecutor: "postTransaccional", pendiente: true },
  { clave: "novedades", titulo: "Novedades (pendiente spec 008)", metodo: "POST", pathExterno: "—", cabeceras: [], ejemplo: {}, ejecutor: "postTransaccional", pendiente: true },
];

export function buscarOperacion(clave: string): OperacionCatalogo | undefined {
  return CATALOGO.find((o) => o.clave === clave);
}
