# SPEC-026 · tasks.md

- [ ] `src/components/bi/chat/integracion.tsx` con `NAV_ITEM_CHAT`, `<EnlaceChatNav />`, `<BotonPreguntaAlgo />`.
- [ ] `tests/unit/bi-chat-integracion.test.tsx`:
  - [ ] `NAV_ITEM_CHAT.href === "/chat"`.
  - [ ] `<EnlaceChatNav />` renderiza `<a href="/chat">`.
  - [ ] `<BotonPreguntaAlgo />` renderiza botón con `<Link>` a `/chat`.
- [ ] Gate LOCAL verde (`build + typecheck + test:unit + ratchets`).
- [ ] Push a `work/bi-SPEC-026-activar-chat`.
- [ ] PR base `main`.
- [ ] Señal REALIZADO a Fábrica BI-2.
