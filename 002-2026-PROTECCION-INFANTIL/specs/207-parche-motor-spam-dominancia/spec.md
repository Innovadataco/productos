# SPEC-207 — Parche motor SPAM dominancia (002-PI-140)

> Status: `PLANEADO`
> PI: 002-PI-140
> Responsable: ODIN
> Rama: `work/002-PI-140-142-lote-parches`
> Base: `feature/001-scaffolding`

## Contexto

Caso testigo RPT-QFUHE8 tras deploy `5d69eaaf`: spam textbook siguió clasificando `OFRECIMIENTO_REGALOS conf 0.67`. Fix A (rúbrica SPAM) y Fix C (guarda dominancia) están cargados, pero la guarda NO se activa porque SPAM vota 1/3 (0.33) < umbral 0.66 y los modelos LLM mienten en la pregunta 2 decisiva de `OFRECIMIENTO_REGALOS` ("individual, no masivo").

Esta SPEC cierra I-100/I-105 con una red de seguridad determinística: cualquier reporte con patrón claro de spam publicitario (hashtags, links acortados, oferta+urgencia+CTA masivo, emojis monetarios) debe clasificar `POSIBLE_SPAM` incluso si la rúbrica LLM se equivoca.

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como sistema, quiero detectar spam publicitario con una regla determinística, para no depender exclusivamente de la rúbrica LLM. | Must |
| US-002 | Como operador, quiero que reportes textbook de spam se marquen `POSIBLE_SPAM` automáticamente, para no revisar manualmente casos obvios. | Must |
| US-003 | Como CEO, quiero poder editar la lista de dominios acortadores sin deploy, para ajustar la regla en caliente. | Should |
| US-004 | Como ingeniero, quiero logs de modelos que no responden, para diagnosticar timeouts o modelo caído en prod. | Should |

## Acceptance Scenarios

### AS-001 · Hard-rule fuerza POSIBLE_SPAM
**Given** un reporte cuyo texto cumple ≥2 señales de spam publicitario  
**When** el motor procesa el reporte  
**Then** el `estadoFinal` es `POSIBLE_SPAM` y `reglasAplicadas` incluye `"spam_publicitario_deterministico"`.

### AS-002 · RPT-QFUHE8 clasifica SPAM
**Given** el texto textbook de RPT-QFUHE8 (ofertas + hashtags + bit.ly + CTA masivo)  
**When** el motor clasifica  
**Then** el resultado es `POSIBLE_SPAM` con confianza determinística, sin depender del voto LLM.

### AS-003 · Falso positivo controlado
**Given** un reporte con solo 1 hashtag y sin link acortado  
**When** el motor clasifica  
**Then** NO se aplica la hard-rule; el veredicto sigue la rúbrica LLM.

### AS-004 · Umbral dominancia a 0.33
**Given** la rúbrica devuelve 1 voto SPAM entre secundarias y ninguna categoría alcanza severidad ≥75  
**When** se evalúa la guarda de dominancia  
**Then** 1 voto SPAM basta para `POSIBLE_SPAM` (umbral 0.33).

### AS-005 · Dominios acortadores configurables
**Given** el parámetro `spam.dominios_acortadores` existe en BD con lista JSON  
**When** la hard-rule evalúa un link  
**Then** usa la lista del parámetro, no un literal en código.

### AS-006 · Log de modelo sin voto
**Given** un modelo de rúbrica no responde  
**When** termina el intento  
**Then** se registra en `WorkerLog`/`AuditLog` el modelo, latencia y error sin alterar el resultado.

## Functional Requirements

