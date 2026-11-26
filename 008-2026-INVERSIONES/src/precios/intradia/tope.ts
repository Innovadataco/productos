/**
 * Los topes fijos del ciclo intradía, para que un error de configuración o una lista larga de especies nunca se vuelvan una
 * ráfaga contra Yahoo (cuya IP se comparte con PI):
 * - TOPE_ESPECIES_CICLO: a lo sumo 20 especies (20 peticiones) por ciclo.
 * - TOPE_PETICIONES_DIA: a lo sumo 9 000 peticiones por día de Colombia (12 especies a un ciclo por minuto son 4 980).
 * El total del día es APROXIMADO: lo lleva un archivo de la huella (`intradia-dia`, en la carpeta de estado del servicio: un tmpfs que se vacía al
 * reiniciar, y entonces la cuenta del día vuelve a empezar). Sin carpeta de estado (en el Mac, sin el servicio) no hay contador.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ESTADO_DIR_POR_DEFECTO, escribirAtomico, leerClaveValor } from "../../servicio-precios/estado";

export const TOPE_ESPECIES_CICLO = 20;
export const TOPE_PETICIONES_DIA = 9_000;
export const ARCHIVO_CONTADOR_DIA = "intradia-dia";

export interface ContadorDia {
  /** Peticiones ya hechas en ese día de Colombia (AAAA-MM-DD); 0 si es otro día o no hay dato. */
  leer(dia: string): Promise<number>;
  guardar(dia: string, total: number): Promise<void>;
}

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Lo que lee un contador ilegible: más que cualquier tope. */
const LLENO = Number.POSITIVE_INFINITY;

/** El contador en un archivo de `dir`; null si la carpeta no existe. */
export async function contadorEnArchivo(dir: string = ESTADO_DIR_POR_DEFECTO): Promise<ContadorDia | null> {
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) return null;
  return {
    async leer(dia) {
      const texto = await readFile(path.join(dir, ARCHIVO_CONTADOR_DIA), "utf8").catch((e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") return null; // todavía no hay cuenta: 0
        throw e;
      });
      if (texto === null) return 0;
      const campos = leerClaveValor(texto);
      const total = Number(campos.peticiones);
      // Un archivo que existe y no se puede interpretar cuenta como tope ALCANZADO (falla cerrada): mejor no pedir que pedir sin cuenta.
      if (!DIA_RE.test(campos.dia ?? "") || campos.peticiones === undefined || !/^\d+$/.test(campos.peticiones) || !Number.isSafeInteger(total)) return LLENO;
      return campos.dia === dia ? total : 0;
    },
    guardar: (dia, total) => escribirAtomico(dir, ARCHIVO_CONTADOR_DIA, { dia, peticiones: total }),
  };
}
