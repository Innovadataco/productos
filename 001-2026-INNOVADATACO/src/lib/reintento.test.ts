import { describe, it, expect, vi } from "vitest";
import { conReintento } from "./reintento";

/** Espera instantánea: la suite no debe tardar de verdad. */
const sinEsperar = () => Promise.resolve();

describe("conReintento (spec 013, FR-001)", () => {
  it("no reintenta lo que sale bien a la primera", async () => {
    const tarea = vi.fn().mockResolvedValue("texto");

    await expect(conReintento(tarea, { dormir: sinEsperar })).resolves.toBe("texto");
    expect(tarea).toHaveBeenCalledTimes(1);
  });

  it("un fallo pasajero deja de condenar el documento (SC-003)", async () => {
    const tarea = vi
      .fn()
      .mockRejectedValueOnce(new Error("Timeout extrayendo texto del PDF"))
      .mockResolvedValue("texto recuperado");

    await expect(conReintento(tarea, { dormir: sinEsperar })).resolves.toBe("texto recuperado");
    expect(tarea).toHaveBeenCalledTimes(2);
  });

  it("deja de insistir al agotar los intentos (SC-004)", async () => {
    const tarea = vi.fn().mockRejectedValue(new Error("Invalid XRef stream header"));

    await expect(
      conReintento(tarea, { intentos: 3, dormir: sinEsperar }),
    ).rejects.toThrow("Invalid XRef stream header");
    expect(tarea).toHaveBeenCalledTimes(3);
  });

  it("relanza el ÚLTIMO error: quien llama debe poder distinguir por qué se rindió", async () => {
    const tarea = vi
      .fn()
      .mockRejectedValueOnce(new Error("primero"))
      .mockRejectedValueOnce(new Error("último"));

    await expect(conReintento(tarea, { intentos: 2, dormir: sinEsperar })).rejects.toThrow(
      "último",
    );
  });

  it("avisa de cada fallo, que es lo que permite auditarlos (FR-005)", async () => {
    const alFallar = vi.fn();
    const tarea = vi.fn().mockRejectedValue(new Error("roto"));

    await expect(
      conReintento(tarea, { intentos: 3, alFallar, dormir: sinEsperar }),
    ).rejects.toThrow();

    expect(alFallar).toHaveBeenCalledTimes(3);
    expect(alFallar.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it("no espera después del último fallo: esa espera no sirve a nadie", async () => {
    const dormir = vi.fn().mockResolvedValue(undefined);
    const tarea = vi.fn().mockRejectedValue(new Error("roto"));

    await expect(conReintento(tarea, { intentos: 3, dormir })).rejects.toThrow();

    // 3 intentos → 2 esperas, no 3.
    expect(dormir).toHaveBeenCalledTimes(2);
  });

  it("con un solo intento se comporta como si no hubiera reintento", async () => {
    const tarea = vi.fn().mockRejectedValue(new Error("roto"));

    await expect(conReintento(tarea, { intentos: 1, dormir: sinEsperar })).rejects.toThrow();
    expect(tarea).toHaveBeenCalledTimes(1);
  });
});
