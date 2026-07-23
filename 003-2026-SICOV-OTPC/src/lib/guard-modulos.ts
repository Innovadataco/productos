import { cargarModulos, cargarSubmodulos } from "@/lib/modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// Guard COMPARTIDO de permisos por módulo (D-017, spec 005-A). Se aplica en CADA endpoint de
/// operación junto a `verifyAuth` — el permiso deja de ser decorado de menú (en el legacy
/// `VerificarModulo` existía registrado y no protegía ninguna ruta: I-09).
///
/// Módulos asignables (D-018): usuarios · novedades · mantenimientos · autorizaciones ·
/// alistamientos · salidas · llegadas (+ inicio, implícito).
///
/// Rol 1 (administrador de plataforma, root) PASA el guard: no opera por UI (§10.1) pero el spec
/// le permite operación/lectura administrativa (FR-003 roles 1,3; D-015: lectura de todas las
/// empresas). La restricción de roles por endpoint sigue siendo de `verifyAuth([roles])`.
export type ModuloOperacion =
  | "usuarios"
  | "novedades"
  | "mantenimientos"
  | "autorizaciones"
  | "alistamientos"
  | "salidas"
  | "llegadas"
  | "configuracion";

export interface UsuarioGuard {
  id: number;
  rolId: number | null;
}

/// Guard de módulo/submódulo (D-017 + extensión spec 009).
///
/// Semántica de la cascada granular (columna aditiva `usm_submodulo_id`, B1/B2):
/// - Fila (usuario, módulo, NULL) = MÓDULO COMPLETO → pasa cualquier submódulo de ese módulo.
/// - Filas (usuario, módulo, submódulo) = solo esos submódulos.
/// La exclusión B2 (nunca coexisten completo y submódulo para el mismo módulo) la garantiza el
/// servicio de asignación server-side; aquí la decisión es inequívoca.
///
/// `submodulo` opcional: si se omite, basta tener el módulo (completo o por cualquier submódulo).
export async function requiereModulo(
  usuario: UsuarioGuard,
  modulo: ModuloOperacion,
  submodulo?: string,
): Promise<void> {
  if (usuario.rolId === 1) return; // root de plataforma (ver doc arriba)
  const modulos = await cargarModulos(usuario.id, usuario.rolId ?? null);
  const habilitado = modulos.some((m) => (m.nombre ?? "").toLowerCase() === modulo);
  if (!habilitado) {
    throw new AppError(`No tiene habilitado el módulo ${modulo}`, ERROR_CODES.FORBIDDEN, 403);
  }

  if (submodulo === undefined) return; // solo se exige el módulo

  const submodulos = await cargarSubmodulos(usuario.id);
  const delModulo = submodulos.filter((s) => (s.moduloNombre ?? "").toLowerCase() === modulo);
  // Sin filas de submódulo para este módulo → tiene el módulo COMPLETO (fila NULL o vía rol) → pasa.
  if (delModulo.length === 0) return;
  const tiene = delModulo.some((s) => (s.nombre ?? "").toLowerCase() === submodulo.toLowerCase());
  if (!tiene) {
    throw new AppError(
      `No tiene habilitado el submódulo ${modulo}/${submodulo}`,
      ERROR_CODES.FORBIDDEN,
      403,
    );
  }
}
