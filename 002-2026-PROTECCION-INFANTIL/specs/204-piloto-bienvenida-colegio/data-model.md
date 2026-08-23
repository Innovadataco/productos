> DEPENDE DE: SPEC-201 (motor de notificaciones núcleo).

# Modelo de datos: SPEC-204 — Piloto Migración Bienvenida Colegio (002-PI-101)

## Resumen

No hay cambios de schema. SPEC-204 añade una plantilla y una regla semilla al modelo de SPEC-201.

## Semilla agregada

### Plantilla

| Campo | Valor |
|---|---|
| `clave` | `colegio.bienvenida.email` |
| `canal` | `EMAIL` |
| `asunto` | `Tu cuenta institucional está lista` |
| `cuerpoMarkdown` | Texto equivalente a `enviarEmailBienvenidaColegio` con variables `{{email}}`, `{{password}}`, `{{url}}` |
| `variablesSchema` | JSON Schema requiere `email`, `password`, `url` |

### Regla

| Campo | Valor |
|---|---|
| `evento` | `colegio.bienvenida` |
| `rol` | `SCHOOL_ADMIN` |
| `offset` | `+0m` |
| `canal` | `EMAIL` |
| `plantillaClave` | `colegio.bienvenida.email` |
| `obligatoria` | `true` |

## Uso

- `src/app/api/admin/colegios/route.ts` llama `motor.programar({ evento: "colegio.bienvenida", ... })`.
- `src/app/api/admin/colegios/[id]/reenviar-email/route.ts` hace lo mismo.
