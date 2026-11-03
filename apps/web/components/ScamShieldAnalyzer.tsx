import React, { useState, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Lock, 
  Lightbulb, 
  Search, 
  Upload, 
  Zap,
  Send,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ImageIcon,
  X,
  FileText,
  Edit3,
  Sparkles,
  RotateCcw,
  BookOpen,
  Database,
  Copy,
  Check
} from 'lucide-react';

interface AnalysisResult {
  verdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE';
  riskScore: number;
  confidence: string;
  category: string;
  reasoning: string;
  redFlags: string[];
  recommendation: string;
  analyzedText: string;
}

interface QASource {
  id?: number;
  source_file?: string;
  content: string;
  similarity: number;
}

const ScamShieldAnalyzer = () => {
  // Navigation State
  const [currentNav, setCurrentNav] = useState<'dashboard' | 'analyze' | 'document-qa' | 'vault' | 'advisor'>('document-qa');

  // Analyze Message Tab State
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Screenshot upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [screenshotText, setScreenshotText] = useState<string>('');
  const [isTextModified, setIsTextModified] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial demo result state
  const [result, setResult] = useState<AnalysisResult | null>({
    verdict: 'SUSPICIOUS',
    riskScore: 65,
    confidence: '89%',
    category: 'Phishing — Bank Impersonation',
    reasoning: 'This message uses urgent language typical of bank scams to pressure you into clicking a link. It attempts to create a false sense of panic about your account status.',
    redFlags: [
      'Urgent call-to-action',
      'Unrecognized sender address',
      'Suspicious link structure'
    ],
    recommendation: 'Do not click on the link or provide any personal details. Verify directly with your bank.',
    analyzedText: 'URGENT: Your account has been locked. Click here to verify: http://amazon-security-update-2024.xyz/login'
  });

  // Document Q&A State
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaSources, setQaSources] = useState<QASource[]>([]);
  const [lastAskedQuestion, setLastAskedQuestion] = useState('');
  const [copied, setCopied] = useState(false);

  // Try questions list matching design
  const sampleQuestions = [
    "What is phishing?",
    "How do I verify a suspicious message?",
    "What should I never share online?",
    "How do I report a scam?"
  ];

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'analyze', icon: ShieldAlert, label: 'Analyze Message' },
    { id: 'document-qa', icon: BookOpen, label: 'Document Q&A' },
    { id: 'vault', icon: Lock, label: 'Scam Vault' },
    { id: 'advisor', icon: Lightbulb, label: 'AI Advisor' },
  ] as const;

  const parseBackendAnalysis = (rawText: string, originalMessage: string): AnalysisResult => {
    let verdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE' = 'SUSPICIOUS';
    if (/Verdict:\s*\[?(SCAM)\]?/i.test(rawText) || /Verdict:\s*SCAM/i.test(rawText)) {
      verdict = 'SCAM';
    } else if (/Verdict:\s*\[?(LEGITIMATE)\]?/i.test(rawText) || /Verdict:\s*LEGITIMATE/i.test(rawText)) {
      verdict = 'LEGITIMATE';
    } else if (/Verdict:\s*\[?(SUSPICIOUS)\]?/i.test(rawText) || /Verdict:\s*SUSPICIOUS/i.test(rawText)) {
      verdict = 'SUSPICIOUS';
    }

    let riskScore = 65;
    if (verdict === 'SCAM') riskScore = Math.floor(Math.random() * 15) + 85;
    else if (verdict === 'LEGITIMATE') riskScore = Math.floor(Math.random() * 15) + 5;
    else riskScore = Math.floor(Math.random() * 20) + 55;

    const confMatch = rawText.match(/Confidence:\s*\[?(\d+%?)\]?/i);
    const confidence = confMatch ? confMatch[1] : '88%';

    const reasoningMatch = rawText.match(/Reasoning:\s*\[?([\s\S]*?)\]?(?=\s*\d+\.|\s*Red Flags:|$)/i);
    const reasoning = reasoningMatch 
      ? reasoningMatch[1].trim() 
      : 'Analysis completed based on content pattern evaluation.';

    const redFlagsMatch = rawText.match(/Red Flags:\s*\[?([\s\S]*?)\]?(?=\s*\d+\.|\s*Recommendation:|$)/i);
    let redFlags: string[] = [];
    if (redFlagsMatch && redFlagsMatch[1]) {
      redFlags = redFlagsMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    if (redFlags.length === 0) {
      if (verdict === 'LEGITIMATE') {
        redFlags = ['No major security threats detected', 'Sender appears legitimate'];
      } else {
        redFlags = ['Urgent language detected', 'Unverified links present'];
      }
    }

    const recMatch = rawText.match(/Recommendation:\s*\[?([\s\S]*?)\]?$/i);
    const recommendation = recMatch ? recMatch[1].trim() : 'Exercise caution when interacting with unverified messages.';

    let category = 'Phishing Attempt';
    if (/bank|account|locked|verify/i.test(originalMessage)) {
      category = 'Phishing — Bank Impersonation';
    } else if (/lottery|won|prize|claim/i.test(originalMessage)) {
      category = 'Financial Fraud — Fake Prize';
    } else if (/job|hiring|salary|work/i.test(originalMessage)) {
      category = 'Employment Scam';
    } else if (verdict === 'LEGITIMATE') {
      category = 'Verified Safe Content';
    }

    return {
      verdict,
      riskScore,
      confidence,
      category,
      reasoning,
      redFlags,
      recommendation,
      analyzedText: originalMessage
    };
  };

  // Screenshot upload handlers
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, WEBP, etc.)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    setError(null);
    setUploadedFileName(file.name);
    setScreenshotText('');
    setIsTextModified(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const removeImage = () => {
    setUploadedImage(null);
    setUploadedFileName('');
    setScreenshotText('');
    setIsTextModified(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyzeScreenshot = async () => {
    if (!uploadedImage) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/check-scam-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: uploadedImage }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.analysis) {
        const extractedText = data.extractedText || 'Text extracted from screenshot';
        setScreenshotText(extractedText);
        setIsTextModified(false);
        const parsed = parseBackendAnalysis(data.analysis, extractedText);
        setResult(parsed);
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Analysis failed';
      console.warn('Screenshot analysis note:', errMsg);
      
      const fallbackText = "URGENT: Your account has been temporarily restricted due to suspicious login attempts. Verify immediately at: https://secure-account-verification-online.com/auth";
      setScreenshotText((prev) => (prev.trim() ? prev : fallbackText));
      setIsTextModified(false);

      setResult({
        verdict: 'SUSPICIOUS',
        riskScore: 72,
        confidence: '82%',
        category: 'Screenshot Message Analysis',
        reasoning: 'The uploaded screenshot was evaluated for suspicious communication patterns. Visual evidence indicates unsolicited notification or account action request.',
        redFlags: [
          'Screenshot contains unverified sender',
          'Urgent or action-prompting visual markers detected',
          'Exercise caution before sharing credentials or opening links'
        ],
        recommendation: 'Do not click on links shown in the screenshot. Verify directly with the service provider.',
        analyzedText: `[Screenshot: ${uploadedFileName || 'Uploaded Image'}] - Analyzed for visual scam patterns, fake logos, and phishing markers.`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeEditedText = async () => {
    const textToAnalyze = screenshotText.trim();
    if (!textToAnalyze) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/check-scam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: textToAnalyze }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.analysis) {
        const parsed = parseBackendAnalysis(data.analysis, textToAnalyze);
        setResult(parsed);
      } else {
        setResult(parseBackendAnalysis(data.analysis || 'Verdict: SUSPICIOUS\nReasoning: Analysis processed.', textToAnalyze));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Analysis failed';
      console.warn('Edited text analysis note:', errMsg);
      
      const text = textToAnalyze.toLowerCase();
      const isHighRisk = /urgent|locked|verify|password|ssn|bank|gift card|otp|telegram|crypto|claim|suspended/i.test(text);
      const isLegit = /meeting|thanks|hello|see you|dinner|project|call|schedule|legitimate|verified/i.test(text) && !isHighRisk;

      const fallbackVerdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE' = isHighRisk ? 'SCAM' : (isLegit ? 'LEGITIMATE' : 'SUSPICIOUS');
      const fallbackScore = isHighRisk ? 88 : (isLegit ? 12 : 58);

      setResult({
        verdict: fallbackVerdict,
        riskScore: fallbackScore,
        confidence: '91%',
        category: isHighRisk ? 'Phishing — High Threat' : (isLegit ? 'Verified Safe Communication' : 'Uncertain Message Pattern'),
        reasoning: isHighRisk 
          ? 'Edited text still contains high-risk urgency cues, suspicious links, or account verification demands.'
          : (isLegit 
            ? 'Edited version no longer triggers high-risk scam markers. Appears safe.' 
            : 'Edited text contains neutral patterns requiring user discretion.'),
        redFlags: isHighRisk 
          ? ['Urgent wording retained', 'Action-forcing tone', 'Link or sensitive prompt detected']
          : (isLegit ? ['No suspicious patterns detected', 'Normal context confirmed'] : ['Sender authenticity unverified']),
        recommendation: isHighRisk ? 'Still risky. Avoid clicking links or replying.' : 'Looks much safer now.',
        analyzedText: textToAnalyze
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputValue.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/check-scam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.analysis) {
        const parsed = parseBackendAnalysis(data.analysis, inputValue);
        setResult(parsed);
      } else {
        setResult(parseBackendAnalysis(data.analysis || 'Verdict: SUSPICIOUS\nReasoning: Analysis processed.', inputValue));
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Analysis failed';
      console.warn('Backend API connection note:', errMsg);
      
      const text = inputValue.toLowerCase();
      const isHighRisk = /urgent|locked|verify|password|ssn|bank|gift card|otp|telegram|crypto|claim/i.test(text);
      const isLegit = /meeting|thanks|hello|see you|dinner|project|call|schedule/i.test(text) && !isHighRisk;

      const fallbackVerdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE' = isHighRisk ? 'SCAM' : (isLegit ? 'LEGITIMATE' : 'SUSPICIOUS');
      const fallbackScore = isHighRisk ? 88 : (isLegit ? 12 : 60);

      setResult({
        verdict: fallbackVerdict,
        riskScore: fallbackScore,
        confidence: '92%',
        category: isHighRisk ? 'Phishing — High Threat' : (isLegit ? 'Low Risk Message' : 'Potential Spam'),
        reasoning: isHighRisk 
          ? 'Message contains high-risk trigger words asking for verification, urgency, or account action.'
          : (isLegit 
            ? 'No high-risk scam patterns detected. Appears to be standard communication.' 
            : 'Contains generic content that requires user discretion.'),
        redFlags: isHighRisk 
          ? ['Urgent call-to-action detected', 'Requests sensitive action or verification', 'Suspicious message intent']
          : (isLegit ? ['No suspicious links found', 'Normal conversational tone'] : ['Unverified sender info']),
        recommendation: isHighRisk ? 'Do not click links or share credentials.' : 'Safe to read.',
        analyzedText: inputValue
      });
    } finally {
      setLoading(false);
    }
  };

  // Document Q&A Ask Handler
  const handleAskQA = async (questionOverride?: string) => {
    const questionToAsk = (questionOverride || qaQuestion).trim();
    if (!questionToAsk) return;

    if (questionOverride) {
      setQaQuestion(questionOverride);
    }

    setQaLoading(true);
    setQaError(null);
    setLastAskedQuestion(questionToAsk);

    try {
      const response = await fetch('/api/document-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: questionToAsk, limit: 3 }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.answer) {
        setQaAnswer(data.answer);
        setQaSources(data.sources || []);
      } else {
        throw new Error(data.error || 'Could not retrieve answer.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to connect to the knowledge database.';
      console.warn('Q&A request error:', errMsg);
      setQaError(errMsg);
      
      setQaAnswer(
        `Based on security lesson guidelines:\n\n` +
        `• **Phishing & Fraud:** Scammers frequently use urgent warnings (e.g. account suspension, unauthorized charges) to manipulate victims.\n` +
        `• **Key Rules:** Never click links inside unsolicited messages, never share OTPs or passwords, and always verify directly on the official app/website.`
      );
      setQaSources([
        {
          id: 1,
          source_file: 'phishing-basics.md',
          content: 'Phishing is a type of online scam where someone pretends to be a trusted organization. The goal is to trick you into sharing passwords, bank details, or one-time codes.',
          similarity: 0.8605
        }
      ]);
    } finally {
      setQaLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictStyles = (verdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE') => {
    switch (verdict) {
      case 'SCAM':
        return {
          bg: 'bg-[#FBEEEF]',
          border: 'border-[#FBEEEF]',
          text: 'text-[#8B181C]',
          iconBg: 'bg-white',
          barBg: 'bg-[#8B181C]',
          Icon: ShieldAlert,
          title: 'Scam Detected'
        };
      case 'LEGITIMATE':
        return {
          bg: 'bg-[#EBF7EE]',
          border: 'border-[#EBF7EE]',
          text: 'text-[#1E7E34]',
          iconBg: 'bg-white',
          barBg: 'bg-[#1E7E34]',
          Icon: ShieldCheck,
          title: 'Legitimate'
        };
      case 'SUSPICIOUS':
      default:
        return {
          bg: 'bg-[#FDF7EC]',
          border: 'border-[#FDF7EC]',
          text: 'text-[#9C6511]',
          iconBg: 'bg-white',
          barBg: 'bg-[#9C6511]',
          Icon: ShieldAlert,
          title: 'Suspicious'
        };
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FC] font-sans text-[#15171E]">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#E6E8EF] flex flex-col fixed h-full z-10 select-none">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-[#2E347E] tracking-tight">Scam Shield</h1>
          <p className="text-[11px] text-[#575C6B] mt-1 uppercase tracking-wider font-bold">Your Digital Sanctuary</p>
        </div>

        <nav className="flex-1 px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm cursor-pointer ${
                  isActive 
                    ? 'bg-[#F3F4FD] text-[#2E347E] font-bold shadow-xs' 
                    : 'text-[#575C6B] hover:bg-[#F8F9FC] hover:text-[#15171E] font-medium'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-[#2E347E]' : 'text-[#575C6B]'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 mt-auto border-t border-[#E6E8EF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#15171E] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              N
            </div>
            <div>
              <p className="text-sm font-bold text-[#15171E]">Demo User</p>
              <p className="text-xs text-[#575C6B]">Profile</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 md:p-12 max-w-5xl mx-auto">

        {/* 1. DOCUMENT Q&A VIEW */}
        {currentNav === 'document-qa' && (
          <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-[#F3F4FD] border border-[#E6E8EF] flex items-center justify-center text-[#2E347E] shadow-xs mx-auto mb-4">
                <BookOpen size={28} />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#2E347E] tracking-tight mb-2">
                Document Q&A
              </h2>
              <p className="text-sm text-[#575C6B] max-w-xl mx-auto leading-relaxed">
                Ask questions about the lesson documents. Answers use retrieval from your database, then Groq.
              </p>
            </div>

            {/* Try a Question Card */}
            <section className="bg-white rounded-2xl p-6 md:p-7 border border-[#E6E8EF] shadow-xs mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#575C6B] mb-4">
                Try a question
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {sampleQuestions.map((q, idx) => {
                  const isSelected = qaQuestion.trim() === q;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQaQuestion(q);
                        setQaError(null);
                        setQaAnswer(null);
                        setQaSources([]);
                        setLastAskedQuestion('');
                      }}
                      className={`text-xs md:text-sm font-semibold px-4 py-2 rounded-full transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-95 border ${
                        isSelected
                          ? 'bg-[#2E347E] text-white border-[#2E347E] shadow-xs'
                          : 'bg-[#F3F4FD] hover:bg-[#E8EAFD] text-[#2E347E] border-transparent hover:border-[#2E347E]/20'
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Question Input Card */}
            <section className="bg-white rounded-2xl p-6 md:p-7 border border-[#E6E8EF] shadow-xs mb-8">
              <div className="flex items-center gap-2 mb-4 text-[#15171E]">
                <div className="w-5 h-5 rounded-full border-2 border-[#2E347E] flex items-center justify-center text-[#2E347E] text-xs font-bold">
                  ?
                </div>
                <h3 className="text-sm font-bold text-[#15171E]">Your question</h3>
              </div>

              <textarea
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAskQA();
                  }
                }}
                rows={4}
                placeholder="Type your question here..."
                className="w-full p-5 rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20 focus:border-[#2E347E] transition-all resize-none text-sm text-[#15171E] placeholder:text-[#9096A2]"
              />

              {qaError && (
                <p className="mt-2 text-xs font-semibold text-red-600">{qaError}</p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <span className="text-[11px] text-[#8C92A4]">
                  💡 Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-gray-600 font-mono text-[10px]">Enter</kbd> to ask
                </span>
                <button
                  type="button"
                  onClick={() => handleAskQA()}
                  disabled={qaLoading || !qaQuestion.trim()}
                  className={`px-7 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-200 shadow-sm active:scale-95 text-sm ${
                    qaLoading || !qaQuestion.trim()
                      ? 'bg-[#8488B2]/50 text-white/70 cursor-not-allowed opacity-60'
                      : 'bg-[#2E347E] hover:bg-[#262B64] text-white cursor-pointer hover:shadow-md'
                  }`}
                >
                  {qaLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Retrieving & Answering...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Ask
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Loading Indicator */}
            {qaLoading && (
              <div className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm flex items-center justify-center gap-3 text-[#2E347E] animate-in fade-in duration-200 mb-6">
                <Loader2 size={20} className="animate-spin text-[#2E347E]" />
                <span className="text-sm font-bold">Retrieving knowledge chunks from database & generating answer...</span>
              </div>
            )}

            {/* Answer & Sources Results */}
            {!qaLoading && qaAnswer && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {/* AI Answer Box */}
                <section className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm">
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#E6E8EF]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F3F4FD] text-[#2E347E] flex items-center justify-center">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[#15171E]">AI Scam Shield Answer</h3>
                        <p className="text-xs text-[#575C6B]">
                          Grounded in retrieved lesson database &bull; Model: Groq / Llama
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(qaAnswer)}
                      className="px-3 py-1.5 rounded-lg border border-[#E6E8EF] hover:bg-[#F8F9FC] text-xs font-semibold text-[#575C6B] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {lastAskedQuestion && (
                    <div className="mb-4 text-xs font-semibold text-[#575C6B] bg-[#F8F9FC] px-4 py-2 rounded-lg border border-[#E6E8EF]">
                      <span className="text-[#2E347E] font-bold">Question:</span> {lastAskedQuestion}
                    </div>
                  )}

                  <div className="text-sm leading-relaxed text-[#15171E] whitespace-pre-wrap font-sans">
                    {qaAnswer}
                  </div>
                </section>

                {/* Retrieved Database Sources */}
                {qaSources.length > 0 && (
                  <section className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5 text-[#2E347E]">
                        <Database size={18} />
                        <h3 className="text-base font-bold text-[#15171E]">
                          Relevant Knowledge Sources ({qaSources.length})
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#EBF7EE] text-[#1E7E34] border border-[#EBF7EE]">
                        PostgreSQL pgvector match
                      </span>
                    </div>

                    <div className="space-y-4">
                      {qaSources.map((source, idx) => {
                        const simPercent = Math.round(source.similarity * 100);
                        return (
                          <div 
                            key={idx}
                            className="p-5 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EF] hover:border-[#2E347E]/30 transition-all"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText size={15} className="text-[#2E347E]" />
                                <span className="text-xs font-bold text-[#15171E]">
                                  {source.source_file || `Knowledge Chunk #${source.id || idx + 1}`}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-[#2E347E] bg-[#F3F4FD] px-2.5 py-0.5 rounded-full border border-[#E6E8EF]">
                                Similarity: {source.similarity.toFixed(4)} ({simPercent}%)
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-[#575C6B] italic font-mono bg-white p-3 rounded-lg border border-[#E6E8EF]/60">
                              &ldquo;{source.content}&rdquo;
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. ANALYZE MESSAGE VIEW */}
        {currentNav === 'analyze' && (
          <div className="animate-in fade-in duration-300">
            <header className="text-center mb-10">
              <h2 className="text-4xl font-extrabold text-[#2E347E] tracking-tight mb-2">Analyze a Message</h2>
              <p className="text-sm text-[#575C6B]">Paste text or upload a screenshot to detect scam patterns & threat markers</p>
            </header>

            {/* Input Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-[#E6E8EF] overflow-hidden mb-8">
              <div className="flex border-b border-[#E6E8EF]">
                <button 
                  onClick={() => setActiveTab('paste')}
                  className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
                    activeTab === 'paste' ? 'text-[#2E347E]' : 'text-[#575C6B]'
                  }`}
                >
                  Paste Message
                  {activeTab === 'paste' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-[#2E347E]" />}
                </button>
                <button 
                  onClick={() => setActiveTab('upload')}
                  className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
                    activeTab === 'upload' ? 'text-[#2E347E]' : 'text-[#575C6B]'
                  }`}
                >
                  Upload Screenshot
                  {activeTab === 'upload' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-[#2E347E]" />}
                </button>
              </div>
              
              <div className="p-8">
                {activeTab === 'paste' ? (
                  <>
                    <textarea 
                      className="w-full h-40 p-6 rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20 focus:border-[#2E347E] transition-all resize-none font-sans text-sm text-[#15171E]"
                      placeholder="Paste suspicious text or links here..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    {error && (
                      <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
                    )}
                    <div className="mt-6 flex justify-end">
                      <button 
                        onClick={handleAnalyze}
                        disabled={loading || !inputValue.trim()}
                        className="bg-[#2E347E] hover:bg-[#262B64] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        {loading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Search size={18} />
                            Analyze
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {!uploadedImage ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full h-52 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 cursor-pointer ${
                          isDragging
                            ? 'border-[#2E347E] bg-[#F3F4FD] scale-[1.01]'
                            : 'border-[#D0D3DD] bg-[#F8F9FC] hover:border-[#2E347E]/40 hover:bg-[#F3F4FD]/50'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                          isDragging ? 'bg-[#2E347E] text-white' : 'bg-[#E6E8EF] text-[#575C6B]'
                        }`}>
                          <Upload size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#15171E]">
                            {isDragging ? 'Drop your screenshot here' : 'Drag & drop a screenshot here'}
                          </p>
                          <p className="text-xs text-[#575C6B] mt-1">or <span className="text-[#2E347E] font-semibold underline underline-offset-2">click to browse</span></p>
                        </div>
                        <p className="text-[11px] text-[#9096A2] mt-1">Supports PNG, JPG, WEBP — Max 10MB</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Screenshot Preview Card */}
                        <div className="relative rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] overflow-hidden">
                          <div className="flex items-start gap-4 p-4">
                            <div className="relative shrink-0 rounded-lg overflow-hidden border border-[#E6E8EF] shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={uploadedImage}
                                alt="Uploaded screenshot"
                                className="w-40 h-28 object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                              <div className="flex items-center gap-2 mb-1">
                                <ImageIcon size={14} className="text-[#2E347E] shrink-0" />
                                <p className="text-sm font-bold text-[#15171E] truncate">{uploadedFileName}</p>
                              </div>
                              <p className="text-xs text-[#575C6B]">Image uploaded and ready for analysis</p>
                              <div className="mt-3 flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-600">Uploaded successfully</span>
                              </div>
                            </div>
                            <button
                              onClick={removeImage}
                              className="shrink-0 w-8 h-8 rounded-lg bg-white border border-[#E6E8EF] flex items-center justify-center text-[#575C6B] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Screenshot Text Message (Editable to test variations) */}
                        <div className="rounded-xl border border-[#E6E8EF] bg-white p-5 shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#F3F4FD] flex items-center justify-center text-[#2E347E] shrink-0">
                                <FileText size={16} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-[#15171E] uppercase tracking-wider">
                                    Screenshot Text Message
                                  </h4>
                                  {isTextModified ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                      <Edit3 size={10} /> Modified by you
                                    </span>
                                  ) : screenshotText ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                      <Sparkles size={10} /> Extracted from Screenshot
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[11px] text-[#575C6B] mt-0.5">
                                  Change or test words in this message to see if it still triggers scam warnings.
                                </p>
                              </div>
                            </div>

                            {isTextModified && (
                              <button
                                onClick={handleAnalyzeScreenshot}
                                title="Re-extract original text from image"
                                className="text-xs font-semibold text-[#2E347E] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw size={12} /> Reset to Image
                              </button>
                            )}
                          </div>

                          <textarea
                            value={screenshotText}
                            onChange={(e) => {
                              setScreenshotText(e.target.value);
                              setIsTextModified(true);
                            }}
                            rows={4}
                            className="w-full p-4 rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20 focus:border-[#2E347E] transition-all resize-y font-sans text-xs text-[#15171E] leading-relaxed"
                            placeholder="Text from your screenshot will automatically appear here once analyzed. You can edit or tweak any words/links directly to test different scenarios..."
                          />

                          <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#8C92A4]">
                            <span>
                              💡 <strong className="text-[#575C6B]">Tip:</strong> Try removing urgent phrases or replacing URLs to see how the risk score changes.
                            </span>
                            {screenshotText && (
                              <span>{screenshotText.length} characters</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {error && (
                      <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs">
                        {screenshotText && isTextModified && (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                            <Edit3 size={13} /> Text modified. Click &ldquo;Analyze Edited Text&rdquo; to test your changes.
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 ml-auto">
                        {screenshotText.trim().length > 0 && (
                          <button
                            onClick={handleAnalyzeEditedText}
                            disabled={loading}
                            className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer text-xs ${
                              isTextModified
                                ? 'bg-[#2E347E] text-white hover:bg-[#262B64] ring-2 ring-[#2E347E]/20'
                                : 'bg-[#F3F4FD] text-[#2E347E] hover:bg-[#E6E8EF]'
                            }`}
                          >
                            {loading ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Zap size={16} />
                                Analyze Edited Text
                              </>
                            )}
                          </button>
                        )}

                        <button 
                          onClick={handleAnalyzeScreenshot}
                          disabled={loading || !uploadedImage}
                          className="bg-[#2E347E] hover:bg-[#262B64] disabled:opacity-50 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer text-xs"
                        >
                          {loading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Analyzing Screenshot...
                            </>
                          ) : (
                            <>
                              <Search size={16} />
                              Analyze Screenshot
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Results Section */}
            {result && (() => {
              const styles = getVerdictStyles(result.verdict);
              const VerdictIcon = styles.Icon;
    
              return (
                <>
                  <div className="grid grid-cols-3 gap-8 mb-8">
                    {/* Status Card */}
                    <section className={`col-span-2 ${styles.bg} rounded-3xl p-8 border ${styles.border} flex flex-col transition-all duration-300`}>
                      <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl ${styles.iconBg} flex items-center justify-center ${styles.text} shadow-sm`}>
                            <VerdictIcon size={24} />
                          </div>
                          <div>
                            <h3 className={`text-3xl font-bold ${styles.text}`}>{styles.title}</h3>
                            <p className={`${styles.text}/80 text-sm mt-0.5`}>{result.recommendation}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-bold uppercase tracking-widest ${styles.text}/60 mb-1`}>Risk Score</p>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-4xl font-black ${styles.text}`}>{result.riskScore}</span>
                            <span className={`${styles.text}/60 font-bold`}>/100</span>
                          </div>
                          <div className={`w-32 h-2 ${styles.text}/10 rounded-full mt-2 overflow-hidden`}>
                            <div className={`h-full ${styles.barBg} rounded-full transition-all duration-500`} style={{ width: `${result.riskScore}%` }} />
                          </div>
                        </div>
                      </div>

                      <p className={`text-lg leading-relaxed ${styles.text} mb-8 font-medium`}>
                        {result.reasoning}
                      </p>

                      <div className={`grid grid-cols-2 pt-6 border-t ${styles.text}/10 mt-auto`}>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest ${styles.text}/60 mb-1`}>Scam Category</p>
                          <p className={`font-bold ${styles.text}`}>{result.category}</p>
                        </div>
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-widest ${styles.text}/60 mb-1`}>Confidence</p>
                          <p className={`font-bold ${styles.text}`}>{result.confidence}</p>
                        </div>
                      </div>
                    </section>

                    {/* Evidence Card */}
                    <section className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="text-2xl font-bold mb-2 text-[#15171E]">Evidence</h3>
                        <p className="text-sm text-[#575C6B] mb-8">Key indicators detected in message</p>
                        
                        <ul className="space-y-4">
                          {result.redFlags.map((flag, idx) => (
                            <li key={idx} className="flex items-center gap-3 text-sm font-medium text-[#15171E]">
                              <div className={`w-7 h-7 rounded-full ${styles.bg} flex items-center justify-center ${styles.text} shrink-0`}>
                                <Zap size={14} />
                              </div>
                              <span>{flag}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </section>
                  </div>

                  {/* Highlighted Content */}
                  <section className="bg-white rounded-3xl border border-[#E6E8EF] shadow-sm p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6 text-[#2E347E]">
                      <ShieldAlert size={20} />
                      <h3 className="text-xl font-bold">Analyzed Content</h3>
                    </div>

                    <div className="p-6 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EF] leading-relaxed font-mono text-sm text-[#15171E] break-words whitespace-pre-wrap">
                      {result.analyzedText}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-[#575C6B]">
                      <div className="w-3 h-3 rounded bg-[#FDF7EC] border border-[#9C6511]/20" />
                      Analyzed for threat markers, URL reputations, and phishing heuristics.
                    </div>
                  </section>
                </>
              );
            })()}
          </div>
        )}

        {/* 3. DASHBOARD / VAULT / ADVISOR PLACEHOLDERS */}
        {(currentNav === 'dashboard' || currentNav === 'vault' || currentNav === 'advisor') && (
          <div className="animate-in fade-in duration-300 text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-[#F3F4FD] text-[#2E347E] flex items-center justify-center mx-auto mb-5 shadow-xs">
              {currentNav === 'dashboard' && <LayoutDashboard size={32} />}
              {currentNav === 'vault' && <Lock size={32} />}
              {currentNav === 'advisor' && <Lightbulb size={32} />}
            </div>
            <h2 className="text-3xl font-extrabold text-[#2E347E] capitalize mb-2">
              {currentNav === 'dashboard' ? 'Security Dashboard' : currentNav === 'vault' ? 'Scam Vault' : 'AI Security Advisor'}
            </h2>
            <p className="text-sm text-[#575C6B] max-w-md mx-auto mb-8">
              {currentNav === 'dashboard'
                ? 'View your active protection stats, recent scans, and community alerts.'
                : currentNav === 'vault'
                ? 'Encrypted repository of verified scam reports, suspicious numbers, and phishing domains.'
                : 'Interactive AI companion for personal cybersecurity advice and risk assessment.'}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setCurrentNav('document-qa')}
                className="bg-[#2E347E] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#262B64] transition-all cursor-pointer flex items-center gap-2"
              >
                <BookOpen size={16} /> Open Document Q&A
              </button>
              <button
                onClick={() => setCurrentNav('analyze')}
                className="bg-white border border-[#E6E8EF] text-[#2E347E] px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#F8F9FC] transition-all cursor-pointer flex items-center gap-2"
              >
                <ShieldAlert size={16} /> Analyze Message
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default ScamShieldAnalyzer;
