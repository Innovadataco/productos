import Link from "next/link";

export const metadata = {
    title: "Sin conexión — Protección Infantil",
};

export default function OfflinePage() {
    return (
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sin conexión</h1>
            <p className="mt-3 text-sm text-slate-600">
                Parece que no tienes acceso a internet. Algunas funciones no están disponibles sin conexión.
            </p>
            <Link
                href="/"
                className="mt-6 inline-flex rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
                Volver al inicio
            </Link>
        </main>
    );
}
