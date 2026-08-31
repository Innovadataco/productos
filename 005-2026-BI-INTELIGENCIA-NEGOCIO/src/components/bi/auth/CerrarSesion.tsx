"use client";

// SPEC-036 · botón "Cerrar sesión". POST a /api/auth/logout (borra la cookie
// y redirige a /login). Form nativo · sin JS extra · funciona sin hidratación.
export function CerrarSesion({ className }: { className?: string }) {
    return (
        <form method="post" action="/api/auth/logout" className={className}>
            <button
                type="submit"
                data-testid="cerrar-sesion"
                className="text-sm text-slate-500 hover:text-slate-900"
            >
                Cerrar sesión
            </button>
        </form>
    );
}
