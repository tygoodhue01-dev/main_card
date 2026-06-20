import { useEffect, useState, useRef } from 'react';
import { Coins, Star, ArrowLeft, RotateCcw, Package, Trophy, Lock, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Box Tier Definitions ───────────────────────────────────────────────────

const BOXES = [
  {
    type: 'bronze' as const,
    name: 'Bronze Box',
    badge: 'RARE',
    pkbCost: 300,
    description: 'Guaranteed rare card valued $10–$60',
    priceRange: '$10 – $60',
    gradient: 'from-amber-900 via-amber-700 to-amber-500',
    lidGradient: 'from-amber-950 via-amber-800 to-amber-700',
    glowColor: '#d97706',
    glowClass: 'shadow-amber-500/40',
    borderColor: 'border-amber-600/60',
    textAccent: 'text-amber-400',
    badgeBg: 'bg-amber-700',
    badgeText: 'text-amber-100',
    ribbonColor: '#f59e0b',
    particleColor: '#fbbf24',
    stars: 1,
  },
  {
    type: 'silver' as const,
    name: 'Silver Box',
    badge: 'ULTRA RARE',
    pkbCost: 800,
    description: 'Ultra rare card guaranteed, valued $50–$160',
    priceRange: '$50 – $160',
    gradient: 'from-slate-700 via-slate-500 to-slate-300',
    lidGradient: 'from-slate-900 via-slate-700 to-slate-500',
    glowColor: '#94a3b8',
    glowClass: 'shadow-slate-400/50',
    borderColor: 'border-slate-400/60',
    textAccent: 'text-slate-300',
    badgeBg: 'bg-slate-500',
    badgeText: 'text-slate-100',
    ribbonColor: '#cbd5e1',
    particleColor: '#e2e8f0',
    stars: 2,
  },
  {
    type: 'gold' as const,
    name: 'Gold Box',
    badge: 'SECRET RARE',
    pkbCost: 2000,
    description: 'Legendary card valued $120+. The ultimate pull.',
    priceRange: '$120+',
    gradient: 'from-yellow-800 via-yellow-500 to-yellow-300',
    lidGradient: 'from-yellow-950 via-yellow-800 to-yellow-600',
    glowColor: '#fbbf24',
    glowClass: 'shadow-yellow-400/60',
    borderColor: 'border-yellow-500/70',
    textAccent: 'text-yellow-300',
    badgeBg: 'bg-yellow-500',
    badgeText: 'text-yellow-900',
    ribbonColor: '#fde68a',
    particleColor: '#fef08a',
    stars: 3,
  },
] as const;

type BoxType = typeof BOXES[number]['type'];

interface WonCard {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  set_name: string | null;
  rarity: string | null;
  description: string | null;
}

interface Opening {
  id: string;
  box_type: BoxType;
  pkb_spent: number;
  product_name: string;
  product_image_url: string | null;
  product_price: number;
  created_at: string;
}

type Phase = 'idle' | 'shaking' | 'burst' | 'rising' | 'revealed';

// ─── Sparkle Particle ───────────────────────────────────────────────────────

function Sparkle({ color, delay, tx, ty, sx, sy }: {
  color: string; delay: number; tx: string; ty: string; sx: string; sy: string;
}) {
  return (
    <div
      className="absolute w-3 h-3 rounded-full animate-sparkle pointer-events-none"
      style={{
        background: color,
        top: '50%', left: '50%',
        animationDelay: `${delay}s`,
        '--sx': sx, '--sy': sy, '--tx': tx, '--ty': ty,
        boxShadow: `0 0 6px 2px ${color}`,
      } as React.CSSProperties}
    />
  );
}

function generateSparkles(color: string, count = 24) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360 + Math.random() * 30;
    const dist = 80 + Math.random() * 120;
    const rad = (angle * Math.PI) / 180;
    return {
      tx: `${Math.cos(rad) * dist}px`,
      ty: `${Math.sin(rad) * dist}px`,
      sx: `${Math.cos(rad) * 10}px`,
      sy: `${Math.sin(rad) * 10}px`,
      delay: Math.random() * 0.3,
      color,
    };
  });
}

