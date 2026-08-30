import { useState, useEffect } from 'react';
import { X, Info, HelpCircle, MessageSquare, ExternalLink, ShieldCheck, Github, Radio, Clock, Heart, Star, GitPullRequest } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/branding.ts';

export type InfoTabType = 'about' | 'faq' | 'feedback';

interface InfoModalProps {
  isOpen: boolean;
  initialTab?: InfoTabType;
  onClose: () => void;
}

export function InfoModal({ isOpen, initialTab = 'about', onClose }: InfoModalProps) {
  const [activeTab, setActiveTab] = useState<InfoTabType>(initialTab);

  // Sync tab when opened with a specific initialTab
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-[#182337] border border-white/15 shadow-2xl overflow-hidden text-[#FFF8EE] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#101B2D]/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#F4A100]/20 border border-[#F4A100]/40 text-[#F4A100] font-display text-xl font-bold shadow-sm shrink-0 select-none">
              BB
            </div>
            <div>
              <h2 id="info-modal-title" className="text-base font-sans font-bold text-[#FFF8EE] leading-tight">
                {BRAND_CONFIG.brandName} Info & Support
              </h2>
              <p className="text-xs font-mono text-[#FFF8EE]/50">
                {BRAND_CONFIG.brandTagline}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close information modal"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center border-b border-white/10 bg-white/[0.02] p-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'about'
                ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/5'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>About</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'faq'
                ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/5'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>FAQ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-sans font-semibold transition-all ${
              activeTab === 'feedback'
                ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                : 'text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 basbuddy-scroll text-xs font-sans leading-relaxed text-[#FFF8EE]/80">
          {/* ── ABOUT TAB ────────────────────────────────────────────────────── */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F4A100]">
                  <ShieldCheck className="w-4 h-4 text-[#F4A100]" />
                  <span>Independent & Open Source</span>
                </div>
                <p>
                  <strong>{BRAND_CONFIG.brandName}</strong> is an unofficial, high-performance transit tracking service and PWA designed to give commuters transparent, instant access to bus schedules, arrival countdowns, and live GPS positions across {BRAND_CONFIG.regionName} and Malaysia.
                </p>
              </div>

              {/* Open Source Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={BRAND_CONFIG.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-2.5">
                    <Star className="w-4 h-4 text-[#F4A100] group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="font-bold text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors">
                        Star on GitHub
                      </div>
                      <div className="text-[10px] text-[#FFF8EE]/50 font-mono">
                        Support the project
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFF8EE]/40 group-hover:text-[#FFF8EE]" />
                </a>

                <a
                  href={BRAND_CONFIG.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center gap-2.5">
                    <GitPullRequest className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="font-bold text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors">
                        Contribute Code
                      </div>
                      <div className="text-[10px] text-[#FFF8EE]/50 font-mono">
                        Open source repository
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#FFF8EE]/40 group-hover:text-[#FFF8EE]" />
                </a>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#F4A100]">
                  Key Features
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <li className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2">
                    <Radio className="w-3.5 h-3.5 text-[#E94B8C] shrink-0 mt-0.5" />
                    <span><strong>Live GPS Map:</strong> Real-time vehicle tracking with directional bearing on route shapes.</span>
                  </li>
                  <li className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#F4A100] shrink-0 mt-0.5" />
                    <span><strong>Instant ETAs:</strong> High-speed arrival predictions computed from vehicle telemetry.</span>
                  </li>
                  <li className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Transparent Freshness:</strong> Clearly distinguishes live GPS from timetable schedules.</span>
                  </li>
                  <li className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2">
                    <Heart className="w-3.5 h-3.5 text-[#FF5A47] shrink-0 mt-0.5" />
                    <span><strong>Favorites Tray:</strong> One-tap access to your frequent stops and routes.</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-[#101B2D] border border-white/10 space-y-1.5 text-[11px] text-[#FFF8EE]/60">
                <div className="font-bold text-[#FFF8EE] flex items-center justify-between">
                  <span>Open Data Attribution</span>
                  <span className="text-[10px] font-mono text-[#F4A100]">CC BY 4.0</span>
                </div>
                <p>
                  Transit schedules, route geometries, and realtime protobuf feeds are powered by open data published by <strong>Prasarana Malaysia Berhad</strong> and Malaysian transport agencies on <a className="text-[#F4A100] underline" href="https://data.gov.my" target="_blank" rel="noopener noreferrer">data.gov.my</a>.
                </p>
                <p className="text-[10px] text-[#FFF8EE]/40">
                  {BRAND_CONFIG.brandName} is not affiliated with, endorsed by, or connected to Prasarana, Rapid Bus, or any government agency.
                </p>
              </div>
            </div>
          )}

          {/* ── FAQ TAB ──────────────────────────────────────────────────────── */}
          {activeTab === 'faq' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="font-bold text-[#FFF8EE] flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F4A100]/20 text-[#F4A100] text-[10px] flex items-center justify-center font-mono">Q</span>
                  Why does it say &quot;No live GPS&quot; or &quot;0 buses live&quot;?
                </h4>
                <p className="text-[11px] text-[#FFF8EE]/70 pl-6">
                  The open data feed only shares GPS for vehicles actively moving on the road. If a bus is waiting at the depot or between trips, we show the <strong>official timetable</strong> so you still know when the next trip is scheduled.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="font-bold text-[#FFF8EE] flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F4A100]/20 text-[#F4A100] text-[10px] flex items-center justify-center font-mono">Q</span>
                  Can I see bus plate numbers (e.g. WXX 1234)?
                </h4>
                <p className="text-[11px] text-[#FFF8EE]/70 pl-6">
                  Not right now. Open transit feeds don&apos;t include license plate numbers. We track vehicles by their <strong>Route Number</strong> (e.g. <code>750</code>, <code>SA02</code>, <code>T728</code>) and <strong>Destination</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="font-bold text-[#FFF8EE] flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F4A100]/20 text-[#F4A100] text-[10px] flex items-center justify-center font-mono">Q</span>
                  How do arrival times work?
                </h4>
                <div className="text-[11px] text-[#FFF8EE]/70 pl-6 space-y-1">
                  <p>• <strong className="text-[#E94B8C]">Live (Pulsing pink dot):</strong> Real GPS location directly from the moving vehicle.</p>
                  <p>• <strong className="text-[#FFF8EE]">Schedule estimate:</strong> Estimated arrival based on the published timetable when live GPS isn&apos;t broadcasting.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="font-bold text-[#FFF8EE] flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F4A100]/20 text-[#F4A100] text-[10px] flex items-center justify-center font-mono">Q</span>
                  Is this an official transport authority app?
                </h4>
                <p className="text-[11px] text-[#FFF8EE]/70 pl-6">
                  No. {BRAND_CONFIG.brandName} is a free, independent community project built by and for Malaysian commuters using open data from <strong>data.gov.my</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="font-bold text-[#FFF8EE] flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F4A100]/20 text-[#F4A100] text-[10px] flex items-center justify-center font-mono">Q</span>
                  How do I install {BRAND_CONFIG.brandName} on my phone?
                </h4>
                <p className="text-[11px] text-[#FFF8EE]/70 pl-6">
                  In Chrome or Safari on your phone, tap the browser menu (or Share button) and choose <strong>&quot;Add to Home Screen&quot;</strong>. It installs instantly and works just like an app!
                </p>
              </div>
            </div>
          )}

          {/* ── FEEDBACK TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'feedback' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-[#101B2D] border border-white/10 space-y-2 text-center">
                <MessageSquare className="w-8 h-8 text-[#F4A100] mx-auto" />
                <h4 className="font-bold text-sm text-[#FFF8EE]">We&apos;d love your feedback!</h4>
                <p className="text-[11px] text-[#FFF8EE]/70 max-w-sm mx-auto">
                  Have a suggestion, noticed a route discrepancy, or want to report a bug? Community feedback helps make {BRAND_CONFIG.brandName} better for all commuters.
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href={`${BRAND_CONFIG.repoUrl}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors" />
                    <div>
                      <div className="font-bold text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors">
                        Submit an Issue / Feature Request
                      </div>
                      <div className="text-[10px] text-[#FFF8EE]/50 font-mono">
                        Open a ticket on GitHub
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#FFF8EE]/40 group-hover:text-[#FFF8EE]" />
                </a>

                <a
                  href={`mailto:${BRAND_CONFIG.supportEmail}?subject=${encodeURIComponent(BRAND_CONFIG.brandName + ' Feedback')}`}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-[#F4A100]" />
                    <div>
                      <div className="font-bold text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors">
                        Send Direct Feedback via Email
                      </div>
                      <div className="text-[10px] text-[#FFF8EE]/50 font-mono">
                        {BRAND_CONFIG.supportEmail}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#FFF8EE]/40 group-hover:text-[#FFF8EE]" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 sm:py-3 border-t border-white/10 bg-[#101B2D]/60 flex items-center justify-between text-[11px] text-[#FFF8EE]/50 shrink-0">
          <span>{BRAND_CONFIG.brandName} {BRAND_CONFIG.version} · Open Source</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF8EE] font-semibold transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
