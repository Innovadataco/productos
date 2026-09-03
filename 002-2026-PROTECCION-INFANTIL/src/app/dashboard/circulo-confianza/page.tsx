"use client";

/**
 * A-73 (SPEC-367) · Tu círculo de confianza (menú: "A quién vigilo").
 *
 * La pantalla anterior mezclaba 4 métricas, un formulario técnico
 * (etiqueta/tipo/identificadores), la lista, una dona, un mapa y una vista
 * agregada: Jelkin la rechazó cuatro veces. El rediseño (G12) vive en
 * `components/modules/padre/circulo`; aquí solo queda el candado de acceso.
 *
 * SPEC-317: `/dashboard/padre/circulo-confianza` reexporta esta misma página,
 * así que el rediseño entra por las dos rutas.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { CirculoConfianzaClient } from "@/components/modules/padre/circulo/CirculoConfianzaClient";

/** Roles que no ven el círculo: se les manda a su propio panel. */
const ROLES_REDIRIGIDOS = ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "SCHOOL_ADMIN"];

export default function CirculoConfianzaPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();

    // Mismo candado de acceso que tenía la pantalla anterior (no se relaja).
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        if (["ADMIN", "OPERADOR", "COMITE_VALIDACION"].includes(user.rol)) {
            // SPEC-404 (I-290): ADMIN cae en la bandeja (URL propia), no en la
            // raíz-aterrizaje. OPERADOR y COMITE_VALIDACION conservan destino.
            const target =
                user.rol === "COMITE_VALIDACION"
                    ? "/dashboard/admin/comite"
                    : user.rol === "OPERADOR"
                        ? "/dashboard/admin/operadores"
                        : "/dashboard/admin/bandeja";
            router.push(target);
            return;
        }
        if (user.rol === "SCHOOL_ADMIN") {
            router.push("/dashboard/colegio");
        }
    }, [authLoading, user, router]);

    // Mismo alcance que antes: se muestra a todo el que NO se redirige arriba
    // (no se restringe más ni menos que la pantalla anterior).
    const redirigido = !!user && ROLES_REDIRIGIDOS.includes(user.rol);
    if (authLoading || !user || redirigido) return null;

    return <CirculoConfianzaClient />;
}
