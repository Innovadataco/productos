# Quickstart: SPEC-135 — círculo de confianza modular

## Importar (igual que antes)

```ts
import { listarContactos, agregarContacto } from "@/lib/dal/services/circulo-confianza";
import type { EstadoContacto } from "@/lib/dal/services/circulo-confianza";
```

El barrel (`circulo-confianza/index.ts`) reexporta toda la API pública. NO importar de
los submódulos directamente (`./contactos`, `./estado`…) — son internos.

## Dónde vive cada cosa

| Necesitas… | Módulo |
|---|---|
| Estado de un contacto, umbrales, tope | `estado.ts` |
| CRUD de contactos e identificadores | `contactos.ts` |
| Vista agregada del círculo | `agregado.ts` |
| Preferencias de notificación | `preferencias.ts` |
| Notificación al clasificar un reporte | `notificaciones.ts` |
| Tipos compartidos | `tipos.ts` |

## Regla anti-N+1

Listados de N entidades con datos derivados: UNA query para las N + UNA query para los
datos derivados de todos los valores + agrupación en memoria. Prohibido `Promise.all(
items.map(…query…))`.
