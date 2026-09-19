import { exigirPadre } from "@/lib/padre/guardia-padre";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { IdentificadorBusquedaClient } from "@/components/modules/padre/IdentificadorBusquedaClient";
import { ErrorState } from "@/components/ui/ErrorState";
import {
    decodificarIdentificadorParam,
    esIdentificadorParamValido,
    MAX_IDENTIFICADOR_LENGTH,
} from "@/lib/expediente/identificador-param";

/**
 * SPEC-233 (002-PI-133): vista padre de búsqueda por identificador.
 * Lista únicamente los expedientes del padre autenticado sobre ese
 * identificador (histórico completo, nuevo → anterior).
 */
export default async function PadreIdentificadorPage({ params }: { params: Promise<{ nick: string }> }) {
    const { nick } = await params;
    const usuario = await exigirPadre(); // SPEC-711: compuerta por rol (rol ≠ PARENT → su área)

    const identificador = decodificarIdentificadorParam(nick);

    if (!esIdentificadorParamValido(identificador)) {
        return (
            <div className="p-6">
                <ErrorState
                    title="Cuenta inválida"
                    description={`La cuenta no puede estar vacía ni superar ${MAX_IDENTIFICADOR_LENGTH} caracteres. Ajusta la búsqueda e intenta de nuevo.`}
                />
            </div>
        );
    }

    const resultado = await new ExpedienteRepository().listarExpedientesDePadrePorIdentificador(
        usuario.id,
        identificador,
        { page: 1, pageSize: 100 }
    );

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Expedientes sobre {identificador}</h1>
                <p className="mt-1 text-sm text-muted">
                    {resultado.pagination.total === 1
                        ? "1 expediente registrado por ti sobre esta cuenta."
                        : `${resultado.pagination.total} expedientes registrados por ti sobre esta cuenta.`}
                </p>
            </div>
            <IdentificadorBusquedaClient identificador={identificador} expedientes={resultado.items} />
        </div>
    );
}
