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
  User
} from 'lucide-react';

const ScamShieldAnalyzer = () => {
  const [activeTab, setActiveTab] = useState('paste');
  const [inputValue, setInputValue] = useState('');

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: false },
    { icon: ShieldAlert, label: 'Analyze Message', active: true },
    { icon: Lock, label: 'Scam Vault', active: false },
    { icon: Lightbulb, label: 'AI Advisor', active: false },
  ];

  const evidencePoints = [
    { icon: Zap, text: 'Urgent call-to-action' },
    { icon: Mail, text: 'Unrecognized sender address' },
    { icon: ExternalLink, text: 'Suspicious link structure' },
  ];

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
            <div className="mt-6 flex justify-end">
              <button className="bg-[#2E347E] hover:bg-[#262B64] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95">
                <Search size={18} />
                Analyze
              </button>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          {/* Status Card */}
          <section className="col-span-2 bg-[#FDF7EC] rounded-3xl p-8 border border-[#FDF7EC] flex flex-col">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#9C6511] shadow-sm">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-[#9C6511]">Suspicious</h3>
                  <p className="text-[#9C6511]/80">We found several warning signs.</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-[#9C6511]/60 mb-1">Risk Score</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-[#9C6511]">65</span>
                  <span className="text-[#9C6511]/60 font-bold">/100</span>
                </div>
                <div className="w-32 h-2 bg-[#9C6511]/10 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-[#9C6511] rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>

            <p className="text-lg leading-relaxed text-[#9C6511] mb-8 font-medium">
              This message uses urgent language typical of bank scams to pressure you into clicking a link. It attempts to create a false sense of panic about your account status.
            </p>

            <div className="grid grid-cols-2 pt-6 border-t border-[#9C6511]/10 mt-auto">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#9C6511]/60 mb-1">Scam Category</p>
                <p className="font-bold text-[#9C6511]">Phishing — Bank Impersonation</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#9C6511]/60 mb-1">Confidence</p>
                <p className="font-bold text-[#9C6511]">89%</p>
              </div>
            </div>
          </section>

          {/* Evidence Card */}
          <section className="bg-white rounded-3xl p-8 border border-[#E6E8EF] shadow-sm">
            <h3 className="text-2xl font-bold mb-2">Evidence</h3>
            <p className="text-sm text-[#575C6B] mb-8">Similar to 17 known phishing messages</p>
            
            <ul className="space-y-6">
              {evidencePoints.map((point, idx) => (
                <li key={idx} className="flex items-center gap-4 text-sm font-medium text-[#15171E]">
                  <div className="w-8 h-8 rounded-full bg-[#FDF7EC] flex items-center justify-center text-[#9C6511]">
                    <point.icon size={16} />
                  </div>
                  {point.text}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Highlighted Content */}
        <section className="bg-white rounded-3xl border border-[#E6E8EF] shadow-sm p-8 mb-8">
          <div className="flex items-center gap-3 mb-8 text-[#2E347E]">
            <ShieldAlert size={20} />
            <h3 className="text-xl font-bold">Analyzed Content</h3>
          </div>

          <div className="p-8 rounded-2xl bg-[#F8F9FC] border border-[#E6E8EF] leading-loose">
            <span className="bg-[#FBEEEF] text-[#8B181C] px-2 py-0.5 rounded font-mono text-sm font-bold mr-1">URGENT:</span>
            <span className="bg-[#FDF7EC] text-[#9C6511] px-2 py-0.5 rounded font-mono text-sm font-bold mx-1">Your account has been locked.</span>
            <span>Click here to verify:</span>
            <div className="mt-4">
              <span className="bg-[#FDF7EC] text-[#9C6511] px-3 py-1 rounded font-mono text-sm font-bold border border-[#FDF7EC]">http://amazon-security-update-2024.xyz/login</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#575C6B]">
            <div className="w-3 h-3 rounded bg-[#FDF7EC] border border-[#9C6511]/20" />
            Highlighted text indicates suspicious patterns or flagged links.
          </div>
        </section>

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
