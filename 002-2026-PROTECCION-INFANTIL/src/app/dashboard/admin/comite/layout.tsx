/**
 * SPEC-381 (I-276) — Layout compartido de /dashboard/admin/comite/**.
 *
 * Antes cada page.tsx montaba su propio `<ComiteSubNav>` en distinta posición
 * respecto al `<h1>`: `/comite`, `/comite/guias-pendientes` y
 * `/comite/auditoria` lo ponían DEBAJO del título; `/comite/apelaciones` y
 * `/comite/gestion` lo ponían ARRIBA (sin título). Al saltar entre pestañas la
 * barra brincaba varias líneas.
 *
 * El layout resuelve el brinco poniendo el subnav SIEMPRE arriba, en la misma
 * posición vertical para las 5 pantallas. Cada `page.tsx` conserva su propio
 * `<h1>` (título distinto por pestaña) y no monta la barra otra vez.
 */
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { verifyToken } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { ComiteSubNav } from "./components/ComiteSubNav";

export default async function ComiteLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";
    const permitidos = await modulosPermitidosParaRol(rol);

    return (
        <div className="space-y-6">
            <ComiteSubNav rol={rol} modulosPermitidos={[...permitidos]} />
            {children}
        </div>
    );
}
