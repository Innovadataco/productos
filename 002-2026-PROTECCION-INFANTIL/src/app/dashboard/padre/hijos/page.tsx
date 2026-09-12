import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { listarHijos } from "@/lib/dal/services/hijos";
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
    const usuario = await verifyAuth("PARENT");
    const [hijos, home] = await Promise.all([
        listarHijos(usuario.id),
        obtenerHomePadre(usuario.id, usuario.nombre ?? null),
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
