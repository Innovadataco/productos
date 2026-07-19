# Cierre — Lote: bugs Spec 029 + Spec 030 + deploy limpio

## Tarea 1 · Bugs de Spec 029 (consulta pública + panel autenticado)

### Bugs corregidos
1. **CTA de registro en consulta pública**: `ConsultaPublicaClient.tsx` ahora detecta sesión activa con `useAuth`. Si el usuario es `PARENT`, muestra "Ver detalle completo" con acceso al dashboard; el muro de registro solo se muestra a usuarios anónimos.
2. **Tarjetas de Mis reportes no clickeables**: `MisReportesList.tsx` ahora tiene `role="button"`, foco visible y cursor pointer; al hacer clic abre `/seguimiento?numero=...` si hay código de seguimiento.
3. **Consulta enriquecida y mapa**: `ConsultaEnriquecidaClient.tsx` funciona de punta a punta; el mapa muestra ubicaciones aproximadas a nivel ciudad sin direcciones exactas.

### Archivos tocados
- `src/components/modules/ConsultaPublicaClient.tsx`
- `src/components/modules/ConsultaPublicaClient.test.tsx`
- `src/components/modules/MisReportesList.tsx`
- `src/components/modules/ConsultaEnriquecidaClient.test.tsx` (nuevo)
- `specs/029-redisenio-consulta-panel-usuario/cierre.md`

### Commit
```
4b24ad3 fix(029): corrige bugs de consulta pública y panel autenticado
391a813 docs(029): actualiza cierre con bugs corregidos en Tarea 1
```

---

## Tarea 2 · Spec 030 · Rediseño del círculo de confianza (contacto = persona con múltiples identificadores)

### Qué se implementó
- **Nuevo modelo**: `ContactoConfianza` representa una persona (etiqueta, nota, activo); `IdentificadorContacto` guarda cada valor (teléfono/nick/usuario) con su tipo y plataforma opcional.
- **Migración de datos**: cada contacto anterior se convirtió en un `ContactoConfianza` nuevo con su `IdentificadorContacto` correspondiente, sin pérdida de datos.
- **Fix de seguridad de menores**: el círculo ahora busca reportes por `identificador` solamente, sin filtrar por plataforma. Un reporte en Minecraft se detecta aunque el contacto también tenga WhatsApp.
- **Estado y alertas**: el estado del contacto es el agregado de todos sus identificadores; las notificaciones email se disparan si cualquier identificador activo aparece en un reporte visible.
- **UI**: formulario de contacto permite agregar múltiples identificadores; el detalle muestra cada identificador con su estado y reportes.
- **Spec-Kit**: `specs/030-circulo-confianza-multiples-identificadores/` con `spec.md`, `plan.md`, `data-model.md`, `quickstart.md`, `cierre.md`.

### Archivos principales
- `prisma/schema.prisma`
- `prisma/migrations/20260719030000_circulo_confianza_multiples_identificadores/migration.sql`
- `src/lib/circulo-confianza.ts`
- `src/lib/circulo-confianza.test.ts`
- `src/app/api/circulo-confianza/route.ts`
- `src/app/api/circulo-confianza/[id]/route.ts`
- `src/app/api/circulo-confianza/route.test.ts`
- `src/app/dashboard/circulo-confianza/page.tsx`
- `specs/030-circulo-confianza-multiples-identificadores/`

### Commits
```
039d722 docs(030): spec-kit circulo de confianza multi-identificador
d5e01a2 feat(db): migration circulo de confianza multi-identificador
c634e41 feat(circulo): logica de negocio multi-identificador
d49e9ab feat(api): endpoints circulo ajustados a multi-identificador
7859c7e feat(ui): dashboard circulo multi-identificador con design system
90cac6f test(circulo): tests actualizados al modelo multi-identificador
eeb1b63 docs(030): cierre de spec con despliegue y validacion
```

### Prueba obligatoria validada en vivo
Contacto "Tío" con identificadores `3000WHATSAPP` (WhatsApp) y `3000MINECRAFT` (Minecraft). Se creó un reporte `CLASIFICADO` en el identificador de Minecraft. El detalle del contacto mostró:
- Estado del contacto: `clasificado`.
- Identificador WhatsApp: `sinReportes` (0 reportes).
- Identificador Minecraft: `clasificado` (1 reporte).
- El reporte apareció en el detalle sin exponer datos del denunciante.

---

## Tarea 3 · Verificación de deploy (build limpia)

### Proceso seguido
1. Maté todos los procesos previos (incluyendo dos workers huérfanos que quedaron de un despliegue anterior).
2. Ejecuté `rm -rf .next && npm run build` para asegurar que `next start` sirva la build nueva.
3. Reinicié app (`npx next start -p 5005 -H 0.0.0.0`) y worker (`npm run worker`) con `nohup`.
4. Verifiqué que solo haya una instancia de app y una de worker.
5. Corrí `smoke-e2e.ts` y verifiqué `/api/health/worker`.

### Estado final
- App: `http://localhost:5005` responde 200.
- Worker: `/api/health/worker` responde `ok` (`workerAlive: true`, `dbOk: true`).
- Procesos activos: 1 `next start` y 1 `worker-supervisor` + 1 `worker-reportes`.
- `smoke-e2e.ts`: ✅ pasó.

---

## Suite de calidad final

- `npm run lint`: ✅ verde (1 warning preexistente en `src/lib/sms.ts`).
- `npx tsc --noEmit`: ✅ verde.
- `npm run build`: ✅ verde (tras `rm -rf .next`).
- `npm test`: ✅ 370 tests en 72 archivos, todos verdes.
- `npx tsx scripts/smoke-e2e.ts`: ✅ verde.

## Git

Rama: `feature/001-scaffolding`  
Push: realizado tras cada tarea.

```
eeb1b63 docs(030): cierre de spec con despliegue y validacion
90cac6f test(circulo): tests actualizados al modelo multi-identificador
7859c7e feat(ui): dashboard circulo multi-identificador con design system
d49e9ab feat(api): endpoints circulo ajustados a multi-identificador
c634e41 feat(circulo): logica de negocio multi-identificador
d5e01a2 feat(db): migration circulo de confianza multi-identificador
039d722 docs(030): spec-kit circulo de confianza multi-identificador
391a813 docs(029): actualiza cierre con bugs corregidos en Tarea 1
4b24ad3 fix(029): corrige bugs de consulta pública y panel autenticado
2eb59eb docs(029): cierre de spec con resultado de tests, despliegue y validación en vivo
```

## Nota sobre migración

La migración de la Spec 030 se aplicó con `prisma migrate deploy` en `proteccion_infantil` y `proteccion_infantil_test`. El flujo interactivo `prisma migrate dev` no pudo ejecutarse en el entorno no interactivo, por lo que la migración se generó con `prisma migrate diff` y versionó manualmente. Esto mantiene el historial de migraciones y los datos migrados, pero debe ser revisado si el equipo exige `migrate dev` de forma estricta.

## R7 (pipeline de clasificación)

No se modificó el pipeline de clasificación IA en ninguna de las tres tareas.
