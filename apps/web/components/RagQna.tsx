'use client';

import React, { useState } from 'react';
import AppSidebar from './AppSidebar';
import { BookOpen, Loader2, MessageCircleQuestion, Send } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'What is phishing?',
  'How do I verify a suspicious message?',
  'What should I never share online?',
  'How do I report a scam?',
] as const;

interface RagSource {
  document_name: string;
  chunk_index: number;
  snippet: string;
  distance: number;
}

interface RagAskResponse {
  success: boolean;
  question: string;
  answer: string;
  sources: RagSource[];
  error?: string;
}

const RagQna = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagAskResponse | null>(null);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = (await response.json()) as RagAskResponse & { detail?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.detail || `Server returned status ${response.status}`);
      }

      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FC] font-sans text-[#15171E]">
      <AppSidebar activeHref="/qna" />
      <main className="ml-64 flex-1 px-6 py-12">
        <div className="mx-auto max-w-3xl">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F4FD] text-[#2E347E]">
            <BookOpen size={28} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#2E347E]">Document Q&amp;A</h1>
          <p className="mt-2 text-sm text-[#575C6B]">
            Ask questions about the lesson documents. Answers use retrieval from your database, then Groq.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-[#E6E8EF] bg-white p-6 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#575C6B]">
            Try a question
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => setQuestion(pill)}
                className="rounded-full bg-[#F3F4FD] px-4 py-2 text-sm font-semibold text-[#2E347E] transition hover:bg-[#E6E8EF]"
              >
                {pill}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#E6E8EF] bg-white p-6 shadow-sm">
          <label
            htmlFor="rag-question"
            className="mb-2 flex items-center gap-2 text-sm font-bold text-[#15171E]"
          >
            <MessageCircleQuestion size={18} className="text-[#2E347E]" />
            Your question
          </label>
          <textarea
            id="rag-question"
            className="h-32 w-full resize-none rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] p-4 text-sm focus:border-[#2E347E] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20"
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="flex items-center gap-2 rounded-xl bg-[#2E347E] px-6 py-3 font-bold text-white shadow-md transition hover:bg-[#262B64] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Asking...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Ask
                </>
              )}
            </button>
          </div>
        </section>

        {result && (
          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-[#E6E8EF] bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold text-[#2E347E]">Answer</h2>
              <p className="whitespace-pre-wrap leading-relaxed text-[#15171E]">{result.answer}</p>
            </div>

            <div className="rounded-2xl border border-[#E6E8EF] bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-xl font-bold text-[#15171E]">Sources</h2>
              <p className="mb-4 text-sm text-[#575C6B]">
                Retrieved document chunks used as context (lower distance = closer match).
              </p>
              {result.sources.length === 0 ? (
                <p className="text-sm text-[#575C6B]">No chunks were retrieved.</p>
              ) : (
                <ul className="space-y-4">
                  {result.sources.map((source) => (
                    <li
                      key={`${source.document_name}-${source.chunk_index}`}
                      className="rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] p-4"
                    >
                      <p className="text-sm font-bold text-[#2E347E]">
                        {source.document_name} (chunk {source.chunk_index})
                      </p>
                      <p className="mt-1 text-xs text-[#575C6B]">
                        L2 distance: {source.distance.toFixed(4)}
                      </p>
                      <p className="mt-2 text-sm text-[#15171E]">{source.snippet}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
        </div>
      </main>
    </div>
  );
};

export default RagQna;
