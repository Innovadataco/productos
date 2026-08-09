import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verifyToken } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { cursoIdParamsSchema } from "@/lib/schemas";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import type { CursoDetalle } from "@/lib/dal/repositories/colegio-resumen";
import CursoEscritorioClient from "./CursoEscritorioClient";

/**
 * SPEC-147 (FR-001/FR-002) — Escritorio del curso (mockup §5.5). REEMPLAZA la
 * vista anterior (misma ruta). La auth la hace el layout; aquí se lee la sesión
 * para el `colegioId` y TODOS los datos salen de UNA llamada a
 * `ColegioResumenRepository.cursoDetalle(colegioId, cursoId)` — 404 si el curso
 * no existe o es de OTRO colegio (tenant-first E-1).
 */
export default async function CursoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const { id } = await params;
    if (!cursoIdParamsSchema.safeParse({ id }).success) notFound();

    let datos: CursoDetalle;
    try {
        datos = await new ColegioResumenRepository().cursoDetalle(usuario.colegioId, id);
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        throw error;
    }

    return <CursoEscritorioClient datos={datos} />;
}
