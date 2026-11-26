// La tarjeta de resumen (E5) contra la base de PRUEBAS: un PUBLICADO guardado por el registro de E3 se lee con
// `ultimoPublicado`, se revalida y se muestra; si los hechos de hoy cambiaron, DESACTUALIZADO; si la salida guardada no
// pasa el validador, no se muestra y va el resumen sin IA; de otro día no se muestra. El paquete de hoy se simula (el
// export de E7 tiene sus propias pruebas). La tarjeta muestra el ÚLTIMO PUBLICADO de cualquier día, y la base es compartida
// con otros archivos que también escriben resumen_ia: por eso cada prueba corre en una transacción que bloquea la tabla
// contra escrituras ajenas y se deshace al terminar (no deja filas). Datos inventados: días de 2027 y especies FICTICIA-*.
import { Prisma, PrismaClient } from "@prisma/client";
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

type Cliente = Prisma.TransactionClient;
class Deshacer extends Error {}

/** Corre `cuerpo` con la tabla bloqueada contra otras escrituras, vacía, y deshace todo al terminar (también si falla). */
async function aislado(cuerpo: (tx: Cliente) => Promise<void>): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE resumen_ia IN SHARE ROW EXCLUSIVE MODE`;
      // Las filas de otros archivos (algunas con hora a futuro) le ganarían a la de la prueba: dentro de la transacción,
      // y solo en ella, la tabla parte vacía (el disparador de solo inserción se salta con replica; se deshace todo).
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      await tx.$executeRawUnsafe("DELETE FROM resumen_ia");
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");
      await cuerpo(tx);
      throw new Deshacer();
    }, { timeout: 30_000 });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }
}
const leer = (tx: Cliente, tipo: TipoResumen, dia: string, p: PaqueteHechos) =>
  resumenDelDia(tx as unknown as PrismaClient, tipo, "u-ficticio", { ahora: ahoraDe(dia), paquetes: exportacion(p) });

async function publicar(tx: Cliente, paquete: PaqueteHechos, salidaCruda = salidaDePlantilla(paquete)): Promise<void> {
  await registrarResumen(tx, {
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
  it("un PUBLICADO del día que pasa, con los mismos hechos hoy: IA al día, con el texto revalidado", () => aislado(async (tx) => {
    const p = paquete("DIARIO", "2027-05-19");
    await publicar(tx, p);
    const vista = await leer(tx, "DIARIO", "2027-05-19", p);
    expect(vista).toMatchObject({ estado: "IA", vigencia: "AL_DIA", pie: "Redactado por IA local (ficticio-modelo:7b) · cifras calculadas por Inversiones y cotejadas" });
    expect(vista.frases.join(" ")).not.toContain(`Resumen ficticio ${marca}`);
  }));

  it("si los hechos de hoy cambiaron: DESACTUALIZADO", () => aislado(async (tx) => {
    const guardado = paquete("REGLAS", "2027-05-20");
    await publicar(tx, guardado);
    const hoy = paquete("REGLAS", "2027-05-20", `PANTALLA_OTRO_${marca}`);
    const vista = await leer(tx, "REGLAS", "2027-05-20", hoy);
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO" });
  }));

  it("una salida guardada que no pasa el validador no se muestra: va el resumen sin IA", () => aislado(async (tx) => {
    const p = paquete("ESCENARIOS", "2027-05-21");
    await publicar(tx, p, '{"frases":[{"segmentos":[{"texto":"Le recomendamos vender."}]}]}');
    const vista = await leer(tx, "ESCENARIOS", "2027-05-21", p);
    expect(vista).toMatchObject({ estado: "SIN_IA", pie: "Resumen sin IA" });
  }));

  it("un PUBLICADO de AYER se muestra con su fecha y hora, DESACTUALIZADO (otros hechos hoy), revalidado", () => aislado(async (tx) => {
    const ayer = paquete("DIARIO", "2027-05-24");
    await publicar(tx, ayer);
    const hoy = paquete("DIARIO", "2027-05-25");
    const vista = await leer(tx, "DIARIO", "2027-05-25", hoy);
    expect(vista).toMatchObject({ estado: "IA", vigencia: "DESACTUALIZADO", rechazo: null });
    expect(vista.analisisDel).toMatch(/^Análisis de la IA del \d{1,2}-[a-z]{3}-\d{4}, \d{2}:\d{2}$/);
    expect(vista.frases.length).toBeGreaterThan(0);
  }));

  it("varios por día: la tarjeta muestra el ÚLTIMO válido", () => aislado(async (tx) => {
    const primero = paquete("REGLAS", "2027-05-26");
    const segundo = paquete("REGLAS", "2027-05-26", `PANTALLA_SEGUNDO_${marca}`);
    await publicar(tx, primero);
    await publicar(tx, segundo);
    const vista = await leer(tx, "REGLAS", "2027-05-26", segundo);
    expect(vista).toMatchObject({ estado: "IA", vigencia: "AL_DIA" });
  }));

  describe("el último RECHAZADO por el validador", () => {
    const rechazar = (tx: Cliente, p: PaqueteHechos, motivos: string[]) =>
      registrarResumen(tx, {
        paquete: p, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio de la pantalla ${marca}`) }, opciones: { temperature: 0, seed: 42 },
        validadorVersion: "validador-v2", estado: "RECHAZADO", motivos,
        exito: { ok: true, puerta: "local", salidaCruda: "{}", modelo: "ficticio-modelo:7b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
      });

    it("más nuevo que el último válido: la tarjeta trae su motivo en palabras simples y sigue mostrando el válido", () => aislado(async (tx) => {
      const p = paquete("ESCENARIOS", "2027-05-27");
      await publicar(tx, p);
      await rechazar(tx, paquete("ESCENARIOS", "2027-05-27", `PANTALLA_RECHAZO_${marca}`), ["HECHO_NO_CITADO"]);
      const vista = await leer(tx, "ESCENARIOS", "2027-05-27", p);
      expect(vista.estado).toBe("IA");
      expect(vista.rechazo).toContain("no citó todas las cifras que debía");
      expect(vista.rechazo).not.toContain("HECHO_NO_CITADO");
    }));

    it("más viejo que un válido nuevo: no se muestra", () => aislado(async (tx) => {
      const p = paquete("ESCENARIOS", "2027-05-28");
      await rechazar(tx, paquete("ESCENARIOS", "2027-05-28", `PANTALLA_RECHAZO2_${marca}`), ["FORMATO"]);
      await publicar(tx, p);
      const vista = await leer(tx, "ESCENARIOS", "2027-05-28", p);
      expect(vista).toMatchObject({ estado: "IA", rechazo: null });
    }));

    it("el RECHAZADO por YA_PUBLICADO (dos corridas a la vez) no es un rechazo del validador: no se muestra", () => aislado(async (tx) => {
      const p = paquete("DIARIO", "2027-05-29");
      await publicar(tx, p);
      const repetida = await registrarResumen(tx, {
        paquete: p, prompt: { version: "resumen-ficticio-v3", hash: sha256Hex(`prompt ficticio de la pantalla ${marca}`) }, opciones: { temperature: 0, seed: 42 },
        validadorVersion: "validador-v2", estado: "PUBLICADO", texto: "otra vez",
        exito: { ok: true, puerta: "local", salidaCruda: salidaDePlantilla(p), modelo: "ficticio-modelo:7b", modeloDigest: "sha256:ficticio7193", latenciaMs: 4127, tokensEntrada: 1237, tokensSalida: 211 },
      });
      expect(repetida).toMatchObject({ estado: "RECHAZADO", yaPublicado: true });
      const vista = await leer(tx, "DIARIO", "2027-05-29", p);
      expect(vista).toMatchObject({ estado: "IA", rechazo: null });
    }));
  });
});
