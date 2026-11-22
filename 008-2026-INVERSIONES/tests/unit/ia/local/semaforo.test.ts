/**
 * Un pedido a la vez: el semáforo da un turno por vez, en orden de llegada; una espera se corta con su señal y sale
 * de la cola; liberar dos veces no da dos turnos.
 */
import { describe, expect, it, vi } from "vitest";
import { crearSemaforo, type Liberar } from "@/ia/local/semaforo";

const vivo = (): AbortSignal => new AbortController().signal;
/** Deja correr las promesas pendientes. */
const drenar = async (): Promise<void> => {
  for (let i = 0; i < 7; i += 1) await Promise.resolve();
};

describe("crearSemaforo", () => {
  it("el primero entra de una; el segundo espera a que el primero libere", async () => {
    const semaforo = crearSemaforo();
    const primero = await semaforo.tomar(vivo());
    expect(typeof primero).toBe("function");
    let segundo: Liberar | null | undefined;
    void semaforo.tomar(vivo()).then((l) => {
      segundo = l;
    });
    await drenar();
    expect(segundo).toBeUndefined();
    (primero as Liberar)();
    await drenar();
    expect(typeof segundo).toBe("function");
  });

  it("los turnos van en orden de llegada", async () => {
    const semaforo = crearSemaforo();
    const orden: string[] = [];
    const liberarA = await semaforo.tomar(vivo());
    const b = semaforo.tomar(vivo()).then((l) => {
      orden.push("B");
      return l;
    });
    const c = semaforo.tomar(vivo()).then((l) => {
      orden.push("C");
      return l;
    });
    (liberarA as Liberar)();
    const liberarB = await b;
    await drenar();
    expect(orden).toEqual(["B"]);
    (liberarB as Liberar)();
    await c;
    expect(orden).toEqual(["B", "C"]);
  });

  it("una espera abortada devuelve null y sale de la cola: el siguiente recibe el turno", async () => {
    const semaforo = crearSemaforo();
    const liberarA = await semaforo.tomar(vivo());
    const control = new AbortController();
    const b = semaforo.tomar(control.signal);
    const c = semaforo.tomar(vivo());
    control.abort();
    expect(await b).toBeNull();
    (liberarA as Liberar)();
    expect(typeof (await c)).toBe("function");
  });

  it("una señal ya abortada no entra a la cola ni toma el turno", async () => {
    const semaforo = crearSemaforo();
    const control = new AbortController();
    control.abort();
    expect(await semaforo.tomar(control.signal)).toBeNull();
    expect(typeof (await semaforo.tomar(vivo()))).toBe("function");
  });

  it("liberar dos veces no da dos turnos", async () => {
    const semaforo = crearSemaforo();
    const liberarA = (await semaforo.tomar(vivo())) as Liberar;
    let b: Liberar | null | undefined;
    let c: Liberar | null | undefined;
    void semaforo.tomar(vivo()).then((l) => {
      b = l;
    });
    void semaforo.tomar(vivo()).then((l) => {
      c = l;
    });
    liberarA();
    liberarA();
    await drenar();
    expect(typeof b).toBe("function");
    expect(c).toBeUndefined();
  });

  it("al recibir el turno quita su escucha de la señal: abortarla después no suelta el turno", async () => {
    const semaforo = crearSemaforo();
    const liberarA = (await semaforo.tomar(vivo())) as Liberar;
    const control = new AbortController();
    const quitar = vi.spyOn(control.signal, "removeEventListener");
    const b = semaforo.tomar(control.signal);
    liberarA();
    const liberarB = await b;
    expect(typeof liberarB).toBe("function");
    expect(quitar).toHaveBeenCalledWith("abort", expect.any(Function));
    control.abort();
    let c: Liberar | null | undefined;
    void semaforo.tomar(vivo()).then((l) => {
      c = l;
    });
    await drenar();
    expect(c).toBeUndefined();
    (liberarB as Liberar)();
    await drenar();
    expect(typeof c).toBe("function");
  });

  it("el primero, sin espera, no deja escuchas en su señal", async () => {
    const semaforo = crearSemaforo();
    const control = new AbortController();
    const poner = vi.spyOn(control.signal, "addEventListener");
    await semaforo.tomar(control.signal);
    expect(poner).not.toHaveBeenCalled();
  });
});
