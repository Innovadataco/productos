# SPEC-486 · Tasks
- [x] Diagnóstico de #403 desde el log real (ENOTEMPTY en cleanup de SPEC-432; 2637 passed).
- [x] Rama desde origin/main; inventario (17 rmSync sin maxRetries, 16 archivos).
- [x] maxRetries:5 + retryDelay:100 en todos los rmSync(recursive) de cleanup (solo líneas rmSync). Sin tocar aserciones.
- [x] Candado de barrido + verificado por mutación.
- [x] Registrado en vitest.unit.includes.ts. No toca tokens:check ni PISO.
- [ ] Preflight + unit; commit + push + PR (merge PRIMERO).
- [ ] Tras merge: #403 re-corre verde; avisar a Dev 01 (destraba #485).
