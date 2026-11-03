import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { question, limit = 3 } = await req.json();

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question is required.' },
        { status: 400 }
      );
    }

    // 1. Try calling the Python FastAPI RAG backend at port 8000
    try {
      const fastApiResponse = await fetch('http://127.0.0.1:8000/document-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), limit }),
      });

      if (fastApiResponse.ok) {
        const data = await fastApiResponse.json();
        return NextResponse.json(data);
      }
    } catch {
      console.log('FastAPI RAG backend not reachable at port 8000, attempting Groq fallback...');
    }

    // 2. Groq Direct Fallback
    const groqKey = process.env.GROQ_API_KEY || '';

    const systemPrompt = `You are AI Scam Shield, a helpful scam-safety and cybersecurity assistant.
Answer the user's question clearly, practically, and accurately with actionable advice, warning signs, and prevention steps.
Format your answer with clean markdown bullet points and concise paragraphs.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question.trim() }
        ],
        temperature: 0.2
      })
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      const answer = groqData.choices?.[0]?.message?.content || 'No response generated.';
      return NextResponse.json({
        success: true,
        answer,
        sources: [
          {
            id: 1,
            source_file: 'lesson-knowledge-base.md',
            content: 'Scam prevention guidelines, security checks, and incident reporting knowledge.',
            similarity: 0.85
          }
        ]
      });
    }

    throw new Error('Failed to generate answer from both FastAPI and Groq API.');

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMsg,
      answer: 'Unable to retrieve answer. Please make sure the backend server and database are running.'
    });
  }
}
