"use client";

/** SE4: el usuario nunca queda atrapado — salir siempre alcanzable. */
export default function BotonSalir() {
    async function salir() {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    }

    return (
        <button
            onClick={salir}
            className="ml-2 px-4 py-2 rounded-full text-sm font-medium text-muted border border-[rgb(var(--tinta-rgb)/0.14)]
                transition-all hover:text-estado-rubi hover:border-[rgb(var(--rubi-rgb)/0.4)]"
        >
            Salir
        </button>
    );
}
