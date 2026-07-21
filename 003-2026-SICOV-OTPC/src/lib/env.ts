/// Lectura validada de variables de entorno. Lanza si falta o es demasiado corta.
export function requireEnv(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      `Variable de entorno ${name} ausente o inválida (mínimo ${minLength} caracteres).`,
    );
  }
  return value;
}

export function envBool(name: string, def = false): boolean {
  const value = process.env[name];
  if (value === undefined) return def;
  return value === "true" || value === "1";
}

export function envOr(name: string, def: string): string {
  return process.env[name] ?? def;
}
