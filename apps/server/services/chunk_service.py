DEFAULT_MAX_CHUNK_CHARS = 500


def chunk_text(text: str, max_chars: int = DEFAULT_MAX_CHUNK_CHARS) -> list[str]:
    """Split text into paragraph-based chunks with a maximum character length."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        stripped = text.strip()
        return [stripped] if stripped else []

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if not current:
            candidate = paragraph
        else:
            candidate = f"{current}\n\n{paragraph}"

        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        if len(paragraph) <= max_chars:
            current = paragraph
            continue

        start = 0
        while start < len(paragraph):
            chunks.append(paragraph[start : start + max_chars])
            start += max_chars

    if current:
        chunks.append(current)

    return chunks
