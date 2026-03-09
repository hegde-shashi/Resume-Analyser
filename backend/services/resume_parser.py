import base64
import io
import os


def get_resume_text(file_b64: str, filename: str = "resume.pdf"):
    """
    Decode base64 file and extract text.
    Supports: pdf, txt, docx, doc
    Returns: list of text chunks (plain strings)
    """
    file_bytes = base64.b64decode(file_b64)
    ext = os.path.splitext(filename)[-1].lower()

    # ── Extract raw text based on file type ──────────────────────
    if ext == ".pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        text = "\n".join(
            page.extract_text() or "" for page in reader.pages
        )

    elif ext == ".docx":
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        text = "\n".join(para.text for para in doc.paragraphs)

    elif ext == ".txt":
        text = file_bytes.decode("utf-8", errors="ignore")

    else:
        # try plain text as fallback
        text = file_bytes.decode("utf-8", errors="ignore")

    text = text.strip()
    if not text:
        return []

    # ── Simple chunking (800 chars, 150 overlap) ──────────────────
    chunk_size = 800
    overlap    = 150
    chunks = []
    start  = 0
    while start < len(text):
        chunks.append(text[start : start + chunk_size])
        start += chunk_size - overlap

    return chunks
