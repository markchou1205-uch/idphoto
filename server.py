
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from api.index import handler as APIHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/remove-bg':
            # Correctly delegate to the APIHandler's method using the current instance
            APIHandler.do_POST(self)
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == '/api/remove-bg':
            # Correctly delegate to the APIHandler's method using the current instance
            APIHandler.do_GET(self)
        else:
            super().do_GET()

print("Starting Local Server on port 8000 (Threading)...")
print("Open http://localhost:8000 in your browser.")
httpd = ThreadingHTTPServer(('localhost', 8000), CORSRequestHandler)
httpd.serve_forever()
