# AGENTS.md — productos

## Proposito

Reglas especificas para operar el repo `Innovadataco/productos`.

## Estructura del repo

- `fabrica-de-software/`: codigo fuente de productos.
- `documentacion-tecnica/`: arquitectura, ADRs, guias.

## Reglas

1. Cada producto tiene su propia carpeta.
2. Todo PR requiere revision de codigo.
3. Los secrets se manejan via variables de entorno, nunca en el codigo.
4. Preferir modelos locales para revision de codigo sensible.

## Lider

- ZEUS — Lider de Fabrica de Software

## Uso por ODIN

- ODIN puede consultar y revisar PRs siguiendo `innovadataco-zeus-software-factory`.
- No mergear sin ACTA-VALIDACION.

## Metodología y estándares (fábrica IDC)

- **Metodología oficial:** PM2 (gestión) + Spec Kit (desarrollo). Documento canónico en el repo `Metodologias` → `Desarrollo de software/METODOLOGIA-OPERATIVA-FABRICA-SOFTWARE-v1.0.md`.
- **Modelo de dos agentes:** ZEUS diseña/revisa (constitución, brief, compuerta); ODIN redacta spec/plan e implementa/prueba/despliega.
- **5 reglas de oro:** aplicar Spec Kit · subir a GitHub · pruebas · validar despliegue · documentar.
- **Índice de specs:** mantener `002-2026-PROTECCION-INFANTIL/specs/README.md` actualizado con cada spec nueva o cerrada.
