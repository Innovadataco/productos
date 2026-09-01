"use client";

import { useState } from "react";

/**
 * Login propio del 006 (cerrado por defecto — CEO 31-08-2026).
 * El payload es exactamente { email, password }: el mismo JSON que espera
 * el endpoint (T1: payload real, nunca inventado). Jamás se envía `rol`.
 */
export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);

    async function entrar(e: React.FormEvent) {
        e.preventDefault();
        setCargando(true);
        setError(null);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (res.ok) {
                window.location.href = "/dashboard";
                return;
            }
            setError("Credenciales inválidas. Verificá correo y contraseña.");
        } catch {
            setError("No se pudo contactar al servidor. Intentá de nuevo.");
        }
        setCargando(false);
    }

    return (
        <main className="relative z-10 min-h-screen grid place-items-center px-5 py-10">
            <div className="glass-strong anim-entrada w-full max-w-[430px] p-10 sm:p-12 text-center">
                <div
                    className="accent-gradient respira mx-auto mb-6 grid place-items-center rounded-[22px] text-2xl font-bold text-[#060b0a]"
                    style={{ width: 68, height: 68, boxShadow: "0 0 34px rgb(var(--pino-rgb) / 0.5)" }}
                >
                    BI
                </div>
                <h1 className="font-serif text-[31px] tracking-tight mb-1.5">Inteligencia de Negocio</h1>
                <p className="text-muted text-sm mb-8">Innovadataco · acceso interno</p>

                <form onSubmit={entrar} className="text-left">
                    <label className="block mb-4">
                        <span className="block text-[12.5px] font-semibold mb-1.5">Correo</span>
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@innovadataco.com"
                            className="w-full rounded-xl border px-4 py-3.5 text-[15px] outline-none transition-all
                                bg-[rgb(var(--papel-rgb)/0.5)] border-[rgb(var(--tinta-rgb)/0.15)] text-body
                                focus:border-pino focus:shadow-[0_0_0_2px_rgb(var(--pino-rgb)/0.3),0_0_20px_rgb(var(--pino-rgb)/0.15)]"
                        />
                    </label>
                    <label className="block mb-4">
                        <span className="block text-[12.5px] font-semibold mb-1.5">Contraseña</span>
                        <input
                            type="password"
                            required
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••"
                            className="w-full rounded-xl border px-4 py-3.5 text-[15px] outline-none transition-all
                                bg-[rgb(var(--papel-rgb)/0.5)] border-[rgb(var(--tinta-rgb)/0.15)] text-body
                                focus:border-pino focus:shadow-[0_0_0_2px_rgb(var(--pino-rgb)/0.3),0_0_20px_rgb(var(--pino-rgb)/0.15)]"
                        />
                    </label>

                    {error && (
                        <p className="text-estado-rubi text-[13px] font-medium mb-3" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={cargando}
                        className="accent-gradient w-full mt-2 rounded-xl py-3.5 text-[14.5px] font-semibold text-[#060b0a]
                            transition-all hover:brightness-110 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {cargando ? "Verificando…" : "Entrar"}
                    </button>
                </form>

                <div
                    className="mt-6 rounded-xl px-4 py-3 text-[12.5px] text-estado-ambar"
                    style={{ background: "rgb(var(--ambar-rgb) / 0.1)", border: "1px solid rgb(var(--ambar-rgb) / 0.25)" }}
                >
                    Sistema cerrado por defecto: sin sesión válida no se muestra ningún dato.
                    Autenticación propia de BI — independiente de PI.
                </div>
            </div>
        </main>
    );
}
