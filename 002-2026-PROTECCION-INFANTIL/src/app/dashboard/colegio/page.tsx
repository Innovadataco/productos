import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

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
        <>
            <main className="min-h-screen p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="rounded-2xl glass p-6 sm:p-8">
                        <div className="mb-6 flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl accent-gradient text-white text-2xl shadow-lg">
                                🏫
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-body">{colegio.nombre}</h1>
                                <p className="text-sm text-muted">Panel institucional</p>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-xl glass-input p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Ubicación</p>
                                <p className="mt-1 text-sm text-body">
                                    {colegio.ciudad?.nombre}
                                    {colegio.departamento ? `, ${colegio.departamento.nombre}` : ""}
                                    {colegio.pais ? ` — ${colegio.pais.nombre}` : ""}
                                </p>
                                {colegio.direccion && <p className="mt-1 text-sm text-muted">{colegio.direccion}</p>}
                            </div>

                            <div className="rounded-xl glass-input p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Representante legal</p>
                                <p className="mt-1 text-sm text-body">{colegio.representanteLegalNombre}</p>
                                <p className="text-sm text-muted">{colegio.representanteLegalEmail}</p>
                            </div>

                            <div className="rounded-xl glass-input p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Vigencia del servicio</p>
                                <p className="mt-1 text-sm text-body">
                                    {new Date(colegio.inicioServicio).toLocaleDateString("es-CO")}
                                    {" — "}
                                    {colegio.finServicio ? new Date(colegio.finServicio).toLocaleDateString("es-CO") : "Sin fecha de fin"}
                                </p>
                                <p className="mt-1 text-xs text-muted uppercase">{colegio.tipoPeriodo}</p>
                            </div>

                            <div className="rounded-xl glass-input p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Administrador de acceso</p>
                                <p className="mt-1 text-sm text-body">{usuario.nombre || usuario.email}</p>
                                <p className="text-sm text-muted">{usuario.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Link
                            href="/dashboard/colegio/cursos"
                            className="rounded-2xl glass p-6 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                        >
                            <div className="text-2xl">📚</div>
                            <h2 className="mt-3 text-lg font-semibold text-body">Cursos</h2>
                            <p className="mt-1 text-sm text-muted">Gestiona cursos y alumnos.</p>
                        </Link>

                        <Link
                            href="/dashboard/colegio/cursos/carga"
                            className="rounded-2xl glass p-6 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                        >
                            <div className="text-2xl">📥</div>
                            <h2 className="mt-3 text-lg font-semibold text-body">Carga masiva</h2>
                            <p className="mt-1 text-sm text-muted">Sube alumnos e identificadores desde Excel/CSV.</p>
                        </Link>

                        <Link
                            href="/dashboard/colegio/alertas"
                            className="rounded-2xl glass p-6 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                        >
                            <div className="text-2xl">🚨</div>
                            <h2 className="mt-3 text-lg font-semibold text-body">Alertas</h2>
                            <p className="mt-1 text-sm text-muted">Revisa alertas anonimizadas del colegio.</p>
                        </Link>

                        <Link
                            href="/dashboard/colegio/estadisticas"
                            className="rounded-2xl glass p-6 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30"
                        >
                            <div className="text-2xl">📊</div>
                            <h2 className="mt-3 text-lg font-semibold text-body">Estadísticas</h2>
                            <p className="mt-1 text-sm text-muted">Resumen agregado y PDF institucional.</p>
                        </Link>
                    </div>
                </div>
            </main>
        </>
    );
}
