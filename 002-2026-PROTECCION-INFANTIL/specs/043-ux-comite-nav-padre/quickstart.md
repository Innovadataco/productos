# Quickstart — Spec 043: UX del comité y navegación del padre

## 1. Pre-requisitos

- Tener un usuario `PARENT` autenticado.
- Tener un usuario `COMITE_VALIDACION` activo.
- Tener al menos un reporte escalado al comité en estado `PENDIENTE`.
- El worker y la app deben estar corriendo.

## 2. Padre autenticado llega a su panel (US1)

1. Iniciar sesión como usuario `PARENT`.
2. En el header, verificar que el botón "Dashboard" apunta a `/dashboard` (no a `/dashboard-publico`).
3. Hacer clic en "Dashboard"; debe llegar a `/dashboard` y ver:
   - Sección "Mis reportes".
   - Sección "Consulta enriquecida".
4. En el menú desplegable del usuario (avatar), verificar que existe "Mi panel" → `/dashboard`.
5. En móvil, abrir el menú hamburguesa y verificar que existe el enlace a `/dashboard`.
6. Cerrar sesión y verificar que el botón "Dashboard" de un usuario anónimo sigue yendo a `/dashboard-publico`.

## 3. Comité ve bandeja unificada (US2)

1. Iniciar sesión como `COMITE_VALIDACION`.
2. Ir a `/dashboard/admin/comite`.
3. Verificar que no hay pestañas "Pendientes" ni "Mías"; solo hay una lista de casos.
4. Verificar que cada fila muestra: número, estado (`PENDIENTE`, `ASIGNADA`, `RESUELTA`), motivo, fecha y acción "Ver detalle".
5. Hacer clic en "Ver detalle" de un caso `PENDIENTE`.
6. Verificar que aparece un estado breve de "Asignando..." y luego se abre el detalle con el caso en estado `ASIGNADA`.
7. Refrescar la bandeja; el caso debe aparecer con estado `ASIGNADA` y asignado al comité logueado.

## 4. Comité resuelve con un solo botón (US3)

1. Desde el detalle de un caso asignado, verificar que no hay radio buttons "Clasificar/Corregir".
2. Verificar que hay un select de categoría y un botón "Resolver".
3. Seleccionar una categoría (puede ser igual o distinta a la original).
4. Opcionalmente escribir un motivo.
5. Hacer clic en "Resolver".
6. Verificar el mensaje de éxito: "Solicitud resuelta. El reporte pasó a CORREGIDO."
7. Verificar en la bandeja que el caso queda en `RESUELTA`.
8. Verificar en la base de datos que el reporte quedó en estado `CORREGIDO` y la transición tiene `responsableTipo = COMITE`:

```sql
SELECT "estadoNuevo", "responsableTipo"
FROM "TransicionReporte"
WHERE "reporteId" = '<reporte-id>'
ORDER BY "creadoEn" DESC
LIMIT 1;
```

Expected: `estadoNuevo = 'CORREGIDO'`, `responsableTipo = 'COMITE'`.

## 5. Copy del Círculo de Confianza (US4)

1. Iniciar sesión como `PARENT`.
2. Ir a `/dashboard/circulo-confianza`.
3. Verificar que el checkbox de notificaciones dice:
   > "Recibir un aviso por email cuando alguno de los contactos de mi Círculo de Confianza aparezca en un reporte."
4. Verificar que el texto se lee bien en modo claro y oscuro.

## 6. Tests automáticos

```bash
npx tsc --noEmit
npm run lint
npm run test
```

Expected: todos pasan (lint puede mostrar 1 warning heredado).

Run tests específicos:

```bash
npm run test -- src/components/modules/ComiteBandeja.test.tsx
npm run test -- src/app/api/admin/comite/[id]/resolver/route.test.ts
npm run test -- src/components/modules/NavHeader.test.tsx
```

## 7. Build y deploy

```bash
rm -rf .next
npm run build
./scripts/dev-restart.sh
```

Expected: app en `:5005`, healthcheck OK, un solo worker.

---

## Checklist

- [ ] Padre autenticado ve enlace a `/dashboard` en header y menú móvil.
- [ ] Anónimo sigue yendo a `/dashboard-publico`.
- [ ] `/dashboard` muestra Mis reportes + Consulta enriquecida.
- [ ] Comité ve una sola lista de casos sin pestañas.
- [ ] Abrir caso `PENDIENTE` lo auto-asigna al comité.
- [ ] Resolver no tiene opciones Clasificar/Corregir, solo un botón Resolver.
- [ ] Reporte queda siempre en `CORREGIDO` con `responsableTipo = COMITE`.
- [ ] Tests de `resolver` pasan con el nuevo comportamiento.
- [ ] Copy del Círculo de Confianza actualizado.
- [ ] `tsc`, `lint`, `test` y build pasan.
- [ ] Deploy limpio con un solo worker.
