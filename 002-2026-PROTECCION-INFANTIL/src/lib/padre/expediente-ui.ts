import { toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

const ZONA_BOGOTA = "America/Bogota";

export const LABELS_ESTADO: Record<EstadoExpediente, string> = {
    ACTIVO: "Activo",
    CONSOLIDANDO: "Consolidando",
    PENDIENTE_COMITE: "Pendiente comité",
    EN_APROBACION_PADRE: "En aprobación",
    EN_ACLARACION: "En aclaración",
    CERRADO: "Cerrado",
    ESCALADO: "Escalado",
};

export const LABELS_SCORE: Record<ScoreGravedad, string> = {
    VERDE: "Nivel bajo",
    AMARILLO: "Nivel medio",
    ROJO: "Nivel crítico",
};

export const COLORES_SCORE: Record<ScoreGravedad, string> = {
    VERDE: "bg-pino/10 text-pino border-pino/30",
    AMARILLO: "bg-ambar/10 text-ambar border-ambar/30",
    ROJO: "bg-rubi/10 text-rubi border-rubi/30",
};

export function diasDesdeUltimaActividad(fecha: Date | string): number {
    const ahora = toZonedTime(new Date(), ZONA_BOGOTA);
    const entonces = toZonedTime(new Date(fecha), ZONA_BOGOTA);
    return differenceInCalendarDays(ahora, entonces);
}

export function grupoEstado(estado: EstadoExpediente): "activos" | "en_revision" | "cerrados" {
    if (estado === "ACTIVO") return "activos";
    if (estado === "CERRADO" || estado === "ESCALADO") return "cerrados";
    return "en_revision";
}

export function debeMostrarAutoSuggest(ultimoEventoEn: Date | string | null): boolean {
    if (!ultimoEventoEn) return true;
    return diasDesdeUltimaActividad(ultimoEventoEn) >= 3;
}
