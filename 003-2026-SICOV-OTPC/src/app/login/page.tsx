"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Login ÚNICO usuario/contraseña. NO existe pestaña/flujo "Vigía" (desviación del demo, eliminada).
export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, contrasena }),
      });
      if (!res.ok) {
        // Bug 3: nunca "iniciar sesión demo" ante error; se muestra el error real del backend.
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No fue posible iniciar sesión");
        return;
      }
      const data = (await res.json()) as { claveTemporal?: boolean };
      router.push(data.claveTemporal ? "/cambiar-clave" : "/dashboard");
    } catch {
      setError("Error de red");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-sicov-700">SICOV-OTPC</h1>
        <p className="text-sm text-gray-500">Operación de Transporte de Pasajeros por Carreteras</p>

        <label className="block text-sm">
          Usuario
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block text-sm">
          Contraseña
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando || !usuario || !contrasena}
          className="w-full bg-sicov-700 text-white rounded py-2 disabled:opacity-50"
        >
          {cargando ? "Iniciando sesión…" : "Ingresar"}
        </button>
        {/* Enlace "¿Olvidó su contraseña?" retirado: /recuperar da 404 hasta la spec de usuarios (009). */}
      </form>
    </main>
  );
}
