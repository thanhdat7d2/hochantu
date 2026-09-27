import http.server
import socketserver
import os
import sys
import webbrowser
import subprocess
import threading
import time

# Port 75832 exceeds the 16-bit TCP port range (1-65535), so 7583 is used as the standard port.
PORT = 7583
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Prevent aggressive browser caching of app scripts/styles during development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Compact log format
        sys.stderr.write(f"[Server] {self.address_string()} - {format % args}\n")


def open_browser(url):
    time.sleep(0.6)
    try:
        # Try to open directly in Google Chrome if available on Windows
        chrome_paths = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
        opened = False
        for path in chrome_paths:
            if os.path.exists(path):
                subprocess.Popen([path, url])
                opened = True
                break
        if not opened:
            webbrowser.open(url)
    except Exception as e:
        print(f"Browser launch note: {e}")
        webbrowser.open(url)


def run():
    os.chdir(DIRECTORY)
    # Enable address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHTTPHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"==================================================")
        print(f"  Học Hán Tự - Spaced Repetition App")
        print(f"  Server running at: {url}")
        print(f"  Serving directory: {DIRECTORY}")
        print(f"  Press Ctrl+C to stop the server.")
        print(f"==================================================")

        # Launch browser in a background thread
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer shutting down gracefully.")
            httpd.shutdown()


if __name__ == "__main__":
    run()
