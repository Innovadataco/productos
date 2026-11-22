/**
 * Configuraciones de la IA y listas de PI INVENTADAS para las pruebas de src/ia/config. La IP de la tailnet se arma al
 * correr (el cruce de literales de la Fábrica marca cualquier IPv4 escrita); el puerto no es redondo; los digests de la
 * lista son los del archivo ficticio (tests/fixtures/ia/modelos-ia-local-permitidos.ficticio.json).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ConfigIaVigente } from "@/ia/config/leer";
import { leerModelosPermitidos, type ListaModelosPi } from "@/ia/local/modelos";
import { IP_FICTICIA, ORIGEN_FICTICIO, PUERTO_FICTICIO as PUERTO_DE_LA_RED, ip } from "../../local/apoyo/red.ficticio";

export { ip };
/** El mismo destino inventado del `fetch` falso de la puerta local (así sus URL son las permitidas). */
export const HOST_FICTICIO = IP_FICTICIA;
export const PUERTO_FICTICIO = PUERTO_DE_LA_RED;
export const DESTINO_FICTICIO = ORIGEN_FICTICIO;
export const DIGEST_QWEN = "4613a27c".repeat(8);
export const DIGEST_GEMMA = "37911f47".repeat(8);
export const DIGEST_AYA = "1237bead".repeat(8);

const FIXTURE = path.join(__dirname, "..", "..", "..", "..", "fixtures", "ia", "modelos-ia-local-permitidos.ficticio.json");
export const LISTA_FICTICIA: ListaModelosPi = leerModelosPermitidos(readFileSync(FIXTURE, "utf8"));
export const SIN_LISTA: ListaModelosPi = Object.freeze({ estado: "SIN_LISTA", motivo: "SIN_VARIABLE" });

const tarea = (activo: boolean, modeloLocal: string | null) => Object.freeze({ activo, modeloLocal });

/** Una vigente con la local y la nube encendidas, cada tarea con su modelo. */
export const VIGENTE_FICTICIA: ConfigIaVigente = Object.freeze({
  id: "config-ficticia-4613",
  version: 7,
  modo: "local-luego-nube",
  ollamaHost: HOST_FICTICIO,
  ollamaPuerto: PUERTO_FICTICIO,
  temperaturaCentesimas: 0,
  tareas: Object.freeze({ DIARIO: tarea(true, "qwen2.5:14b"), REGLAS: tarea(true, "gemma2:27b"), ESCENARIOS: tarea(false, null) }),
  modeloNube: "claude-sonnet-5-5",
  esfuerzoNube: "medium",
  topeMicroUsd: 4_610_000n,
  horaResumen: "19:00",
  limiteSegundos: 97,
  creadaEn: new Date("2027-03-17T23:41:13.000Z"),
});

/** El cuerpo que manda el formulario para una versión válida (todo en texto, como lo escribe el dueño). */
export function cuerpoFicticio(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    versionBase: 7,
    modo: "local-luego-nube",
    ollamaHost: HOST_FICTICIO,
    ollamaPuerto: String(PUERTO_FICTICIO),
    temperatura: "0",
    tareas: { DIARIO: { activo: true, modeloLocal: "qwen2.5:14b" }, REGLAS: { activo: true, modeloLocal: "gemma2:27b" }, ESCENARIOS: { activo: false, modeloLocal: "" } },
    modeloNube: "claude-sonnet-5-5",
    esfuerzoNube: "medium",
    topeMensualUsd: "4,61",
    horaResumen: "19:00",
    limiteSegundos: "97",
    motivo: "Cambio ficticio de la configuración",
    ...cambios,
  };
}
