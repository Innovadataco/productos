# Implementation Plan: Cómo le habla PI al padre (parte independiente)

**Branch**: `work/pi-SPEC-326-lenguaje-padre` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: SPEC-326 · 002-PI-226 · Brief A-62. Base `origin/main` (0bc324054, trae A-56/A-57/A-58/A-61).

## Summary

Hacer que el área del padre "hable" al padre no técnico. Cuatro frentes independientes: §3.1 reescribe la pantalla de preferencias de notificaciones a frases (2 toggles reales + bloque forzado, mapeados a eventos reales; diseño CEO-aprobado); §3.4 construye el perfil del padre (nombre/correo/teléfono/país/ciudad + cambiar-contraseña) con cambio de correo seguro (verificar el nuevo + avisar al viejo); §3.5 agrega país/ciudad al registro; §3.6 corrige el menú. §3.2/§3.3 quedan fuera (dependen de A-60/A-61).

## Technical Context

**Language/Version**: TypeScript 5.x / Next.js 15 (App Router), React 19
**Primary Dependencies**: Prisma 5.22 (PostgreSQL), `jose` (auth), Tailwind + design tokens (Instrument/anillos), Vitest
**Storage**: PostgreSQL. Migración aditiva a `Usuario`: `telefono String?`, `ciudadId String?`, `paisId String?`, `emailNuevoPendiente String?`, y verificación del correo nuevo vía `CodigoVerificacion` existente (o campos `tokenCambioEmail`/expiración — se decide en data-model). Todo nullable, sin backfill.
**Testing**: Vitest unit (pantalla de notificaciones = lógica de catálogo pura; perfil/registro = integration con BD).
**Target Platform**: Web móvil-first (la mayoría de padres entran por teléfono). Verificación §6 en producción con capturas.
**Project Type**: Monolito Next.js (DAL frontier Q-3: Prisma solo por repositorios).
**Constraints**: NO tocar el motor de notificaciones/reglas/plantillas (solo-lectura); NO tocar I-221 (rol PADRE/PARENT); usar el sistema de diseño existente. Cambio de correo = identidad → verificación obligatoria del nuevo + aviso al viejo.
**Scale/Scope**: 4 sub-features · 1 pantalla reescrita (notificaciones) + 1 pantalla nueva (perfil) + 2 campos de registro + cambios de menú + 1 migración aditiva.

## Constitution Check

- **Spec Kit en todo** ✅ — spec+plan+tasks+analyze antes de implementar.
- **DAL frontier (Q-3)** ✅ — acceso a `Usuario`/catálogo por repositorios; sin Prisma directo en rutas.
- **Verde ≠ funciona** ✅ — evidencia §6 con capturas en producción, móvil.
- **Migración aditiva/reversible** ✅ — columnas nullable, sin backfill.
- **arch:check** — §3.4 agrega la ruta real `/dashboard/padre/perfil` (hoy placeholder) + endpoints de perfil/cambio-correo → **regenerar `02-roles-capacidades.md`**; §3.4/§3.5 tocan esquema → **regenerar `01-modelo-datos.md`**. Se verifica en implement.
- **No tocar solo-lectura** ✅ — motor de notificaciones, `src/lib/ai/**`, workflows, deploy intactos.
- **Reuso, no paralelo** ✅ — `CodigoVerificacion`, `CiudadSearchSelect`, patrón de aviso A-59, tokens de diseño.

Sin violaciones → Complexity Tracking vacío.

## Project Structure

```text
src/
├── app/dashboard/perfil/notificaciones/page.tsx      # §3.1 (fuente única; /dashboard/padre/notificaciones re-exporta)
├── components/modules/perfil/PreferenciasNotificaciones.tsx  # §3.1 reescritura a frases (catálogo curado)
├── app/dashboard/padre/perfil/page.tsx               # §3.4 pantalla real (hoy placeholder)
├── components/modules/padre/PerfilPadre*.tsx         # §3.4 UI del perfil + cambio de correo
├── app/api/padre/perfil/route.ts                     # §3.4 GET/PATCH datos del perfil (nombre/telefono/pais/ciudad)
├── app/api/padre/perfil/cambiar-email/route.ts       # §3.4 solicitar (verifica nuevo) + confirmar
├── app/registro/page.tsx + VerificacionForm          # §3.5 país/ciudad en el paso completar
├── app/api/auth/verificar/completar/route.ts         # §3.5 recibe paisId/ciudadId
├── lib/nav-items.ts (PADRE_NAV_ITEMS)                # §3.6 "Mis reportes" + "Mi perfil" en lateral
├── components/modules/NavHeader.tsx                   # §3.6 coherencia lateral (verificar A-56/A-57)
prisma/schema.prisma + migrations/                    # §3.4/§3.5 migración aditiva a Usuario
```

**Structure Decision**: Reutiliza la pantalla de preferencias existente (fuente única `perfil/notificaciones`), reconstruye la de perfil sobre la ruta placeholder, y extiende el flujo de registro/verificación existente. Un módulo de catálogo curado de notificaciones (frase→evento) alimenta §3.1 sin tocar el motor.

## Fases de entrega (para el PARA · decide Fábrica 1 PR o secuenciado)

- **Fase A — §3.1** (notificaciones): sin migración; pura reescritura de la pantalla sobre un catálogo curado. Desplegable sola.
- **Fase B — §3.5** (país/ciudad registro) + migración `Usuario.ciudadId/paisId`.
- **Fase C — §3.4** (perfil + cambio de correo) + migración `Usuario.telefono` + correo pendiente.
- **Fase D — §3.6** (menú): apunta a la pantalla de §3.4; va con C o al final.

§3.2/§3.3 NO están: esperan A-60/A-61.

## Complexity Tracking

Sin violaciones de constitución que justificar.
