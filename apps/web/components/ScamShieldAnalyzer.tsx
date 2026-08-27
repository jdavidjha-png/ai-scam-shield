import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Lock, 
  Lightbulb, 
  Search, 
  AlertTriangle, 
  Send,
  User
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const parseAnalysisField = (text: string, field: string) => {
  const match = text.match(new RegExp(`${field}:\\s*([\\s\\S]*?)(?=\\n\\d+\\.|$)`, "i"));
  return match?.[1]?.trim() ?? null;
};

const ScamShieldAnalyzer = () => {
  const [activeTab, setActiveTab] = useState('paste');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const message = inputValue.trim();
    if (!message || loading) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch(`${API_URL}/check-scam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? "Analysis failed. Please try again.");
        if (data.analysis) setAnalysis(data.analysis);
        return;
      }

      setAnalysis(data.analysis);
    } catch {
      setError("Could not reach the backend. Make sure it is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const verdict = analysis ? parseAnalysisField(analysis, "Verdict") : null;
  const confidence = analysis ? parseAnalysisField(analysis, "Confidence") : null;
  const reasoning = analysis ? parseAnalysisField(analysis, "Reasoning") : null;
  const redFlags = analysis ? parseAnalysisField(analysis, "Red Flags") : null;
  const recommendation = analysis ? parseAnalysisField(analysis, "Recommendation") : null;

  const verdictLabel = verdict?.split(/[\[\]]/).find((part) =>
    /^(SCAM|LEGITIMATE|SUSPICIOUS)$/i.test(part.trim())
  ) ?? "Unknown";

  const verdictStyles =
    verdictLabel.toUpperCase() === "SCAM"
      ? { bg: "bg-[#FBEEEF]", border: "border-[#FBEEEF]", text: "text-[#8B181C]", icon: "text-[#8B181C]", bar: "bg-[#8B181C]" }
      : verdictLabel.toUpperCase() === "LEGITIMATE"
        ? { bg: "bg-[#EEF7F0]", border: "border-[#EEF7F0]", text: "text-[#1B6B3A]", icon: "text-[#1B6B3A]", bar: "bg-[#1B6B3A]" }
        : { bg: "bg-[#FDF7EC]", border: "border-[#FDF7EC]", text: "text-[#9C6511]", icon: "text-[#9C6511]", bar: "bg-[#9C6511]" };

  const confidenceScore = confidence?.match(/\d+/)?.[0] ?? null;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: false },
    { icon: ShieldAlert, label: 'Analyze Message', active: true },
    { icon: Lock, label: 'Scam Vault', active: false },
    { icon: Lightbulb, label: 'AI Advisor', active: false },
  ];

  const evidencePoints = redFlags
    ? redFlags.split(/\n|,/).map((item) => item.replace(/^[-•]\s*/, "").trim()).filter(Boolean)
    : [];

  return (
    <div className="flex min-h-screen bg-[#F8F9FC] font-sans text-[#15171E]">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#E6E8EF] flex flex-col fixed h-full">
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
              className="w-full h-40 p-6 rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] focus:outline-none focus:ring-2 focus:ring-[#2E347E]/20 focus:border-[#2E347E] transition-all resize-none font-sans"
              placeholder="Paste suspicious text or links here..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <div className="mt-6 flex items-center justify-end gap-4">
              {error && (
                <p className="text-sm font-medium text-[#8B181C]">{error}</p>
              )}
              <button
                onClick={handleAnalyze}
                disabled={loading || !inputValue.trim()}
                className="bg-[#2E347E] hover:bg-[#262B64] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Search size={18} />
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {analysis && (
          <>
            <div className="grid grid-cols-3 gap-8 mb-8">
              {/* Status Card */}
              <section className={`col-span-2 ${verdictStyles.bg} rounded-3xl p-8 border ${verdictStyles.border} flex flex-col`}>
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center ${verdictStyles.icon} shadow-sm`}>
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h3 className={`text-3xl font-bold ${verdictStyles.text}`}>{verdictLabel}</h3>
                      <p className={`${verdictStyles.text}/80`}>AI analysis complete.</p>
                    </div>
                  </div>
                  {confidenceScore && (
                    <div className="text-right">
                      <p className={`text-xs font-bold uppercase tracking-widest ${verdictStyles.text}/60 mb-1`}>Confidence</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-black ${verdictStyles.text}`}>{confidenceScore}</span>
                        <span className={`${verdictStyles.text}/60 font-bold`}>%</span>
                      </div>
                      <div className={`w-32 h-2 ${verdictStyles.text}/10 rounded-full mt-2 overflow-hidden`}>
                        <div className={`h-full ${verdictStyles.bar} rounded-full`} style={{ width: `${confidenceScore}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {reasoning && (
                  <p className={`text-lg leading-relaxed ${verdictStyles.text} mb-8 font-medium`}>
                    {reasoning}
                  </p>
                )}

                {recommendation && (
                  <div className={`grid grid-cols-1 pt-6 border-t ${verdictStyles.text}/10 mt-auto`}>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${verdictStyles.text}/60 mb-1`}>Recommendation</p>
                      <p className={`font-bold ${verdictStyles.text}`}>{recommendation}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Evidence Card */}
              <section className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm">
                <h3 className="text-2xl font-bold mb-2">Red Flags</h3>
                <p className="text-sm text-[#575C6B] mb-8">Warning signs detected in the message</p>

                {evidencePoints.length > 0 ? (
                  <ul className="space-y-6">
                    {evidencePoints.map((point, idx) => (
                      <li key={idx} className="flex items-center gap-4 text-sm font-medium text-[#15171E]">
                        <div className="w-8 h-8 rounded-full bg-[#FDF7EC] flex items-center justify-center text-[#9C6511] shrink-0">
                          <AlertTriangle size={16} />
                        </div>
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#575C6B]">No specific red flags listed.</p>
                )}
              </section>
            </div>

            {/* Analyzed Content */}
            <section className="bg-white rounded-3xl border border-[#E6E8EF] shadow-sm p-8 mb-8">
              <div className="flex items-center gap-3 mb-8 text-[#2E347E]">
                <ShieldAlert size={20} />
                <h3 className="text-xl font-bold">Analyzed Content</h3>
              </div>

              <div className="p-8 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EF] leading-loose whitespace-pre-wrap">
                {inputValue}
              </div>
            </section>
          </>
        )}

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