- **FR-001**: El parámetro `spam.dominancia_umbral` DEBE sembrarse con valor `0.33` en `prisma/seed.ts` (update forzado en `RUBRICA_SEMILLA` por decisión de diseño de esta SPEC).
- **FR-002**: El parámetro `spam.dominios_acortadores` DEBE sembrarse como JSON con al menos: `bit.ly`, `tinyurl`, `is.gd`, `t.co`, `cutt.ly`, `ow.ly`, `buff.ly`.
- **FR-003**: Debe existir una hard-rule determinística en `src/lib/ai/guardas.ts` (o archivo adyacente) que evalúe el texto original y fuerce `POSIBLE_SPAM` si cumple ≥2 de 4 señales:
  - ≥2 hashtags (`/#[a-zA-Z0-9_]+/g`).
  - ≥1 link acortado (lista del parámetro).
  - mención dinero + urgencia + CTA masivo (`/gana|dinero|pagos|ingresos/i` + `/ahora|ya|hoy|urgente|limitado|últimas/i` + `/envía|escribe|contacta|únete|link|click/i`).
  - ≥3 emojis del conjunto {💰🤑💵💸🎁🎉🔥⚡🚀}.
- **FR-004**: La hard-rule DEBE aplicarse ANTES de la guarda de dominancia y tener prioridad sobre el veredicto LLM.
- **FR-005**: La hard-rule DEBE registrar `reglaAplicada = "spam_publicitario_deterministico"`.
- **FR-006**: En `src/lib/ai/sandbox.ts` (o donde viva el llamado a rúbrica) DEBE loggearse cuando un modelo no responde: `modelo`, `latenciaMs`, `error?`.
- **FR-007**: No se DEBE modificar el schema Prisma ni crear migraciones.
- **FR-008**: No se DEBE cambiar la UI.

## Non-Functional Requirements

- **NFR-001**: La hard-rule debe ejecutarse en <50 ms por reporte.
- **NFR-002**: Cero PII adicional: solo se usa el texto del reporte ya disponible.
- **NFR-003**: Gate local completo verde: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.

## Success Criteria

- **SC-001**: Reporte con texto textbook RPT-QFUHE8 clasifica `POSIBLE_SPAM` con regla `spam_publicitario_deterministico`.
- **SC-002**: Reporte con solo 1 hashtag y sin link acortado NO se marca por la hard-rule.
- **SC-003**: `spam.dominancia_umbral=0.33` en BD tras seed.
- **SC-004**: Logs de rúbrica incluyen entrada por modelo que no responde.
- **SC-005**: Test unitario con mock LLM devolviendo `OFRECIMIENTO_REGALOS conf 0.67` verifica que la hard-rule fuerza `POSIBLE_SPAM`.
- **SC-006**: CI 6/6 verde en el PR del lote.

## Assumptions

- El motor de clasificación ejecuta guardas en `src/lib/ai/guardas.ts` después de la rúbrica.
- `ParametroSistema` soporta valores JSON para `spam.dominios_acortadores`.
- El texto original del reporte está disponible en el contexto de clasificación.

## Decisiones propuestas para compuerta §4

1. **Umbral 0.33**: un solo voto SPAM en secundarias basta cuando ninguna categoría alcanza severidad ≥75. Racional: reducir falsos negativos de spam publicitario.
2. **Hard-rule antes de guarda dominancia**: actúa como red de seguridad determinística, prioridad sobre LLM.
3. **Lista de acortadores en parámetro**: permite ajuste en caliente sin deploy.
4. **Log de modelo caído en sandbox**: instrumentación aditiva, sin cambio de comportamiento.

## Impacto en arquitectura:

- Cambio en `src/lib/ai/guardas.ts`: nueva hard-rule `spam_publicitario_deterministico`.
- Cambio en `prisma/seed.ts`: `spam.dominancia_umbral=0.33` (update forzado) + `spam.dominios_acortadores` JSON.
- Cambio en `src/lib/ai/sandbox.ts`: log de modelo sin respuesta.
- Tests unitarios de la hard-rule y del flujo RPT-QFUHE8.
- No se toca `src/lib/ai/rubrica.ts` ni el motor de LLM.

## Deuda Técnica

- Ninguna identificada en fase de diseño.
