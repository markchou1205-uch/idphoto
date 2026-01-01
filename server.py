
from http.server import HTTPServer, SimpleHTTPRequestHandler
from api.index import handler as APIHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/remove-bg':
            handler = APIHandler(self.request, self.client_address, self.server)
            handler.do_POST()
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == '/api/remove-bg':
            handler = APIHandler(self.request, self.client_address, self.server)
            handler.do_GET()
        else:
            super().do_GET()

print("Starting Local Server on port 8000...")
print("Open http://localhost:8000 in your browser.")
httpd = HTTPServer(('localhost', 8000), CORSRequestHandler)
httpd.serve_forever()
