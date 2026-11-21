import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { ColegioResumenRepository } from "@/lib/dal/repositories/colegio-resumen";
import { resolverEstado, colorDeEstadoColegio } from "@/lib/colegio/semaforo";
import { OrbitaColegioMapa } from "@/components/modules/colegio/orbita/OrbitaColegioMapa";

/**
 * SPEC-965 (FORMA Órbita) — overview radial del colegio POR CAPAS. Es una VISTA APARTE del panel del
 * colegio (no toca la home ni el camino de alta). Misma autorización que la home del rector
 * (SPEC-571): `verifyToken` + `findSesionColegio`; sin `colegioId` de sesión → /login. La capa 1 sale
 * de UNA llamada a `orbitaColegio` (SPEC-964); el color del centro es la ley del inicio (pino/ámbar).
 */
export default async function MapaColegioPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const [orbita, ficha] = await Promise.all([
        new ColegioResumenRepository().orbitaColegio(usuario.colegioId),
        new ColegioRepository().obtenerFichaHome(usuario.colegioId),
    ]);

    const colorColegio = colorDeEstadoColegio(resolverEstado(orbita.semaforo));

    return (
        <OrbitaColegioMapa
            colegioNombre={ficha?.nombre ?? "Mi colegio"}
            colorColegio={colorColegio}
            orbita={orbita}
        />
    );
}
