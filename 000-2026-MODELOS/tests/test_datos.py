"""Pruebas de app/datos.py — SPEC-001 T16 (Regla de Oro 3).

Fixtures sintéticos en un directorio temporal: nada depende de las
transcripciones reales de la máquina. `python3 -m unittest discover tests`
"""
import json
import os
import sys
import tempfile
import unittest
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
import datos  # noqa: E402

AHORA = datetime.datetime(2026, 7, 29, 12, 0, 0)
HOY = "2026-07-29"


# Las transcripciones reales son JSON compacto (sin espacios); el parser de
# datos.py se apoya en eso ('"role":"user"'), así que el fixture lo replica.
COMPACTO = {"separators": (",", ":")}


def linea_uso(ts, i=10, o=100, cw=1000, cr=50000):
    return json.dumps({
        "type": "assistant", "timestamp": ts + "T10:00:00.000Z",
        "message": {"role": "assistant", "usage": {
            "input_tokens": i, "output_tokens": o,
            "cache_creation_input_tokens": cw, "cache_read_input_tokens": cr,
        }},
    }, **COMPACTO)


def linea_usuario(texto):
    return json.dumps({"type": "user",
                       "message": {"role": "user", "content": texto}}, **COMPACTO)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def escribir(self, nombre, lineas, hace_min=0):
        carpeta = os.path.join(self.raiz, "-Users-idc")
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, nombre + ".jsonl")
        with open(ruta, "w") as fh:
            fh.write("\n".join(lineas) + "\n")
        t = (AHORA - datetime.timedelta(minutes=hace_min)).timestamp()
        os.utime(ruta, (t, t))
        return ruta


class TestAgregacion(Base):
    def test_suma_y_contexto_ultimo(self):
        self.escribir("s1", [
            linea_usuario("hola zeus"),
            linea_uso(HOY, i=10, o=100, cw=1000, cr=50000),
            linea_uso(HOY, i=20, o=200, cw=2000, cr=80000),
        ])
        ses, tend, salt = datos.recolectar(1, AHORA, self.raiz, idx_titulos={})
        s = ses["s1"]
        self.assertEqual(s["turnos"], 2)
        self.assertEqual(s["in"], 30)
        self.assertEqual(s["out"], 300)
        self.assertEqual(s["cr"], 130000)
        # contexto del ÚLTIMO turno = i + cw + cr de la última línea
        self.assertEqual(s["contexto_ultimo"], 20 + 2000 + 80000)
        self.assertEqual(tend[HOY]["turnos"], 2)
        self.assertEqual(salt, 0)

    def test_linea_corrupta_se_salta(self):
        self.escribir("s1", [
            linea_uso(HOY),
            '{"esto no es json valido "usage" ///',
            linea_uso(HOY),
        ])
        ses, _, salt = datos.recolectar(1, AHORA, self.raiz, idx_titulos={})
        self.assertEqual(ses["s1"]["turnos"], 2)
        self.assertEqual(salt, 1)

    def test_fuera_de_rango_no_cuenta(self):
        self.escribir("s1", [linea_uso("2026-07-20")])
        ses, _, _ = datos.recolectar(1, AHORA, self.raiz, idx_titulos={})
        self.assertNotIn("s1", ses)


class TestNombresYEstado(Base):
    def test_nombre_por_titulo_de_app(self):
        self.escribir("abc12345-x", [linea_uso(HOY)])
        ses, _, _ = datos.recolectar(
            1, AHORA, self.raiz, idx_titulos={"abc12345-x": "ZEUS-Arquitecto -PI"})
        self.assertEqual(ses["abc12345-x"]["chat"], "ZEUS-Arquitecto -PI")
        self.assertEqual(ses["abc12345-x"]["origen_nombre"], "app")

    def test_nombre_por_primer_mensaje(self):
        self.escribir("s1", [linea_usuario("audita el spec 126"), linea_uso(HOY)])
        ses, _, _ = datos.recolectar(1, AHORA, self.raiz, idx_titulos={})
        self.assertEqual(ses["s1"]["chat"], '"audita el spec 126"')

    def test_estado_activa_inactiva(self):
        est, _ = datos.estado_sesion(
            (AHORA - datetime.timedelta(minutes=5)).timestamp(), AHORA)
        self.assertEqual(est, "activa")
        est, etq = datos.estado_sesion(
            (AHORA - datetime.timedelta(minutes=90)).timestamp(), AHORA)
        self.assertEqual(est, "inactiva")
        self.assertEqual(etq, "10:30")  # mismo día → hora

    def test_subagente_detectado(self):
        self.escribir("agent-a1b2", [linea_uso(HOY)])
        ses, _, _ = datos.recolectar(1, AHORA, self.raiz, idx_titulos={})
        self.assertTrue(ses["agent-a1b2"]["es_subagente"])


class TestAlertas(Base):
    def _sesion(self, contexto_ultimo=0, cr=0, turnos=1, hace_min=0, sid="s1"):
        return {sid: {
            "in": 0, "out": 0, "cw": 0, "cr": cr, "turnos": turnos,
            "contexto_ultimo": contexto_ultimo,
            "mtime": (AHORA - datetime.timedelta(minutes=hace_min)).timestamp(),
            "chat": "chat-prueba", "sid": sid, "es_subagente": False,
        }}

    def test_warning_al_75(self):
        a = datos.alertas(self._sesion(contexto_ultimo=155_000), AHORA)
        self.assertEqual(a[0]["sev"], "warning")
        self.assertIn("/compact", a[0]["accion"])

    def test_critical_al_90(self):
        a = datos.alertas(self._sesion(contexto_ultimo=185_000), AHORA)
        self.assertEqual(a[0]["sev"], "critical")
        self.assertIn("CIERRA", a[0]["accion"])

    def test_inactiva_no_dispara_contexto(self):
        a = datos.alertas(self._sesion(contexto_ultimo=185_000, hace_min=120), AHORA)
        self.assertFalse([x for x in a if x["sev"] == "critical"])

    def test_inflada(self):
        a = datos.alertas(
            self._sesion(cr=160_000 * 10, turnos=10, hace_min=120), AHORA)
        self.assertTrue([x for x in a if "inflada" in x["metrica"]])

    def test_toda_alerta_trae_accion(self):
        ses = self._sesion(contexto_ultimo=190_000)
        ses.update(self._sesion(cr=200_000 * 8, turnos=8, sid="s2"))
        for a in datos.alertas(ses, AHORA):
            self.assertTrue(a["accion"].strip())

    def test_nominal_sin_alertas(self):
        a = datos.alertas(self._sesion(contexto_ultimo=50_000, cr=40_000, turnos=4), AHORA)
        self.assertEqual(a, [])


class TestResumen(Base):
    def test_resumen_completo(self):
        self.escribir("s1", [linea_usuario("hola"), linea_uso(HOY, cr=90000)])
        self.escribir("agent-a9", [linea_uso(HOY, cr=1000)], hace_min=300)
        r = datos.resumen(1, AHORA, self.raiz, idx_titulos={})
        self.assertEqual(r["kpis"]["sesiones"], 1)      # subagente no cuenta
        self.assertEqual(len(r["sesiones"]), 2)
        self.assertEqual(r["dias"], 1)
        json.dumps(r)  # JSON-serializable de punta a punta


if __name__ == "__main__":
    unittest.main()
