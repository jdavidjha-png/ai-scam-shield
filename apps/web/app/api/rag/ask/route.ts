import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question is required.' },
        { status: 400 }
      );
    }

    const fastApiResponse = await fetch('http://localhost:8000/api/rag/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim() }),
    });

    const data = await fastApiResponse.json().catch(() => ({}));

    if (!fastApiResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.detail || 'Unable to get an answer from the RAG service.',
        },
        { status: fastApiResponse.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error contacting the backend.';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 503 }
    );
  }
}
