/**
 * Cableado real del servicio inv-008-alertas (lo usa scripts/servicio-alertas.ts, el bundle de la imagen de la app): la carpeta de la
 * huella (/estado, o ALERTAS_ESTADO_DIR en las pruebas), el reloj, el log con la hora de Colombia, la credencial revisada (nunca la URL), el
 * interruptor del intradía (INV_INTRADIA_ENCENDIDO, el mismo de los precios), el calendario de la BVC y la evaluación.
 *
 * Por qué la evaluación corre EN EL MISMO PROCESO y no en un hijo, como en precios: la de precios lanza CLI pesados (red, ficheros y
 * su propio cliente de la base) que se pueden matar por plazo; esta es una lectura y unos INSERT breves (src/alertas/correr.ts, el
 * mismo código del script `npm run alertas:evaluar`), con un solo cliente de Prisma. Un hijo sería un segundo Node con su propio
 * motor de Prisma dentro de los 64 MiB del contenedor.
 */
import { PrismaClient } from "@prisma/client";
import { correrAlertas } from "../alertas/correr";
import { revisarCredencial } from "../alertas/credencial";
import { diaIso, esDiaHabil } from "../precios/horario";
import { ESTADO_DIR_POR_DEFECTO } from "../servicio-precios/estado";
import { leerConfigIntradia } from "../servicio-precios/intradia-configuracion";
import { textoCot } from "../servicio-precios/programa";
import { causa, iniciarBucle, type DependenciasBucle, type Programar, type Senales } from "./bucle";
import { revisarCredencialAlertas } from "./configuracion";

/** Lo que el servicio usa del proceso de node (process, o uno falso en las pruebas). */
export interface Proceso extends Senales {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: { write(texto: string): unknown };
}

const programarConIntervalo: Programar = (accion, cadaMs) => {
  const intervalo = setInterval(accion, cadaMs);
  return () => clearInterval(intervalo);
};

const esperarMs = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const sinConexion = (): never => {
  throw new Error("sin conexión a la base");
};

/**
 * La URL con `connection_limit=1`. El rol inv_alertas tiene CONNECTION LIMIT 2: el bucle usa UNA conexión y `ahora` (el modo de una sola
 * evaluación, que corre mientras el bucle está vivo) la otra. Con una sola conexión por proceso, las consultas en paralelo de
 * src/alertas/leer-entrada.ts (un Promise.all de 4) hacen cola en vez de pedir conexiones de más (P2037, «demasiadas conexiones»).
 */
export function conUnaConexion(url: string): string {
  const u = new URL(url);
  u.searchParams.set("connection_limit", "1");
  return u.toString();
}

const abrirBase = (url: string): PrismaClient => new PrismaClient({ log: [], datasources: { db: { url } } });

/** Las dependencias reales. Sin conexión (`db` nulo: sin credencial) el bucle no llega a pedirle nada. */
export function dependenciasReales(proceso: Proceso, db: PrismaClient | null): DependenciasBucle {
  return {
    dir: proceso.env.ALERTAS_ESTADO_DIR || ESTADO_DIR_POR_DEFECTO,
    ahora: Date.now,
    registrar: (mensaje) => void proceso.stdout.write(`${textoCot(new Date())} [alertas] ${mensaje}\n`),
    credencial: revisarCredencialAlertas(proceso.env.DATABASE_URL),
    programar: programarConIntervalo,
    intradia: leerConfigIntradia(proceso.env).encendido,
    revisarRol: () => (db === null ? sinConexion() : revisarCredencial(db, proceso.env)),
    esHabil: async (hoy) => {
      if (db === null) return sinConexion();
      // Solo ese día: no se trae todo el calendario de festivos.
      const festivos = await db.calendarioBvc.findMany({ where: { esHabil: false, dia: hoy }, select: { dia: true } });
      return esDiaHabil(hoy, new Set(festivos.map((f) => diaIso(f.dia))));
    },
    correr: (ahora) => (db === null ? sinConexion() : correrAlertas(db, { ahora, intradiaActivo: leerConfigIntradia(proceso.env).encendido })),
    esperar: esperarMs,
  };
}

/** `servicio-alertas.mjs bucle`: el servicio permanente. Sale con 0 al recibir SIGTERM o SIGINT. */
export function servir(proceso: Proceso, crearDb: (url: string) => PrismaClient = abrirBase): Promise<number> {
  const credencial = revisarCredencialAlertas(proceso.env.DATABASE_URL);
  const db = credencial.ok ? crearDb(conUnaConexion(proceso.env.DATABASE_URL as string)) : null;
  const deps = dependenciasReales(proceso, db);
  const avisos = leerConfigIntradia(proceso.env).avisos.length;
  if (avisos > 0) deps.registrar(`la configuración del intradía trae ${avisos} aviso(s): se usa la omisión en lo inválido y el interruptor, ante la duda, apaga`);
  return iniciarBucle(deps, proceso, async () => {
    await db?.$disconnect();
  });
}

/**
 * `servicio-alertas.mjs ahora`: UNA evaluación ya, con el rol revisado, y sale (0 evaluó y guardó · 3 alguna alerta no se guardó · 1 sin
 * credencial, con otra conexión o con error). No mira el calendario ni escribe la marca ni la huella: sirve para medir el pico de memoria
 * en el despliegue y para correrla a mano. Imprime solo conteos y códigos.
 */
export async function servirAhora(proceso: Proceso, crearDb: (url: string) => PrismaClient = abrirBase): Promise<number> {
  const deps = dependenciasReales(proceso, null);
  if (!deps.credencial.ok) {
    deps.registrar(deps.credencial.motivo);
    return 1;
  }
  const db = crearDb(conUnaConexion(proceso.env.DATABASE_URL as string));
  const real = dependenciasReales(proceso, db);
  try {
    if (!(await real.revisarRol())) {
      real.registrar("la conexión no es la del rol inv_alertas: no se evalúa");
      return 1;
    }
    const r = await real.correr(new Date(real.ahora()));
    const { evaluadas, insertadas, duplicadas, fallidas } = r.resultado;
    real.registrar(`evaluación ahora: evaluadas ${evaluadas} · nuevas ${insertadas} · ya guardadas ${duplicadas} · fallidas ${fallidas}`);
    return r.codigoSalida;
  } catch (error) {
    real.registrar(`no se evaluó: ${causa(error)}`);
    return 1;
  } finally {
    await db.$disconnect();
  }
}
