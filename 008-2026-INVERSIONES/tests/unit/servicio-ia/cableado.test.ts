// El cableado real del servicio inv-008-ia que se puede probar sin base ni red: el `fetch` acotado (solo el destino de
// la tailnet y las dos rutas de Ollama) y los digests de la clave de «ya publicado».
import { describe, expect, it, vi } from "vitest";
import { digestsDe, fetchAcotado, opcionesDe } from "@/servicio-ia/cableado";
import { DESTINO_FICTICIO, DIGEST_QWEN, LISTA_FICTICIA, SIN_LISTA, VIGENTE_FICTICIA } from "../ia/config/apoyo/config.ficticio";

const init = { method: "GET", headers: {}, signal: new AbortController().signal, redirect: "manual" } as const;

describe("fetchAcotado", () => {
  it("deja pasar solo /api/tags y /api/generate de un destino de la tailnet", async () => {
    const real = vi.fn(async () => ({ status: 200 }) as never);
    const buscar = fetchAcotado(real);
    await buscar(`${DESTINO_FICTICIO}/api/tags`, init);
    await buscar(`${DESTINO_FICTICIO}/api/generate`, init);
    expect(real).toHaveBeenCalledTimes(2);
  });

  it.each(["https://api.telegram.org/", "http://inv-008-db:5432/api/tags", `${DESTINO_FICTICIO}/api/pull`, `${DESTINO_FICTICIO}/api/tags?x=1`, "http://localhost:8008/api/tags"])(
    "rechaza %s sin salir a la red",
    async (url) => {
      const real = vi.fn();
      await expect(fetchAcotado(real as never)(url, init)).rejects.toThrow(/DESTINO_NO_PERMITIDO/);
      expect(real).not.toHaveBeenCalled();
    },
  );
});

describe("digestsDe y opcionesDe", () => {
  it("el digest de la lista de PI del modelo local de la tarea, si el modo usa la local", () => {
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "DIARIO", LISTA_FICTICIA)).toEqual([DIGEST_QWEN]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "nube" }, "DIARIO", LISTA_FICTICIA)).toEqual([]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "ESCENARIOS", LISTA_FICTICIA)).toEqual([]);
    expect(digestsDe({ ...VIGENTE_FICTICIA, modo: "local" }, "DIARIO", SIN_LISTA)).toEqual([]);
  });

  it("las opciones del registro: las fijas de 008 (num_ctx 8192, semilla 42) y la temperatura de la configuración", () => {
    expect(opcionesDe({ ...VIGENTE_FICTICIA, temperaturaCentesimas: 37 })).toEqual({ num_ctx: 8192, seed: 42, temperaturaCentesimas: 37 });
  });
});
