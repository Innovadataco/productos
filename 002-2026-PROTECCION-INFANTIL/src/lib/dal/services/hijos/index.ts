// SPEC-325 (002-PI-225) · barrel del módulo "A quién protejo".
export {
    registrarHijo,
    listarHijos,
    actualizarHijo,
    desvincularIdentificador,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
} from "./hijos";
// SPEC-339: el cruce identificador-de-hijo → aviso al padre (punto 4 Calidad).
export { notificarHijosSiCorresponde } from "./notificaciones";
export { DOCUMENTO_TIPOS, SEXOS } from "./tipos";
export type { RegistrarHijoInput, ActualizarHijoInput, IdentificadorHijoInput, DocumentoTipo, Sexo } from "./tipos";
