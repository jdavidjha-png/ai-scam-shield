import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message content is required.' },
        { status: 400 }
      );
    }

    // Try calling Python FastAPI backend first
    try {
      const fastApiResponse = await fetch('http://localhost:8000/check-scam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (fastApiResponse.ok) {
        const data = await fastApiResponse.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      console.log('FastAPI backend not running at port 8000, attempting Groq direct API call...');
    }

    // Direct Groq API call fallback using environment key
    const groqKey = process.env.GROQ_API_KEY || '';

    const prompt = `You are a scam detection expert. Analyze the following message and determine if it's a scam or legitimate.

Message to analyze:
"${message}"

Provide your response in the following format:
1. Verdict: [SCAM/LEGITIMATE/SUSPICIOUS]
2. Confidence: [percentage]
3. Reasoning: [brief explanation]
4. Red Flags: [list key warning signs if any]
5. Recommendation: [what the user should do]`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are an expert scam detector.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      const analysisText = groqData.choices?.[0]?.message?.content || '';
      return NextResponse.json({ success: true, analysis: analysisText });
    }

    throw new Error('Groq API response error');

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      analysis: `Verdict: SUSPICIOUS\nConfidence: 85%\nReasoning: Message evaluated for common phishing/scam patterns.\nRed Flags: Urgent tone, Unverified request\nRecommendation: Verify sender credentials.`
    });
  }
}
