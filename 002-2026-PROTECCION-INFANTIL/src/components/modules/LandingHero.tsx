"use client";

import Link from "next/link";

export function LandingHero() {
    return (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-16 text-white shadow-lg sm:py-20">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

            <div className="relative mx-auto max-w-3xl text-center">
                <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
                    Protege a quienes más importan
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base text-primary-50 sm:text-lg">
                    Consulta reportes comunitarios sobre identificadores de riesgo en plataformas digitales.
                    Reporta de forma anónima o autenticada conductas que afecten a menores.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                        href="/reportar"
                        className="inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-sm transition hover:bg-primary-50"
                    >
                        Hacer un reporte
                    </Link>
                    <Link
                        href="#consultar"
                        className="inline-flex rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                        Consultar un identificador
                    </Link>
                </div>
            </div>
        </section>
    );
}
