import { ColegioNav } from "@/components/modules/colegio/ColegioNav";

export default function ColegioEstadisticasPage() {
    return (
        <div className="min-h-screen bg-page">
            <ColegioNav />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl rounded-2xl glass p-8 text-center">
                    <div className="text-4xl">📊</div>
                    <h1 className="mt-4 text-2xl font-bold text-body">Estadísticas</h1>
                    <p className="mt-2 text-muted">Esta funcionalidad estará disponible en la Fase 4.</p>
                </div>
            </main>
        </div>
    );
}
