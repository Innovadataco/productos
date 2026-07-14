"use client";

type Distribucion = Record<string, number>;

type Resultado = {
    identificador: string;
    plataforma: string;
    tieneReportes: boolean;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    distribucion?: {
        porCiudad: Distribucion;
        porPais: Distribucion;
        porMes: Distribucion;
    };
    mensaje?: string;
};

export function ConsultaResultado({ data }: { data: Resultado }) {
    if (!data.tieneReportes) {
        return (
            <div className="glass rounded-2xl p-8 text-center animate-floatUp">
                <p className="text-lg text-slate-600">{data.mensaje || "Sin reportes registrados para este identificador."}</p>
            </div>
        );
    }

    const dist = data.distribucion;
    const topCiudad = dist?.porCiudad ? Object.entries(dist.porCiudad).sort((a, b) => b[1] - a[1])[0] : null;
    const topPais = dist?.porPais ? Object.entries(dist.porPais).sort((a, b) => b[1] - a[1])[0] : null;

    return (
        <div className="glass rounded-2xl p-6 animate-floatUp">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">
                    {data.identificador}
                </h2>
                <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                    {data.plataforma}
                </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <StatBox label="Total reportes" value={String(data.totalReportes ?? 0)} />
                <StatBox label="Autenticados" value={String(data.reportesAutenticados ?? 0)} />
                <StatBox label="Anónimos" value={String(data.reportesAnonimos ?? 0)} />
            </div>

            {topCiudad && (
                <p className="text-sm text-slate-600 mb-1">
                    Ciudad con más reportes: <strong className="text-slate-800">{topCiudad[0]}</strong> ({topCiudad[1]})
                </p>
            )}
            {topPais && (
                <p className="text-sm text-slate-600">
                    País: <strong className="text-slate-800">{topPais[0]}</strong>
                </p>
            )}

            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Esta información es de carácter estadístico y no constituye una verificación de culpabilidad.
            </div>
        </div>
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-white/50 p-4 text-center">
            <p className="text-2xl font-bold text-primary-700 font-mono">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
    );
}