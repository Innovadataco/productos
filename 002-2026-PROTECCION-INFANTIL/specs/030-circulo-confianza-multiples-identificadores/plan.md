# Plan 030 — Rediseño del Círculo de Confianza

## Fases

### 1. Spec-Kit y validación (Tarea 2.1)

- Redactar `spec.md`, `plan.md`, `data-model.md` y `quickstart.md` en `specs/030-circulo-confianza-multiples-identificadores/`.
- Validar con el contexto actual del schema, lógica y UI.

### 2. Schema y migración (Tarea 2.2)

- Reemplazar `ContactoConfianza` actual por el nuevo modelo y crear `IdentificadorContacto`.
- Actualizar relaciones en `Usuario` y `Plataforma`.
- Generar migración con `prisma migrate dev --create-only`.
- Editar el SQL generado para:
  1. Renombrar la tabla vieja a `ContactoConfianzaViejo`.
  2. Crear las nuevas tablas.
  3. Copiar cada contacto viejo a un contacto nuevo con su identificador.
  4. Eliminar la tabla vieja.
- Aplicar la migración con `prisma migrate dev`.

### 3. Lógica de negocio (Tarea 2.3)

- Refactorizar `src/lib/circulo-confianza.ts`:
  - `determinarEstadoContacto` por `contactoId` (o lista de valores).
  - `listarContactos`, `agregarContacto`, `actualizarContacto`, `obtenerDetalleContacto`, `obtenerVistaAgregada`.
  - `notificarCambioCirculoSiCorresponde` buscando por valor sin plataforma.
  - Helpers de tope y umbral sin cambios.

### 4. Endpoints (Tarea 2.4)

- `src/app/api/circulo-confianza/route.ts`: aceptar array de identificadores en POST.
- `src/app/api/circulo-confianza/[id]/route.ts`: aceptar `identificadores` en PATCH.
- `agregado` y `preferencias` sin cambios de firma.

### 5. UI (Tarea 2.5)

- Adaptar `src/app/dashboard/circulo-confianza/page.tsx` a los nuevos tipos.
- Usar `GlassCard`, `Button`, `Input`, `Select`, `Badge`, `MetricCard`, `MiniList`, `BarChart`, `DonutChart`.
- Formulario de alta con botón para agregar más identificadores.
- Detalle por contacto con listado de identificadores y sus estados.

### 6. Tests (Tarea 2.6)

- Actualizar `src/lib/circulo-confianza.test.ts` al nuevo modelo.
- Actualizar `src/app/api/circulo-confianza/route.test.ts`.
- Agregar prueba obligatoria de WhatsApp + Minecraft.
- Corregir tests rotos por el cambio de schema.

### 7. Cierre y despliegue (Tarea 2.7)

- Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test`, `npx tsx scripts/smoke-e2e.ts`.
- Desplegar en `:5005` con rebuild limpio.
- Commits separados por bloque y push a `feature/001-scaffolding`.
- Escribir `cierre.md` con archivos tocados, tests, git log y validación en vivo.

## Dependencias

- Depende del modelo de reportes y plataformas existentes (no se tocan).
- Depende de `src/lib/parametros.ts` para los parámetros `circulo.max_contactos`, `circulo.umbral_agregacion` y `circulo.notificaciones.*`.
- Depende de `src/lib/email.ts` para `enviarAlertaCirculoConfianza`.

## Riesgos

- Pérdida de datos durante la migración si no se copia correctamente antes de eliminar la tabla vieja. Mitigación: renombrar antes de copiar y verificar conteos.
- Cambios en los tipos de Prisma Client que rompen la compilación. Mitigación: actualizar todos los usos de `contactoConfianza` y regenerar el cliente.
- Errores en tests por el cambio de firma de funciones. Mitigación: actualizar tests y correrlos antes de commit final.
