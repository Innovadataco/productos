// Carga de bcrypt (D-014, hallazgo MEDIO de security-reviewer): bcryptjs ocupa el hilo ~200 ms por
// hash, así que una ráfaga desde muchas IP podría saturar el proceso aunque cada IP respete su tope.
// Dos barreras de proceso: un semáforo (máximo 2 bcrypt a la vez, cola acotada) y un tope global de
// ingresos por minuto.
import { describe, expect, it } from "vitest";
import { ErrorOcupado, crearSemaforo } from "@/auth/carga";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("crearSemaforo", () => {
  it("nunca corre más de 2 a la vez", async () => {
    const s = crearSemaforo({ maximo: 2, maxEspera: 50 });
    let activos = 0;
    let pico = 0;
    const tarea = async () => {
      activos += 1;
      pico = Math.max(pico, activos);
      await esperar(10);
      activos -= 1;
    };
    await Promise.all(Array.from({ length: 10 }, () => s.con(tarea)));
    expect(pico).toBe(2);
  });

  it("con la cola llena rechaza en vez de acumular", async () => {
    const s = crearSemaforo({ maximo: 1, maxEspera: 1 });
    const largas = [s.con(() => esperar(30)), s.con(() => esperar(30))];
    await expect(s.con(() => esperar(1))).rejects.toBeInstanceOf(ErrorOcupado);
    await Promise.all(largas);
  });

  it("si la tarea falla, libera el permiso", async () => {
    const s = crearSemaforo({ maximo: 1, maxEspera: 5 });
    await expect(s.con(() => Promise.reject(new Error("falla ficticia")))).rejects.toThrow("falla ficticia");
    await expect(s.con(async () => "sigue")).resolves.toBe("sigue");
  });
});
