import { cargarModulos } from "@/lib/modulos";
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
  | "llegadas";

export interface UsuarioGuard {
  id: number;
  rolId: number | null;
}

export async function requiereModulo(usuario: UsuarioGuard, modulo: ModuloOperacion): Promise<void> {
  if (usuario.rolId === 1) return; // root de plataforma (ver doc arriba)
  const modulos = await cargarModulos(usuario.id, usuario.rolId ?? null);
  const habilitado = modulos.some((m) => (m.nombre ?? "").toLowerCase() === modulo);
  if (!habilitado) {
    throw new AppError(
      `No tiene habilitado el módulo ${modulo}`,
      ERROR_CODES.FORBIDDEN,
      403,
    );
  }
}
