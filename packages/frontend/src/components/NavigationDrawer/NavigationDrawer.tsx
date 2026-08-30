import { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Compass,
  Star,
  Info,
  ExternalLink,
  Search,
  Bus,
  Check,
  Building2,
} from 'lucide-react';
import {
  KLANG_VALLEY_HUBS,
  AGENCY_OPTIONS,
  filterHubsByQuery,
  type TransitHub,
} from '../../utils/transitHubs.ts';
import { BRAND_CONFIG } from '../../config/branding.ts';

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAgencyId: string;
  onSelectAgency: (agencyId: string) => void;
  onSelectHub: (hub: TransitHub) => void;
  onOpenFavorites: () => void;
  onOpenAbout: () => void;
}

export function NavigationDrawer({
  isOpen,
  onClose,
  selectedAgencyId,
  onSelectAgency,
  onSelectHub,
  onOpenFavorites,
  onOpenAbout,
}: NavigationDrawerProps) {
  const [hubSearchQuery, setHubSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredHubs = filterHubsByQuery(KLANG_VALLEY_HUBS, hubSearchQuery);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transit navigation and hub directory"
      data-testid="navigation-drawer"
      className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-sm h-full bg-[#101B2D]/95 border-r border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col text-[#FFF8EE] animate-in slide-in-from-left duration-250 overflow-hidden">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#182337]/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#F4A100] to-[#E08D00] text-[#101B2D] font-bold shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-sans font-bold text-[#FFF8EE]">
                {BRAND_CONFIG.brandName} Transit
              </h2>
              <p className="text-[11px] font-sans text-[#FFF8EE]/50">
                Klang Valley Hubs & Agencies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className="p-1.5 rounded-lg text-[#FFF8EE]/60 hover:text-[#FFF8EE] hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto basbuddy-scroll p-4 space-y-6">
          {/* Section 1: Agency & Service Filter */}
          <section aria-labelledby="agency-filter-heading">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Bus className="w-3.5 h-3.5 text-[#F4A100]" />
              <h3
                id="agency-filter-heading"
                className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/60"
              >
                Service Network Filter
              </h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGENCY_OPTIONS.map((agency) => {
                const isSelected = selectedAgencyId === agency.id;
                return (
                  <button
                    key={agency.id}
                    type="button"
                    onClick={() => onSelectAgency(agency.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-[#1F7A6C] text-[#FFF8EE] ring-1 ring-[#1F7A6C]/60 font-semibold shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-[#FFF8EE]/70 border border-white/10'
                    }`}
                  >
                    <span>{agency.name}</span>
                    {isSelected && <Check className="w-3 h-3 text-[#F4A100]" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Municipal Transit Hubs */}
          <section aria-labelledby="transit-hubs-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#F4A100]" />
                <h3
                  id="transit-hubs-heading"
                  className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/60"
                >
                  Municipal Transit Hubs
                </h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-[#F4A100]">
                {filteredHubs.length}
              </span>
            </div>

            {/* Hub Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#FFF8EE]/40 pointer-events-none" />
              <input
                type="text"
                value={hubSearchQuery}
                onChange={(e) => setHubSearchQuery(e.target.value)}
                placeholder="Search municipal hubs..."
                aria-label="Search municipal hubs"
                className="w-full bg-[#182337] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-[#FFF8EE] placeholder:text-[#FFF8EE]/30 focus:outline-none focus:border-[#F4A100]/60 focus:ring-1 focus:ring-[#F4A100]/30 transition-all font-sans"
              />
              {hubSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHubSearchQuery('')}
                  aria-label="Clear hub search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#FFF8EE]/40 hover:text-[#FFF8EE] p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Hubs List */}
            <div className="space-y-2 max-h-72 overflow-y-auto basbuddy-scroll pr-1">
              {filteredHubs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#FFF8EE]/40">
                  No transit hubs found matching &ldquo;{hubSearchQuery}&rdquo;
                </div>
              ) : (
                filteredHubs.map((hub) => (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      onSelectHub(hub);
                      onClose();
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-[#1F7A6C]/25 border border-white/10 hover:border-[#1F7A6C]/50 transition-all group active:scale-[0.99] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-[#F4A100] shrink-0" />
                        <span className="text-xs font-sans font-bold text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors truncate">
                          {hub.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-sans text-[#FFF8EE]/40 shrink-0">
                        {hub.city}
                      </span>
                    </div>

                    <p className="text-[11px] font-sans text-[#FFF8EE]/60 line-clamp-2">
                      {hub.description}
                    </p>

                    {/* Mode badges */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {hub.modes.map((mode) => (
                        <span
                          key={mode}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase bg-white/10 text-[#FFF8EE]/70"
                        >
                          {mode}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Section 3: App Shortcuts & Tools */}
          <section aria-labelledby="app-tools-heading" className="space-y-1.5 pt-2 border-t border-white/10">
            <h3
              id="app-tools-heading"
              className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/60 mb-2"
            >
              Shortcuts & Information
            </h3>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFavorites();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-[#FFF8EE] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[#F4A100]" />
                <span>Saved Favorites</span>
              </div>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40">Manager</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAbout();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-[#FFF8EE] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#1F7A6C]" />
                <span>About & FAQ</span>
              </div>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40">Info</span>
            </button>

            <a
              href="https://github.com/farisdanish/basbuddy"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-sans text-[#FFF8EE]/80 hover:text-[#FFF8EE] transition-colors"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#FFF8EE]/40" />
                <span>GitHub Repository</span>
              </div>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40">Open Source</span>
            </a>
          </section>
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-white/10 bg-[#182337]/80 text-center shrink-0">
          <p className="text-[10px] font-mono text-[#FFF8EE]/40">
            {BRAND_CONFIG.brandName} {BRAND_CONFIG.version} · Klang Valley Transit
          </p>
        </div>
      </div>
    </div>
  );
}
