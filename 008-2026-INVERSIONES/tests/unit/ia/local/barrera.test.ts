/**
 * La segunda barrera de la puerta local, sin el paquete: el cliente revisa el pedido que recibe antes de tocar la red.
 * No reemplaza a la guarda de `generarConPuertas` (que coteja contra el paquete completo); solo cierra en fallo si al
 * cliente le llega un pedido mal formado o con algo que no es ciego. Control positivo: todos los pedidos armados por
 * `armarPedido` pasan (paquetes al azar con semilla); cada fuga plantada se rechaza.
 */
import { describe, expect, it } from "vitest";
import { armarPedido, type PedidoGeneracion } from "@/ia/generador";
import { barreraLocal } from "@/ia/local/barrera";
import { crearPrng } from "@/proyecciones/prng";
import { paqueteAlAzar } from "../apoyo/aleatorio.ficticio";
import { ESQUEMA_FICTICIO, PROMPT_FICTICIO } from "../apoyo/pedido.ficticio";
import { pedidoFicticio } from "./apoyo/red.ficticio";

const SEMILLA = 4613;
const VUELTAS = 211;
const noCiego = { ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "PEDIDO_NO_CIEGO" };
const invalido = { ok: false, puerta: "local", motivo: "ERROR_PROVEEDOR", detalle: "PEDIDO_INVALIDO" };

type HechoAbierto = Record<string, unknown>;

/** Una copia del pedido con la vista cambiada por `cambiar` (sobre una copia profunda de los hechos). */
function conVista(cambiar: (vista: { tipo: unknown; hechos: HechoAbierto[] } & Record<string, unknown>) => void): unknown {
  const { pedido } = pedidoFicticio();
  const vista = JSON.parse(JSON.stringify(pedido.vista)) as { tipo: unknown; hechos: HechoAbierto[] } & Record<string, unknown>;
  cambiar(vista);
  return { ...pedido, vista };
}

describe("barreraLocal · control positivo", () => {
  it("el pedido de armarPedido pasa, y lo que sigue es la copia revisada", () => {
    const { pedido } = pedidoFicticio();
    const resultado = barreraLocal(pedido);
    expect(resultado).toEqual({ ok: true, pedido });
    if (resultado.ok) expect(resultado.pedido).not.toBe(pedido);
  });

  it(`pasan los pedidos de ${VUELTAS} paquetes al azar (semilla ${SEMILLA}), de los tres tipos`, () => {
    const prng = crearPrng(SEMILLA);
    const tipos = new Set<string>();
    for (let i = 0; i < VUELTAS; i += 1) {
      const paquete = paqueteAlAzar(prng);
      tipos.add(paquete.tipo);
      const pedido: PedidoGeneracion = armarPedido({ paquete, prompt: PROMPT_FICTICIO, esquemaSalida: ESQUEMA_FICTICIO, limiteMs: 4613 });
      expect(barreraLocal(pedido).ok).toBe(true);
    }
    expect(tipos.size).toBe(3);
  });
});

describe("barreraLocal · rechaza un pedido que no es ciego (PEDIDO_NO_CIEGO)", () => {
  it.each([
    ["un dígito en una etiqueta", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[0] as HechoAbierto).etiqueta = "Valor de la especie 4613";
    }],
    ["un dígito de ancho completo", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[0] as HechoAbierto).etiqueta = "Valor ４";
    }],
    ["un campo valor plantado", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).valor = "FICTICIA-ALFA";
    }],
    ["una presentación plantada sin dígitos", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).presentacion = "mucho";
    }],
    ["un campo de más en la vista", (v: Record<string, unknown>) => {
      v.hoy = "marzo";
    }],
    ["una clave prohibida anidada", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[2] as HechoAbierto).etiqueta = { correo: "ficticio" };
    }],
    ["un sujeto que no es un id de dos dígitos", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).sujeto = "H1";
    }],
    ["un id con tres dígitos", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[0] as HechoAbierto).id = "H101";
    }],
    ["un tipo que no es de la lista", (v: { tipo: unknown }) => {
      v.tipo = "OTRO";
    }],
    ["hechos que no son arreglo", (v: Record<string, unknown>) => {
      v.hechos = { H01: true };
    }],
    ["un hecho que no es objeto", (v: { hechos: unknown[] }) => {
      v.hechos[0] = "H01";
    }],
    ["una etiqueta en letras que no es la del catálogo (un nombre)", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).etiqueta = "Acciones de la persona ficticia";
    }],
    ["una clave que no es del catálogo", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).clave = "CLAVE_INVENTADA";
    }],
    ["una clave que no es texto", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).clave = true;
    }],
    ["una clave del catálogo de otro tipo", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).clave = "REGLA_NIVEL";
    }],
    ["un sujeto en letras", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).sujeto = "HAB";
    }],
    ["un id que no empieza por H", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[0] as HechoAbierto).id = "X01";
    }],
    ["una dirección fuera de la lista", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).direccion = "SUBIO_MUCHO";
    }],
    ["una cercanía fuera de la lista", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).cercania = "PEGADO";
    }],
    ["una frescura fuera de la lista", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).frescura = "AYER";
    }],
    ["una calidad fuera de la lista", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).calidad = "SEGURA";
    }],
    ["obligatorio que no es booleano", (v: { hechos: HechoAbierto[] }) => {
      (v.hechos[1] as HechoAbierto).obligatorio = "si";
    }],
    ["más hechos que el máximo del contrato", (v: { hechos: HechoAbierto[] }) => {
      const primero = v.hechos[0] as HechoAbierto;
      v.hechos = Array.from({ length: 100 }, () => ({ ...primero }));
    }],
  ] as const)("%s", (_n, cambiar) => {
    expect(barreraLocal(conVista(cambiar as (v: unknown) => void))).toEqual(noCiego);
  });

  it("una vista con getter (que podría leerse distinto dos veces)", () => {
    const { pedido } = pedidoFicticio();
    const vista = { tipo: "DIARIO", get hechos() {
      return [];
    } };
    expect(barreraLocal({ ...pedido, vista })).toEqual(noCiego);
  });

  it("una vista que es un Proxy", () => {
    const { pedido } = pedidoFicticio();
    expect(barreraLocal({ ...pedido, vista: new Proxy({ ...pedido.vista }, {}) })).toEqual(noCiego);
  });
});

describe("barreraLocal · rechaza un pedido mal formado (PEDIDO_INVALIDO)", () => {
  const { pedido } = pedidoFicticio();
  it.each([
    ["null", null],
    ["un texto", "pedido"],
    ["un campo de más", { ...pedido, paquete: {} }],
    ["el hash del prompt alterado", { ...pedido, prompt: { ...pedido.prompt, hash: "0".repeat(64) } }],
    ["el prompt sin versión", { ...pedido, prompt: { texto: pedido.prompt.texto, hash: pedido.prompt.hash } }],
    ["un esquema que no es de tipo object", { ...pedido, esquemaSalida: { type: "array" } }],
    ["un límite fuera de rango", { ...pedido, limiteMs: 0 }],
    ["un límite con fracción", { ...pedido, limiteMs: 46.13 }],
  ])("%s", (_n, malo) => {
    expect(barreraLocal(malo)).toEqual(invalido);
  });

  it("no lanza con nada de lo anterior ni con un Proxy de pedido", () => {
    expect(() => barreraLocal(new Proxy({ ...pedido }, {}))).not.toThrow();
    expect(barreraLocal(new Proxy({ ...pedido }, {}))).toEqual(invalido);
  });
});
