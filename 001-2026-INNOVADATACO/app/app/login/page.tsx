"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import Logo from "../components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("jelkin@innovadataco.com");
  const [password, setPassword] = useState("innovadata2026");

  if (isAuthenticated) {
    router.push("/dashboard");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 page-enter">
      <div className="w-full max-w-md">
        <div className="glass rounded-[36px] p-8 md:p-10 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <Logo width={120} height={132} />
          </div>

          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            <span className="text-[var(--navy-mid)]">INNOVA</span>
            <span className="text-[var(--data)]">DATA</span>
            <span className="text-[var(--gold)]">CO</span>
          </h1>
          <p className="text-white/50 mb-8 text-sm tracking-wide">
            SOLUCIONES TECNOLÓGICAS · DATOS · IA
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2 ml-1">
                CORREO
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="jelkin@innovadataco.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2 ml-1">
                CONTRASEÑA
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-[var(--data)] w-4 h-4 rounded" />
                Recordarme
              </label>
              <a href="#" className="text-[var(--data-light)] hover:underline">
                ¿Olvidaste?
              </a>
            </div>
            <button type="submit" className="btn-primary w-full mt-4">
              Ingresar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
