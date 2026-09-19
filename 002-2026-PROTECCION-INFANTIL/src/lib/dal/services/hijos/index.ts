// SPEC-325 (002-PI-225) · barrel del módulo "A quién protejo".
export {
    registrarHijo,
    listarHijos,
    listarHijosConEstado,
    obtenerHijoDePadre,
    actualizarHijo,
    desvincularIdentificador,
    cambiarEstadoHijo,
    agregarIdentificador,
    cambiarEstadoIdentificador,
} from "./hijos";
// SPEC-339: el cruce identificador-de-hijo → aviso al padre (punto 4 Calidad).
export { notificarHijosSiCorresponde } from "./notificaciones";
// SPEC-716 (Parte B): los dos grupos por hijo («Sus cuentas» = reportes de OTROS · «Cuentas que
// reportaste por ella» = reportes PROPIOS) NO se re-exportan por este barril A PROPÓSITO: usan alias
// `@/lib/*` y el barril entra en la cadena de los workers (notificarHijosSiCorresponde) — I-88/SPEC-197
// prohíbe alias ahí. La pantalla los importa por su ruta directa (no es worker). Ver arch:check (f).
export { SEXOS } from "./tipos";
export type { RegistrarHijoInput, ActualizarHijoInput, IdentificadorHijoInput, Sexo } from "./tipos";
