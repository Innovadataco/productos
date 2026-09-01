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
export { DOCUMENTO_TIPOS, SEXOS } from "./tipos";
export type { RegistrarHijoInput, ActualizarHijoInput, IdentificadorHijoInput, DocumentoTipo, Sexo } from "./tipos";
