"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegistroForm() {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState("");
    const [codigo, setCodigo] = useState("");
    const [tempToken, setTempToken] = useState("");
    const [password, setPassword] = useState("");
    const [nombre, setNombre] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    async function solicitarCodigo(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const res = await fetch("/api/auth/verificar/solicitar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        if (res.status === 202) {
            setStep(2);
        } else if (res.status === 429) {
            setError("Límite de solicitudes excedido. Intenta más tarde.");
        } else {
            setError("Error al solicitar código");
        }
    }

    async function validarCodigo(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        const res = await fetch("/api/auth/verificar/validar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, codigo }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
            setTempToken(data.token);
            setStep(3);
        } else {
            setError(data.error?.message || "Código inválido");
        }
    }

    async function completarRegistro(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError("Contraseña: mínimo 8 caracteres, 1 letra y 1 número");
            return;
        }
        const res = await fetch("/api/auth/verificar/completar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tempToken, password, nombre }),
        });
        if (res.ok) {
            router.push("/dashboard");
        } else {
            const data = await res.json();
            setError(data.error?.message || "Error al completar registro");
        }
    }

    return (
        <div>
            {step === 1 && (
                <form onSubmit={solicitarCodigo}>
                    <h2>Registro — Paso 1: Email</h2>
                    {error && <p style={{ color: "red" }}>{error}</p>}
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <button type="submit">Solicitar código</button>
                </form>
            )}
            {step === 2 && (
                <form onSubmit={validarCodigo}>
                    <h2>Registro — Paso 2: Código</h2>
                    <p>Revisa tu email: {email}</p>
                    {error && <p style={{ color: "red" }}>{error}</p>}
                    <input type="text" placeholder="Código de 6 dígitos" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={6} required />
                    <button type="submit">Verificar</button>
                </form>
            )}
            {step === 3 && (
                <form onSubmit={completarRegistro}>
                    <h2>Registro — Paso 3: Contraseña</h2>
                    {error && <p style={{ color: "red" }}>{error}</p>}
                    <input type="text" placeholder="Nombre (opcional)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="submit">Completar registro</button>
                </form>
            )}
        </div>
    );
}