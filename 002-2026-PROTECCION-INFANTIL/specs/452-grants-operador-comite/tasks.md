# SPEC-452 · Tasks
- [x] Leído el radicado entero + verificado en fuente (endpoints spam/rúbrica, seed, arnés, jerarquía AND).
- [x] Seed aditivo: OPERADOR+revision_spam; COMITE+centro_control_ia+ia_rubrica (ruling A del CEO por la jerarquía AND).
- [x] 5 tests reescritos al mapa real (deleteMany + syncModulosYGrants; sin tocar el arnés).
- [x] Candado del comité (token real): lee 200 / no escribe 403 / no raíz 403.
- [x] Contraprueba por mutación (quitar grants del seed → operador/comité 200 caen a 403). Set completo 39/39 en integración local.
- [x] BD de test local migrada (le faltaba spec_438_hora_aproximada) para poder verificar de verdad.
- [ ] Preflight + commit + push + PR + reportar al CEO. Post-deploy: sync-modulos-grants (el CEO verifica prod).
