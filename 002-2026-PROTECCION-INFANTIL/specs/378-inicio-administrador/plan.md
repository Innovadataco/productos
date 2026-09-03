# SPEC-378 · Plan

1. **Diagnóstico 15v5**: leer `INVENTARIO-SENALES-OPERACION.md` (PI-2, gestión),
   el servicio `monitor` en `docker-compose.prod.yml`, `scripts/monitor-probes.mjs`,
   la tabla `HealthProbe` y las pantallas admin existentes. Confirmar que el
   dato está y que no hay una pantalla equivalente ya.
2. Aprobación de plan por el CEO ANTES de codificar (chat).
3. **Módulo `inicio_admin`**: añadir a `CATALOGO_MODULOS` (orden 5) — el seed
   lo otorga a ADMIN por default.
4. **Servicio agregador** `src/lib/dal/services/inicio-admin.ts`:
   - Lee la última fila por señal de `HealthProbe` (infra).
   - Calcula en vivo S1..S7 con queries mínimas.
   - Devuelve `{ alertas, ok, generadoEn, latenciaMs }` — el `latenciaMs`
     lo consumen el propio test y el CEO para vigilar el rendimiento.
   - `Promise.allSettled`: un fallo de una señal no tumba la pantalla.
   - Orden determinístico: `alta` antes que `media`, empate por `id`.
5. **Endpoint** `GET /api/admin/inicio/senales/route.ts`: verifyAuth ADMIN +
   `assertModulo("inicio_admin")` + `Cache-Control: no-store`.
6. **Página server component** `/dashboard/admin/inicio/page.tsx`: vacío →
   «Todo tranquilo», con alertas → dos secciones (Urgente/Requiere revisión)
   + tarjetas ámbar con link «Resolver». `export const dynamic = "force-dynamic"`.
7. **Redirect** en `/dashboard/admin/page.tsx`: si el admin tiene
   `inicio_admin`, redirige a `/inicio` antes de la lógica actual.
8. **Nav**: añadir «Inicio» como primer item de `ADMIN_NAV_ITEMS`.
9. **Umbrales sembrados idempotentes** en `prisma/seed.ts` con `update:{}`.
10. **Tests**:
    - Endpoint (integration): vacío, huérfanos por antigüedad, correos con
      cuota (alta), volumen sin cuota (media), ordenamiento por prioridad,
      sin auth (401), rol PARENT (401/403).
    - Página (unit, jsdom, mocks): sin módulo → SinAcceso, alertas vacías →
      texto de calma, alta+media → dos secciones + links `Resolver` + acento
      ámbar + cero rojo, subtítulo cuenta N alertas y N urgentes.
11. **Gate**: `tsc --noEmit` limpio, lint 0 errores, unit + integration verdes.
