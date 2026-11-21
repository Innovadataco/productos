/** Argumentos de `scripts/importar-plan.ts --ficha <ruta> --email <dueño> [--aplicar]`. Estrictos. */
export type Argumentos =
  | { readonly ok: true; readonly ficha: string; readonly email: string; readonly aplicar: boolean }
  | { readonly ok: false; readonly codigo: "USO" };

const USO: Argumentos = { ok: false, codigo: "USO" };
const CON_VALOR: ReadonlySet<string> = new Set(["--ficha", "--email"]);

export function leerArgumentos(argv: readonly string[]): Argumentos {
  const valores = new Map<string, string>();
  let aplicar = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--aplicar" && !aplicar) {
      aplicar = true;
    } else if (CON_VALOR.has(a) && !valores.has(a)) {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--") || valor.trim() === "") return USO;
      valores.set(a, valor);
      i += 1;
    } else {
      return USO;
    }
  }
  const ficha = valores.get("--ficha");
  const email = valores.get("--email");
  return ficha && email ? { ok: true, ficha, email, aplicar } : USO;
}
