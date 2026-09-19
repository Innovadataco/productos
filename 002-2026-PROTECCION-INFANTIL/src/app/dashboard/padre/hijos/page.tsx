import type { Metadata } from "next";
import { exigirPadre } from "@/lib/padre/guardia-padre";
import { listarHijosConEstado } from "@/lib/dal/services/hijos";
// SPEC-716 (Parte B): por ruta DIRECTA (no por el barril): el barril entra en la cadena de workers y
// estos servicios usan alias `@/lib/*` (I-88/SPEC-197). La pantalla no es worker → alias permitido.
import { listarCuentasReportadasPorOtros } from "@/lib/dal/services/hijos/reportes-ajenos";
import { listarCuentasQueReporte } from "@/lib/dal/services/hijos/reportes-propios-por-hijo";
import { obtenerHomePadre } from "@/lib/padre/home";
import { AQuienProtejoView, type AQuienProtejoData } from "@/components/modules/padre/AQuienProtejoView";

// SPEC-660 (Fase B) · «A quién protejo» pasa a ser la pantalla de ENTERARSE: el
// gráfico de cómo están los hijos + la línea de estado del motor + el hueco de
// cobertura, SIN formularios. El CRUD (registrar/editar) se mudó a Mi perfil ›
// «Menores de edad» (Fase C, #580). Esta es la que «cierra la puerta vieja»:
// antes montaba `MisHijos` (el formulario) acá.
export const metadata: Metadata = {
    title: "A quién protejo",
    description: "Cómo están los menores que proteges.",
};

export default async function PadreHijosPage() {
    const usuario = await exigirPadre();
    const [{ hijos, cuentasConReporte }, home, grupoA, grupoB] = await Promise.all([
        listarHijosConEstado(usuario.id),
        obtenerHomePadre(usuario.id, usuario.nombre ?? null),
        // SPEC-716 (Parte B): los dos grupos por hijo, cargados en el servidor (la cuenta no va a la URL).
        listarCuentasReportadasPorOtros(usuario.id), // «Sus cuentas» (reportes de OTROS)
        listarCuentasQueReporte(usuario.id), // «Cuentas que reportaste por ella» (reportes propios)
    ]);

    const datos: AQuienProtejoData = {
        hijos: hijos.map((h) => ({
            id: h.id,
            nombre: h.nombre,
            activo: h.estado === "activo",
            tieneCuentasActivas: h.identificadores.some((i) => i.activo),
            tieneReportes: h.tieneReportes,
        })),
        estadoClasificador: {
            motorVivo: home.estadoClasificador.motorVivo,
            ultimaVerificacionEn: home.estadoClasificador.ultimaVerificacionEn,
        },
        // SPEC-716 (Parte A · I-427): el conteo de CUENTAS con reporte visible, para la línea de estado.
        cuentasConReporte,
        // SPEC-716 (Parte B): los dos grupos por hijo.
        grupoA,
        grupoB,
        circulo: {
            personas: home.resumen.totalContactos,
            // «todas tranquilas» solo se afirma con motor VIVO y sin reportes en el
            // círculo — misma asimetría I-396: sin motor no se afirma la calma.
            todasTranquilas:
                home.estadoClasificador.motorVivo && home.resumen.enRevision === 0 && home.resumen.clasificados === 0,
        },
    };

    return (
        <main className="min-h-screen bg-page py-4">
            <AQuienProtejoView {...datos} />
        </main>
    );
}
