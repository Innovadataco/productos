"use client";

import { DetallePadre } from "./components/DetallePadre";
import { DetalleRector } from "./components/DetalleRector";
import { DetalleOperador } from "./components/DetalleOperador";
import { DetalleComiteConvivencia } from "./components/DetalleComiteConvivencia";
import { DetalleComiteValidacion } from "./components/DetalleComiteValidacion";
import { DetalleAdmin } from "./components/DetalleAdmin";
import type { DetalleConsolidadoDto } from "@/lib/dal/types/usuarios-consolidado";

interface UsuarioDetalleClientProps {
    detalle: DetalleConsolidadoDto;
}

export default function UsuarioDetalleClient({ detalle }: UsuarioDetalleClientProps) {
    switch (detalle.rol) {
        case "PARENT":
            return <DetallePadre detalle={detalle} />;
        case "SCHOOL_ADMIN":
            return <DetalleRector detalle={detalle} />;
        case "OPERADOR":
            return <DetalleOperador detalle={detalle} />;
        case "COMITE_CONVIVENCIA":
            return <DetalleComiteConvivencia detalle={detalle} />;
        case "COMITE_VALIDACION":
            return <DetalleComiteValidacion detalle={detalle} />;
        case "ADMIN":
            return <DetalleAdmin detalle={detalle} />;
        default:
            return null;
    }
}
