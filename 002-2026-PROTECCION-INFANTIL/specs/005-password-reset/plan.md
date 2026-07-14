# Implementation Plan: Restablecimiento de Contraseña

**Feature**: Restablecimiento de Contraseña

**Branch**: `feature/005-password-reset`

**Created**: 2026-07-14

---

## Technical Context

### Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 16.2.10 |
| ORM | Prisma | 5.22.0 |
| Auth | JWT manual + bcryptjs | — |
| Email | Resend | — |
| Testing | Vitest + Playwright | — |

### Dependencias existentes relevantes

- `Usuario` modelo con `passwordHash`.
- `enviarCodigoVerificacion` en `src/lib/email.ts`.
- `createToken`/`verifyToken` en `src/lib/auth.ts`.
- Bypass de email en dev ya implementado en verificación.

---

## Constitution Check

| Principio | Impacto | Mitigación |
|-----------|---------|------------|
| §1.1 Seguridad | Tokens de recuperación | Hash seguro, expiración, un solo uso |
| §3.1 TypeScript strict | Aplica | Sin `any`, validación con Zod |
| §3.4 Códigos HTTP | Aplica | 200 OK genérico, 400 validación, 401/403 token inválido |
| §6.1 Cookie httpOnly | Aplica | No aplica directamente, pero mantener estándar de sesión |

**Veredicto**: Ninguna violación. Proceder.

---

## Phases

### Phase 1: Backend — Modelo y endpoints

- Crear modelo `TokenRecuperacion` en Prisma schema.
- Generar migración.
- Crear endpoint `POST /api/auth/recuperar/solicitar`.
- Crear endpoint `GET /api/auth/recuperar/validar`.
- Crear endpoint `POST /api/auth/recuperar/restablecer`.
- Extender `src/lib/email.ts` con `enviarTokenRecuperacion`.
- Aplicar bypass de email en dev.

### Phase 2: Frontend — Páginas y formularios

- Crear `src/app/recuperar/page.tsx`.
- Crear `src/app/recuperar/[token]/page.tsx`.
- Crear componentes `RecuperarForm.tsx` y `RestablecerForm.tsx`.

### Phase 3: Tests

- Tests E2E con Playwright para flujo completo.
- Tests unitarios para helpers si aplica.

### Phase 4: Validación

- `npm run build` limpio.
- `npm run test` y `npm run test:e2e` verdes.
- Escenarios del quickstart validados.

---

## File Structure

```
src/
├── app/
│   ├── recuperar/
│   │   ├── page.tsx
│   │   └── [token]/
│   │       └── page.tsx
│   └── api/auth/recuperar/
│       ├── solicitar/route.ts
│       ├── validar/route.ts
│       └── restablecer/route.ts
├── components/modules/
│   ├── RecuperarForm.tsx
│   └── RestablecerForm.tsx
├── lib/
│   └── email.ts (extendido)
prisma/
├── schema.prisma (TokenRecuperacion)
├── migrations/...
tests/e2e/
├── password-reset.spec.ts
```

---

## Unknowns / NEEDS CLARIFICATION

Ninguno.
