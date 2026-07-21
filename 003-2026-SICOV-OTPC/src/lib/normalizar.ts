/// Normalización tolerante de respuestas externas (paridad ClienteApiSupertransporte).

/// Extrae la lista de datos aceptando array_data | data | obj | raíz.
export function extraerLista<T = unknown>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const r = res as Record<string, unknown> | null;
  if (!r) return [];
  for (const key of ["array_data", "data", "obj", "datos"]) {
    const v = r[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

/// Extrae el objeto de datos aceptando obj.obj | obj | data | raíz.
export function extraerObjeto(res: unknown): Record<string, unknown> {
  const r = res as Record<string, unknown> | null;
  if (!r) return {};
  const obj = r["obj"] as Record<string, unknown> | undefined;
  if (obj && typeof obj === "object") {
    const inner = obj["obj"];
    if (inner && typeof inner === "object") return inner as Record<string, unknown>;
    return obj;
  }
  const data = r["data"];
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return r;
}

/// Extrae el id de despacho externo probando candidatos anidados (obj.obj.id → obj.id → data.id → id).
export function extraerIdDespachoExterno(res: unknown): number | null {
  const r = res as Record<string, unknown> | null;
  const obj = (r?.["obj"] ?? {}) as Record<string, unknown>;
  const objObj = (obj?.["obj"] ?? {}) as Record<string, unknown>;
  const data = (r?.["data"] ?? {}) as Record<string, unknown>;
  const candidatos = [objObj?.["id"], obj?.["id"], data?.["id"], r?.["id"]];
  for (const c of candidatos) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/// Extrae el id de llegada externa (candidatos verificados en legacy ClienteApiSupertransporte):
/// obj.obj.id → obj.id → obj.idLlegada → data.idLlegada → data.id → idLlegada → id.
export function extraerIdLlegadaExterno(res: unknown): number | null {
  const r = res as Record<string, unknown> | null;
  const obj = (r?.["obj"] ?? {}) as Record<string, unknown>;
  const objObj = (obj?.["obj"] ?? {}) as Record<string, unknown>;
  const data = (r?.["data"] ?? {}) as Record<string, unknown>;
  const candidatos = [
    objObj?.["id"],
    obj?.["id"],
    obj?.["idLlegada"],
    data?.["idLlegada"],
    data?.["id"],
    r?.["idLlegada"],
    r?.["id"],
  ];
  for (const c of candidatos) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/// Mensaje de error externo tolerante.
export function extraerMensajeError(err: unknown): string {
  const e = err as Record<string, unknown> | null;
  const responseData = e?.["responseData"] as Record<string, unknown> | undefined;
  const response = e?.["response"] as Record<string, unknown> | undefined;
  const data = (responseData ?? (response?.["data"] as Record<string, unknown>)) ?? undefined;
  const msg =
    (data?.["mensaje"] as string) ??
    (data?.["message"] as string) ??
    (e?.["message"] as string) ??
    "Error de integración";
  return String(msg).slice(0, 300);
}

/// Limpia una placa: sin espacios/guiones, mayúsculas.
export function limpiarPlaca(placa: unknown): string {
  return String(placa ?? "").replace(/[\s-]/g, "").toUpperCase();
}
