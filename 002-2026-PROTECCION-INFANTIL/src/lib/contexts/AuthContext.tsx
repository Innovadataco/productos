"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type User = { id: string; email: string; nombre: string; rol: string; debeCambiarPassword?: boolean };

type AuthCtx = {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ ok: boolean; user?: User | null; error?: string }>;
    logout: () => Promise<void>;
    checkSession: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSession = useCallback(async () => {
        try {
            const res = await fetch("/api/me", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void (async () => {
            await checkSession();
        })();
    }, [checkSession]);

    const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; user?: User | null; error?: string }> => {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
            // SPEC-119: el servidor explica el motivo (p. ej. servicio vencido o cuenta
            // desactivada); la página de login lo muestra en vez de un genérico.
            const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
            return { ok: false, error: data?.error?.message };
        }
        const data = await res.json();
        setUser(data.user);
        return { ok: true, user: data.user };
    }, []);

    const logout = useCallback(async () => {
        // I-35b (SPEC-113): la salida NO depende del resultado de la API — aunque la
        // llamada falle (red, 403 histórico), la sesión local se limpia igual y la UI
        // puede navegar al inicio público.
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
            // La cookie la borra el servidor cuando puede; la UI no se bloquea por ello.
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, checkSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}