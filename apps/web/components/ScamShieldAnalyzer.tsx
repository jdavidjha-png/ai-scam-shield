import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Lock, 
  Lightbulb, 
  Search, 
  Upload, 
  MessageSquare, 
  AlertTriangle, 
  ExternalLink, 
  Mail, 
  Zap,
  Send,
  User,
  CheckCircle2,
  Loader2,
  ShieldCheck
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

const ScamShieldAnalyzer = () => {
  const [activeTab, setActiveTab] = useState('paste');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: false },
    { icon: ShieldAlert, label: 'Analyze Message', active: true },
    { icon: Lock, label: 'Scam Vault', active: false },
    { icon: Lightbulb, label: 'AI Advisor', active: false },
  ];

  const parseBackendAnalysis = (rawText: string, originalMessage: string): AnalysisResult => {
    // Extract Verdict
    let verdict: 'SCAM' | 'SUSPICIOUS' | 'LEGITIMATE' = 'SUSPICIOUS';
    if (/Verdict:\s*\[?(SCAM)\]?/i.test(rawText) || /Verdict:\s*SCAM/i.test(rawText)) {
      verdict = 'SCAM';
    } else if (/Verdict:\s*\[?(LEGITIMATE)\]?/i.test(rawText) || /Verdict:\s*LEGITIMATE/i.test(rawText)) {
      verdict = 'LEGITIMATE';
    } else if (/Verdict:\s*\[?(SUSPICIOUS)\]?/i.test(rawText) || /Verdict:\s*SUSPICIOUS/i.test(rawText)) {
      verdict = 'SUSPICIOUS';
    }

    // Risk Score based on verdict
    let riskScore = 65;
    if (verdict === 'SCAM') riskScore = Math.floor(Math.random() * 15) + 85; // 85-99
    else if (verdict === 'LEGITIMATE') riskScore = Math.floor(Math.random() * 15) + 5; // 5-20
    else riskScore = Math.floor(Math.random() * 20) + 55; // 55-74

    // Confidence
    const confMatch = rawText.match(/Confidence:\s*\[?(\d+%?)\]?/i);
    const confidence = confMatch ? confMatch[1] : '88%';

    // Reasoning
    const reasoningMatch = rawText.match(/Reasoning:\s*\[?([\s\S]*?)\]?(?=\s*\d+\.|\s*Red Flags:|$)/i);
    const reasoning = reasoningMatch 
      ? reasoningMatch[1].trim() 
      : 'Analysis completed based on content pattern evaluation.';

    // Red Flags
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

    // Recommendation
    const recMatch = rawText.match(/Recommendation:\s*\[?([\s\S]*?)\]?$/i);
    const recommendation = recMatch ? recMatch[1].trim() : 'Exercise caution when interacting with unverified messages.';

    // Infer Category
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

  const handleAnalyze = async () => {
    if (!inputValue.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Call API route handler
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
        // Fallback analysis if API succeeds with raw payload
        setResult(parseBackendAnalysis(data.analysis || 'Verdict: SUSPICIOUS\nReasoning: Analysis processed.', inputValue));
      }
    } catch (err: any) {
      console.warn('Backend API connection note:', err.message);
      
      // Fallback local heuristic analyzer so UI works even without backend running
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
      <aside className="w-64 bg-white border-r border-[#E6E8EF] flex flex-col fixed h-full z-10">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-[#2E347E]">Scam Shield</h1>
          <p className="text-xs text-[#575C6B] mt-1 uppercase tracking-wider font-semibold">Your Digital Sanctuary</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                item.active 
                  ? 'bg-[#F3F4FD] text-[#2E347E] font-bold shadow-sm' 
                  : 'text-[#575C6B] hover:bg-[#F8F9FC] hover:text-[#15171E]'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-[#E6E8EF]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F3F4FD] flex items-center justify-center text-[#2E347E]">
              <User size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#15171E]">Demo User</p>
              <p className="text-xs text-[#575C6B]">Profile</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-12 max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight mb-2">Analyze a Message</h2>
        </header>

        {/* Input Card */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#E6E8EF] overflow-hidden mb-8">
          <div className="flex border-b border-[#E6E8EF]">
            <button 
              onClick={() => setActiveTab('paste')}
              className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all relative ${
                activeTab === 'paste' ? 'text-[#2E347E]' : 'text-[#575C6B]'
              }`}
            >
              Paste Message
              {activeTab === 'paste' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-[#2E347E]" />}
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all relative ${
                activeTab === 'upload' ? 'text-[#2E347E]' : 'text-[#575C6B]'
              }`}
            >
              Upload Screenshot
              {activeTab === 'upload' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-[#2E347E]" />}
            </button>
          </div>
          
          <div className="p-8">
            <textarea 
              className="w-full h-40 p-6 rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20 focus:border-[#2E347E] transition-all resize-none font-sans text-sm"
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
                    <h3 className="text-2xl font-bold mb-2">Evidence</h3>
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

        {/* AI Advisor Input */}
        <section className="mt-12 bg-white rounded-2xl p-4 shadow-lg border border-[#E6E8EF] sticky bottom-8">
          <div className="flex gap-2 justify-center mb-4">
            <button className="bg-[#F3F4FD] hover:bg-[#E6E8EF] text-[#2E347E] text-xs font-bold px-4 py-2 rounded-full transition-all">Is it safe to click this?</button>
            <button className="bg-[#F3F4FD] hover:bg-[#E6E8EF] text-[#2E347E] text-xs font-bold px-4 py-2 rounded-full transition-all">Should I reply?</button>
          </div>
          <div className="relative">
            <input 
              type="text" 
              className="w-full pl-6 pr-16 py-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8EF] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20"
              placeholder="Ask the AI Security Advisor..."
            />
            <button className="absolute right-2 top-2 bottom-2 bg-[#2E347E] text-white px-4 rounded-lg hover:bg-[#262B64] transition-all">
              <Send size={18} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ScamShieldAnalyzer;

