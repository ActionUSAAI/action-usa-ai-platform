from http.server import BaseHTTPRequestHandler
import json
import pikepdf
from pypdf import PdfReader, PdfWriter
import io
import os

PDF_PATH = os.path.join(os.path.dirname(__file__), 'i-129-base.pdf')

def remove_xfa_and_fill(field_values: dict) -> bytes:
    # Paso 1: eliminar /XFA del PDF base
    pdf = pikepdf.open(PDF_PATH)
    if '/XFA' in pdf.Root.AcroForm:
        del pdf.Root.AcroForm['/XFA']
    buffer = io.BytesIO()
    pdf.save(buffer)
    buffer.seek(0)

    # Paso 2: rellenar con pypdf
    reader = PdfReader(buffer)
    writer = PdfWriter()
    writer.append(reader)

    for page in writer.pages:
        writer.update_page_form_field_values(page, field_values)

    writer.set_need_appearances_writer(True)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body)
            field_values = data.get('fieldValues', {})

            pdf_bytes = remove_xfa_and_fill(field_values)

            self.send_response(200)
            self.send_header('Content-type', 'application/pdf')
            self.end_headers()
            self.wfile.write(pdf_bytes)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
