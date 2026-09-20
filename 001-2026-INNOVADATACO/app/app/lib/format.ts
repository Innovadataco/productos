export function formatCOP(value: number | null | string): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? Number(value.replace(/[^0-9]/g, "")) : Number(value);
  if (Number.isNaN(num)) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(num);
}

export function parseCOP(value: string): number | null {
  const clean = value.replace(/[^0-9]/g, "");
  if (!clean) return null;
  return Number(clean);
}

export function diasEjecucion(inicio: string | Date | null, fin: string | Date | null): number | null {
  if (!inicio || !fin) return null;
  const d1 = new Date(inicio);
  const d2 = new Date(fin);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  const msPorDia = 1000 * 60 * 60 * 24;
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / msPorDia);
  return diff >= 0 ? diff : null;
}

export function formatDateInput(value: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export function formatDateDisplay(value: string | Date | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-CO");
}
