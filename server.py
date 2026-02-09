#!/usr/bin/env python3
"""
Simple HTTP server with proxy support for the frontend.
Serves static files from the current directory and proxies API requests to the backend.
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
import urllib.request
import json

BACKEND_URL = 'http://localhost:8000'

class ProxyHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests"""
        if self.path.startswith('/api/') or self.path.startswith('/ws/'):
            # Proxy API requests to backend
            self.proxy_request()
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path.startswith('/api/'):
            # Proxy API requests to backend
            self.proxy_request()
        else:
            self.send_error(405, "Method Not Allowed")
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def proxy_request(self):
        """Proxy HTTP request to backend"""
        try:
            # Build backend URL
            backend_url = BACKEND_URL + self.path
            
            # Prepare request
            req_headers = {}
            content_length = self.headers.get('Content-Length')
            
            # Copy relevant headers
            for header, value in self.headers.items():
                if header.lower() not in ['host', 'connection', 'content-length']:
                    req_headers[header] = value
            
            # Get request body if POST
            body = None
            if content_length:
                body = self.rfile.read(int(content_length))
            
            # Create request
            request = urllib.request.Request(
                backend_url,
                data=body,
                headers=req_headers,
                method=self.command
            )
            
            # Make request to backend
            with urllib.request.urlopen(request) as response:
                status_code = response.status
                response_headers = dict(response.headers)
                response_body = response.read()
            
            # Check if the response is JSON
            try:
                json.loads(response_body)
            except json.JSONDecodeError:
                # If not JSON, wrap it in a JSON object
                response_body = json.dumps({"error": response_body.decode('utf-8')}).encode()

            # Send response
            self.send_response(status_code)

            # Set CORS headers
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            
            # Set other response headers
            for header, value in response_headers.items():
                if header.lower() not in ['transfer-encoding', 'content-encoding']:
                    self.send_header(header, value)

            self.send_header('Content-Length', len(response_body))
            self.end_headers()
            self.wfile.write(response_body)
            
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = json.dumps({
                'error': f'Backend error: {e.reason}'
            }).encode()
            self.wfile.write(error_response)
        except Exception as e:
            self.send_error(500, f"Proxy error: {str(e)}")
    
    def log_message(self, format, *args):
        """Log messages"""
        print(f"[{self.client_address[0]}] {format % args}")

def run_server(port=3000):
    """Run the proxy server"""
    # Change to the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    server_address = ('', port)
    httpd = HTTPServer(server_address, ProxyHTTPRequestHandler)
    print(f"Serving frontend on http://localhost:{port}")
    print(f"Backend proxied to {BACKEND_URL}")
    print("Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
        sys.exit(0)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    run_server(port)
