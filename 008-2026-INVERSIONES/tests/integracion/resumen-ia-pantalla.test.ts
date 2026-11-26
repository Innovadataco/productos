// La tarjeta de resumen (E5) contra la base de PRUEBAS: un PUBLICADO guardado por el registro de E3 se lee con
// `ultimoPublicado`, se revalida y se muestra; si los hechos de hoy cambiaron, DESACTUALIZADO; si la salida guardada no
// pasa el validador, no se muestra y va el resumen sin IA; de otro día no se muestra. El paquete de hoy se simula (el
// export de E7 tiene sus propias pruebas). Datos inventados: días de 2027 y especies FICTICIA-*.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { reiniciarMemoParaPruebas, resumenDelDia } from "@/app/_comun/resumen-ia/leer";
import { reiniciarTurnoParaPruebas } from "@/app/proyecciones/turno";
import type { PaqueteHechos, TipoResumen } from "@/ia/contrato";
import { sha256Hex } from "@/ia/hash";
import { registrarResumen } from "@/ia/registro/registro";
import { salidaDePlantilla } from "@/ia/validador/plantilla";
import { paqueteFicticio } from "../unit/resumen-ia/apoyo.ficticio";

const db = new PrismaClient();
const marca = Date.now().toString(36).toUpperCase();

