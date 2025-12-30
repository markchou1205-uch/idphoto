from http.server import BaseHTTPRequestHandler
from rembg import remove
from io import BytesIO
from PIL import Image
import base64
import cgi

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse Content-Length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Content-Length required")
                return

            # Read Body
            post_data = self.rfile.read(content_length)
            
            # Open Image
            input_image = Image.open(BytesIO(post_data))
            
            # Execute Remove Background
            # alpha_matting=True gives better edges for hair
            output_image = remove(input_image, alpha_matting=True)
            
            # Save to Buffer
            buffered = BytesIO()
            output_image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()

            # Send Response
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*') # CORS for dev
            self.end_headers()
            self.wfile.write(img_str.encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
