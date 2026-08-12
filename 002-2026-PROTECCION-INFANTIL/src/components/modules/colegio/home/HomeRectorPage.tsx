import type { CSSProperties } from "react";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { resolverEstado } from "@/lib/colegio/semaforo";
import { fechaLargaES } from "@/lib/colegio/fechas-humano";
import type { HomeRector } from "@/lib/dal/repositories/colegio-resumen";
import { HeroEstado } from "./HeroEstado";
import { FranjaVigilancia } from "./FranjaVigilancia";
import { AnillosProteccion } from "./AnillosProteccion";
import { TendenciaReportes } from "./TendenciaReportes";
import { CursosQueMerecenMirada } from "./CursosQueMerecenMirada";
import { AccionesRapidas } from "./AccionesRapidas";

/**
 * SPEC-143 (FR-001) — Composición de la home operativa del rector (mockup §5.1):
 * saludo + fecha, declaración de estado, franja de vigilancia, KPIs (solo activos),
 * anillos de protección, tendencia, cursos que merecen mirada, acciones rápidas y
 * canales oficiales. Todo entra escalonado con la curva única (§4.5) y se calla;
 * reduced-motion lo apaga todo (media query global).
 */

/** Saludo por franja horaria (hora local del servidor). */
export function saludoSegunHora(hora: number): string {
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
}

function retardo(ms: number): CSSProperties {
    return { "--anim-retardo": `${ms}ms` } as CSSProperties;
}

interface HomeRectorPageProps {
    nombreUsuario: string;
    datos: HomeRector;
}

export function HomeRectorPage({ nombreUsuario, datos }: HomeRectorPageProps) {
    const estado = resolverEstado(datos.semaforo);
    const ahora = new Date();
    const { kpis } = datos;

    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
                <header className="anim-entrada">
                    <p className="text-lg font-semibold text-body">
                        {saludoSegunHora(ahora.getHours())}
                        {nombreUsuario ? `, ${nombreUsuario}` : ""}.
                    </p>
                    <p className="mt-0.5 text-sm text-muted">Hoy es {fechaLargaES(ahora)}.</p>
                </header>

                <div className="anim-entrada" style={retardo(70)}>
                    <HeroEstado estado={estado} />
                </div>

                <div className="anim-entrada" style={retardo(140)}>
                    <FranjaVigilancia
                        ultimaSenal={datos.ultimaSenal}
                        latidoSistema={datos.latidoSistema}
                        reportesSemana={kpis.reportesSemana}
                        deltaSemana={kpis.deltaSemana}
                    />
                </div>

                <section
                    aria-label="Cifras de tu colegio"
                    className="anim-entrada grid grid-cols-2 gap-3 lg:grid-cols-5"
                    style={retardo(210)}
                >
                    <TarjetaMetrica disposicion="panel" label="Estudiantes" value={kpis.estudiantes} sub="activos" />
                    <TarjetaMetrica disposicion="panel" label="Cursos" value={kpis.cursos} sub="activos" />
                    <TarjetaMetrica disposicion="panel" label="Profesores" value={kpis.profesores} sub="activos" />
                    <TarjetaMetrica
                        disposicion="panel"
                        label="Acudientes"
                        value={kpis.acudientes}
                        sub="activos"
                    />
                    <TarjetaMetrica
                        disposicion="panel"
                        label="Reportes este mes"
                        value={kpis.reportesMes}
                        sub={`${kpis.reportesSemana} esta semana`}
                    />
                </section>

                <div className="anim-entrada grid gap-5 sm:gap-6 lg:grid-cols-2" style={retardo(280)}>
                    <AnillosProteccion
                        vigilancia={datos.cobertura.vigilancia}
                        reaccion={datos.cobertura.reaccion}
                        estudiantes={kpis.estudiantes}
                        sinRedes={datos.cobertura.sinRedes}
                        sinContacto={datos.cobertura.sinContacto}
                        estado={estado}
                    />
                    <TendenciaReportes
                        semanal={datos.tendencia.semanal}
                        mensual={datos.tendencia.mensual}
                        anual={datos.tendencia.anual}
                    />
                </div>

                <div className="anim-entrada" style={retardo(350)}>
                    <CursosQueMerecenMirada cursos={datos.cursosMirada} />
                </div>

                <div className="anim-entrada" style={retardo(420)}>
                    <AccionesRapidas />
                </div>

                <div className="anim-entrada" style={retardo(490)}>
                    <CanalesOficiales />
                </div>
            </div>
        </main>
    );
}
