# SPEC-435 · Plan

## Diseño

- **Molde**: `POST /api/admin/operadores` — mismo perfil, sin `cupoMaximo`/`esComite`/`esRevisorDeApelaciones`. Sin perfil auxiliar (`PerfilOperador` es del operador; el verificador vive en `Usuario` puro).
- **Guardia**: módulo nuevo `verificadores_admin`. Default SOLO ADMIN. La cuenta que se crea nace con `admin_verificacion_profesionales` y nada más.
- **Contrato de la credencial**: patrón SPEC-421/423. `restablecer` SIEMPRE muestra en respuesta. `reenviar` NUNCA la muestra si el envío se encoló. El candado permanente `credencial-siempre-visible.candado.test.ts` protege el flujo (piso subido a 6).

## Q-3

- Prisma solo se toca en `UsuarioRepository` (agregado `listarPorRol`). El service no importa `@/lib/prisma`.

## Candados

- `verificador-modulos.candado.test.ts` (unit) — importa la fuente (`CLAVES_POR_ROL`) y afirma la lista exacta + contraprueba de contaminación con módulos ajenos. Muere si alguien copia módulos de operador/padre al VERIFICADOR.
- `credencial-siempre-visible.candado.test.ts` (unit existente) — barre la nueva `restablecer-password/route.ts`. Piso 5 → 6.
- `route.test.ts` (integración) — 4 tests, incluye 403 con `verifyAuth("ADMIN")` frente a un usuario VERIFICADOR.
