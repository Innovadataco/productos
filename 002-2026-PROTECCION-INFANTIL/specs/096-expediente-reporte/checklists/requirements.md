# Checklist de requisitos — Spec 096

**Spec**: `specs/096-expediente-reporte/spec.md` · **Verificado**: 2026-07-25 (implementación completa, gate verde, quickstart validado en vivo)

- [x] US1: botón "Ver proceso" en la Bandeja abre el expediente con las 10 etapas en 4 fases (fase, etapa, actividad, evaluación, fecha y hora), solo lectura.
- [x] US2: votación pregunta por pregunta (texto y tipo EN VIVO de `ia.rubrica.preguntas`, 0/1 por modelo) + matriz modelos×categorías + confianza/cascada/latencia/tokens; votos SOLO de `ClasificacionRubricaVoto`.
- [x] US3: `PasoProcesamiento` registra guardas (con veredicto), RAG y score de deduplicación con hora; escritura fail-open; reportes viejos degradan a "sin instrumentar" sin romper.
- [x] US4: etapas (orden/nombre/ícono/campos/gated) desde `admin.expediente.etapas`; nada quemado en código; parámetro documentado en `docs/configuracion/parametros-sistema.md` (§3.9, junto a `mensaje.padre.canales`).
- [x] US5: default anonimizado; textoOriginal/hashes/rawResponse solo con módulo `expediente_revelar_original` + AuditLog `TEXTO_ORIGINAL_REVELADO`; sin permiso → campos omitidos + `revelado:false`; test que lo prueba (fuga I-12 cerrada) + validado en vivo.
- [x] US6: análisis interno determinista con consenso X/N, gravedad interna (D-13), señales, disparador, confianza, peso de fuente y conclusión neutral.
- [x] US7: mensaje al padre por plantillas deterministas (sin LLM), SIN score ni nivel de riesgo, canales desde `mensaje.padre.canales`, sin botón de enviar/publicar.
- [x] FR-001…FR-012 cubiertos por tareas con tests colocalizados; migraciones aditivas; no rompe specs previas (882/882).
- [x] Gate por US (lint + test + tsc + build) + healthcheck tras `./scripts/dev-restart.sh`; quickstart validado sección por sección.
- [x] Staging explícito solo del 002.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.
