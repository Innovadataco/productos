import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { ConsultaPublica } from "@/components/modules/ConsultaPublica";
import { PublicDashboard } from "@/components/modules/PublicDashboard";

/**
 * SPEC-129 (C2/C3, D-b): home del colegio = consulta pública + RESUMEN de
 * estadísticas (componente compartido con /dashboard-publico, cero duplicación).
 * La vista ampliada (mapa/categorías) queda en la subsección Estadísticas.
 */
export default async function ColegioDashboardPage() {
    const acceso = await verificarAccesoPagina("colegios");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.rol !== "SCHOOL_ADMIN") redirect("/login");

    const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub as string },
        include: { colegio: { include: { pais: true, departamento: true, ciudad: true } } },
    });

    if (!usuario?.colegio) redirect("/login");

    const colegio = usuario.colegio;

    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-5xl space-y-8">
                {/* Ficha compacta del colegio */}
                <div className="flex items-center gap-4 rounded-2xl glass p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl accent-gradient text-white text-xl shadow-lg">
                        🏫
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-bold text-body">{colegio.nombre}</h1>
                        <p className="text-sm text-muted">
                            {colegio.ciudad?.nombre}
                            {colegio.departamento ? `, ${colegio.departamento.nombre}` : ""}
                            {colegio.pais ? ` — ${colegio.pais.nombre}` : ""}
                            {" · Vigencia: "}
                            {new Date(colegio.inicioServicio).toLocaleDateString("es-CO")}
                            {colegio.finServicio ? ` — ${new Date(colegio.finServicio).toLocaleDateString("es-CO")}` : " — Sin fecha de fin"}
                        </p>
                    </div>
                </div>

                {/* Consulta pública (componente compartido con la home pública, O-2) */}
                <section aria-label="Consulta pública">
                    <ConsultaPublica />
                </section>

                {/* Resumen de estadísticas (componente compartido con /dashboard-publico, D-b) */}
                <PublicDashboard
                    variant="resumen"
                    titulo="Panorama de la plataforma"
                    subtitulo="Reportes agregados y anonimizados de toda la plataforma. La vista ampliada está en Estadísticas."
                />
            </div>
        </main>
    );
}
