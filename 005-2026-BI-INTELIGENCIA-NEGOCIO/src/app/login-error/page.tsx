const REASONS: Record<string, string> = {
    invalid_token: "El enlace de acceso es inválido o está mal formado.",
    expired: "El enlace de acceso caducó. Inicia sesión de nuevo.",
    bad_claim: "El enlace no corresponde a este servicio.",
};

export default async function LoginErrorPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string }>;
}) {
    const { reason } = await searchParams;
    const msg = REASONS[reason ?? ""] ?? "No se pudo completar el ingreso.";
    return (
        <main className="mx-auto max-w-md p-8">
            <h1 className="text-xl font-semibold text-slate-900">
                No se pudo iniciar sesión
            </h1>
            <p className="mt-3 text-sm text-slate-600" data-testid="login-error-reason">
                {msg}
            </p>
            <p className="mt-6 text-sm">
                <a
                    href="/dashboard"
                    className="text-sky-700 underline hover:text-sky-900"
                >
                    Reintentar
                </a>
            </p>
        </main>
    );
}
