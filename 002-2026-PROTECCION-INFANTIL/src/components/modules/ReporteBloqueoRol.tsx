"use client";

/**
 * SPEC-314 (002-PI-214): tarjeta que aparece cuando el usuario autenticado no puede
 * generar reportes (rol interno: ADMIN, SCHOOL_ADMIN, OPERADOR, COMITE_*). Se muestra
 * antes del wizard (guard preventivo por rol conocido) o como fallback reactivo al 403
 * del backend cuando el rol no está en la lista pre-configurada del cliente.
 *
 * 2 CTAs de escape UX-friendly:
 *  A · Cerrar sesión y reportar anónimo — hace logout + reload; el reporte se re-crea
 *      sin cookie de sesión, entrando al flujo anónimo válido para todos.
 *  B · Registrarme como padre — redirige a /registro?rol=PARENT&returnTo=<actual>
 *      para que el usuario cree una cuenta PARENT y vuelva a la misma página.
 */

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface ReporteBloqueoRolProps {
    onLogoutAndRetry: () => void | Promise<void>;
    returnTo?: string;
}

export function ReporteBloqueoRol({ onLogoutAndRetry, returnTo }: ReporteBloqueoRolProps) {
    const router = useRouter();

    async function handleLogoutClick() {
        await onLogoutAndRetry();
    }

    function handleRegistroClick() {
        const target = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/reportar");
        router.push(`/registro?rol=PARENT&returnTo=${encodeURIComponent(target)}`);
    }

    return (
        <div
            className="mx-auto max-w-xl rounded-2xl border border-ambar/20 bg-ambar/10 p-8"
            role="alert"
            data-testid="reporte-bloqueo-rol"
        >
            <h2 className="text-lg font-semibold text-estado-ambar">
                Las cuentas internas no pueden crear reportes
            </h2>
            <p className="mt-2 text-sm text-estado-ambar">
                Los usuarios internos (colegio · admin · comités) no pueden reportar desde su cuenta institucional. Puedes hacerlo de forma anónima o crear una cuenta de padre.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button onClick={handleLogoutClick} data-testid="cta-logout-anonimo">
                    Cerrar sesión y reportar anónimo
                </Button>
                <Button variant="outline" onClick={handleRegistroClick} data-testid="cta-registro-padre">
                    Registrarme como padre
                </Button>
            </div>
        </div>
    );
}
