import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Términos de uso — Protección Infantil",
    description: "Términos y condiciones de uso de la plataforma de reportes comunitarios de protección infantil.",
};

export default function TerminosPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <article className="glass rounded-2xl p-6 sm:p-8">
                <h1 className="text-2xl font-bold text-slate-900">Términos de uso</h1>
                <p className="mt-2 text-sm text-slate-500">Última actualización: julio de 2026</p>

                <section className="mt-6 space-y-4 text-sm text-slate-700">
                    <p>
                        Al usar Protección Infantil aceptas estos términos. La plataforma permite consultar y reportar
                        identificadores asociados a conductas de riesgo para menores.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">1. Uso responsable</h2>
                    <p>
                        Los reportes deben ser veraces y basados en situaciones reales. Está prohibido reportar información
                        falsa, difamatoria o con fines de acoso.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">2. Naturaleza de la información</h2>
                    <p>
                        Los scores y niveles de riesgo son indicadores estadísticos generados a partir de reportes comunitarios.
                        No constituyen una verificación judicial ni una acusación formal.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">3. Moderación</h2>
                    <p>
                        Los administradores pueden corregir clasificaciones, anonimizar datos personales o rechazar reportes
                        que incumplan estas normas.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">4. Limitación de responsabilidad</h2>
                    <p>
                        Protección Infantil no reemplaza las denuncias ante autoridades competentes. Ante una situación de
                        riesgo real, contacta los canales oficiales de denuncia.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">5. Modificaciones</h2>
                    <p>
                        Nos reservamos el derecho de actualizar estos términos. Los cambios se publicarán en esta página con su
                        respectiva fecha de actualización.
                    </p>
                </section>
            </article>
        </main>
    );
}
