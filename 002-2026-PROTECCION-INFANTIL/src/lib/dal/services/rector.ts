/**
 * SPEC-344 (A-69 · C1) — Servicio del rector (Paso 1 del camino colegio).
 *
 * Persiste los 5 campos en `Usuario` (fuente de verdad, patrón A-67) y refleja
 * los denormalizados en `Colegio` para compatibilidad con lectores existentes
 * (retro-llena "PENDIENTE" cuando aplique).
 */
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";

export interface PatchRectorInput {
    documentoTipo: string;
    documentoNumero: string;
    nombre: string;
    apellidos: string;
    telefono: string;
}

/** Obtiene el `colegioId` del rector autenticado. `null` si no tiene. */
export async function obtenerColegioIdDelRector(usuarioId: string): Promise<string | null> {
    const usuario = await new UsuarioRepository().findVigenciaCliente(usuarioId);
    return usuario?.colegioId ?? null;
}

/** Aplica el patch del Paso 1 del camino colegio en una `withUnitOfWork`. */
export async function actualizarRectorYReflejarEnColegio(
    usuarioId: string,
    colegioId: string,
    datos: PatchRectorInput,
): Promise<void> {
    await withUnitOfWork(async (tx) => {
        // 1) Fuente de verdad: Usuario.
        await new UsuarioRepository(tx).actualizarDatosRector(usuarioId, datos);
        // 2) Reflejo en Colegio para compatibilidad con los lectores.
        await new ColegioRepository(tx).actualizarRepresentanteLegal(colegioId, {
            nombre: `${datos.nombre} ${datos.apellidos}`.trim(),
            identificacion: `${datos.documentoTipo} ${datos.documentoNumero}`.trim(),
            telefono: datos.telefono,
        });
    });
}
