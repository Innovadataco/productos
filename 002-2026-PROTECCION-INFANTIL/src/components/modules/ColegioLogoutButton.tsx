"use client";

import { useState } from "react";

export function ColegioLogoutButton({ className }: { className?: string }) {
    const [loading, setLoading] = useState(false);

    async function handleLogout() {
        setLoading(true);
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } finally {
            window.location.href = "/login";
        }
    }

    return (
        <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className={className}
        >
            {loading ? "Cerrando sesión..." : "Volver al inicio"}
        </button>
    );
}
