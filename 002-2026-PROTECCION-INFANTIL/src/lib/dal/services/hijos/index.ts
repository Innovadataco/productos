// SPEC-325 (002-PI-225) · barrel del módulo "A quién protejo".
export {
    registrarHijo,
    listarHijos,
    desvincularIdentificador,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
} from "./hijos";
export { DOCUMENTO_TIPOS, SEXOS } from "./tipos";
export type { RegistrarHijoInput, IdentificadorHijoInput, DocumentoTipo, Sexo } from "./tipos";
