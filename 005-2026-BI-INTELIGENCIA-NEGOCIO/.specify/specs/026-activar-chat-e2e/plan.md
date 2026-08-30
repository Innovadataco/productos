# SPEC-026 · plan.md · integración chat sidebar/home

## Estrategia
1 archivo nuevo (`integracion.tsx`) + 1 test. Sin deps nuevas. Cero cambios al motor/route/sidebar/home. Los consumidores (024/025) importan lo publicado aquí al mergear.

## Archivos
- `src/components/bi/chat/integracion.tsx` (nuevo · Client Component + data pura)
- `tests/unit/bi-chat-integracion.test.tsx` (nuevo)

## API
```ts
export const NAV_ITEM_CHAT = {
  href: "/chat" as const,
  label: "Chat NL→SQL" as const,
  icon: "💬" as const,
};
export function EnlaceChatNav(props: { className?: string }): JSX.Element;
export function BotonPreguntaAlgo(props: { className?: string }): JSX.Element;
```

## Gate LOCAL
```
rm -rf .next && npm run build && npm run typecheck && npm run test:unit && bash scripts/ratchets/run-all.sh
```

## Push
```
git add src/components/bi/chat/integracion.tsx tests/unit/bi-chat-integracion.test.tsx .specify/specs/026-*
git commit -m "feat(bi): SPEC-026 integra chat NL-to-SQL a sidebar/home"
git push origin work/bi-SPEC-026-activar-chat
```

## Fuera de scope
- SPEC-024 sidebar (spec+plan abierto).
- SPEC-025 home (spec+plan abierto).
- Motor NL→SQL (SPECs 011-014, cerrado).
