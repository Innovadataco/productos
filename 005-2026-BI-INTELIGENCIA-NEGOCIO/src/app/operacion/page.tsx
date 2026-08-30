import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./operacion.css";
import { exigirSesionBi } from "@/lib/auth/guard-bi-sesion";
import { leerOperacion } from "@/lib/bi/operacion";
import { BarraOperacion } from "@/components/bi/operacion/BarraOperacion";
import { EquiposChips } from "@/components/bi/operacion/EquiposChips";
import { TablaFuncionalidades } from "@/components/bi/operacion/TablaFuncionalidades";
import { TablaRecorridos } from "@/components/bi/operacion/TablaRecorridos";
import { AvisoSinDatos } from "@/components/bi/operacion/AvisoSinDatos";

// SPEC-033 · lee el JSON en CADA request: editar el archivo + recargar refleja
// el cambio sin redeploy (candado del INSTRUCTIVO · evidencia §6(e) tablero vivo).
export const dynamic = "force-dynamic";

// IBM Plex del artefacto, auto-hosteadas por next/font → compatibles con la CSP
// `font-src 'self'` (no dependen de Google Fonts en runtime · D-033.3).
const plexSans = IBM_Plex_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-plex-sans",
    display: "swap",
});
const plexMono = IBM_Plex_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-plex-mono",
    display: "swap",
});

const PIE_DEFAULT =
    "BI congelado · Fechas en hora de Colombia · Tablero mantenido por el CEO.";

export default async function OperacionPage() {
    // SPEC-035 · guard ANTES de leer/renderizar datos: si no hay sesión,
    // redirect() corta aquí y el RSC del tablero NUNCA se rendriza ni streamea
    // (el guard en el layout hermano no basta: el page renderiza en paralelo
    // y su flight data se filtraría en el body del 307). I-33.
    await exigirSesionBi("/operacion");
    const r = await leerOperacion();

    return (
        <div className={`op ${plexSans.variable} ${plexMono.variable}`}>
            <div className="wrap">
                <BarraOperacion
                    titulo={r.ok ? r.data.titulo : null}
                    actualizado={r.ok ? r.data.actualizado : null}
                    commit={r.ok ? r.data.commitProduccion : null}
                />

                {r.ok ? (
                    <>
                        <EquiposChips equipos={r.data.equipos} />
                        <TablaFuncionalidades f={r.data.funcionalidades} />
                        <TablaRecorridos r={r.data.recorridos} />
                        <footer>
                            {r.data.notaPie && r.data.notaPie.trim()
                                ? r.data.notaPie
                                : PIE_DEFAULT}
                        </footer>
                    </>
                ) : (
                    <AvisoSinDatos motivo={r.motivo} />
                )}
            </div>
        </div>
    );
}
