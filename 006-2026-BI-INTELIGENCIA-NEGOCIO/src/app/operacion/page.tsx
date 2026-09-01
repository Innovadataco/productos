import Topbar from "@/components/bi/Topbar";

export default function OperacionPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Operación" acento="en vivo" activo="operacion" />

            <section className="glass anim-entrada p-8 sm:p-12 text-center" style={{ "--anim-retardo": "120ms" } as React.CSSProperties}>
                <h2 className="font-serif text-[clamp(28px,4vw,42px)] tracking-tight leading-tight">
                    El tablero de la <em className="text-estado-pino">gerencia</em>
                </h2>
                <p className="text-muted mt-4 max-w-xl mx-auto text-[15px] leading-relaxed">
                    Semáforo de colegios, filtros y actividad en vivo. Esta vista es
                    obligatoria antes del corte final de dominio y se conecta a la
                    réplica en la Fase 3.
                </p>
            </section>
        </main>
    );
}
