# Plan — Spec 043: UX del comité y navegación del padre

## Fase 1: Análisis y diseño UX

- P1.1 Revisar `NavHeader`, `DashboardUsuarioClient`, `ComiteBandeja`, `ComiteSolicitudDetalle`, `resolver` y `circulo-confianza/page.tsx`.
- P1.2 Consultar `/skill:ui-ux-pro-max` para patrones de navegación de padres, listas unificadas y flujos de resolución. (Hecho: se recomienda glassmorphism, colores rojo/alerta + azul/seguridad, Fira Sans, evitar navegación sobrecargada, usar listas unificadas con estados visibles.)
- P1.3 Decidir: para el padre, el botón "Dashboard" del header variará según autenticación (`/dashboard` si está autenticado, `/dashboard-publico` si no). El menú desplegable del padre añadirá "Mi panel" → `/dashboard`. No se duplica la vista.
- P1.4 Decidir: para el comité, la bandeja será una sola lista con estado por fila; el detalle de un caso pendiente se abrirá con un estado de "Asignando..." y luego mostrará el resolver. Si otro comité lo tomó, mostrar solo lectura.
- P1.5 Decidir: el resolver elimina `accion` y siempre usa `CORREGIDO`; el body enviará solo `categoria` y `resolucion` opcional.

## Fase 2: Navegación del padre (US1)

- P2.1 En `NavHeader.tsx`, cambiar el `href` del botón "Dashboard" para usuarios autenticados con rol `PARENT` a `/dashboard`; anónimos permanecen en `/dashboard-publico`.
- P2.2 En el menú desplegable del `PARENT`, añadir enlace "Mi panel" → `/dashboard` (antes o junto a "Mis reportes").
- P2.3 En el menú móvil, añadir el mismo enlace para `PARENT`.
- P2.4 Agregar test de componente o verificación manual de que el enlace lleva a `/dashboard`.

## Fase 3: Bandeja unificada del comité (US2)

- P3.1 Eliminar estado `tab` y las pestañas en `ComiteBandeja.tsx`.
- P3.2 Cambiar el endpoint a `/api/admin/comite/pendientes` (o un nuevo endpoint que devuelva todas las solicitudes del comité sin importar estado). Si no existe, se planea crear `/api/admin/comite/solicitudes`.
- P3.3 Al hacer clic en "Ver" de un caso `PENDIENTE`, llamar a `/api/admin/comite/${id}/asignar` y esperar la respuesta antes de abrir el detalle; refrescar la lista.
- P3.4 Si el caso está `ASIGNADO` a otro comité, mostrar el detalle en modo solo lectura o deshabilitar el botón de resolver.
- P3.5 Actualizar tests de `ComiteBandeja` si existen, o agregar tests de componente.

## Fase 4: Resolver simplificado (US3)

- P4.1 En `ComiteSolicitudDetalle.tsx`, eliminar los radio buttons "Clasificar/Corregir" y el estado `accion`.
- P4.2 Cambiar el título del panel a "Resolver solicitud" y el botón a "Resolver".
- P4.3 Ajustar el body de la llamada a `/api/admin/comite/${id}/resolver` para enviar solo `categoria` y `resolucion`.
- P4.4 En `src/app/api/admin/comite/[id]/resolver/route.ts`, eliminar `accion` del schema y siempre usar `CORREGIDO` como estado nuevo. Actualizar siempre `ClasificacionIA.categoria` y `confianza = 1.0`.
- P4.5 Actualizar el mensaje de éxito: "Solicitud resuelta. El reporte pasó a CORREGIDO.".
- P4.6 Actualizar los tests de `resolver` para esperar `CORREGIDO` en todos los casos.

## Fase 5: Copy del Círculo de Confianza (US4)

- P5.1 Reemplazar el texto en `src/app/dashboard/circulo-confianza/page.tsx` línea 364 por el texto propuesto.
- P5.2 Verificar que el contraste y legibilidad se mantienen en modo claro y oscuro.

## Fase 6: Tests, validación y cierre

- P6.1 Ejecutar `npx tsc --noEmit`.
- P6.2 Ejecutar `npm run lint`.
- P6.3 Ejecutar `npm run test`.
- P6.4 Ejecutar `rm -rf .next && npm run build`.
- P6.5 Ejecutar `./scripts/dev-restart.sh` y healthcheck.
- P6.6 Ejecutar el `quickstart.md` de punta a punta.
- P6.7 Actualizar `spec.md` con sección Implementación.
- P6.8 Crear `docs/cierre-043.md`.
- P6.9 Validar checklist de requisitos.
- P6.10 Commits: uno por US + uno de docs; push a `feature/001-scaffolding`.

---

## Orden y dependencias

- Fase 1 → Fase 2, 3, 4, 5 (pueden ejecutarse en paralelo).
- Fase 3 depende ligeramente de Fase 4 (la asignación solo tiene sentido si el resolver funciona), pero los cambios de UI son independientes.
- Fase 6 depende de todas las anteriores.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Cambiar el botón "Dashboard" del header afecta a anónimos | Condicionar por autenticación/rol; anónimos siguen a `/dashboard-publico`. |
| Auto-asignación en el detalle puede causar colisión | El backend ya retorna 409 si no está `PENDIENTE`; la UI maneja el error. |
| Eliminar `accion` rompe tests existentes | Actualizar tests como parte del spec. |
| Usuarios confunden el nuevo flujo "Resolver" | Añadir copy claro en el detalle: "Elige la categoría final del caso". |

---

## Notas

- No se requieren migraciones de Prisma.
- No se toca el modelo de datos.
- No se modifica el clasificador/eval ni la lógica de privacidad.
- Se siguen las recomendaciones de UI/UX Pro Max: glassmorphism, colores rojo/alerta + azul/seguridad, Fira Sans, focus/hover/reduced-motion, listas unificadas.
