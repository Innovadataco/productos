/** Rutas SVG: línea con huecos, área entre dos curvas, región para recortar y tajadas de la dona. Puro. */

export interface Punto { readonly x: number; readonly y: number | null }

const uno = (v: number): string => String(Math.round(v * 10) / 10 || 0);
const par = (p: { readonly x: number; readonly y: number }) => `${uno(p.x)},${uno(p.y)}`;
const conDato = (p: Punto): p is { x: number; y: number } => p.y !== null && Number.isFinite(p.y);

/** Une los puntos; un null corta la línea. */
export function rutaLinea(puntos: readonly Punto[]): string {
  let d = "";
  let enTramo = false;
  for (const p of puntos) {
    if (!conDato(p)) { enTramo = false; continue; }
    d += `${enTramo ? "L" : "M"}${par(p)}`;
    enTramo = true;
  }
  return d;
}

/** Área entre dos curvas con los mismos x: la de arriba hacia adelante, la de abajo hacia atrás, por tramos sin null. */
export function rutaArea(arriba: readonly Punto[], abajo: readonly Punto[]): string {
  const tramos: { x: number; y: number; y2: number }[][] = [];
  let actual: { x: number; y: number; y2: number }[] = [];
  arriba.forEach((p, i) => {
    const q = abajo[i];
    if (conDato(p) && q && conDato(q)) actual.push({ x: p.x, y: p.y, y2: q.y });
    else if (actual.length > 0) { tramos.push(actual); actual = []; }
  });
  if (actual.length > 0) tramos.push(actual);
  return tramos.map((t) => {
    const ida = t.map((p, i) => `${i === 0 ? "M" : "L"}${par(p)}`).join("");
    const vuelta = [...t].reverse().map((p) => `L${par({ x: p.x, y: p.y2 })}`).join("");
    return `${ida}${vuelta}Z`;
  }).join("");
}

/** La curva cerrada contra un borde horizontal (0 = arriba, el alto = abajo): sirve de recorte. */
export function rutaRegion(curva: readonly Punto[], borde: number): string {
  const pts = curva.filter(conDato);
  const primero = pts[0];
  const ultimo = pts[pts.length - 1];
  if (!primero || !ultimo) return "";
  return `${pts.map((p, i) => `${i === 0 ? "M" : "L"}${par(p)}`).join("")}L${par({ x: ultimo.x, y: borde })}L${par({ x: primero.x, y: borde })}Z`;
}

export interface Tajada { readonly inicio: number; readonly largo: number }

/** Reparte la circunferencia por valor con un hueco entre tajadas; una sola tajada da la vuelta entera. */
export function tajadasDona(valores: readonly number[], circunferencia: number, hueco: number): Tajada[] {
  const total = valores.reduce((s, v) => (v > 0 ? s + v : s), 0);
  const positivos = valores.filter((v) => v > 0).length;
  let acumulado = 0;
  const r = (v: number) => Math.round(v * 10) / 10;
  return valores.map((v) => {
    if (!(v > 0) || total === 0) return { inicio: r(acumulado), largo: 0 };
    const largo = (v / total) * circunferencia;
    const t = positivos === 1 ? { inicio: r(acumulado), largo: r(largo) } : { inicio: r(acumulado + hueco / 2), largo: r(Math.max(0, largo - hueco)) };
    acumulado += largo;
    return t;
  });
}
