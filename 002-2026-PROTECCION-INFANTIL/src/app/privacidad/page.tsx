import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Política de privacidad — Protección Infantil",
    description: "Política de privacidad de la plataforma de reportes comunitarios de protección infantil.",
};

export default function PrivacidadPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <article className="glass rounded-2xl p-6 sm:p-8">
                <h1 className="text-2xl font-bold text-slate-900">Política de privacidad</h1>
                <p className="mt-2 text-sm text-slate-500">Última actualización: julio de 2026</p>

                <section className="mt-6 space-y-4 text-sm text-slate-700">
                    <p>
                        En Protección Infantil nos comprometemos a proteger la información de quienes usan nuestra plataforma.
                        Esta política explica qué datos recopilamos, cómo los usamos y cuáles son tus derechos.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">1. Información que recopilamos</h2>
                    <p>
                        Recopilamos el identificador reportado (número, nick o usuario), la plataforma, la descripción del incidente,
                        la fecha, la ciudad y el país. Si creas una cuenta, también almacenamos tu nombre y correo electrónico.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">2. Anonimización</h2>
                    <p>
                        Los reportes anónimos no guardan información de contacto del reportante. Los textos que contengan datos
                        personales se anonimizan automáticamente antes de ser visibles para terceros.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">3. Uso de la información</h2>
                    <p>
                        Utilizamos la información para calcular scores de riesgo, mostrar estadísticas agregadas y generar
                        datasets de entrenamiento para mejorar los modelos de clasificación locales.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">4. Compartición</h2>
                    <p>
                        No vendemos ni compartimos datos personales con terceros. Solo mostramos información agregada y
                        anonimizada en las consultas públicas.
                    </p>

                    <h2 className="text-lg font-semibold text-slate-900">5. Tus derechos</h2>
                    <p>
                        Puedes solicitar la eliminación de tu cuenta o de datos personales escribiendo al administrador de la
                        plataforma.
                    </p>
                </section>
            </article>
        </main>
    );
}
