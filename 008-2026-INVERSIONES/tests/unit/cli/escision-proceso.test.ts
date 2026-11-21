// registrar-escision y lote-escision como proceso, con la base inalcanzable (O2): los mismos datos mal formados
// salen igual en los dos (2, «campo · CÓDIGO», ANTES de abrir la base), y un error de la base sale igual en los dos
// (1, ERROR_BASE y la clase). Nunca un valor ni la URL de la base. El 0, el 1 de negocio y el 3 los prueba
// tests/integracion/cli-escision.test.ts. Entorno mínimo, sin red, datos inventados.
import { describe, expect, it } from "vitest";
import { POR_CLI_MS, comprobar as comprobarSalida, correr as correrCli, entornoMinimo, type Salida } from "../../ayudas/cli";

const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test"];
const correr = (script: string, args: readonly string[], extra: Record<string, string> = {}): Salida =>
  correrCli(script, args, entornoMinimo({ DATABASE_URL: INALCANZABLE, ...extra }));

function comprobar(s: Salida, codigo: number, esperado: string, ademas: readonly string[] = []): void {
  comprobarSalida(s, codigo, esperado, [...NUNCA, ...ademas]);
  if (codigo === 2) expect(s.texto, "un 2 no debe haber intentado la base").not.toContain("PrismaClient");
}

const DATOS_INVALIDOS = "❌ Datos inválidos, no se registró nada:";

describe("datos mal formados → 2 en los dos CLI, por campo y antes de abrir la base", { timeout: 4 * POR_CLI_MS }, () => {
  it("lote-escision: una línea por campo con su código, sin los valores", () => {
    const s = correr("lote-escision.ts", ["--destino", "fict-x47", "--fecha-evento", "2027-02-30", "--cantidad", "0", "--costo-unitario=-4.613"]);
    comprobar(s, 2, DATOS_INVALIDOS, ["fict-x47", "FICT-X47", "2027-02-30", "4.613"]);
    for (const linea of ["   destino · NEMOTECNICO_FORMATO", "   fechaEvento · FECHA_INVALIDA", "   cantidad · DEBE_SER_POSITIVO", "   costoUnitario · NO_PUEDE_SER_NEGATIVO"]) {
      expect(s.texto).toContain(linea);
    }
    expect(s.texto).not.toContain("No se registró:");
  });

  it("lote-escision sin argumentos: 2 con los cuatro campos (como registrar-escision sin argumentos)", () => {
    const lote = correr("lote-escision.ts", []);
    comprobar(lote, 2, DATOS_INVALIDOS);
    for (const campo of ["destino", "fechaEvento", "cantidad", "costoUnitario"]) expect(lote.texto).toContain(`   ${campo} · `);
    const evento = correr("registrar-escision.ts", []);
    comprobar(evento, 2, DATOS_INVALIDOS);
    for (const campo of ["origen", "destino", "fecha"]) expect(evento.texto).toContain(`   ${campo} · `);
  });

  it("registrar-escision con una fecha que no existe: 2 «fecha · FECHA_INVALIDA», sin la fecha", () => {
    const s = correr("registrar-escision.ts", ["--origen", "FICTORI", "--destino", "FICTDES", "--fecha", "2027-02-30"]);
    comprobar(s, 2, "   fecha · FECHA_INVALIDA", ["FICTORI", "FICTDES", "2027-02-30"]);
  });
});

describe("error de la base → 1 en los dos CLI: ERROR_BASE y la clase, nunca el mensaje", { timeout: 4 * POR_CLI_MS }, () => {
  const lote = ["--destino", "FICTLOTE", "--fecha-evento", "2027-03-17", "--cantidad", "4613", "--costo-unitario", "1237.53"];
  const evento = ["--origen", "FICTORI", "--destino", "FICTDES", "--fecha", "2027-03-17", "--nota", "nota ficticia reservada"];
  const ESPERADO = "❌ No se registró: ERROR_BASE · PrismaClientInitializationError";

  it("en local", () => {
    comprobar(correr("lote-escision.ts", lote), 1, ESPERADO, ["FICTLOTE", "2027-03-17", "4613", "1237"]);
    comprobar(correr("registrar-escision.ts", evento), 1, ESPERADO, ["FICTORI", "FICTDES", "2027-03-17", "nota ficticia"]);
  });

  it("en producción (NODE_ENV=production, como el migrador): lo mismo, sin siguiente paso", () => {
    const prod = { NODE_ENV: "production" };
    const s = [correr("lote-escision.ts", lote, prod), correr("registrar-escision.ts", evento, prod)];
    comprobar(s[0]!, 1, ESPERADO, ["FICTLOTE", "2027-03-17", "4613", "1237"]);
    comprobar(s[1]!, 1, ESPERADO, ["FICTORI", "FICTDES", "2027-03-17", "nota ficticia"]);
    for (const x of s) expect(x.texto).not.toContain("Siguiente paso");
  });
});
