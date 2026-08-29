import { Suspense } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ActivarForm } from "@/components/modules/ActivarForm";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";

export const metadata = {
    title: "Activar cuenta — Protección Infantil",
};

function LinkExpirado() {
    return (
        <GlassCard className="w-full max-w-md text-center">
            <h2 className="text-xl font-semibold text-body">Link expirado</h2>
            <p className="mt-2 text-sm text-muted">
                El enlace de activación no es válido, ya fue usado o venció.
                <br />
                Contacta al administrador para recibir una nueva invitación.
            </p>
        </GlassCard>
    );
}

async function ActivarContenido({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const sp = await searchParams;
    const token = sp.token ?? "";
    const validacion = await new RegistroColegioService().validarTokenInvitacion(token);

    if (!validacion.valido) {
        return <LinkExpirado />;
    }

    return <ActivarForm token={token} />;
}

export default function ActivarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <Suspense fallback={<LinkExpirado />}>
                <ActivarContenido searchParams={searchParams} />
            </Suspense>
        </main>
    );
}
