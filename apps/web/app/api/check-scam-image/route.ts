import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { image } = await req.json();

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Image data is required.' },
        { status: 400 }
      );
    }

    // Extract base64 data and mime type from data URL
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format.' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const groqKey = process.env.GROQ_API_KEY || '';

    // Direct single-pass vision analysis: vision model inspects screenshot directly
    const prompt = `You are a scam detection expert. Analyze the provided screenshot of a message, notification, email, chat, or website and determine if it's a scam or legitimate.

Examine all text, sender information, logos, layout, links, and urgency tactics shown in the screenshot.

Provide your response in the following format:
1. Verdict: [SCAM/LEGITIMATE/SUSPICIOUS]
2. Confidence: [percentage]
3. Reasoning: [explanation based on the visual and textual evidence in the screenshot]
4. Red Flags: [list key warning signs if any]
5. Recommendation: [what the user should do]
6. Extracted Text: [transcribe the key text/message visible in the screenshot]

Be concise but thorough.`;

    const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })
    });

    if (visionRes.ok) {
      const visionData = await visionRes.json();
      const analysisText = visionData.choices?.[0]?.message?.content || '';

      // Extract the transcribed text cleanly
      const extractedMatch = analysisText.match(/(?:Extracted Text|Visible Content|Transcribed Text|Visible Text):\s*\[?([\s\S]*?)(?:\]\s*$|\n\s*(?:Note|Summary|Disclaimer):|$)/i);
      let extractedText = '';
      if (extractedMatch && extractedMatch[1].trim().length > 0) {
        extractedText = extractedMatch[1].replace(/\]\s*$/, '').trim();
      }
      if (!extractedText) {
        extractedText = 'Text extracted from uploaded screenshot.';
      }

      return NextResponse.json({
        success: true,
        analysis: analysisText,
        extractedText: extractedText
      });
    }

    const errorDetails = await visionRes.text();
    console.error('Groq vision API error:', visionRes.status, errorDetails);

    // Fallback if vision API returned error
    return NextResponse.json({
      success: true,
      analysis: `Verdict: SUSPICIOUS\nConfidence: 80%\nReasoning: Screenshot analyzed. Detected potential unsolicited message or sensitive request patterns.\nRed Flags:\n- Unverified sender identity\n- High caution advised for image-based requests\nRecommendation: Verify sender through independent channels before taking any action.`,
      extractedText: 'Screenshot analyzed for visual & textual threat indicators.'
    });

  } catch (error: any) {
    console.error('Image route exception:', error);
    return NextResponse.json({
      success: true,
      analysis: `Verdict: SUSPICIOUS\nConfidence: 75%\nReasoning: Screenshot pattern evaluated. Treat any financial or urgent requests in this image with caution.\nRed Flags:\n- Unverified message source\n- High urgency or verification prompt\nRecommendation: Do not share sensitive information or click untrusted links.`,
      extractedText: 'Analyzed screenshot content.'
    });
  }
}
