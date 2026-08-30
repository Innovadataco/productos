# SPEC-026 · Activar chat NL→SQL end-to-end desde sidebar y home

> **Radicado:** BI · SPEC-026 (INSTRUCTIVO-013 · A-51 §3-C) · **F3C:** 2026-08-29
> **Rama:** `work/bi-SPEC-026-activar-chat` · base `main`
> **Depende de:** SPEC-013 (UI chat existe · mergeado). SPEC-024 (sidebar) y SPEC-025 (home) están abiertos como spec+plan · esta SPEC-026 entrega los puntos de integración que ambos consumen al mergear.

## 1. Problema
`/chat` existe (SPEC-013) pero no hay entrada de navegación desde el sidebar (SPEC-024) ni CTA desde el home (SPEC-025). Un admin que aterriza en la app no encuentra el chat.

## 2. Objetivo
Publicar dos "puntos de integración" tipados (constantes + componentes ligeros) que 024/025 consuman al mergear, sin duplicar lógica y sin bloquear a este SPEC.

## 3. Alcance
**Dentro:**
- `src/components/bi/chat/integracion.tsx` — exporta:
  - `NAV_ITEM_CHAT`: `{ href: "/chat", label: "Chat NL→SQL", icon: "💬" }` (data pura, consumo por sidebar).
  - `<BotonPreguntaAlgo />`: componente Client que renderiza un botón CTA que navega a `/chat` (consumo por home).
  - `<EnlaceChatNav />`: componente Client que renderiza el `<Link>` con estilo idéntico al resto del sidebar (consumo por sidebar).
- Tests unit (Vitest + Testing Library) que validan render y `href`.

**Fuera (regla dura instructivo):**
- `src/lib/bi/motor.ts` NO se toca.
- `src/app/api/bi/{preguntar,aprobar,rechazar}` NO se toca (solo lectura para confirmar contrato).
- Sidebar y home NO se tocan (esos SPECs son 024/025).

## 4. Contrato de integración
- Cuando SPEC-024 mergee, su `BiSideNav` importa `NAV_ITEM_CHAT` y agrega `<EnlaceChatNav />` (o construye el link desde la data).
- Cuando SPEC-025 mergee, su `HomeBI` importa `<BotonPreguntaAlgo />` en el bloque CTA.

## 5. Verificación en vivo (candado 14)
- Navegar a `/chat` directo funciona hoy (verificado en SPEC-013 y en producción https://bi.innovadataco.com).
- End-to-end con jurado 3/3: se ejecuta si Ollama Mac Studio + bi-vanna up + los 3 modelos en RAM. Si el jurado no tiene quórum por RAM (I-12 conocido), documentar razón real (`sin_votos_validos`/`checks_atomicos_incompletos`) — nunca reportar "funcionó" sin quórum (candado 15).

## 6. Criterios de aceptación
- [ ] `NAV_ITEM_CHAT` con `href="/chat"` y `label="Chat NL→SQL"`.
- [ ] `<BotonPreguntaAlgo />` navega a `/chat`.
- [ ] `<EnlaceChatNav />` renderiza `<a href="/chat">…</a>`.
- [ ] Tests unit verdes.
- [ ] `npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh` verde.

## 📋 Control
| Campo | Valor |
|---|---|
| Radicado | BI · SPEC-026 |
| F3C | 2026-08-29 |
| Autor | dev-bi-1 (idc-5e) |
| Estado | 🟡 spec+plan |
