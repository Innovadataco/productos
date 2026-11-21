/**
 * Base y app del E2E de la pantalla (INV-SPEC-15). Módulo puro: no importa Playwright ni Prisma.
 * La siembra BORRA y recrea esta base con un superusuario, así que el candado es estricto:
 * solo el Postgres local de 008 (puerto 5438) y solo un nombre que termine en `_e2e_test`
 * (nunca la base de trabajo, ni `postgres`, ni las de integración).
 */
// `inversiones_dev` es la clave de desarrollo del docker-compose.yml de 008 (solo local), no un secreto.
export const URL_E2E_POR_DEFECTO = "postgresql://inversiones:inversiones_dev@127.0.0.1:5438/inversiones_e2e_test?schema=public";

/** La app del E2E: la misma de `npm run dev`, solo en la interfaz local. */
export const APP = { host: "127.0.0.1", puerto: 5008 } as const;

const HOSTS_LOCALES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);
const PROTOCOLOS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);
const PUERTO_BASE_008 = "5438";
/** Solo minúsculas, dígitos y guion bajo: el nombre se puede citar en SQL sin riesgo. */
const NOMBRE_E2E = /^[a-z0-9_]+_e2e_test$/;
const ESQUEMA = "public";

export interface BaseDePruebas {
  /** Nombre de la base, ya validado. */
  readonly nombre: string;
  /** URL de la base e2e. */
  readonly url: string;
  /** La misma conexión sobre la base `postgres`, para borrar y crear la de pruebas. */
  readonly urlMantenimiento: string;
}

/** El mensaje nunca lleva la URL: puede traer la clave. */
const rechazo = (motivo: string): Error => new Error(`La base del E2E no es válida: ${motivo}. No se toca nada.`);

function leerUrl(valor: string): URL {
  try {
    return new URL(valor);
  } catch {
    throw rechazo("no es una URL");
  }
}

/** Valida la URL de la base del E2E; lanza si no es la base e2e local de 008. */
/**
 * Prisma obedece la query (`host=`, `port=`, `dbname=`…): con ella la conexión podría ir a otro host,
 * a un socket o a otra base aunque el resto de la URL pase. Solo se admite `schema=public`.
 */
function exigirSoloEsquema(u: URL): void {
  if (u.hash) throw rechazo("trae un fragmento (#)");
  const parametros = [...u.searchParams.entries()];
  const soloEsquema = parametros.every(([k, v]) => k === "schema" && v === ESQUEMA) && parametros.length <= 1;
  if (!soloEsquema) throw rechazo(`la query solo puede ser «schema=${ESQUEMA}»`);
}

/** URL armada desde cero con las piezas ya validadas (nada de la URL original pasa sin revisar). */
const conexion = (u: URL, nombre: string): string =>
  `postgresql://${u.username}:${u.password}@${u.hostname}:${PUERTO_BASE_008}/${nombre}?schema=${ESQUEMA}`;

/** Valida la URL de la base del E2E; lanza si no es la base e2e local de 008. */
export function baseDePruebas(valor: string): BaseDePruebas {
  const u = leerUrl(valor);
  if (!PROTOCOLOS.has(u.protocol)) throw rechazo("no es PostgreSQL");
  if (!u.username) throw rechazo("no trae usuario");
  if (!HOSTS_LOCALES.has(u.hostname)) throw rechazo("el host no es local");
  if (u.port !== PUERTO_BASE_008) throw rechazo(`el puerto no es el ${PUERTO_BASE_008} de 008`);
  exigirSoloEsquema(u);
  const nombre = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!NOMBRE_E2E.test(nombre)) throw rechazo("el nombre debe ser minúsculas, dígitos o «_» y terminar en «_e2e_test»");
  return { nombre, url: conexion(u, nombre), urlMantenimiento: conexion(u, "postgres") };
}

/**
 * El secreto de la sesión de ESTA corrida (aleatorio, nunca real): playwright.config.ts lo sortea una vez y
 * lo pasa a la app y a los procesos de las pruebas por el entorno, para que una prueba pueda firmar una
 * pre-sesión vencida. Se lee al usarse (no al importar). Fuera de Playwright queda vacío y nada firma.
 */
export const secretoSesionE2E = (): string => process.env.E2E_AUTH_SECRET ?? "";

/** Una cuenta del E2E: todo inventado (correos `@ejemplo.invalid`, contraseñas ficticias). */
export interface CuentaE2E {
  readonly email: string;
  readonly clave: string;
}

/** El dueño del E2E: lo crea la siembra (como el comando de acceso inicial) y le pone su clave ficticia. */
export const DUENO_E2E: CuentaE2E = { email: "dueno-e2e@ejemplo.invalid", clave: "clave-ficticia-e2e-dueno" };
