# Spec 025 — Anonimización reforzada + encriptación del original

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Garantizar que ningún rol interno (OPERADOR, COMITE, ADMIN) conozca la identidad del denunciante. Reforzar la anonimización del texto y cifrar el original.

## Decisiones

- **Anonimización automática**: doble capa regex (`src/lib/ai/pii-patterns.ts`) + IA (`src/lib/ai/pii-detector.ts`). Evaluar si Presidio (`.venv-presidio`) mejora la cobertura.
- Se enmascaran datos de la víctima y auto-identificación del denunciante en el texto.
- **Original cifrado**: `Reporte.textoOriginal` ya existe; se encripta con el wrapper AES-256-GCM de `src/lib/param-encryption.ts`.
- **Copia anonimizada**: `Reporte.texto` circula libremente (sin PII), se clasifica, entra al RAG, la ven operador/comité.
- **Operador valida anonimización**: el operador puede marcar si la anonimización es correcta o solicitar ajuste.
- **Regla crítica**: ningún endpoint/pantalla filtra datos del denunciante. Se audita el detalle del reporte para cerrar fugas.

## Requisitos

1. Cifrar `Reporte.textoOriginal` al guardar; descifrar solo bajo autorización estricta.
2. Mejorar anonimización de víctima y denunciante.
3. Operador valida anonimización.
4. Auditar endpoints/pantallas que hoy exponen datos del denunciante y cerrarlas.
5. AuditLog de acceso al texto original.

## Riesgos mitigados

- Fuga de identidad del denunciante.
- Responsabilidad legal por exposición de PII.

## R7

No aplica: no toca el pipeline de clasificación; solo refuerza protección de datos.
