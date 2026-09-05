# SPEC-486 · Plan
Fix infra-wide de la race ENOTEMPTY del cleanup en el runner nuevo (Node 24/git 2.55).
1. Rama desde origin/main; inventario de `rmSync(recursive)` sin `maxRetries` en scripts/** + tests de src/**.
2. Añadir `maxRetries:5, retryDelay:100` SOLO en líneas con `rmSync` (no cpSync/otros). Sin tocar aserciones.
3. Candado de barrido (0 rmSync(recursive) sin maxRetries) + contraprueba por mutación.
4. Preflight + unit. Merge PRIMERO (destraba #403 y protege a todos).
Fuera de alcance: cambiar lo que prueban los candados barridos.
