/**
 * Claves que nunca van en un paquete de hechos ni en su vista ciega: datos de la persona y de sus cuentas, filas
 * crudas, el texto libre de reglas y decisiones, la acción y la cantidad de las reglas, y lo que nombra una especie.
 * La reusan los armadores (E1b) y la guarda de la vista ciega.
 *
 * Se compara la clave NORMALIZADA (sin tildes, en minúsculas y solo letras) y basta con que CONTENGA una raíz:
 * «usuario_id», «usuarioId», «idUsuario» y «correoUsuario» quedan prohibidas. Ningún campo del contrato contiene
 * una raíz (lo prueba `tests/unit/ia/prohibidas.test.ts`).
 */
const MAX_PROFUNDIDAD = 64;

export const CLAVES_PROHIBIDAS: readonly string[] = Object.freeze([
  // la persona y sus cuentas
  "correo", "email", "mail", "usuario", "user", "dueno", "propietario", "persona", "familia", "telefono", "celular",
  "documento", "cedula", "cuenta", "account", "encargo",
  // secretos y sesiones
  "password", "contrasena", "secreto", "token", "totp", "sesion", "telegram", "chat",
  // filas crudas y texto libre de reglas y decisiones
  "crudo", "fila", "texto", "nota", "comentario", "descripcion", "detalle", "justificacion", "razon", "regla", "decision",
  // la acción y la cantidad de las reglas
  "accion", "action", "cantidad", "quantity", "unidades",
  // lo que nombra una especie
  "nemotecnico", "nemo", "ticker", "simbolo", "especie", "instrumento", "nombre",
]);

/** «Correo_Usuario» → «correousuario»: sin marcas diacríticas, en minúsculas y solo letras a-z. */
export function normalizarClave(clave: string): string {
  return clave.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
}

export function esClaveProhibida(clave: string): boolean {
  const normalizada = normalizarClave(clave);
  return CLAVES_PROHIBIDAS.some((raiz) => normalizada.includes(raiz));
}

/**
 * Las rutas de las claves prohibidas en un valor JSON (p. ej. «hechos[3].correo»), a cualquier profundidad, en objetos
 * y arreglos. Los primitivos no tienen claves. Un ciclo o más de 64 niveles lanzan TypeError: no es un valor JSON.
 */
export function clavesProhibidasEn(valor: unknown): readonly string[] {
  const halladas: string[] = [];
  recorrer(valor, "", 0, new WeakSet<object>(), halladas);
  return Object.freeze(halladas);
}

function recorrer(valor: unknown, ruta: string, profundidad: number, vistos: WeakSet<object>, halladas: string[]): void {
  if (valor === null || typeof valor !== "object") return;
  if (profundidad > MAX_PROFUNDIDAD) throw new TypeError("Valor demasiado profundo para un paquete de hechos.");
  if (vistos.has(valor)) throw new TypeError("Valor con ciclos: no es un paquete de hechos.");
  vistos.add(valor);
  if (Array.isArray(valor)) {
    valor.forEach((elemento, i) => recorrer(elemento, `${ruta}[${i}]`, profundidad + 1, vistos, halladas));
  } else {
    for (const [clave, interior] of Object.entries(valor)) {
      const aqui = ruta === "" ? clave : `${ruta}.${clave}`;
      if (esClaveProhibida(clave)) halladas.push(aqui);
      recorrer(interior, aqui, profundidad + 1, vistos, halladas);
    }
  }
  vistos.delete(valor);
}
