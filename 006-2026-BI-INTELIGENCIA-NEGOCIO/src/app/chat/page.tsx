import Topbar from "@/components/bi/Topbar";

export default function ChatPage() {
    return (
        <main className="relative z-10 max-w-[1180px] mx-auto px-6 pt-8 pb-20">
            <Topbar titulo="Conversá con la" acento="operación" activo="chat" />

            <section className="glass anim-entrada p-8 sm:p-12 text-center" style={{ "--anim-retardo": "120ms" } as React.CSSProperties}>
                <h2 className="font-serif text-[clamp(28px,4vw,42px)] tracking-tight leading-tight">
                    El motor <em className="text-estado-pino">NL→SQL</em> llega en la Fase 2
                </h2>
                <p className="text-muted mt-4 max-w-xl mx-auto text-[15px] leading-relaxed">
                    Preguntas en español contra la réplica read-only de PI, con un solo
                    modelo Ollama (<code className="font-mono text-[13px]">qwen2.5:14b</code>),
                    SQL validado antes de ejecutarse y plantillas deterministas:
                    si no hay dato, no inventa.
                </p>
            </section>
        </main>
    );
}
