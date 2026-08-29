import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { obtenerSenalComunitaria } from "@/lib/expediente/compilacion/queries/senal-comunitaria";
import { IdentificadorAdminClient } from "@/components/modules/admin/IdentificadorAdminClient";
import { IdentificadorAgregadoAnonimo } from "@/components/modules/admin/IdentificadorAgregadoAnonimo";
import { IdentificadorExpedientesAnonimos } from "@/components/modules/admin/IdentificadorExpedientesAnonimos";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import {
    decodificarIdentificadorParam,
    esIdentificadorParamValido,
    MAX_IDENTIFICADOR_LENGTH,
} from "@/lib/expediente/identificador-param";

const ROLES_PERMITIDOS = new Set(["ADMIN", "COMITE_VALIDACION"]);

/**
 * SPEC-233 (002-PI-133): vista admin/comité de búsqueda por identificador.
 * Agregado anónimo (señal comunitaria) + lista anonimizada de expedientes de
 * toda la plataforma. Cero textos, cero identidades (Ley 1581).
 * Restringida a ADMIN y COMITE_VALIDACION: otros roles internos → /dashboard/admin.
 */
export default async function AdminIdentificadorPage({ params }: { params: Promise<{ nick: string }> }) {
    const { nick } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!rol || !ROLES_PERMITIDOS.has(rol)) {
        redirect("/dashboard/admin");
    }

    const identificador = decodificarIdentificadorParam(nick);

    if (!esIdentificadorParamValido(identificador)) {
        return (
            <div className="space-y-6">
                <ErrorState
                    title="Identificador inválido"
                    description={`El identificador no puede estar vacío ni superar ${MAX_IDENTIFICADOR_LENGTH} caracteres. Ajusta la búsqueda e intenta de nuevo.`}
                />
                <IdentificadorAdminClient identificador="" />
            </div>
        );
    }

    const [senal, expedientes] = await Promise.all([
        obtenerSenalComunitaria(identificador),
        new ExpedienteRepository().listarExpedientesPorIdentificadorAnonimo(identificador),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Identificador: {identificador}</h1>
                <p className="mt-1 text-sm text-muted">
                    Vista interna con datos anonimizados: estadísticas agregadas, sin textos ni identidad de quienes reportaron.
                </p>
            </div>

            <IdentificadorAdminClient identificador={identificador} />

            {expedientes.length === 0 ? (
                <GlassCard className="p-8 text-center">
                    <p className="text-body font-semibold">Sin expedientes registrados sobre este identificador</p>
                    <p className="mt-2 text-sm text-muted">
                        Cuando la comunidad registre reportes sobre este identificador, el agregado aparecerá aquí.
                    </p>
                </GlassCard>
            ) : (
                <>
                    <IdentificadorAgregadoAnonimo senal={senal} />
                    <IdentificadorExpedientesAnonimos expedientes={expedientes} />
                </>
            )}
        </div>
    );
}
