"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { destinoSeguro } from "@/lib/destinoSeguro";
import { ShieldCheck, Send } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ username: "", password: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error("Login fallido");
            // Vuelve a la página que pidió el usuario antes de la barrera
            // (spec 005, FR-017); el helper descarta destinos externos (FR-018).
            // Se lee aquí y no con useSearchParams para no arrastrar un límite
            // de suspensión a toda la pantalla.
            router.push(destinoSeguro(new URLSearchParams(window.location.search).get("next")));
        } catch (err: any) {
            alert("Error: " + (err.message || "Credenciales inválidas"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020203] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 space-y-6">
                <header className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
                        <ShieldCheck className="w-4 h-4" /> Protocolo ODIN
                    </div>
                    <h1 className="text-2xl font-bold uppercase">Innovadataco</h1>
                </header>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input required placeholder="admin" className="w-full bg-white/5 border border-white/10 p-3 text-xs" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
                    <input type="password" required placeholder="••••••" className="w-full bg-white/5 border border-white/10 p-3 text-xs" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    <button type="submit" disabled={loading} className="w-full py-4 bg-neonCyan text-black font-black text-xs uppercase">{loading ? "Autenticando..." : <><Send className="w-3 h-3 inline" /> Ingresar</>}</button>
                </form>
                <p className="text-[8px] text-[#444] text-center uppercase">admin / admin123</p>
            </div>
        </div>
    );
}