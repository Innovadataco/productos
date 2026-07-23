#!/usr/bin/env bash
# Verificación LIVE del cierre 009+013 (003-SICOV-007). Contra el server en :5010.
# Ejercita: admin ve Configuración → crea empresa → cascada operador solo-preventivos → 403 correctivos.
# La clave temporal del operador (creado por API) se fija a un valor conocido vía prisma solo para
# poder autenticar en el guion; en producción viaja por correo.
set -uo pipefail
B="http://localhost:5010"
J="$(mktemp -d)"
ok=0; fail=0
chk() { # etiqueta esperado obtenido [cuerpo]
  if [ "$2" = "$3" ]; then echo "  ✓ $1 ($3)"; ok=$((ok+1));
  else echo "  ✗ $1 (esperado $2, obtuvo $3) ${4:-}"; fail=$((fail+1)); fi
}
login() { curl -s -c "$3" -o /dev/null -w '%{http_code}' -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d "{\"usuario\":\"$1\",\"contrasena\":\"$2\"}"; }
rol_de() { curl -s -b "$1" "$B/api/me" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).usuario.rol)}catch{console.log('?')}})"; }
gcode() { curl -s -b "$1" -o /dev/null -w '%{http_code}' "$B$2"; }
pcode() { curl -s -b "$1" -o /tmp/003-body.json -w '%{http_code}' -X POST "$B$2" -H 'Content-Type: application/json' -d "$3"; }
body() { cat /tmp/003-body.json 2>/dev/null; }

echo "─── 1. Admin (rol 1) ve Configuración ───"
chk "login admin"              200 "$(login admin Admin123! "$J/admin")"
chk "rol admin = 1"            1   "$(rol_de "$J/admin")"
chk "GET configuracion/empresas" 200 "$(gcode "$J/admin" /api/configuracion/empresas)"
chk "GET consola apis (013)"  200 "$(gcode "$J/admin" /api/configuracion/apis/catalogo)"

echo "─── 2. Admin crea una empresa (token autogenerado UUID) ───"
NIT="9015$RANDOM"
c="$(pcode "$J/admin" /api/configuracion/empresas "{\"empresa\":\"Transportes Cierre SAS\",\"nit\":\"$NIT\",\"correo\":\"cierre@e.com\",\"modulos\":[8,4]}")"
chk "POST crear empresa" 201 "$c" "$(body)"

echo "─── 3. Cascada: empresa (rol 2) crea operador SOLO preventivos ───"
chk "login empresa (rol 2)"   200 "$(login vigilado Vigilado123! "$J/emp")"
chk "rol empresa = 2"         2   "$(rol_de "$J/emp")"
OPNIT="9025$RANDOM"
c="$(pcode "$J/emp" /api/usuarios "{\"nombre\":\"Operador Prev\",\"identificacion\":\"$OPNIT\",\"correo\":\"op@e.com\",\"rolId\":3,\"permisos\":[{\"moduloId\":4,\"submoduloIds\":[3]}]}")"
chk "POST crear operador solo-preventivos" 201 "$c" "$(body)"

CLAVE_OP="Operador123!"
npx tsx scripts/_fijar-clave.ts "$OPNIT" "$CLAVE_OP" >/dev/null 2>&1

echo "─── 4. Operador solo-preventivos: 403 en correctivos ───"
chk "login operador"          200 "$(login "$OPNIT" "$CLAVE_OP" "$J/op")"
chk "rol operador = 3"        3   "$(rol_de "$J/op")"
COD_CORR="$(pcode "$J/op" /api/mantenimientos/correctivo '{"placa":"ABC123","mantenimientoId":1}')"
chk "POST correctivo → 403 (guard submódulo)" 403 "$COD_CORR" "$(body)"
COD_PREV="$(pcode "$J/op" /api/mantenimientos/preventivo '{"placa":"ABC123","mantenimientoId":1}')"
if [ "$COD_PREV" = "403" ]; then echo "  ✗ POST preventivo dio 403 (no debía)"; fail=$((fail+1));
else echo "  ✓ POST preventivo NO es 403 ($COD_PREV) — tiene el submódulo"; ok=$((ok+1)); fi

echo "─── Resultado: $ok OK · $fail FALLOS ───"
rm -rf "$J"
[ "$fail" -eq 0 ]
