import type { Usuario } from "./tipos";

export interface ResultadoTenancy {
    permite: boolean;
    razon?: string;
    filtroSQL?: string;
}

export function evaluarTenancy(usuario: Usuario): ResultadoTenancy {
    if (!usuario || !usuario.rol) {
        return { permite: false, razon: "usuario_sin_rol" };
    }
    if (usuario.rol === "ADMIN") {
        return { permite: true };
    }
    return {
        permite: false,
        razon: "activacion_multi_tenant_diferida_a_INSTRUCTIVO_009",
    };
}
