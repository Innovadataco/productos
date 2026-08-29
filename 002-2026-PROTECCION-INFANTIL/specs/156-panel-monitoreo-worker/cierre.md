# Cierre: SPEC-156 — Panel de monitoreo del worker

## Estado

🟢 Implementado.

## Resumen

Se entrega el panel de monitoreo del worker para ADMIN en `/dashboard/admin/monitoreo/worker`, reutilizando el endpoint existente `GET /api/health/worker`. La interfaz es solo lectura: muestra estado general, señal del worker, conexión a base de datos y timestamp de la última lectura, con refresco automático cada 30 s. No incluye botones de reinicio, detención ni purga.

## Cambios entregados

- `src/lib/permisos-catalogo.ts`: módulo `monitoreo_worker` con grant para `ADMIN`.
- `src/lib/nav-items.ts`: entrada de navegación en el área de administración.
- `src/app/dashboard/admin/monitoreo/worker/page.tsx`: página server con verificación de acceso.
- `src/components/modules/MonitoreoWorkerClient.tsx`: UI cliente, polling y presentación de estado.
- `src/lib/permisos-modulos.test.ts`: cobertura de que ADMIN tiene acceso y OPERADOR no.
- `src/lib/proxy.test.ts`: cobertura de redirect para roles no internos en ruta admin-only.
- `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md`: regenerados.
- `scripts/arch/rutas-app.test.ts`: oráculo actualizado de 59 a 60 páginas.
- `specs/156-panel-monitoreo-worker/spec.md`: status a IMPLEMENTADO y sección de implementación.
- `specs/README.md`: SPEC-156 marcada como Implementada en ambas tablas.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (42 warnings heredados, 0 errores)
- `npm run tokens:check` ✅ (1130 ≤ 1135)
- `npm run arch:check` ✅
- `npm run test:coverage` ✅
- `npm run build` ✅

## Evidencia de integración

- Rama: `work/002-pi-058`
- PR: #37
- Hash de merge: `ef446d8a`
- CI-PUSH: `31368586175` ✅
