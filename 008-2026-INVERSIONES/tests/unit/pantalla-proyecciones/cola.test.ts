// La cola de pedidos del simulador en el navegador (frente proyecciones-pantalla): espera ~350 ms sin cambios antes de
// pedir (debounce), nunca hay más de un pedido en vuelo (el servidor lo exige), de lo que se movió durante un pedido
// solo se pide lo último, una respuesta vieja no pisa la nueva, «ocupado» reintenta después de Retry-After y un error
// conserva lo último que se mostró. Con temporizadores falsos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESPERA_MS, crearCola, type Respuesta } from "@/app/proyecciones/cola";
import { CONTROLES_INICIALES, type Controles } from "@/app/proyecciones/opciones";
import type { VistaProyeccion } from "@/app/proyecciones/vista";

const c = (horizonteMeses: number): Controles => ({ ...CONTROLES_INICIALES, horizonteMeses });
const vistaDe = (horizonteMeses: number) => ({ controles: c(horizonteMeses) }) as unknown as VistaProyeccion;

interface Abierto { controles: Controles; responder: (r: Respuesta) => void }

function armar() {
  const abiertos: Abierto[] = [];
  const enviar = vi.fn((controles: Controles) => new Promise<Respuesta>((responder) => abiertos.push({ controles, responder })));
  const al = { calculando: vi.fn(), resultado: vi.fn(), fallo: vi.fn() };
  const cola = crearCola({ enviar, al });
  return { abiertos, enviar, al, cola };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const esperar = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); };

