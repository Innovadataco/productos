/**
 * SPEC-135 (E-2): barrel del módulo circulo-confianza — reexporta TODA la API
 * pública del god-module original (funciones y tipos) para que los consumidores
 * (`@/lib/dal/services/circulo-confianza`) no cambien una línea.
 */
export type { EstadoContacto, IdentificadorInput } from "./tipos";
export {
    contarContactosActivos,
    obtenerTopeContactos,
    obtenerUmbralAgregacion,
    determinarEstadoContacto,
} from "./estado";
export { listarContactos, obtenerDetalleContacto } from "./contactos";
export { agregarContacto, actualizarContacto } from "./contactos-mutaciones";
export { obtenerVistaAgregada } from "./agregado";
export { toggleNotificacionesCirculo, obtenerPreferenciasCirculo } from "./preferencias";
export { notificarCambioCirculoSiCorresponde } from "./notificaciones";
