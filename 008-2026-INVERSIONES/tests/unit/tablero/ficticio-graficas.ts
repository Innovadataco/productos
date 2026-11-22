// Ayudas de las pruebas de las gráficas del tablero: una evolución inventada (FICTA y FICTB, días hábiles de
// enero a marzo de 2027) ya serializada, y un tablero con 9 especies. No es una prueba.
import { aEvolucionVista } from "@/app/tablero/serializar";
import type { EvolucionVista } from "@/app/tablero/tipos";
import { calcularEvolucion } from "@/tablero/evolucion";
import { D, dia, especie } from "./ficticio";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function habiles(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let t = dia(desde).getTime(); t <= dia(hasta).getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dias.push(iso(d));
  }
  return dias;
}

/** FICTA desde el 4-ene-2027 y FICTB desde el 1-mar-2027; FICTZ sin ningún cierre. */
export function evolucionFicticia(): EvolucionVista {
  const A = { id: "iA", nemo: "FICTA" };
  const B = { id: "iB", nemo: "FICTB" };
  const dias = habiles("2027-01-04", "2027-03-31");
  const precioA = (k: number) => D((1237 + 41 * Math.sin(k / 3) + 3 * k).toFixed(2));
  const precioB = (k: number) => D((461.3 - 7 * Math.cos(k / 2) - k).toFixed(2));
  const cierres = [
    ...dias.map((f, k) => ({ instrumentoId: A.id, fecha: dia(f), precio: precioA(k) })),
    ...dias.filter((f) => f >= "2027-03-01" && f !== "2027-03-17").map((f, k) => ({ instrumentoId: B.id, fecha: dia(f), precio: precioB(k) })),
  ];
  return aEvolucionVista(calcularEvolucion({
    especies: [A, B, { id: "iZ", nemo: "FICTZ" }],
    lotes: [
      { id: "L1", instrumentoId: A.id, fecha: dia("2027-01-04"), cantidad: 19n, costoTotal: D(23503), flujo: D("23519.11") },
      { id: "L2", instrumentoId: B.id, fecha: dia("2027-02-24"), cantidad: 37n, costoTotal: D("17068.1"), flujo: D("17079.29") },
      { id: "LZ", instrumentoId: "iZ", fecha: dia("2027-01-04"), cantidad: 3n, costoTotal: D(4613), flujo: D(4617) },
    ],
    ventas: [], dividendos: [{ instrumentoId: A.id, fecha: dia("2027-02-15"), monto: D("371.13") }], cierres, referencia: dia("2027-03-31"),
  }));
}

/** Nueve especies vivas con cierre (FICT1 … FICT9): la composición pliega las dos menores en «Otras». */
export const nueveEspecies = () =>
  Array.from({ length: 9 }, (_, k) => especie({
    nemotecnico: `FICT${k + 1}`, cantidad: BigInt(k + 2), costoVivo: D(1237 + k * 101),
    cierre: { precio: D(`${300 + k * 61}.37`), fecha: dia("2027-03-31"), verificado: k % 2 === 0 },
  }));
