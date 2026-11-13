interface TitleOverlayProps {
  savedSummary?: {
    className: string;
    level: number;
    zone: number;
    gold: number;
  } | null;
  onContinue?: () => void;
  onStart: () => void;
}

export function TitleOverlay({ savedSummary, onContinue, onStart }: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-8 md:p-12 pointer-events-none">
      {/* Upper-Left Negative Space Title Emblem */}
      <div className="max-w-xl pointer-events-auto">
        <svg
          viewBox="0 0 420 118"
          className="w-full max-w-md drop-shadow-[0_6px_0_rgba(14,11,22,0.95)]"
          role="img"
          aria-label="Villager's Trial"
        >
          <rect x="4" y="6" width="412" height="104" fill="#1b162b" fillOpacity="0.88" stroke="#f7c948" strokeWidth="4" />
          <rect x="10" y="12" width="400" height="92" fill="none" stroke="#4b3f6b" strokeWidth="2" />
          {/* Pixel Sword & Pitchfork Emblem */}
          <rect x="26" y="34" width="6" height="44" fill="#a66a3e" />
          <rect x="20" y="28" width="18" height="6" fill="#94a3b8" />
          <rect x="20" y="18" width="4" height="10" fill="#f4efe6" />
          <rect x="27" y="18" width="4" height="10" fill="#f4efe6" />
          <rect x="34" y="18" width="4" height="10" fill="#f4efe6" />
          <text
            x="56"
            y="55"
            fill="#f7c948"
            fontFamily="Silkscreen, monospace"
            fontWeight="700"
            fontSize="26"
            letterSpacing="1"
          >
            VILLAGER&apos;S TRIAL
          </text>
          <text
            x="58"
            y="82"
            fill="#e6d8bd"
            fontFamily="Silkscreen, monospace"
            fontSize="12"
            letterSpacing="1.5"
          >
            16-BIT STAGGER &amp; PLATFORM RPG
          </text>
        </svg>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {savedSummary && onContinue && (
            <button
              type="button"
              data-continue="true"
              onClick={onContinue}
              className="font-pixel px-6 py-3.5 text-sm md:text-base font-bold bg-[#4ade80] text-[#0e0b16] border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] hover:bg-[#86efac] active:translate-y-0.5 active:shadow-[0_2px_0_#0e0b16] transition-transform cursor-pointer whitespace-nowrap shrink-0"
            >
              CONTINUE ({savedSummary.className} Lv.{savedSummary.level} · Z{savedSummary.zone})
            </button>
          )}
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className={`font-pixel px-7 py-3.5 text-sm md:text-base font-bold border-2 border-[#0e0b16] shadow-[0_4px_0_#0e0b16] active:translate-y-0.5 active:shadow-[0_2px_0_#0e0b16] transition-transform cursor-pointer whitespace-nowrap shrink-0 ${
              savedSummary
                ? 'bg-[#2d2544] text-[#f7c948] hover:bg-[#3d335c]'
                : 'bg-[#f7c948] text-[#0e0b16] hover:bg-[#fde047]'
            }`}
          >
            {savedSummary ? 'NEW ADVENTURE' : 'START ADVENTURE'}
          </button>
        </div>
      </div>

      {/* Bottom Safe-Margin Flat Control Hint */}
      <div className="text-xs md:text-sm font-pixel text-[#f4efe6] drop-shadow-[0_2px_0_#0e0b16]">
        A/D Move · Space Jump · E Interact · I Inventory · K Skill Tree · Enter Start
      </div>
    </div>
  );
}