describe("crearCola", () => {
  it("espera ESPERA_MS sin cambios antes de pedir: cambios seguidos dan un solo pedido, con lo último", async () => {
    const { cola, enviar } = armar();
    expect(ESPERA_MS).toBe(350);
    cola.pedir(c(12));
    await esperar(200);
    cola.pedir(c(36));
    await esperar(349);
    expect(enviar).not.toHaveBeenCalled();
    await esperar(1);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0]![0]).toEqual(c(36));
  });

  it("avisa que calcula desde que se mueve un control y hasta que llega el resultado, que entrega", async () => {
    const { cola, abiertos, al } = armar();
    cola.pedir(c(12));
    expect(al.calculando).toHaveBeenLastCalledWith(true);
    await esperar(ESPERA_MS);
    abiertos[0]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(0);
    expect(al.resultado).toHaveBeenCalledWith(vistaDe(12));
    expect(al.calculando).toHaveBeenLastCalledWith(false);
  });

  it("un pedido en vuelo a la vez: lo que se mueve mientras, se pide al terminar, solo lo último, y la respuesta vieja no se pinta", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    cola.pedir(c(36));
    await esperar(ESPERA_MS);
    cola.pedir(c(60));
    await esperar(ESPERA_MS);
    expect(enviar).toHaveBeenCalledTimes(1);
    abiertos[0]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(0);
    expect(al.resultado).not.toHaveBeenCalled();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls.at(-1)![0]).toEqual(c(60));
    expect(al.calculando).toHaveBeenLastCalledWith(true);
    abiertos[1]!.responder({ tipo: "OK", vista: vistaDe(60) });
    await esperar(0);
    expect(al.resultado).toHaveBeenCalledTimes(1);
    expect(al.resultado).toHaveBeenCalledWith(vistaDe(60));
    expect(al.calculando).toHaveBeenLastCalledWith(false);
  });

  it("«ocupado» (429) reintenta lo mismo después de Retry-After, sin avisar fallo si al reintento le va bien", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    abiertos[0]!.responder({ tipo: "OCUPADO", reintentarEnS: 2 });
    await esperar(1_999);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(al.calculando).toHaveBeenLastCalledWith(true);
    await esperar(1);
    expect(enviar).toHaveBeenCalledTimes(2);
    abiertos[1]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(0);
    expect(al.fallo).not.toHaveBeenCalled();
    expect(al.resultado).toHaveBeenCalledWith(vistaDe(12));
  });

  it("después de tres «ocupado» seguidos se rinde y avisa, sin perder lo último que se mostró", async () => {
    const { cola, abiertos, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    for (let k = 0; k < 3; k += 1) {
      abiertos[k]!.responder({ tipo: "OCUPADO", reintentarEnS: 1 });
      await esperar(1_000);
    }
    abiertos[3]!.responder({ tipo: "OCUPADO", reintentarEnS: 1 });
    await esperar(1_000);
    expect(abiertos).toHaveLength(4);
    expect(al.fallo).toHaveBeenCalledWith("OCUPADO");
    expect(al.calculando).toHaveBeenLastCalledWith(false);
    expect(al.resultado).not.toHaveBeenCalled();
  });

  it("un error o unos parámetros rechazados avisan el fallo y dejan pedir de nuevo", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    abiertos[0]!.responder({ tipo: "ERROR" });
    await esperar(0);
    expect(al.fallo).toHaveBeenLastCalledWith("ERROR");
    expect(al.calculando).toHaveBeenLastCalledWith(false);
    cola.pedir(c(36));
    await esperar(ESPERA_MS);
    abiertos[1]!.responder({ tipo: "PARAMETROS" });
    await esperar(0);
    expect(al.fallo).toHaveBeenLastCalledWith("PARAMETROS");
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("si `enviar` rechaza (sin red), cuenta como error", async () => {
    const al = { calculando: vi.fn(), resultado: vi.fn(), fallo: vi.fn() };
    const cola = crearCola({ enviar: () => Promise.reject(new TypeError("sin red")), al });
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    expect(al.fallo).toHaveBeenCalledWith("ERROR");
  });

  it("una respuesta que llega mientras corre el debounce de otro cambio no se entrega ni apaga «Calculando…» (hallazgo MEDIO de code-reviewer y react-reviewer)", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    cola.pedir(c(36));
    await esperar(100);
    abiertos[0]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(0);
    expect(al.resultado).not.toHaveBeenCalled();
    expect(al.calculando).toHaveBeenLastCalledWith(true);
    await esperar(ESPERA_MS);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls.at(-1)![0]).toEqual(c(36));
    abiertos[1]!.responder({ tipo: "OK", vista: vistaDe(36) });
    await esperar(0);
    expect(al.resultado).toHaveBeenCalledWith(vistaDe(36));
    expect(al.calculando).toHaveBeenLastCalledWith(false);
  });

  it("un pendiente viejo no se pide si llega otro cambio: solo el último (hallazgo MEDIO de react-reviewer)", async () => {
    const { cola, abiertos, enviar } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    cola.pedir(c(36));
    await esperar(ESPERA_MS);
    cola.pedir(c(60));
    await esperar(100);
    abiertos[0]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(ESPERA_MS);
    expect(enviar.mock.calls.map(([x]) => x.horizonteMeses)).toEqual([12, 60]);
  });

  it("un 429 con Retry-After largo (límite de frecuencia) no espera minutos: avisa al instante (hallazgo MEDIO de code-reviewer)", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    abiertos[0]!.responder({ tipo: "OCUPADO", reintentarEnS: 59 });
    await esperar(0);
    expect(al.fallo).toHaveBeenCalledWith("FRECUENCIA");
    expect(al.calculando).toHaveBeenLastCalledWith(false);
    await esperar(60_000);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("si entregar el resultado falla, «Calculando…» se apaga igual y no queda una promesa rechazada (hallazgo BAJO de code-reviewer)", async () => {
    const abiertos: Abierto[] = [];
    const al = { calculando: vi.fn(), resultado: vi.fn(() => { throw new TypeError("x"); }), fallo: vi.fn() };
    const cola = crearCola({ enviar: (controles) => new Promise<Respuesta>((responder) => abiertos.push({ controles, responder })), al });
    const sinManejar = vi.fn();
    process.on("unhandledRejection", sinManejar);
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    abiertos[0]!.responder({ tipo: "OK", vista: vistaDe(12) });
    await esperar(0);
    expect(al.calculando).toHaveBeenLastCalledWith(false);
    expect(al.fallo).toHaveBeenCalledWith("ERROR");
    await esperar(0);
    process.off("unhandledRejection", sinManejar);
    expect(sinManejar).not.toHaveBeenCalled();
  });

  it("cancelar aborta el pedido en vuelo (hallazgo BAJO de react-reviewer)", async () => {
    const senales: AbortSignal[] = [];
    const al = { calculando: vi.fn(), resultado: vi.fn(), fallo: vi.fn() };
    const cola = crearCola({ enviar: (_c, senal) => { senales.push(senal); return new Promise<Respuesta>(() => undefined); }, al });
    cola.pedir(c(12));
    await esperar(ESPERA_MS);
    expect(senales[0]!.aborted).toBe(false);
    cola.cancelar();
    expect(senales[0]!.aborted).toBe(true);
  });

  it("cancelar (al desmontar) suelta los temporizadores y no entrega nada después", async () => {
    const { cola, abiertos, enviar, al } = armar();
    cola.pedir(c(12));
    cola.cancelar();
    await esperar(ESPERA_MS);
    expect(enviar).not.toHaveBeenCalled();
    cola.pedir(c(36));
    await esperar(ESPERA_MS);
    cola.cancelar();
    abiertos[0]?.responder({ tipo: "OK", vista: vistaDe(36) });
    await esperar(0);
    expect(al.resultado).not.toHaveBeenCalled();
  });
});
