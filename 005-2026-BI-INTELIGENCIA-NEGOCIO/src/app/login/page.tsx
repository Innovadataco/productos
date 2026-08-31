import { sanitizeReturnTo } from "@/lib/auth/return-to";

// SPEC-036 · login propio de BI. Reemplaza el redirect al SSO de PI por un
// form usuario+contraseña. Lee ?returnTo= (validado) y ?error=1.
export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
    const sp = await searchParams;
    const returnTo = sanitizeReturnTo(sp.returnTo ?? null);
    const hayError = sp.error === "1";

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <header className="mb-6">
                    <h1 className="text-xl font-bold text-slate-900">
                        BI · Inteligencia de Negocio
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">Ingresá para continuar</p>
                </header>

                {hayError ? (
                    <div
                        className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                        data-testid="login-error"
                    >
                        Usuario o contraseña incorrectos.
                    </div>
                ) : null}

                <form method="post" action="/api/auth/login" className="space-y-4">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                        <label
                            htmlFor="usuario"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Usuario
                        </label>
                        <input
                            id="usuario"
                            name="usuario"
                            type="text"
                            required
                            autoComplete="username"
                            autoFocus
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-slate-700"
                        >
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                    >
                        Entrar
                    </button>
                </form>
            </div>
        </main>
    );
}
