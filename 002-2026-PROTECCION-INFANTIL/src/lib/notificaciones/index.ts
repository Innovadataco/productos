/**
 * SPEC-201 (BRIEF §7): API pública estricta del motor de notificaciones.
 */
export { programar, despacharEnvios, cancelar, estado, recalcular } from "./motor";
export type {
    ProgramarInput,
    ProgramarResult,
    CancelarInput,
    CancelarResult,
    RecalcularInput,
    RecalcularResult,
    ProgramarOpciones,
    EnvioPendiente,
} from "./motor";
export { parseOffset, aplicarOffset, TIMEZONE_MOTOR } from "./offset";
export type { OffsetParseado, UnidadOffset } from "./offset";
export { aplicarQuietHours, DEFAULT_QUIET_HOURS } from "./quiet-hours";
export { renderizarPlantilla } from "./renderer";
export type { RenderResult } from "./renderer";
