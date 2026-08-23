import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

export default async function AnaliticaPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    return (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <h2 className="text-lg font-semibold text-body">Analítica de pagos</h2>
            <p className="mt-2 text-muted">Disponible en SPEC-218.</p>
        </div>
    );
}
