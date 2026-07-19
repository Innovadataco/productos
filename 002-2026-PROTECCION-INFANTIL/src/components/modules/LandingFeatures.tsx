const FEATURES = [
    {
        title: "Reportes anónimos",
        description: "Reporta sin revelar tu identidad, o crea una cuenta para dar más contexto.",
        icon: ShieldIcon,
    },
    {
        title: "Clasificación con IA local",
        description: "Cada reporte se clasifica automáticamente con modelos locales que resguardan tu privacidad.",
        icon: BrainIcon,
    },
    {
        title: "Consulta pública",
        description: "Verifica si un número, nick o usuario fue reportado antes de interactuar.",
        icon: SearchIcon,
    },
    {
        title: "Canales oficiales",
        description: "Te conectamos con Línea 141, CAI Virtual y Te Protejo para denuncias formales.",
        icon: PhoneIcon,
    },
];

export function LandingFeatures() {
    return (
        <section className="py-14 sm:py-20">
            <div className="mb-10 text-center">
                <h2 className="text-2xl font-bold text-body">¿Cómo funciona?</h2>
                <p className="mt-2 text-muted">Una plataforma simple para prevenir riesgos en entornos digitales.</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((feature) => (
                    <article
                        key={feature.title}
                        className="glass rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-accent dark:bg-sky-950/40">
                            <feature.icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-semibold text-body">{feature.title}</h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted">{feature.description}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    );
}

function BrainIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
    );
}

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
    );
}

function PhoneIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.528-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
    );
}
