import Topbar from "@/components/bi/Topbar";

export default function DashboardPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Pulso de la" acento="operación" activo="dashboard" />

            <section className="glass anim-entrada p-8 sm:p-12 text-center" style={{ "--anim-retardo": "120ms" } as React.CSSProperties}>
                <h2 className="font-serif text-[clamp(30px,4.5vw,48px)] tracking-tight leading-tight">
                    La operación respira <em className="text-estado-pino">en calma</em>
                </h2>
                <p className="text-muted mt-4 max-w-xl mx-auto text-[15px] leading-relaxed">
                    Infraestructura validada: estás dentro con sesión propia del 006.
                    El pulso en vivo (ticker, KPIs, “BI detectó”) se conecta a la réplica
                    de PI en las Fases 2 y 3.
                </p>
                <div className="flex gap-2.5 justify-center flex-wrap mt-7">
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                        <span className="punto punto-ok anim-pulso" /> App desplegada
                    </span>
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                        <span className="punto punto-ok" /> Sesión propia activa
                    </span>
                    <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                        <span className="punto punto-warn" /> Réplica PI · Fase 1b
                    </span>
                </div>
            </section>
        </main>
    );
}
