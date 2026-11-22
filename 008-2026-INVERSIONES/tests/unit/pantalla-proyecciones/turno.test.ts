// El turno de las proyecciones (frente proyecciones-pantalla; contrato de src/proyecciones/proyectar.ts): el cálculo es
// síncrono, así que hay UNA proyección en vuelo por usuario, un límite de frecuencia por usuario y, en todo el proceso,
// un solo cálculo a la vez con una cola chica. Vive en globalThis: la página y la ruta comparten la misma instancia.
import { afterEach, describe, expect, it } from "vitest";
import { PROYECCIONES_POR_MINUTO, conTurno, reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";

afterEach(() => reiniciarTurnoParaPruebas());

const T0 = 1_811_234_567_000;

/** Una tarea que no termina hasta que se la suelta. */
function pendiente<T>(valor: T): { tarea: () => Promise<T>; soltar: () => void } {
  let soltar = () => undefined as void;
  const promesa = new Promise<T>((r) => { soltar = () => r(valor); });
  return { tarea: () => promesa, soltar };
}

describe("conTurno", () => {
  it("corre la tarea y devuelve su valor", async () => {
    expect(await conTurno("u1", T0, async () => 4613)).toEqual({ ok: true, valor: 4613 });
  });

  it("una proyección en vuelo por usuario: la segunda del mismo usuario se rechaza (EN_VUELO, reintentar en 1 s)", async () => {
    const p = pendiente(1);
    const primera = conTurno("u1", T0, p.tarea);
    expect(await conTurno("u1", T0 + 3, async () => 2)).toEqual({ ok: false, motivo: "EN_VUELO", reintentarEnS: 1 });
    p.soltar();
    expect(await primera).toEqual({ ok: true, valor: 1 });
    expect(await conTurno("u1", T0 + 7, async () => 3)).toEqual({ ok: true, valor: 3 });
  });

  it("si la tarea falla, el turno se libera y el error se propaga", async () => {
    await expect(conTurno("u1", T0, async () => { throw new RangeError("x"); })).rejects.toThrow(RangeError);
    expect(await conTurno("u1", T0 + 1, async () => 5)).toEqual({ ok: true, valor: 5 });
  });

  it(`límite de frecuencia por usuario: ${PROYECCIONES_POR_MINUTO} por minuto; la siguiente, FRECUENCIA con Retry-After`, async () => {
    expect(PROYECCIONES_POR_MINUTO).toBe(30);
    for (let k = 0; k < PROYECCIONES_POR_MINUTO; k += 1) expect((await conTurno("u1", T0 + k, async () => k)).ok).toBe(true);
    const r = await conTurno("u1", T0 + 1_000, async () => 0);
    expect(r).toEqual({ ok: false, motivo: "FRECUENCIA", reintentarEnS: 59 });
    // Otro usuario no paga por el primero.
    expect((await conTurno("u2", T0 + 1_000, async () => 1)).ok).toBe(true);
    // Pasado el minuto, vuelve a poder.
    expect((await conTurno("u1", T0 + 60_001, async () => 1)).ok).toBe(true);
  });

  it("en el proceso, un cálculo a la vez y una cola chica: con la cola llena, OCUPADO", async () => {
    const a = pendiente("a");
    const primera = conTurno("u1", T0, a.tarea);
    const enCola = [conTurno("u2", T0, async () => "b"), conTurno("u3", T0, async () => "c")];
    expect(await conTurno("u4", T0, async () => "d")).toEqual({ ok: false, motivo: "OCUPADO", reintentarEnS: 1 });
    a.soltar();
    expect(await primera).toEqual({ ok: true, valor: "a" });
    expect(await Promise.all(enCola)).toEqual([{ ok: true, valor: "b" }, { ok: true, valor: "c" }]);
  });

  it("los rechazos por OCUPADO no gastan la cuota de frecuencia: solo cuenta lo que se calcula (hallazgo MEDIO de security-reviewer)", async () => {
    const a = pendiente("a");
    const primera = conTurno("u1", T0, a.tarea);
    const enCola = [conTurno("u2", T0, async () => "b"), conTurno("u3", T0, async () => "c")];
    for (let k = 0; k < PROYECCIONES_POR_MINUTO + 5; k += 1) expect((await conTurno("u9", T0 + k, async () => "x")).ok).toBe(false);
    a.soltar();
    await primera;
    await Promise.all(enCola);
    expect(await conTurno("u9", T0 + 100, async () => "y")).toEqual({ ok: true, valor: "y" });
  });

  it("vive en globalThis (Symbol.for): otra carga del módulo ve el mismo turno", async () => {
    const p = pendiente(1);
    const primera = conTurno("u1", T0, p.tarea);
    const clave = Symbol.for("inv008.proyecciones.turno");
    expect((globalThis as Record<symbol, unknown>)[clave]).toBeDefined();
    p.soltar();
    await primera;
  });
});
