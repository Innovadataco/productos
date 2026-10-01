/**
 * SPEC-790 (T6) · Pantalla admin de carga MANUAL de verificación de habilitación (REPS).
 * Gate por módulo `admin_verificacion_profesionales` (guardia de SERVIDOR — no se esconde un botón).
 * La FORMA la da Diseño: FORMA-SPEC790-ADMIN-CARGA-VERIFICACION-HABILITACION v1.2 (commit 53844d0).
 *
 * Es la ENTRADA del sistema REPS: sin esta carga, la fuente del gate es un stub que nunca dice «vigente»,
 * así que ningún profesional queda fuera de la oferta ni vuelve. El estado REPS se DERIVA de la última fila
 * (no hay columna cacheada); por eso la lista se arma en el servidor con `listarParaCargaReps`.
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { CargaVerificacionRepsClient } from "@/components/modules/verificacion/CargaVerificacionRepsClient";

export const dynamic = "force-dynamic";

export default async function CargaRepsPage() {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    const profesionales = await new PerfilProfesionalRepository().listarParaCargaReps();
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Red de Apoyo</p>
                <h1 className="titular-h1 mt-1">Habilitación (REPS) de profesionales</h1>
                <p className="cuerpo text-subtle mt-2">
                    Registre lo que leyó en la fuente oficial. Usted <strong>copia</strong> el dato; no juzga al
                    profesional. Su transcripción enciende o apaga si el profesional puede ofrecerse a las familias.
                </p>
                <div className="mt-4 text-sm">
                    <Link
                        href="/dashboard/admin/verificacion"
                        className="rounded-full bg-tinta/5 px-4 py-1.5 font-medium text-body transition hover:bg-tinta/10"
                    >
                        ← Volver a verificación
                    </Link>
                </div>
            </header>
            <CargaVerificacionRepsClient profesionalesIniciales={profesionales} />
        </div>
    );
}
