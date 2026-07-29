"""
servidor.py — HTTP local del Centro de Control de Consumo de Tokens.

Solo GET, solo 127.0.0.1, solo lectura (constitución §1.2/§1.3).
Uso: python3 servidor.py [puerto]
"""
import json
import os
import sys
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import datos

AQUI = os.path.dirname(os.path.abspath(__file__))
PUERTO_DEFECTO = 8899


class Manejador(BaseHTTPRequestHandler):
    server_version = "Modelos/1.0"

    def log_message(self, fmt, *args):  # silencio: sin ruido en consola
        pass

    def _responder(self, cuerpo, tipo, codigo=200):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        ruta = urlparse(self.path)
        if ruta.path in ("/", "/index.html"):
            with open(os.path.join(AQUI, "web", "index.html"), "rb") as fh:
                self._responder(fh.read(), "text/html; charset=utf-8")
        elif ruta.path == "/api/resumen":
            q = parse_qs(ruta.query)
            try:
                dias = max(1, min(90, int(q.get("dias", ["1"])[0])))
            except ValueError:
                dias = 1
            cuerpo = json.dumps(datos.resumen(dias)).encode("utf-8")
            self._responder(cuerpo, "application/json; charset=utf-8")
        else:
            self._responder(b"no encontrado", "text/plain; charset=utf-8", 404)


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else PUERTO_DEFECTO
    try:
        srv = HTTPServer(("127.0.0.1", puerto), Manejador)
    except socket.error as e:
        print("ERROR: no puedo abrir 127.0.0.1:%d (%s). ¿Puerto ocupado? "
              "Prueba: python3 servidor.py %d" % (puerto, e, puerto + 1))
        sys.exit(1)
    print("MODELOS · Centro de Control -> http://127.0.0.1:%d  (Ctrl-C para parar)" % puerto)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
