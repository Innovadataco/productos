# Plan · SPEC-496

## Impacto en arquitectura
El módulo pasa de ser un adorno de menú a una segunda puerta real en el área del profesional. Alinea al profesional con el resto del producto (rol + módulo), sin cambiar el modelo de permisos ni la fuente única `CLAVES_POR_ROL`. Cierra un vector de degradación silenciosa en el panel de permisos.

## Análisis de fuente (Candado 15 v5, hecho antes de codificar)
- `assertModulo` (propio AND padre) y `puedeAccederAModulo` viven en `src/lib/permisos-modulos.ts`.
- Endpoints `/api/profesional/*`: 12 archivos. `perfil`/`autorizacion` usan `verifyAuth()` + check manual de rol dentro de `requireProfesional()` (no `verifyAuth("PROFESIONAL")`) — el `assertModulo` va dentro del helper.
- `documentos` gatea vía helper compartido `perfilDelProfesional()` (cubre GET+POST).
- Páginas: 5 son server components; `/perfil-profesional/completar` es `"use client"` (su gate es la API). Los layouts son «UI pura, no redirect» (SPEC-287) → el guard va por página, no en el layout.
- El área del profesional NO tenía endpoint para `casos` (los datos salen de `panelDelProfesional` en el server component) → `profesional_casos` se gatea en la página.

## Pasos
1. `assertModulo` en los 12 endpoints (import + llamada tras el guard de rol).
2. Guard de página (`puedeAccederAModulo` + `SinAccesoModulo`) en las 5 páginas server.
3. Borrar la mención al módulo fantasma en `schema.prisma`.
4. Comentar la decisión `comite_auditoria` (nav-items + seed).
5. Candado de conducta (integración) + candado de clase (unit, escaneo de fuente) + registrar el unit en `vitest.unit.includes.ts`.
6. Preflight + validación por mutación de ambos candados.

## Riesgos y mitigación
- **Romper onboarding del profesional:** los grants son por ROL (sembrados), no por perfil; cualquier PROFESIONAL tiene los 6 módulos → el cableado no bloquea el alta. Verificado con los 34 tests del área (pasan).
- **Falso verde del candado de clase:** incluye una aserción de sanidad (encontró >30 guards + `profesional_inicio`) para que un walk vacío no pase en falso.