function Confetti({ color }: { color: string }) {
  const items = Array.from({ length: 30 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.5}s`,
    dur: `${0.9 + Math.random() * 0.8}s`,
    size: `${4 + Math.random() * 6}px`,
    color: i % 3 === 0 ? color : i % 3 === 1 ? '#fff' : '#fbbf24',
    shape: i % 4 === 0 ? '2px' : '50%',
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((p, i) => (
        <div key={i} className="absolute animate-confetti"
          style={{
            left: p.left, top: '-20px',
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.shape,
            animationDelay: p.delay,
            '--dur': p.dur,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Box Visual ─────────────────────────────────────────────────────────────

function BoxVisual({ box, phase, lidFlying }: {
  box: typeof BOXES[number];
  phase: Phase;
  lidFlying: boolean;
}) {
  return (
    <div className="relative w-44 h-52 mx-auto select-none">
      {/* Glow aura */}
      <div
        className="absolute inset-0 rounded-2xl blur-2xl opacity-50 pointer-events-none"
        style={{ background: box.glowColor, transform: 'scale(1.1)' }}
      />

      {/* Lid */}
      <div
        className={`absolute top-0 left-0 right-0 h-[40%] rounded-t-2xl bg-gradient-to-br ${box.lidGradient} border ${box.borderColor} z-10 flex items-center justify-center overflow-hidden ${lidFlying ? 'animate-lid-fly' : ''}`}
        style={{ transformOrigin: 'center top' }}
      >
        {/* Lid inner panel */}
        <div className="absolute inset-2 rounded-lg border border-white/10 bg-black/20" />
        {/* Lock icon */}
        <div className="relative z-10 w-8 h-8 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
          <Lock className="w-4 h-4 text-white/80" />
        </div>
        {/* Shine sweep */}
        {phase === 'burst' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shine" />
        )}
      </div>

      {/* Box body */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-[64%] rounded-b-2xl bg-gradient-to-br ${box.gradient} border ${box.borderColor} border-t-0 flex flex-col items-center justify-center gap-2 overflow-hidden`}
      >
        {/* Inner shine lines */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.2) 8px, rgba(255,255,255,0.2) 9px)' }} />

        {/* Ribbon vertical */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/25" />

        {/* PKB symbol */}
        <div className="relative z-10 w-12 h-12 rounded-full bg-black/30 border border-white/20 flex items-center justify-center shadow-inner">
          <Coins className="w-6 h-6 text-white/90" />
        </div>

        {/* Burst light from inside */}
        {(phase === 'burst' || phase === 'rising') && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `radial-gradient(circle, ${box.glowColor}99 0%, transparent 70%)` }}
          />
        )}
      </div>

      {/* Ribbon horizontal line */}
      <div
        className="absolute left-0 right-0 z-10 h-px"
        style={{ top: '40%', background: `linear-gradient(90deg, transparent, ${box.ribbonColor}, transparent)` }}
      />
    </div>
  );
}

// ─── Card Reveal ─────────────────────────────────────────────────────────────

