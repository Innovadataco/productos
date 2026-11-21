/**
 * Argumentos de scripts/construir-lotes.ts (D1). Puro: se lee antes de abrir la base, así lo que no se
 * reconoce sale con 2 y el uso sin tocar nada. Sin opciones construye y escribe (lo documentado).
 */
export const USO_CONSTRUIR = [
  "Uso: npm run lotes:construir                  construye y guarda",
  "     npm run lotes:construir -- --ensayo      calcula lo mismo en una transacción que se deshace: no guarda nada",
  "     npm run lotes:construir -- --ayuda       este uso (va sola)",
  "  Crea los lotes de las compras aprobadas y recalcula por especie las ventas FIFO (idempotente). Respeta las",
  "  asignaciones bloqueadas: una especie con una bloqueada inválida se rechaza con su código y no se toca; las",
  "  demás siguen. Las opciones van después de «--»: sin él, npm se queda con ellas.",
  "  Imprime solo conteos, códigos e ids internos. Salida: 0 sin avisos · 3 con avisos (ventas sin lotes o",
  "  especies rechazadas) · 2 uso · 1 error.",
].join("\n");

export interface ArgumentosConstruir {
  readonly ensayo: boolean;
  readonly ayuda: boolean;
}

export class ErrorArgumentosConstruir extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentosConstruir";
  }
}

const OPCIONES = ["--ensayo", "--ayuda"] as const;
type Opcion = (typeof OPCIONES)[number];
const esOpcion = (x: string): x is Opcion => (OPCIONES as readonly string[]).includes(x);
const MAX_ECO = 40;

/**
 * Lo que npm se queda si se escribe sin «--» (`npm run lotes:construir --ensayo`): el script arrancaría sin
 * argumentos y ESCRIBIRÍA. npm lo deja en npm_config_<opción>. --dry-run es de npm, pero es lo que muchos
 * escriben para ensayar.
 */
const TOMADAS_POR_NPM: ReadonlyArray<readonly [string, string]> = [
  ["npm_config_ensayo", "npm se quedó con --ensayo: use «npm run lotes:construir -- --ensayo»."],
  ["npm_config_ayuda", "npm se quedó con --ayuda: use «npm run lotes:construir -- --ayuda»."],
  ["npm_config_dry_run", "npm se quedó con --dry-run, que este comando no usa: para un ensayo, «npm run lotes:construir -- --ensayo»."],
];

/** Eco acotado y sin caracteres de control (ESC, saltos de línea) de lo que escribió el usuario. */
const eco = (x: string) => {
  const limpio = x.replace(/[\u0000-\u001f\u007f-\u009f]/g, "?");
  return limpio.length > MAX_ECO ? `${limpio.slice(0, MAX_ECO)}…` : limpio;
};

/** Lee las opciones; `entorno` es process.env (para detectar las que npm se quedó). */
export function leerArgumentosConstruir(argv: readonly string[], entorno: Readonly<Record<string, string | undefined>>): ArgumentosConstruir {
  const tomada = TOMADAS_POR_NPM.find(([variable]) => entorno[variable] !== undefined);
  if (tomada) throw new ErrorArgumentosConstruir(tomada[1]);
  const vistas = new Set<Opcion>();
  for (const x of argv) {
    if (!esOpcion(x)) throw new ErrorArgumentosConstruir(`Opción desconocida: «${eco(x)}».`);
    if (vistas.has(x)) throw new ErrorArgumentosConstruir(`${x} está repetida.`);
    vistas.add(x);
  }
  if (vistas.has("--ayuda") && vistas.size > 1) throw new ErrorArgumentosConstruir("--ayuda va sola.");
  return { ensayo: vistas.has("--ensayo"), ayuda: vistas.has("--ayuda") };
}
