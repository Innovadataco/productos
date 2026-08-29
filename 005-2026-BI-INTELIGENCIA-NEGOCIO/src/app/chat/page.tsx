"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MensajeMotor } from "@/components/bi/chat/MensajeMotor";
import { MensajeUsuario } from "@/components/bi/chat/MensajeUsuario";
import type { HistorialChat, UsuarioUI } from "@/lib/bi/tipos-ui";
import type { RespuestaMotor } from "@/lib/bi/tipos";

const USUARIO_STUB: UsuarioUI = { id: "dev-local", rol: "ADMIN" };

export default function ChatPage() {
    const [historial, setHistorial] = useState<HistorialChat>([]);
    const [pregunta, setPregunta] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [errorRed, setErrorRed] = useState<string | null>(null);

    const enviar = async () => {
        const texto = pregunta.trim();
        if (!texto || enviando) return;
        setErrorRed(null);
        setEnviando(true);
        const ts = performance.now();
        setHistorial((h) => [
            ...h,
            { tipo: "usuario", id: `u-${ts}`, texto, ts },
        ]);
        setPregunta("");
        try {
            const res = await fetch("/api/bi/preguntar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preguntaNL: texto,
                    rol: USUARIO_STUB.rol,
                    usuarioId: USUARIO_STUB.id,
                }),
            });
            const data = (await res.json()) as RespuestaMotor;
            const tsMotor = performance.now();
            setHistorial((h) => [
                ...h,
                { tipo: "motor", id: `m-${tsMotor}`, respuesta: data, ts: tsMotor },
            ]);
        } catch (e) {
            setErrorRed(e instanceof Error ? e.message : "error_red");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="mx-auto flex h-screen max-w-4xl flex-col p-4">
            <header className="mb-4">
                <h1 className="text-lg font-semibold text-slate-900">BI · Chat NL→SQL</h1>
                <p className="text-xs text-slate-500">
                    Usuario mock: <code>{USUARIO_STUB.id}</code> · rol <code>{USUARIO_STUB.rol}</code>
                </p>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto" data-testid="historial">
                {historial.map((m) =>
                    m.tipo === "usuario" ? (
                        <MensajeUsuario key={m.id} mensaje={m} />
                    ) : (
                        <div key={m.id} className="flex justify-start">
                            <MensajeMotor mensaje={m} usuario={USUARIO_STUB} />
                        </div>
                    ),
                )}
                {errorRed && (
                    <div data-testid="banner-red" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
                        Error de red: {errorRed}
                    </div>
                )}
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void enviar();
                }}
                className="mt-4 flex gap-2"
            >
                <Input
                    value={pregunta}
                    onChange={(e) => setPregunta(e.target.value)}
                    placeholder="Pregunta al motor BI…"
                    disabled={enviando}
                    aria-label="pregunta"
                />
                <Button type="submit" disabled={enviando || !pregunta.trim()}>
                    {enviando ? "Enviando…" : "Enviar"}
                </Button>
            </form>
        </div>
    );
}
