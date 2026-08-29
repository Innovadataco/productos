# Modelo de datos: SPEC-155

## Sin cambios en schema.prisma

Reutiliza:

- `TransicionReporte`
- `ReintentoReporte`

## Tipos TypeScript

```ts
interface EventoProceso {
    id: string;
    tipo: "TRANSICION" | "REINTENTO";
    fecha: string;
    estadoAnterior?: string;
    estadoNuevo?: string;
    responsableTipo?: string;
    responsableId?: string;
    intento?: number;
    exitoso?: boolean;
    error?: string;
    motivo?: string;
}
```
