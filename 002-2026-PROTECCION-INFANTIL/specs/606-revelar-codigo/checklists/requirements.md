# Checklist de requisitos — SPEC-606

## Completitud del contenido

- [x] Sin clarificaciones pendientes (decisión del dueño cerrada en el brief).
- [x] Requisitos testeables y sin ambigüedad (FR-001…FR-009 con DEBE/NO DEBE).
- [x] Criterios de éxito medibles (status HTTP, conteos de intentos, segundos de cooldown).
- [x] `## Impacto en arquitectura:` explícito (ratchet FR-008).

## Cobertura

- [x] Flujo feliz (solicitar → correo → verificar → sello → texto).
- [x] Bordes: incorrecto ×5, vencido, reuso, sin código, formato, sin sesión.
- [x] Anti-abuso: rate limit por scope, cooldown de reenvío, un solo vigente, un solo uso.
- [x] Auditoría completa SIN código ni texto.
- [x] Compatibilidad: sello y parámetros existentes intactos; seed aditivo.
- [x] Eliminación del step-up por contraseña decidida y documentada (D2 de research).
- [x] «Crear contraseña» (SPEC-598) fuera de alcance y protegido por test.

## Calidad

- [x] Tono NEUTRAL en textos de UI (sin voseo).
- [x] Migración 100 % aditiva; índices críticos fuera del schema intactos.
- [x] Tests: integración (endpoints) + unit (componente y helpers), todos verdes.
