#!/usr/bin/env python3

import json
import os
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

from plate_recognition import recognition_api


class RecognitionHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/recognize":
            self._write_json({"error": "Not found."}, 404)
            return

        api_key = os.environ.get("PLATE_RECOGNIZER_API_KEY")
        if not api_key:
            self._write_json(
                {
                    "error": (
                        "Recognition is not configured. Set "
                        "PLATE_RECOGNIZER_API_KEY before starting server.py."
                    )
                },
                503,
            )
            return

        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            self._write_json({"error": "Upload an image as multipart form data."}, 400)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._write_json({"error": "Invalid request length."}, 400)
            return
        body = self.rfile.read(content_length)
        message = BytesParser(policy=policy.default).parsebytes(
            f"Content-Type: {content_type}\r\n"
            "MIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        )
        image_field = next(
            (
                part
                for part in message.iter_attachments()
                if part.get_param("name", header="content-disposition") == "image"
            ),
            None,
        )
        if image_field is None:
            self._write_json({"error": "The request did not include an image."}, 400)
            return

        try:
            image = BytesIO(image_field.get_payload(decode=True) or b"")
            result = recognition_api(
                image,
                api_key=api_key,
                exit_on_error=False,
            )
            result["filename"] = Path(image_field.get_filename() or "upload").name
            self._write_json(result, 200)
        except Exception as error:
            self._write_json({"error": str(error)}, 502)

    def _write_json(self, payload, status):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("ALPR_BACKEND_PORT", "8000"))
    print(f"ALPR recognition backend listening on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), RecognitionHandler).serve_forever()
