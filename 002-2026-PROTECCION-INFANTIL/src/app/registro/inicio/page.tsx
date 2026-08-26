import Link from "next/link";

export default function RegistroInicioPage() {
    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-2xl animate-fadeIn">
                <div className="mb-10 text-center">
                    <h1 className="font-serif text-4xl font-normal text-body">
                        ¿Quién eres?
                    </h1>
                    <p className="mt-3 font-sans text-base text-muted">
                        Protección Infantil tiene un espacio para familias y otro para colegios.
                        Elige el tuyo para comenzar.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Tarjeta Familia */}
                    <div className="group relative overflow-hidden rounded-2xl border border-cielo/30 bg-cielo/5 p-6 transition hover:border-cielo/60 hover:bg-cielo/10 dark:border-cielo/20 dark:bg-cielo/5 dark:hover:border-cielo/40 dark:hover:bg-cielo/10" style={{ borderRadius: "16px" }}>
                        <div className="mb-4 flex justify-center" aria-hidden="true">
                            <svg
                                width="72"
                                height="72"
                                viewBox="0 0 72 72"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                role="img"
                                aria-label="Anillo de protección familia"
                            >
                                <circle cx="36" cy="36" r="29.5" className="stroke-cielo opacity-20" strokeWidth="8" />
                                <circle cx="36" cy="36" r="29.5" className="stroke-cielo" strokeWidth="8" strokeLinecap="round" strokeDasharray="185.35" strokeDashoffset="46.34" transform="rotate(-90 36 36)" />
                                <circle cx="36" cy="36" r="16.5" className="stroke-cielo opacity-20" strokeWidth="8" />
                                <circle cx="36" cy="36" r="16.5" className="stroke-cielo" strokeWidth="8" strokeLinecap="round" strokeDasharray="103.67" strokeDashoffset="25.92" transform="rotate(-90 36 36)" />
                            </svg>
                        </div>
                        <h2 className="font-serif text-2xl font-normal text-body">Familia</h2>
                        <p className="mt-2 font-sans text-sm text-muted" style={{ borderRadius: "12px" }}>
                            Reporta conductas de riesgo y mantén a tu hijo protegido desde cualquier dispositivo.
                        </p>
                        <Link
                            href="/registro"
                            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[22px] bg-cielo px-6 py-2.5 font-sans text-sm font-semibold text-white shadow-md shadow-cielo/25 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cielo"
                            aria-label="Crear mi cuenta de familia"
                        >
                            Crear mi cuenta →
                        </Link>
                    </div>

                    {/* Tarjeta Colegio */}
                    <div className="group relative overflow-hidden rounded-2xl border border-pino/30 bg-pino/5 p-6 transition hover:border-pino/60 hover:bg-pino/10 dark:border-pino/20 dark:bg-pino/5 dark:hover:border-pino/40 dark:hover:bg-pino/10" style={{ borderRadius: "16px" }}>
                        <div className="mb-4 flex justify-center" aria-hidden="true">
                            <svg
                                width="72"
                                height="72"
                                viewBox="0 0 72 72"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                role="img"
                                aria-label="Anillo de protección colegio"
                            >
                                <circle cx="36" cy="36" r="29.5" className="stroke-pino opacity-20" strokeWidth="8" />
                                <circle cx="36" cy="36" r="29.5" className="stroke-pino" strokeWidth="8" strokeLinecap="round" strokeDasharray="185.35" strokeDashoffset="46.34" transform="rotate(-90 36 36)" />
                                <circle cx="36" cy="36" r="16.5" className="stroke-pino opacity-20" strokeWidth="8" />
                                <circle cx="36" cy="36" r="16.5" className="stroke-pino" strokeWidth="8" strokeLinecap="round" strokeDasharray="103.67" strokeDashoffset="25.92" transform="rotate(-90 36 36)" />
                            </svg>
                        </div>
                        <h2 className="font-serif text-2xl font-normal text-body">Colegio</h2>
                        <p className="mt-2 font-sans text-sm text-muted">
                            Gestiona la protección de tus estudiantes, activa alertas y coordina con las familias.
                        </p>
                        <Link
                            href="/registro-colegio"
                            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[22px] bg-pino px-6 py-2.5 font-sans text-sm font-semibold text-white shadow-md shadow-pino/25 transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pino"
                            aria-label="Registrar mi colegio"
                        >
                            Registrar colegio →
                        </Link>
                    </div>
                </div>

                <p className="mt-8 text-center font-sans text-sm text-muted">
                    ¿Ya tienes cuenta?{" "}
                    <Link href="/login" className="font-semibold text-accent hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </main>
    );
}
