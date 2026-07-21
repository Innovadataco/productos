/// Utilidades de fecha/hora en zona America/Bogota (paridad con el legacy).
const TZ = "America/Bogota";

/// Fecha actual en Bogotá como "YYYY-MM-DD".
export function fechaBogota(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/// Hora actual en Bogotá como "HH:mm" (24h).
export function horaBogota(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/// Inicio del día de hoy (Bogotá) como Date UTC, para filtros "de hoy".
export function inicioDiaBogota(d: Date = new Date()): Date {
  const ymd = fechaBogota(d); // YYYY-MM-DD en Bogotá
  // Bogotá es UTC-5 sin horario de verano.
  return new Date(`${ymd}T00:00:00-05:00`);
}
