const CANALES = [
    {
        href: "tel:141",
        label: "Línea 141",
        sub: "ICBF",
        icon: <span className="font-mono text-sm font-bold">141</span>,
        tone: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    },
    {
        href: "https://www.policia.gov.co",
        label: "CAI Virtual",
        sub: "Policía Nacional",
        icon: <PoliceIcon className="h-5 w-5" />,
        tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    {
        href: "https://www.teprotejo.gov.co",
        label: "Te Protejo",
        sub: "MinTIC / Fiscalía",
        icon: <ShieldIcon className="h-5 w-5" />,
        tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    },
];

export function CanalesOficiales() {
    return (
        <div className="glass rounded-2xl p-5 mt-6">
            <h3 className="text-sm font-semibold text-body mb-3 uppercase tracking-wide">
                Canales oficiales de denuncia
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
                {CANALES.map((c) => (
                    <a
                        key={c.label}
                        href={c.href}
                        target={c.href.startsWith("http") ? "_blank" : undefined}
                        rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="group flex items-center gap-3 rounded-xl bg-white/40 dark:bg-slate-900/40 p-3 transition hover:bg-white/70 dark:hover:bg-slate-800/60"
                    >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.tone}`}>
                            {c.icon}
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-body group-hover:text-accent transition">{c.label}</p>
                            <p className="text-xs text-subtle">{c.sub}</p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

function PoliceIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
        </svg>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    );
}