async function publicar(paquete: PaqueteHechos, salidaCruda = salidaDePlantilla(paquete)): Promise<void> {
  await registrarResumen(db, {
    paquete, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio de la pantalla ${marca}`) }, opciones: { temperature: 0, seed: 42 },
    validadorVersion: "validador-v2", estado: "PUBLICADO", texto: `Resumen ficticio ${marca}.`,
    exito: { ok: true, puerta: "local", salidaCruda, modelo: "ficticio-modelo:7b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
  });
}
const paquete = (tipo: TipoResumen, hoy: string, aviso = `PANTALLA_${marca}`) => paqueteFicticio(tipo, aviso, hoy);
const exportacion = (...paquetes: PaqueteHechos[]) => vi.fn().mockResolvedValue({ paquetes, omitidos: [], avisos: [] });
const ahoraDe = (dia: string) => new Date(`${dia}T20:13:00.000Z`);

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
});
beforeEach(() => {
  reiniciarMemoParaPruebas();
  reiniciarTurnoParaPruebas();
});
afterAll(async () => {
  await db.$disconnect();
});

describe("tarjeta de resumen contra la base", () => {
  it("un PUBLICADO del día que pasa, con los mismos hechos hoy: IA al día, con el texto revalidado", async () => {
    const p = paquete("DIARIO", "2027-05-19");
    await publicar(p);
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: ahoraDe("2027-05-19"), paquetes: exportacion(p) });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "AL_DIA", pie: "Redactado por IA local (ficticio-modelo:7b) · cifras calculadas por Inversiones y cotejadas" });
    expect(vista.frases.join(" ")).not.toContain(`Resumen ficticio ${marca}`);
  });

  it("si los hechos de hoy cambiaron: DESACTUALIZADO", async () => {
    const guardado = paquete("REGLAS", "2027-05-20");
    await publicar(guardado);
    const hoy = paquete("REGLAS", "2027-05-20", `PANTALLA_OTRO_${marca}`);
    const vista = await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: ahoraDe("2027-05-20"), paquetes: exportacion(hoy) });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO" });
  });

  it("una salida guardada que no pasa el validador no se muestra: va el resumen sin IA", async () => {
    const p = paquete("ESCENARIOS", "2027-05-21");
    await publicar(p, '{"frases":[{"segmentos":[{"texto":"Le recomendamos vender."}]}]}');
    const vista = await resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: ahoraDe("2027-05-21"), paquetes: exportacion(p) });
    expect(vista).toMatchObject({ estado: "SIN_IA", pie: "Resumen sin IA" });
  });

  it("un PUBLICADO de AYER se muestra con su fecha y hora, DESACTUALIZADO (otros hechos hoy), revalidado", async () => {
    const ayer = paquete("DIARIO", "2027-05-24");
    await publicar(ayer);
    const hoy = paquete("DIARIO", "2027-05-25");
    const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: ahoraDe("2027-05-25"), paquetes: exportacion(hoy) });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO", rechazo: null });
    expect(vista.analisisDel).toMatch(/^Análisis de la IA del \d{1,2}-[a-z]{3}-\d{4}, \d{2}:\d{2}$/);
    expect(vista.frases.length).toBeGreaterThan(0);
  });

  it("varios por día: la tarjeta muestra el ÚLTIMO válido", async () => {
    const primero = paquete("REGLAS", "2027-05-26");
    const segundo = paquete("REGLAS", "2027-05-26", `PANTALLA_SEGUNDO_${marca}`);
    await publicar(primero);
    await publicar(segundo);
    const vista = await resumenDelDia(db, "REGLAS", "u-ficticio", { ahora: ahoraDe("2027-05-26"), paquetes: exportacion(segundo) });
    expect(vista).toMatchObject({ estado: "IA", vigencia: "AL_DIA" });
  });

  describe("el último RECHAZADO por el validador", () => {
    const rechazar = (p: PaqueteHechos, motivos: string[]) =>
      registrarResumen(db, {
        paquete: p, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio de la pantalla ${marca}`) }, opciones: { temperature: 0, seed: 42 },
        validadorVersion: "validador-v2", estado: "RECHAZADO", motivos,
        exito: { ok: true, puerta: "local", salidaCruda: "{}", modelo: "ficticio-modelo:7b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
      });

    it("más nuevo que el último válido: la tarjeta trae su motivo en palabras simples y sigue mostrando el válido", async () => {
      const p = paquete("ESCENARIOS", "2027-05-27");
      await publicar(p);
      await rechazar(paquete("ESCENARIOS", "2027-05-27", `PANTALLA_RECHAZO_${marca}`), ["HECHO_NO_CITADO"]);
      const vista = await resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: ahoraDe("2027-05-27"), paquetes: exportacion(p) });
      expect(vista.estado).toBe("IA");
      expect(vista.rechazo).toContain("no citó todas las cifras que debía");
      expect(vista.rechazo).not.toContain("HECHO_NO_CITADO");
    });

    it("más viejo que un válido nuevo: no se muestra", async () => {
      const p = paquete("ESCENARIOS", "2027-05-28");
      await rechazar(paquete("ESCENARIOS", "2027-05-28", `PANTALLA_RECHAZO2_${marca}`), ["FORMATO"]);
      await publicar(p);
      const vista = await resumenDelDia(db, "ESCENARIOS", "u-ficticio", { ahora: ahoraDe("2027-05-28"), paquetes: exportacion(p) });
      expect(vista).toMatchObject({ estado: "IA", rechazo: null });
    });

    it("el RECHAZADO por YA_PUBLICADO (dos corridas a la vez) no es un rechazo del validador: no se muestra", async () => {
      const p = paquete("DIARIO", "2027-05-29");
      await publicar(p);
      const repetida = await registrarResumen(db, {
        paquete: p, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio de la pantalla ${marca}`) }, opciones: { temperature: 0, seed: 42 },
        validadorVersion: "validador-v2", estado: "PUBLICADO", texto: "otra vez",
        exito: { ok: true, puerta: "local", salidaCruda: salidaDePlantilla(p), modelo: "ficticio-modelo:7b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
      });
      expect(repetida).toMatchObject({ estado: "RECHAZADO", yaPublicado: true });
      const vista = await resumenDelDia(db, "DIARIO", "u-ficticio", { ahora: ahoraDe("2027-05-29"), paquetes: exportacion(p) });
      expect(vista).toMatchObject({ estado: "IA", rechazo: null });
    });
  });
});
