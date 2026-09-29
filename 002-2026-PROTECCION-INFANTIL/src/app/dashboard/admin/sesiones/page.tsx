import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { calendarioDelOperador } from "@/lib/operadores/calendario-operador.service";
import { SesionesOperadorClient } from "@/components/modules/operador/SesionesOperadorClient";

/**
 * SPEC-750 · La cola de sesiones del OPERADOR. Reusa el área interna (/dashboard/admin/**)
 * con el DTO propio SIN PII del padre (`calendarioDelOperador`). El módulo `sesiones_operador`
 * la gatea; `force-dynamic` porque la agenda y el estado del enlace cambian.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Sesiones",
    description: "Las sesiones que le toca preparar, con sus límites.",
};

export default async function SesionesOperadorPage() {
    const usuario = await verifyAuth();
    // SPEC-496: el módulo manda — revocar `sesiones_operador` corta el acceso.
    if (!(await puedeAccederAModulo(usuario.rol, "sesiones_operador"))) {
        return <SinAccesoModulo />;
    }
    const datos = await calendarioDelOperador(usuario.id);

    return (
        <main className="min-h-screen bg-page py-4">
            <SesionesOperadorClient datos={datos} />
        </main>
    );
}
