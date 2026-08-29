import { ColegioLogoutButton } from "./ColegioLogoutButton";

/**
 * Pantalla de corte por vigencia del servicio (SPEC-119). La ve un cliente (padre o
 * colegio) con la ventana vencida o no iniciada al intentar usar su área autenticada:
 * explica qué pasó y a quién acudir (mensaje de verificarVigenciaCliente) y ofrece
 * cerrar sesión. Vencer NO borra nada: sus reportes e información siguen guardados.
 */
export function ServicioVencidoScreen({ mensaje }: { mensaje: string }) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl glass p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full accent-gradient text-white text-2xl font-bold">
                    🛡️
                </div>
                <h1 className="text-2xl font-bold text-body">Servicio no vigente</h1>
                <p className="mt-4 text-muted">
                    {mensaje ||
                        "Tu acceso al servicio no está disponible en este momento. Contacta con el soporte de la plataforma para más información."}
                </p>
                <ColegioLogoutButton
                    className="mt-6 inline-flex rounded-xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition"
                />
            </div>
        </main>
    );
}
