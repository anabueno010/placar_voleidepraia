"""Servidor local para abrir o placar ARENA no navegador."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import socket
import webbrowser

ROOT = Path(__file__).resolve().parent

class ScoreboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        print("[ARENA] " + fmt % args)


def available_port(start=8000):
    for port in range(start, start + 50):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("Não encontrei uma porta livre entre 8000 e 8049.")


if __name__ == "__main__":
    port = available_port()
    url = f"http://127.0.0.1:{port}/"
    server = ThreadingHTTPServer(("127.0.0.1", port), ScoreboardHandler)
    print(f"Placar aberto em {url}")
    print("Para encerrar, pressione Ctrl+C neste terminal.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
