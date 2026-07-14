export function CanalesOficiales() {
    return (
        <div className="glass rounded-2xl p-5 mt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                Canales oficiales de denuncia
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
                <a
                    href="tel:141"
                    className="flex items-center gap-3 rounded-xl bg-white/50 p-3 transition hover:bg-white/80"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-mono text-sm font-bold">
                        141
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Línea 141</p>
                        <p className="text-xs text-slate-500">ICBF</p>
                    </div>
                </a>
                <a
                    href="https://www.policia.gov.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-white/50 p-3 transition hover:bg-white/80"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                        </svg>
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">CAI Virtual</p>
                        <p className="text-xs text-slate-500">Policía Nacional</p>
                    </div>
                </a>
                <a
                    href="https://www.teprotejo.gov.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-white/50 p-3 transition hover:bg-white/80"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                    </span>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Te Protejo</p>
                        <p className="text-xs text-slate-500">MinTIC / Fiscalía</p>
                    </div>
                </a>
            </div>
        </div>
    );
}