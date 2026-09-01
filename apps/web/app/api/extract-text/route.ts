import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const VISION_MODELS = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'] as const;
const MAX_RETRIES = 2;

const EXTRACT_PROMPT = `You are an OCR tool. Transcribe all message text visible in this screenshot.

Include:
- Sender name or label (e.g. "Amazon", "+1 555-1234")
- The complete message body, word for word
- URLs, codes, and phone numbers exactly as shown

Skip only obvious phone UI chrome: status bar icons, battery %, signal labels, and button labels like "Reply" or "Delete".

Output plain text only. No JSON, labels, or commentary.`;

const FALLBACK_PROMPT = `Extract every piece of readable text from this image, top to bottom.

Include message content, sender names, links, and numbers. Ignore only the status bar at the very top.

Plain text only.`;

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type GroqErrorBody = {
  error?: { message?: string; code?: string };
};

function inferMimeType(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return null;
}

function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n');
  }
  return '';
}

function stripThinkingArtifacts(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/``[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function isUiChromeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^UNREADABLE$/i.test(t)) return false;
  if (/^\d{1,2}:\d{2}(\s?(AM|PM))?$/i.test(t)) return true;
  if (/^\d{1,3}%$/.test(t)) return true;
  if (/^(5G|4G|LTE|3G|Wi-?Fi)$/i.test(t)) return true;
  if (/^(Delete Message|Reply|Forward|Back|Done|Cancel|Mark as Read)$/i.test(t)) return true;
  return false;
}

function normalizeExtractedText(raw: string): string {
  const cleaned = stripThinkingArtifacts(raw).replace(/^["']|["']$/g, '');
  if (/^UNREADABLE$/i.test(cleaned)) return '';

  const lines = cleaned.split('\n');
  const messageLines = lines.filter((line) => !isUiChromeLine(line));
  const filtered = (messageLines.length > 0 ? messageLines : lines).join('\n').trim();
  const normalized = filtered.replace(/\n{3,}/g, '\n\n').trim();

  return normalized || cleaned.trim();
}

function parseRetryDelayMs(body: string): number {
  const match = body.match(/try again in ([\d.]+)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  }
  return 5000;
}

function parseGroqError(body: string): { code?: string; message: string } {
  try {
    const parsed = JSON.parse(body) as GroqErrorBody;
    return {
      code: parsed.error?.code,
      message: parsed.error?.message ?? 'Groq API request failed.',
    };
  } catch {
    return { message: 'Groq API request failed.' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callVisionModel(
  groqKey: string,
  model: string,
  mimeType: string,
  base64: string,
  prompt: string
): Promise<
  | { ok: true; text: string; raw: string }
  | { ok: false; status: number; body: string; retryable: boolean; modelUnavailable: boolean }
> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    temperature: 0,
    max_completion_tokens: 1024,
  };

  if (model === 'qwen/qwen3.6-27b') {
    body.reasoning_effort = 'none';
    body.reasoning_format = 'hidden';
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseText = await groqRes.text();

  if (!groqRes.ok) {
    const parsed = parseGroqError(responseText);
    const retryable =
      parsed.code === 'rate_limit_exceeded' ||
      groqRes.status === 429 ||
      groqRes.status === 503;
    const modelUnavailable = parsed.code === 'model_not_found';
    return {
      ok: false,
      status: groqRes.status,
      body: responseText,
      retryable,
      modelUnavailable,
    };
  }

  const groqData = JSON.parse(responseText) as GroqResponse;
  const raw = extractMessageContent(groqData.choices?.[0]?.message?.content);
  const text = normalizeExtractedText(raw);

  return { ok: true, text, raw };
}

async function extractWithModel(
  groqKey: string,
  model: string,
  mimeType: string,
  base64: string,
  prompt: string
): Promise<
  | { ok: true; text: string }
  | { ok: false; userMessage: string; rateLimited: boolean; modelUnavailable: boolean; empty: boolean }
> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await callVisionModel(groqKey, model, mimeType, base64, prompt);

    if (result.ok) {
      if (result.text) {
        return { ok: true, text: result.text };
      }

      if (result.raw.trim()) {
        console.warn(`Groq (${model}) returned content but normalization emptied it:`, result.raw.slice(0, 200));
        const fallback = stripThinkingArtifacts(result.raw).trim();
        if (fallback && !/^UNREADABLE$/i.test(fallback)) {
          return { ok: true, text: fallback };
        }
      }

      return {
        ok: false,
        userMessage: 'No readable message text found in the screenshot.',
        rateLimited: false,
        modelUnavailable: false,
        empty: true,
      };
    }

    const parsed = parseGroqError(result.body);
    console.error(`Groq vision error (${model}, attempt ${attempt + 1}):`, parsed.message);

    if (result.modelUnavailable) {
      return {
        ok: false,
        userMessage: 'Vision model unavailable.',
        rateLimited: false,
        modelUnavailable: true,
        empty: false,
      };
    }

    if (!result.retryable) {
      return {
        ok: false,
        userMessage: parsed.message,
        rateLimited: false,
        modelUnavailable: false,
        empty: false,
      };
    }

    if (attempt < MAX_RETRIES - 1) {
      await sleep(parseRetryDelayMs(result.body));
      continue;
    }

    return {
      ok: false,
      userMessage: 'Groq rate limit reached. Wait 20–30 seconds and try again.',
      rateLimited: true,
      modelUnavailable: false,
      empty: false,
    };
  }

  return {
    ok: false,
    userMessage: 'Failed to extract text from image.',
    rateLimited: false,
    modelUnavailable: false,
    empty: true,
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Image file is required.' },
        { status: 400 }
      );
    }

    const mimeType = inferMimeType(file);
    if (!mimeType) {
      return NextResponse.json(
        { success: false, error: 'Only PNG, JPEG, and WebP images are supported.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Image must be 5MB or smaller.' },
        { status: 400 }
      );
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json(
        { success: false, error: 'GROQ_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const attempts: Array<{ model: string; prompt: string }> = [
      { model: VISION_MODELS[0], prompt: EXTRACT_PROMPT },
      { model: VISION_MODELS[1], prompt: EXTRACT_PROMPT },
      { model: VISION_MODELS[0], prompt: FALLBACK_PROMPT },
      { model: VISION_MODELS[1], prompt: FALLBACK_PROMPT },
    ];

    let lastError = 'Failed to extract text from image.';
    let rateLimited = false;

    for (const { model, prompt } of attempts) {
      const result = await extractWithModel(groqKey, model, mimeType, base64, prompt);

      if (result.ok) {
        return NextResponse.json({ success: true, text: result.text });
      }

      lastError = result.userMessage;

      if (result.modelUnavailable || result.rateLimited || result.empty) {
        if (result.rateLimited) rateLimited = true;
        continue;
      }

      break;
    }

    return NextResponse.json(
      { success: false, error: lastError || 'No message text found in the image.' },
      { status: rateLimited ? 429 : 422 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
