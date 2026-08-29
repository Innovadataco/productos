# SPEC-013 · tasks.md · UI chat + Vega-Lite

## Tras REVISO

- [ ] `npm install react-vega vega vega-lite`
- [ ] Copiar `src/components/ui/{button,input,card,badge}.tsx` desde PI
- [ ] `src/lib/bi/tipos-ui.ts`
- [ ] `src/components/bi/chat/MensajeUsuario.tsx`
  - [ ] test render
- [ ] `src/components/bi/chat/TablaBI.tsx`
  - [ ] test render 5 filas
  - [ ] test paginación con 100 filas
- [ ] `src/components/bi/chat/GraficoVegaLite.tsx`
  - [ ] test render con spec Vega-Lite mínima
- [ ] `src/components/bi/chat/PanelDetalle.tsx`
  - [ ] test render con SQL + votos + latencias
- [ ] `src/components/bi/chat/BannerEstado.tsx`
  - [ ] test 3 estados (OK/REVISION/RECHAZADO)
- [ ] `src/components/bi/chat/BotonesFeedback.tsx`
  - [ ] test: ADMIN → botones visibles
  - [ ] test: SCHOOL_ADMIN → botones NO visibles
  - [ ] test: click 👍 → fetch POST /api/bi/aprobar con consultaLogId
- [ ] `src/components/bi/chat/MensajeMotor.tsx` router de plantillas
  - [ ] test: 4 plantillas → 4 componentes
- [ ] `src/app/chat/page.tsx`
  - [ ] test render inicial
  - [ ] test submit → POST /api/bi/preguntar → historial actualizado
  - [ ] test error red → banner
- [ ] `src/app/api/bi/aprobar/route.ts`
  - [ ] test 200 con consultaLogId válido
  - [ ] test 404 con id inexistente
  - [ ] test 401 sin rol ADMIN
  - [ ] test 400 si consulta sin sqlGenerado
- [ ] `src/app/api/bi/rechazar/route.ts`
  - [ ] test 200 con id + razón
  - [ ] test 200 con id sin razón (default "sin_razon")
  - [ ] test 401 sin rol ADMIN

## Gate LOCAL

- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run test:unit -- src/components/bi src/app/api/bi src/app/chat` verde
- [ ] `bash scripts/ratchets/run-all.sh` verde
- [ ] Levantar dev `npm run dev` · abrir `http://localhost:3000/chat` · pregunta manual · ver respuesta

## Push (mismo PR)

- [ ] `git add src/app/chat src/app/api/bi src/components/bi src/components/ui src/lib/bi/tipos-ui.ts package.json package-lock.json`
- [ ] `git commit -m "feat(bi): SPEC-013 UI chat + Vega-Lite + feedback humano · candados 7/10/14"`
- [ ] `git push origin work/bi-SPEC-011-vanna-motor`

## Señal

- [ ] `SendMessage → BI-Fabrica: desarrollo-bi-1: BI-SPEC-013 · REALIZADO · <hash>`
