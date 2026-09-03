# SPEC-400 · Tasks — PR 1 (cliente resiliente)

## Estado: CERRADO — PR 1 listo para revisión

- [x] Análisis de fuente: middleware.ts, guardias.ts, vigencia-cookie.ts, api/vigencia/refresh — reportado al CEO ANTES de codear.
- [x] Enumerar `/api/**` (275 endpoints) y clasificar por comportamiento (grupos A/B/C/D) — reportado al CEO.
- [x] Decisión de partición: PR 1 = cliente / PR 2 = cerrojo servidor — aprobada por CEO 03-09 11:15.
- [x] Worktree fresco `.worktrees/pi-SPEC-400` sobre `origin/main d832ec3db` + `npm install`.
- [x] `src/lib/http/sesion-refresh-interceptor.ts` — monkey-patch de `globalThis.fetch` con single-flight, bypass, idempotencia, clonado de Request.
- [x] `src/components/modules/SesionRefreshInterceptor.tsx` — client component que instala el parche.
- [x] `src/app/layout.tsx` — mount del componente en el layout raíz.
- [x] 10 tests unit `sesion-refresh-interceptor.test.ts` (jsdom) — todos pasan.
- [x] `spec.md` con Impacto en arquitectura, candados, referencias.
- [ ] `npm run test:unit` completo verde (validación pre-PR).
- [ ] `tsc` verde.
- [ ] `eslint` verde.
- [ ] PR abierto + rebase-check.
- [ ] Verificación en vivo en producción: request cualquiera después de 5 min de inactividad → DevTools muestra 401+SESION_ESTADO_REQUERIDO seguido de refresh+reintento transparente.

## Fuera de este PR

- SPEC-400b · cerrar el middleware para `/api/**` cuando `estado===null` con lista blanca (`/api/pagos/**`, `/api/session/ping`, `/api/vigencia/refresh`). Espera 24-48h en producción con PR 1 desplegado.
- Ficha nueva · `/api/webhooks/resend` cae 401 — posible pieza del misterio I-283 del correo caído.
- Ficha nueva · `/api/publico/verificar-pdf` cae 401 — verificar en prod primero antes de reabrir I-246.