function CardReveal({ card, box }: { card: WonCard; box: typeof BOXES[number] }) {
  const sparkles = generateSparkles(box.particleColor, 28);

  return (
    <div className="relative flex flex-col items-center">
      {/* Confetti */}
      <Confetti color={box.particleColor} />

      {/* Sparkles */}
      <div className="relative">
        {sparkles.map((s, i) => <Sparkle key={i} {...s} />)}

        {/* Card */}
        <div
          className="relative w-64 rounded-2xl overflow-hidden shadow-2xl animate-card-flip holo foil-border"
          style={{
            boxShadow: `0 0 40px ${box.glowColor}80, 0 0 80px ${box.glowColor}40, 0 20px 60px rgba(0,0,0,0.6)`,
          }}
        >
          {/* Card image */}
          <div className="relative aspect-[3/4] bg-gray-900 overflow-hidden">
            {card.image_url ? (
              <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{ background: `linear-gradient(135deg, ${box.glowColor}30, #111827)` }}
              >
                <Package className="w-16 h-16 text-white/20" />
                <p className="text-white/30 text-sm">Image unavailable</p>
              </div>
            )}
            {/* Holographic overlay */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `linear-gradient(135deg, transparent 30%, ${box.glowColor}20 50%, transparent 70%)` }} />
          </div>

          {/* Card footer */}
          <div className="bg-gray-900 border-t border-white/10 px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-bold text-white text-sm leading-tight line-clamp-2">{card.name}</p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${box.badgeBg} ${box.badgeText}`}>
                {box.badge}
              </span>
            </div>
            {card.set_name && (
              <p className="text-xs text-gray-400">{card.set_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Value banner */}
      <div
        className="mt-6 px-6 py-3 rounded-2xl border text-center animate-card-rise"
        style={{ borderColor: `${box.glowColor}50`, background: `${box.glowColor}18`, animationDelay: '0.25s' }}
      >
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Card Value</p>
        <p className="text-3xl font-black text-white mt-0.5" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
          ${card.price.toFixed(2)}
        </p>
        {card.rarity && (
          <p className={`text-xs font-bold mt-1 ${box.textAccent}`}>{card.rarity}</p>
        )}
      </div>
    </div>
  );
}

// ─── Opening Overlay ─────────────────────────────────────────────────────────

function OpeningOverlay({
  box, phase, wonCard, onClose, onOpenAgain, pkbBalance,
}: {
  box: typeof BOXES[number];
  phase: Phase;
  wonCard: WonCard | null;
  onClose: () => void;
  onOpenAgain: () => void;
  pkbBalance: number;
}) {
  const canOpenAgain = pkbBalance >= box.pkbCost;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Burst ring */}
      {(phase === 'burst' || phase === 'rising') && (
        <div
          className="absolute animate-burst-ring rounded-full pointer-events-none"
          style={{
            width: 120, height: 120,
            border: `3px solid ${box.glowColor}`,
            boxShadow: `0 0 30px ${box.glowColor}`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative flex flex-col items-center gap-8 px-4 max-w-sm w-full">

        {/* Phase: shaking / burst / rising = show animated box */}
        {(phase === 'shaking' || phase === 'burst' || phase === 'rising') && (
          <div className={phase === 'shaking' ? 'animate-box-shake' : ''}>
            <BoxVisual box={box} phase={phase} lidFlying={phase === 'burst' || phase === 'rising'} />
            {(phase === 'burst' || phase === 'rising') && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none">
                {generateSparkles(box.glowColor, 16).map((s, i) => (
                  <Sparkle key={i} {...s} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phase: rising = card coming up */}
        {phase === 'rising' && (
          <div className="animate-card-rise mt-4">
            <div className="w-48 h-64 rounded-xl bg-gray-900 border-2 animate-glow-breathe"
              style={{ borderColor: box.glowColor, '--glow': box.glowColor } as React.CSSProperties}
            >
              <div className="w-full h-full flex items-center justify-center">
                <Sparkles className="w-12 h-12 animate-pulse" style={{ color: box.glowColor }} />
              </div>
            </div>
          </div>
        )}

        {/* Phase: revealed */}
        {phase === 'revealed' && wonCard && (
          <>
            <div>
              <p className="text-center text-xs font-bold uppercase tracking-widest mb-3" style={{ color: box.glowColor }}>
                You won!
              </p>
              <CardReveal card={wonCard} box={box} />
            </div>

            <div className="flex gap-3 mt-2">
              {canOpenAgain && (
                <button
                  onClick={onOpenAgain}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border transition-all hover:brightness-110"
                  style={{ borderColor: box.glowColor, background: `${box.glowColor}25` }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Open Again
                </button>
              )}
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl font-bold text-sm transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          </>
        )}

        {/* Loading text */}
        {(phase === 'shaking' || phase === 'burst') && (
          <p className="text-gray-400 text-sm animate-pulse">Opening your box...</p>
        )}
      </div>
    </div>
  );
}

// ─── Box Select Card ─────────────────────────────────────────────────────────

function BoxCard({
  box, pkbBalance, onOpen, isLoading,
}: {
  box: typeof BOXES[number];
  pkbBalance: number;
  onOpen: (type: BoxType) => void;
  isLoading: boolean;
}) {
  const canAfford = pkbBalance >= box.pkbCost;

  return (
    <div
      className={`relative group flex flex-col rounded-3xl border overflow-hidden transition-all duration-500 cursor-pointer ${box.borderColor} ${canAfford ? 'hover:scale-105 hover:-translate-y-2' : 'opacity-60'}`}
      style={{
        background: 'linear-gradient(160deg, #111827 0%, #0f172a 100%)',
        boxShadow: canAfford ? `0 0 0 1px ${box.glowColor}30, 0 20px 60px rgba(0,0,0,0.5)` : undefined,
      }}
    >
      {/* Stars */}
      <div className="absolute top-4 right-4 flex gap-0.5">
        {Array.from({ length: box.stars }, (_, i) => (
          <Star key={i} className={`w-3.5 h-3.5 fill-current ${box.textAccent}`} />
        ))}
      </div>

      {/* Animated glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${box.glowColor}15 0%, transparent 70%)` }}
      />

      {/* Box visual */}
      <div className="pt-8 pb-4 flex justify-center">
        <div className={`${canAfford ? 'animate-box-float group-hover:animate-none' : ''}`}>
          <BoxVisual box={box} phase="idle" lidFlying={false} />
        </div>
      </div>

      {/* Info */}
      <div className="px-6 pb-6 flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
              {box.name}
            </h3>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${box.badgeBg} ${box.badgeText}`}>
              {box.badge}
            </span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{box.description}</p>
          <p className={`text-xs font-semibold mt-2 ${box.textAccent}`}>Card value range: {box.priceRange}</p>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cost</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <Coins className={`w-4 h-4 ${box.textAccent} flex-shrink-0`} />
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
                {box.pkbCost.toLocaleString()}
              </span>
              <span className={`text-sm font-bold ${box.textAccent}`}>$PKB</span>
            </div>
          </div>
          {!canAfford && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Need</p>
              <p className={`text-sm font-bold ${box.textAccent}`}>
                {(box.pkbCost - pkbBalance).toLocaleString()} more
              </p>
            </div>
          )}
        </div>

        {/* Open button */}
        <button
          onClick={() => canAfford && !isLoading && onOpen(box.type)}
          disabled={!canAfford || isLoading}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
            canAfford
              ? 'text-white hover:brightness-110 active:scale-95'
              : 'cursor-not-allowed text-gray-500 bg-gray-800'
          }`}
          style={canAfford ? {
            background: `linear-gradient(135deg, ${box.glowColor}cc, ${box.glowColor})`,
            boxShadow: `0 4px 20px ${box.glowColor}60`,
          } : undefined}
        >
          {canAfford ? (
            <>
              <Sparkles className="w-4 h-4" />
              Open Box
              <ChevronRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Not enough $PKB
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

interface MysteryBoxPageProps {
  onNavigate: (page: string) => void;
}

export default function MysteryBoxPage({ onNavigate }: MysteryBoxPageProps) {
  const { user } = useAuth();
  const [pkbBalance, setPkbBalance] = useState(0);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedBox, setSelectedBox] = useState<typeof BOXES[number] | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wonCard, setWonCard] = useState<WonCard | null>(null);
  const [opening, setOpening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const phaseTimers = useRef<number[]>([]);

  const clearTimers = () => { phaseTimers.current.forEach(clearTimeout); phaseTimers.current = []; };

  const fetchData = async () => {
    if (!user) return;
    const [ledgerRes, openingsRes] = await Promise.all([
      supabase.from('rewards_ledger').select('amount').eq('user_id', user.id),
      supabase.from('mystery_box_openings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    ]);
    const bal = (ledgerRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    setPkbBalance(Math.max(0, bal));
    setOpenings((openingsRes.data ?? []) as Opening[]);
    setLoadingHistory(false);
  };

  useEffect(() => { fetchData(); }, [user]);
  useEffect(() => () => clearTimers(), []);

  const handleOpen = async (boxType: BoxType) => {
    if (opening) return;
    const box = BOXES.find((b) => b.type === boxType)!;
    setSelectedBox(box);
    setWonCard(null);
    setErrorMsg(null);
    setOpening(true);
    setPhase('shaking');

    // Run animation and API in parallel
    const [result] = await Promise.all([
      supabase.rpc('open_mystery_box', { p_box_type: boxType }),
      new Promise<void>((res) => {
        phaseTimers.current.push(window.setTimeout(() => { setPhase('burst'); }, 1100));
        phaseTimers.current.push(window.setTimeout(() => { setPhase('rising'); }, 1700));
        phaseTimers.current.push(window.setTimeout(res, 2400));
      }),
    ]);

    const { data, error } = result;
    if (error || !data) {
      setErrorMsg((error as any)?.message ?? 'Something went wrong. Your PKB was not charged.');
      setSelectedBox(null);
      setPhase('idle');
      setOpening(false);
      return;
    }

    setWonCard(data as WonCard);
    setPhase('revealed');
    setOpening(false);
    // Refresh balance + history
    await fetchData();
  };

  const handleClose = () => {
    clearTimers();
    setSelectedBox(null);
    setPhase('idle');
    setWonCard(null);
    setOpening(false);
  };

  const handleOpenAgain = () => {
    if (!selectedBox) return;
    handleClose();
    // Small delay so state resets cleanly
    setTimeout(() => handleOpen(selectedBox.type), 50);
  };

  const boxTypeLabel: Record<BoxType, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0a12 0%, #111827 50%, #0f172a 100%)' }}>
      {/* Opening overlay */}
      {selectedBox && phase !== 'idle' && (
        <OpeningOverlay
          box={selectedBox}
          phase={phase}
          wonCard={wonCard}
          onClose={handleClose}
          onOpenAgain={handleOpenAgain}
          pkbBalance={pkbBalance}
        />
      )}

      {/* ─ Hero ─ */}
      <div className="relative overflow-hidden">
        {/* Star field bg */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 60 }, (_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                width: `${1 + Math.random() * 2}px`, height: `${1 + Math.random() * 2}px`,
                left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                opacity: 0.1 + Math.random() * 0.4,
                animation: `glow-breathe ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-5">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">$PKB Exclusive</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-white mb-4 leading-tight" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
            Mystery<br />
            <span className="bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Boxes
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Spend your PokeBucks to unlock exclusive, higher-tier cards you won't find in the regular store.
          </p>

          {/* Balance display */}
          {user ? (
            <div className="inline-flex items-center gap-3 mt-8 bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
              <Coins className="w-5 h-5 text-yellow-400" />
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Your Balance</p>
                <p className="text-xl font-black text-white" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
                  {pkbBalance.toLocaleString()} <span className="text-yellow-400 text-base">$PKB</span>
                </p>
              </div>
              <button
                onClick={() => onNavigate('account')}
                className="ml-2 text-xs text-yellow-400/70 hover:text-yellow-400 transition-colors underline underline-offset-2"
              >
                Earn more
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 mt-8 bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-sm">
                <button onClick={() => onNavigate('auth')} className="text-yellow-400 hover:text-yellow-300 font-semibold underline">Sign in</button>
                {' '}to use your PokeBucks
              </span>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="mt-4 inline-flex items-center gap-2 bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-2 text-red-400 text-sm">
              {errorMsg}
            </div>
          )}
        </div>
      </div>

      {/* ─ Box Grid ─ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BOXES.map((box) => (
            <BoxCard
              key={box.type}
              box={box}
              pkbBalance={user ? pkbBalance : 0}
              onOpen={handleOpen}
              isLoading={opening}
            />
          ))}
        </div>

        {/* How it works */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
            <Trophy className="w-5 h-5 text-yellow-400" />
            How Mystery Boxes Work
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Earn PokeBucks', desc: 'Shop at The Card Mon and earn 10 $PKB for every $1 spent. PokeBucks are the only currency accepted.', color: 'text-yellow-400' },
              { step: '02', title: 'Choose Your Box', desc: 'Pick the box tier that matches your balance. Higher tiers guarantee rarer, more valuable cards.', color: 'text-amber-400' },
              { step: '03', title: 'Open & Win', desc: 'Watch the reveal animation and discover which card you pulled. It ships directly from our inventory.', color: 'text-orange-400' },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex gap-4">
                <span className={`text-3xl font-black opacity-30 ${color} flex-shrink-0 leading-none`} style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>{step}</span>
                <div>
                  <p className={`font-bold text-sm mb-1 ${color}`}>{title}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Past openings */}
        {user && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2" style={{ fontFamily: 'Rajdhani, Inter, sans-serif' }}>
              <Package className="w-5 h-5 text-gray-400" />
              Your Openings
            </h2>

            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full" />
              </div>
            ) : openings.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-white/10 bg-white/5">
                <Package className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No boxes opened yet — be the first pull!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {openings.map((o) => {
                  const boxDef = BOXES.find((b) => b.type === o.box_type)!;
                  return (
                    <div key={o.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors">
                      {/* Thumbnail */}
                      <div
                        className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden border"
                        style={{ borderColor: `${boxDef.glowColor}50` }}
                      >
                        {o.product_image_url ? (
                          <img src={o.product_image_url} alt={o.product_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: `${boxDef.glowColor}20` }}>
                            <Package className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{o.product_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${boxDef.badgeBg} ${boxDef.badgeText}`}>
                            {boxTypeLabel[o.box_type]}
                          </span>
                          <span className="text-gray-500 text-xs">${o.product_price?.toFixed(2)}</span>
                        </div>
                        <p className="text-gray-600 text-[10px] mt-0.5">
                          {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${boxDef.textAccent}`}>-{o.pkb_spent.toLocaleString()}</p>
                        <p className="text-gray-600 text-[10px]">$PKB</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
