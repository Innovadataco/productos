interface Props {
    motivo: "ausente" | "invalido";
}

// Degradación clara (candado 9/25): nunca pantalla en blanco ni stack trace.
// La barra con el reloj vivo se sigue mostrando arriba de este aviso.
const MENSAJES: Record<Props["motivo"], string> = {
    ausente:
        "El tablero aún no tiene datos: no se pudo leer operacion.json. En cuanto el CEO publique el archivo, esta pantalla lo mostrará al recargar.",
    invalido:
        "El archivo operacion.json existe pero no se pudo interpretar (JSON inválido). Se mostrará en cuanto el contenido sea válido.",
};

export function AvisoSinDatos({ motivo }: Props) {
    return (
        <div className="aviso" data-testid="aviso-sin-datos">
            <b>Sin datos por ahora</b>
            <span>{MENSAJES[motivo]}</span>
        </div>
    );
}
