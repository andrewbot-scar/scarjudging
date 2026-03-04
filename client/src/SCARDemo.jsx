// SCARDemo.jsx
// Self-contained interactive demo of the SCAR Judge Portal
// Matches the exact design system of the production app
// Deploy at: brackets.socalattackrobots.com/demo
// No backend required - all state is simulated in-memory

import { useState, useEffect, useCallback, useRef } from "react";

// ─── ELO config (mirrors production) ─────────────────────────────────────────
const ELO_SITE_BASE_URL = "https://elo.socalattackrobots.com";
const WEIGHT_CLASS_SLUG = "3lb";

function getEloRobotUrl(robotName) {
  const slug = robotName.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${ELO_SITE_BASE_URL}/class/${WEIGHT_CLASS_SLUG}/robot/${slug}`;
}

// ─── Real top-8 beetleweights ─────────────────────────────────────────────────
const ROBOTS = {
  1: { id: 1, name: "Droopy",          team: "Surrenderbotics",       seed: 1, elo: 1714, tier: "S", wins: 33, losses: 10 },
  2: { id: 2, name: "MAG",             team: "High Energy Failures",  seed: 2, elo: 1583, tier: "S", wins: 26, losses: 8  },
  3: { id: 3, name: "Sandstorm",       team: "Level 5 Robotics",      seed: 3, elo: 1581, tier: "S", wins: 25, losses: 20 },
  4: { id: 4, name: "Strikepoint",     team: "Team Thagomizer",       seed: 4, elo: 1576, tier: "S", wins: 10, losses: 1  },
  5: { id: 5, name: "Z3phyr",          team: "Astro Labs",            seed: 5, elo: 1568, tier: "S", wins: 6,  losses: 2  },
  6: { id: 6, name: "Unknown Avenger", team: "Team Ice",              seed: 6, elo: 1552, tier: "A", wins: 16, losses: 9  },
  7: { id: 7, name: "Venator",         team: "RC Robotics",           seed: 7, elo: 1549, tier: "A", wins: 6,  losses: 4  },
  8: { id: 8, name: "Strikeout",       team: "Team Thagomizer",       seed: 8, elo: 1541, tier: "A", wins: 14, losses: 4  },
};
const rn = (id) => ROBOTS[id]?.name ?? "TBD";

// ─── Theme system (copied exactly from production) ────────────────────────────
const themes = {
  light: {
    bg: "bg-gray-100", card: "bg-white", cardBorder: "border-gray-200",
    text: "text-gray-900", textMuted: "text-gray-600", textFaint: "text-gray-500",
    headerBg: "bg-white", inputBg: "bg-white", inputBorder: "border-gray-300",
    hoverBg: "hover:bg-gray-50", activeBg: "bg-gray-100", tableBg: "bg-gray-50",
    divider: "border-gray-200", winnerBg: "bg-green-50", winnerText: "text-green-700",
    pendingBg: "bg-gray-200", pendingText: "text-gray-600",
    liveBg: "bg-amber-100", liveText: "text-amber-700",
    koBg: "bg-red-100", koText: "text-red-700",
    decisionBg: "bg-green-100", decisionText: "text-green-700",
    blueText: "text-blue-600", redText: "text-red-600",
    sliderBg: "bg-gray-200", tickMark: "bg-gray-300",
  },
  dark: {
    bg: "bg-gray-900", card: "bg-gray-800", cardBorder: "border-gray-700/50",
    text: "text-white", textMuted: "text-gray-400", textFaint: "text-gray-500",
    headerBg: "bg-gray-800", inputBg: "bg-gray-700", inputBorder: "border-gray-600",
    hoverBg: "hover:bg-gray-700", activeBg: "bg-gray-700", tableBg: "bg-gray-700/50",
    divider: "border-gray-700/50", winnerBg: "bg-green-900/30", winnerText: "text-green-400",
    pendingBg: "bg-gray-700", pendingText: "text-gray-400",
    liveBg: "bg-amber-900/50", liveText: "text-amber-400",
    koBg: "bg-red-900/50", koText: "text-red-400",
    decisionBg: "bg-green-900/50", decisionText: "text-green-400",
    blueText: "text-blue-400", redText: "text-red-400",
    sliderBg: "bg-gray-700", tickMark: "bg-gray-600",
  },
};

// ─── Scoring criteria (production default) ────────────────────────────────────
const SCORING_CRITERIA = [
  { id: "aggression", name: "Aggression", points: 3 },
  { id: "damage",     name: "Damage",     points: 5 },
  { id: "control",    name: "Control",    points: 3 },
];
const TOTAL_MAX = SCORING_CRITERIA.reduce((s, c) => s + c.points, 0); // 11

// ─── Demo match data ──────────────────────────────────────────────────────────
// 8-robot double-elim: W1(4 matches) → W2(2) → WF(1) | L1(2) → L2(2) → LF(1) → GF(1)
const buildInitialState = () => ({
  matches: [
    // --- WINNERS BRACKET ---
    {
      id: 1, label: "Match 1", round: "W1", roundLabel: "Winners Round 1",
      p1: 1, p2: 8, winner: 1, loser: 8,
      status: "completed", winMethod: "decision",
      scores: { a: 7, b: 4 },
      completedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      judgeData: {
        judge_1: { scores: { aggression: 2, damage: 3, control: 2 } },
        judge_2: { scores: { aggression: 3, damage: 2, control: 2 } },
        judge_3: { scores: { aggression: 2, damage: 2, control: 2 } },
      },
    },
    {
      id: 2, label: "Match 2", round: "W1", roundLabel: "Winners Round 1",
      p1: 4, p2: 5, winner: 5, loser: 4,
      status: "completed", winMethod: "ko",
      scores: { a: 0, b: 11 },
      completedAt: new Date(Date.now() - 35 * 60000).toISOString(),
      judgeData: {},
    },
    {
      id: 3, label: "Match 3", round: "W1", roundLabel: "Winners Round 1",
      p1: 2, p2: 7, winner: 2, loser: 7,
      status: "completed", winMethod: "ko",
      scores: { a: 11, b: 0 },
      completedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      judgeData: {},
    },
    {
      id: 4, label: "Match 4", round: "W1", roundLabel: "Winners Round 1",
      p1: 3, p2: 6, winner: null, loser: null,
      status: "active", winMethod: null,
      scores: null,
      completedAt: null,
      judgeData: {},
      isFighting: false,
      repairResetAt: null,
    },
    // --- WINNERS SEMIFINALS ---
    {
      id: 5, label: "Match 5", round: "W2", roundLabel: "Winners Semifinals",
      p1: 1, p2: null, winner: null, loser: null, // p2 = winner M4
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    {
      id: 6, label: "Match 6", round: "W2", roundLabel: "Winners Semifinals",
      p1: 2, p2: null, winner: null, loser: null, // p2 = winner M4... (seed logic)
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    // --- WINNERS FINALS ---
    {
      id: 7, label: "Winners Finals", round: "WF", roundLabel: "Winners Finals",
      p1: null, p2: null, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    // --- LOSERS ROUND 1 ---
    {
      id: 8, label: "Match 8", round: "L1", roundLabel: "Losers Round 1",
      p1: 8, p2: 4, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    {
      id: 9, label: "Match 9", round: "L1", roundLabel: "Losers Round 1",
      p1: 7, p2: null, winner: null, loser: null, // p2 = loser M4
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    // --- LOSERS ROUND 2 ---
    {
      id: 10, label: "Match 10", round: "L2", roundLabel: "Losers Round 2",
      p1: null, p2: null, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    {
      id: 11, label: "Match 11", round: "L2", roundLabel: "Losers Round 2",
      p1: null, p2: null, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    // --- LOSERS FINALS ---
    {
      id: 12, label: "Losers Finals", round: "LF", roundLabel: "Losers Finals",
      p1: null, p2: null, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
    // --- GRAND FINALS ---
    {
      id: 13, label: "Grand Finals", round: "GF", roundLabel: "Grand Finals",
      p1: null, p2: null, winner: null, loser: null,
      status: "pending", winMethod: null, scores: null, completedAt: null, judgeData: {},
    },
  ],
  // Active match id (the one currently in the box)
  activeMatchId: 4,
  // Who is currently "fighting" in the arena
  fightingMatchId: null,
  // Repair timer resets: { robotId: timestamp }
  repairResets: {},
  // Which judge is logged in for the demo
  currentJudge: "judge_1",
  // Per-judge submitted state for active match
  judgeSubmitted: { judge_1: false, judge_2: false, judge_3: false },
});

// ─── StatusBadge (exact match to production) ──────────────────────────────────
const StatusBadge = ({ status, winMethod, scores, t }) => {
  if (status === "pending")
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.pendingBg} ${t.pendingText}`}>Upcoming</span>;
  if (status === "active")
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.liveBg} ${t.liveText} animate-pulse`}>● Live</span>;
  if (winMethod === "ko" || (scores && (scores.a === 0 || scores.b === 0)))
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>;
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.decisionBg} ${t.decisionText}`}>Decision</span>;
};

// ─── Tier badge ───────────────────────────────────────────────────────────────
const TierBadge = ({ tier }) => {
  const cls = tier === "S" ? "bg-yellow-100 text-yellow-800" :
              tier === "A" ? "bg-purple-100 text-purple-800" :
              tier === "B" ? "bg-blue-100 text-blue-800" :
                             "bg-green-100 text-green-800";
  return <span className={`font-semibold px-1.5 py-0.5 rounded text-xs ${cls}`}>{tier}</span>;
};

// ─── Robot Avatar (exact match) ───────────────────────────────────────────────
const RobotAvatar = ({ name, size = "md" }) => {
  const sizeClasses = { sm: "w-8 h-8 text-sm", md: "w-12 h-12 text-lg", lg: "w-20 h-20 sm:w-24 sm:h-24 text-3xl", xl: "w-24 h-24 sm:w-28 sm:h-28 text-4xl" };
  const colors = ["bg-blue-100 text-blue-600", "bg-red-100 text-red-600", "bg-emerald-100 text-emerald-600",
                  "bg-purple-100 text-purple-600", "bg-amber-100 text-amber-700", "bg-cyan-100 text-cyan-700",
                  "bg-pink-100 text-pink-600", "bg-indigo-100 text-indigo-600"];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`${sizeClasses[size]} ${colors[idx]} rounded-lg border border-opacity-30 flex items-center justify-center flex-shrink-0 font-bold`}>
      {name?.[0] ?? "?"}
    </div>
  );
};

// ─── SplitSlider (exact match to production, with haptics) ───────────────────
const SplitSlider = ({ label, maxPoints, valueA, onChange, disabled, t }) => {
  const valueB = maxPoints - valueA;
  const [lastValue, setLastValue] = useState(valueA);

  const triggerHaptic = (type = "light") => {
    try { if ("vibrate" in navigator) navigator.vibrate(type === "heavy" ? 40 : type === "medium" ? 20 : 10); } catch {}
  };

  const handleChange = (newValue) => {
    const v = parseInt(newValue);
    if (v !== lastValue) {
      triggerHaptic("light");
      const mid = Math.floor(maxPoints / 2);
      if ((lastValue < mid && v >= mid) || (lastValue > mid && v <= mid)) triggerHaptic("medium");
      if (v === 0 || v === maxPoints) triggerHaptic("heavy");
      setLastValue(v);
    }
    onChange(v);
  };

  return (
    <div className="mb-6 sm:mb-5">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm font-medium ${t.textMuted}`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>{maxPoints} pts total</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 sm:w-12 text-center">
          <span className={`text-xl sm:text-2xl font-bold transition-colors ${valueA > valueB ? t.blueText : t.textFaint}`}>{valueA}</span>
        </div>
        <div className="flex-1 relative py-3">
          <div className={`h-2 ${t.sliderBg} rounded-full relative overflow-hidden`}>
            <div className="absolute left-0 top-0 h-full bg-red-500 rounded-l-full transition-all duration-150" style={{ width: `${(valueB / maxPoints) * 100}%` }} />
            <div className="absolute right-0 top-0 h-full bg-blue-500 rounded-r-full transition-all duration-150" style={{ width: `${(valueA / maxPoints) * 100}%` }} />
          </div>
          <div className="absolute pointer-events-none transition-all duration-150"
            style={{ left: `${(valueB / maxPoints) * 100}%`, top: "50%", marginTop: "-0.5rem", marginLeft: "-0.75rem" }}>
            <div className={`w-6 h-6 rounded-full shadow-lg transition-transform ${disabled ? "bg-gray-400 border-2 border-gray-500" : "bg-white border-2 border-gray-700"}`} />
          </div>
          <input type="range" min={0} max={maxPoints} value={valueB}
            onChange={(e) => handleChange(maxPoints - parseInt(e.target.value))}
            disabled={disabled}
            className="absolute w-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            style={{ top: "50%", transform: "translateY(-50%)", height: "2rem" }}
          />
        </div>
        <div className="w-10 sm:w-12 text-center">
          <span className={`text-xl sm:text-2xl font-bold transition-colors ${valueB > valueA ? t.redText : t.textFaint}`}>{valueB}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Repair Timer (real countdown, mirrors production 20-min logic) ───────────
const RepairTimer = ({ startTime, t }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const REPAIR_MS = 20 * 60 * 1000;
  const elapsed = now - startTime;
  const remaining = Math.max(0, REPAIR_MS - elapsed);
  const pct = (remaining / REPAIR_MS) * 100;
  const mins = Math.floor(remaining / 60000).toString().padStart(2, "0");
  const secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
  const colorClass = remaining > 10 * 60000 ? "text-green-500" : remaining > 5 * 60000 ? "text-amber-500" : "text-red-500";
  const barColor = remaining > 10 * 60000 ? "bg-green-500" : remaining > 5 * 60000 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3 sm:p-4 mb-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 ${t.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className={`text-sm font-semibold ${t.textMuted}`}>Repair Window Active</span>
        </div>
        <span className={`text-2xl font-mono font-bold ${colorClass}`}>{mins}:{secs}</span>
      </div>
      <div className={`w-full h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
        <div className={`h-full ${barColor} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
      {remaining === 0 && <p className={`text-xs ${t.textFaint} mt-1 text-center`}>Repair window expired</p>}
    </div>
  );
};

// ─── Match Detail Popup (exact match to production) ───────────────────────────
const MatchDetailPopup = ({ match, onClose, t }) => {
  if (!match) return null;
  const robot = (id) => ROBOTS[id];
  const ra = robot(match.p1), rb = robot(match.p2);
  const judges = Object.entries(match.judgeData || {});
  const hasScores = judges.length > 0;

  const getJudgeTotals = (scores) => {
    if (!scores) return { a: 0, b: 0 };
    const a = (scores.aggression || 0) + (scores.damage || 0) + (scores.control || 0);
    return { a, b: TOTAL_MAX - a };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg ${t.card} rounded-2xl border ${t.cardBorder} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b ${t.divider} flex justify-between items-center`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${t.tableBg} ${t.textMuted}`}>3lb Beetleweight Demo</span>
            </div>
            <span className={`text-xs ${t.textFaint} font-mono`}>{match.label}</span>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={match.status} winMethod={match.winMethod} scores={match.scores} t={t} />
              {match.winner && <span className={`text-xs ${t.textMuted}`}>Winner: {rn(match.winner)}</span>}
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.hoverBg} ${t.textMuted} transition-colors`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Competitors */}
        <div className={`px-5 py-4 border-b ${t.divider}`}>
          <div className="grid grid-cols-3 items-center gap-4">
            {[{ r: ra, score: match.scores?.a, isWinner: match.winner === match.p1 },
              null,
              { r: rb, score: match.scores?.b, isWinner: match.winner === match.p2 }].map((item, i) => {
              if (!item) return <div key="vs" className="text-center"><span className={`${t.textFaint} font-medium`}>vs</span></div>;
              const { r, score, isWinner } = item;
              return (
                <div key={i} className="text-center">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-lg overflow-hidden mb-2 ${isWinner ? "ring-2 ring-green-500" : ""}`}>
                    <div className={`w-full h-full flex items-center justify-center text-3xl font-bold ${i === 0 ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"}`}>
                      {r?.name?.[0] ?? "?"}
                    </div>
                  </div>
                  {r ? (
                    <a href={getEloRobotUrl(r.name)} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`font-semibold ${t.text} text-sm hover:underline`}>
                      {r.name}
                    </a>
                  ) : <p className={`font-semibold ${t.textMuted} text-sm`}>TBD</p>}
                  {r && (
                    <div className={`inline-block mt-1 px-2 py-1 rounded text-xs ${t.tableBg}`}>
                      <div className="flex items-center justify-center gap-1.5">
                        <TierBadge tier={r.tier} />
                        <span className={t.textFaint}>•</span>
                        <span className={t.textMuted}>{r.elo}</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className="text-green-500 font-medium">{r.wins}W</span>
                        <span className={t.textFaint}>-</span>
                        <span className="text-red-500 font-medium">{r.losses}L</span>
                      </div>
                    </div>
                  )}
                  {score != null && <p className={`text-xl font-bold mt-1 ${i === 0 ? t.blueText : t.redText}`}>{score}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Judge Scores */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <h3 className={`text-sm font-semibold ${t.textFaint} uppercase tracking-wide mb-4`}>Judge Scores ({judges.length}/3)</h3>
          {!hasScores ? (
            <div className="text-center py-8"><p className={t.textMuted}>No judge scores submitted yet</p></div>
          ) : (
            <div className="space-y-4">
              {judges.map(([judgeId, judgeData], idx) => {
                const totals = getJudgeTotals(judgeData.scores);
                return (
                  <div key={judgeId} className={`${t.tableBg} rounded-lg p-4`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`font-semibold ${t.text}`}>Judge {idx + 1}</span>
                      {judgeData.isKO ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">
                          KO: {judgeData.koWinner === "a" ? rn(match.p1) : rn(match.p2)}
                        </span>
                      ) : (
                        <span className={`text-sm ${t.textMuted}`}>{totals.a} - {totals.b}</span>
                      )}
                    </div>
                    {!judgeData.isKO && judgeData.scores && (
                      <div className="space-y-2">
                        {SCORING_CRITERIA.map((c) => {
                          const val = judgeData.scores[c.id] || 0;
                          return (
                            <div key={c.id} className="flex items-center justify-between text-sm">
                              <span className={`${t.textMuted} capitalize`}>{c.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono ${t.blueText}`}>{val}</span>
                                <div className={`w-16 h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
                                  <div className="h-full bg-blue-500" style={{ width: `${(val / c.points) * 100}%` }} />
                                </div>
                                <span className={`font-mono ${t.redText}`}>{c.points - val}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`px-5 py-3 border-t ${t.divider} ${t.tableBg}`}>
          <button onClick={onClose} className={`w-full py-2 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors`}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── Bracket node (production-style) ─────────────────────────────────────────
const getCompetitorDisplay = (id, source) => {
  if (id) return { text: ROBOTS[id]?.name ?? "TBD", isPlaceholder: false };
  if (!source) return { text: "TBD", isPlaceholder: true };
  return { text: `${source.type === "winner" ? "W" : "L"} of M${source.matchNum}`, isPlaceholder: true };
};

const BracketMatchCard = ({ match, onClick, fightingMatchId, t }) => {
  const isFighting = fightingMatchId === match.id;
  const ra = getCompetitorDisplay(match.p1, match.sourceA);
  const rb = getCompetitorDisplay(match.p2, match.sourceB);

  return (
    <div
      onClick={() => match.status !== "pending" || (match.p1 && match.p2) ? onClick(match) : null}
      className={`rounded-xl border overflow-hidden transition-all duration-200 min-w-[160px] cursor-pointer
        ${isFighting ? `border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.3)]` :
          match.status === "active" ? `border-amber-500/60 shadow-md` :
          match.status === "completed" ? `${t.cardBorder}` :
          `${t.cardBorder} opacity-70`}
        ${t.card}`}
    >
      <div className={`px-2 py-1 flex items-center justify-between border-b ${t.divider} ${t.tableBg}`}>
        <span className={`text-xs font-mono ${t.textFaint}`}>{match.label}</span>
        <StatusBadge status={match.status} winMethod={match.winMethod} scores={match.scores} t={t} />
      </div>
      {[{ disp: ra, id: match.p1, score: match.scores?.a, isWinner: match.winner === match.p1 },
        { disp: rb, id: match.p2, score: match.scores?.b, isWinner: match.winner === match.p2 }].map(({ disp, id, score, isWinner }, i) => (
        <div key={i} className={`px-2 py-1.5 flex items-center gap-1.5 text-sm
          ${i === 1 ? `border-t ${t.divider}` : ""}
          ${isWinner ? t.winnerBg : ""}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isWinner ? "bg-green-500" : id ? `${t.tickMark}` : "bg-transparent"}`} />
          <span className={`flex-1 truncate ${disp.isPlaceholder ? t.textFaint : isWinner ? t.winnerText : t.text} ${disp.isPlaceholder ? "italic text-xs" : "font-medium"}`}>
            {disp.text}
          </span>
          {score != null && !disp.isPlaceholder && (
            <span className={`text-xs font-mono font-bold ${t.textMuted}`}>{score}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Bracket View ─────────────────────────────────────────────────────────────
const BracketView = ({ state, onMatchClick, t }) => {
  const { matches, fightingMatchId } = state;
  const byRound = (r) => matches.filter((m) => m.round === r);
  const sections = [
    { key: "winners", label: "Winners Bracket", color: "text-blue-400", border: "border-blue-900/40",
      rounds: [{ id: "W1", label: "Round 1" }, { id: "W2", label: "Semifinals" }, { id: "WF", label: "Finals" }] },
    { key: "losers", label: "Losers Bracket", color: "text-red-400", border: "border-red-900/40",
      rounds: [{ id: "L1", label: "Round 1" }, { id: "L2", label: "Round 2" }, { id: "LF", label: "Finals" }] },
  ];

  return (
    <div className="overflow-x-auto pb-4">
      {sections.map((section) => (
        <div key={section.key} className="mb-8">
          <div className={`text-xs font-bold uppercase tracking-widest ${section.color} mb-3 pb-2 border-b ${section.border}`}>
            {section.label}
          </div>
          <div className="flex gap-6 sm:gap-8 items-start">
            {section.rounds.map(({ id, label }, ri) => {
              const sectionMatches = byRound(id);
              return (
                <div key={id} className="flex flex-col gap-3" style={{ marginTop: ri * 24 }}>
                  <div className={`text-xs uppercase tracking-wide ${t.textFaint} mb-1`}>{label}</div>
                  {sectionMatches.map((m) => (
                    <BracketMatchCard key={m.id} match={m} onClick={onMatchClick} fightingMatchId={fightingMatchId} t={t} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Grand Finals */}
      <div>
        <div className={`text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 pb-2 border-b border-amber-900/40`}>
          Grand Finals
        </div>
        {byRound("GF").map((m) => (
          <BracketMatchCard key={m.id} match={m} onClick={onMatchClick} fightingMatchId={fightingMatchId} t={t} />
        ))}
      </div>
    </div>
  );
};

// ─── Completed Matches View ───────────────────────────────────────────────────
const CompletedView = ({ state, onMatchClick, t }) => {
  const completed = state.matches.filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const kos = completed.filter((m) => m.winMethod === "ko" || m.scores?.a === 0 || m.scores?.b === 0).length;

  const fmt = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (completed.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <div className={`w-16 h-16 mx-auto rounded-full ${t.tableBg} flex items-center justify-center mb-4`}>
          <svg className={`w-8 h-8 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Completed Matches Yet</h3>
        <p className={t.textMuted}>Matches will appear here once they've been judged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className={`text-2xl sm:text-3xl font-bold ${t.text}`}>{completed.length}</p><p className={`text-xs sm:text-sm ${t.textMuted}`}>Completed</p></div>
          <div><p className={`text-2xl sm:text-3xl font-bold ${t.blueText}`}>{kos}</p><p className={`text-xs sm:text-sm ${t.textMuted}`}>KOs</p></div>
          <div><p className={`text-2xl sm:text-3xl font-bold ${t.text}`}>{completed.length - kos}</p><p className={`text-xs sm:text-sm ${t.textMuted}`}>Decisions</p></div>
        </div>
      </div>

      <div className={`${t.card} rounded-xl border ${t.cardBorder} overflow-hidden`}>
        <div className={`px-4 sm:px-5 py-3 border-b ${t.divider} ${t.tableBg}`}>
          <h2 className={`font-bold ${t.text} text-sm sm:text-base`}>All Completed Matches</h2>
          <p className={`text-xs ${t.textMuted}`}>Most recent at top</p>
        </div>
        <div className={`divide-y ${t.divider}`}>
          {completed.map((match) => {
            const isKO = match.winMethod === "ko" || match.scores?.a === 0 || match.scores?.b === 0;
            return (
              <div key={match.id} onClick={() => onMatchClick(match)}
                className={`px-4 sm:px-5 py-3 ${t.hoverBg} cursor-pointer transition-colors`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 text-center w-10">
                      <span className={`text-xs ${t.textFaint} font-mono block`}>M{match.id}</span>
                      <span className={`text-xs ${t.textFaint} block`}>{match.round}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <RobotAvatar name={rn(match.p1)} size="sm" />
                      <RobotAvatar name={rn(match.p2)} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={getEloRobotUrl(rn(match.p1))} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`font-semibold ${match.winner === match.p1 ? t.winnerText : t.text} text-sm hover:underline truncate`}>
                          {rn(match.p1)}{match.winner === match.p1 ? " ✓" : ""}
                        </a>
                        <span className={`text-xs ${t.textFaint}`}>vs</span>
                        <a href={getEloRobotUrl(rn(match.p2))} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`font-semibold ${match.winner === match.p2 ? t.winnerText : t.text} text-sm hover:underline truncate`}>
                          {rn(match.p2)}{match.winner === match.p2 ? " ✓" : ""}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {match.completedAt && <span className={`text-xs ${t.textFaint} hidden sm:block`}>{fmt(match.completedAt)}</span>}
                    {isKO
                      ? <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>
                      : <span className={`text-sm font-mono ${t.textMuted}`}>{match.scores?.a}-{match.scores?.b}</span>}
                    <svg className={`w-4 h-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Judge Scoring View ───────────────────────────────────────────────────────
const JudgeScoringView = ({ state, dispatch, t }) => {
  const { matches, activeMatchId, fightingMatchId, repairResets, currentJudge, judgeSubmitted } = state;
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);

  const REPAIR_MS = 20 * 60 * 1000;

  // Match list: non-completed with both competitors known
  const scorable = matches.filter((m) => m.status !== "completed" && m.p1 && m.p2);

  // Active match
  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? scorable[0];

  // Per-criteria scores state
  const initScores = () => Object.fromEntries(SCORING_CRITERIA.map((c) => [c.id, Math.floor(c.points / 2)]));
  const [scores, setScores] = useState(initScores);
  const [isKO, setIsKO] = useState(false);
  const [koWinner, setKoWinner] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const totalA = SCORING_CRITERIA.reduce((s, c) => s + (scores[c.id] || 0), 0);
  const totalB = TOTAL_MAX - totalA;

  // Submitted judges for current active match
  const submittedJudges = Object.keys(activeMatch?.judgeData ?? {});
  const waitingOn = ["judge_1", "judge_2", "judge_3"].filter((j) => !submittedJudges.includes(j));
  const judgesCount = submittedJudges.length;

  // Repair status
  const getRepairStatus = (robotId) => {
    const reset = repairResets[robotId];
    const robotName = ROBOTS[robotId]?.name;
    const lastFight = matches.filter((m) => m.status === "completed" && (m.p1 === robotId || m.p2 === robotId))
      .map((m) => new Date(m.completedAt).getTime()).reduce((a, b) => Math.max(a, b), 0);
    const resetTime = reset ? new Date(reset).getTime() : 0;
    const start = Math.max(lastFight, resetTime);
    if (!start) return { ready: true, remaining: 0 };
    const elapsed = now.getTime() - start;
    const remaining = Math.max(0, REPAIR_MS - elapsed);
    return { ready: remaining <= 0, remaining };
  };

  const isFighting = fightingMatchId === activeMatch?.id;
  const repairA = activeMatch ? getRepairStatus(activeMatch.p1) : { ready: true };
  const repairB = activeMatch ? getRepairStatus(activeMatch.p2) : { ready: true };
  const bothReady = repairA.ready && repairB.ready;

  const handleMatchChange = (id) => {
    dispatch({ type: "SET_ACTIVE_MATCH", id: parseInt(id) });
    setScores(initScores());
    setIsKO(false); setKoWinner(null); setHasSubmitted(false); setSubmitResult(null);
  };

  const handleSubmit = () => {
    if (!activeMatch) return;
    const judgeData = isKO
      ? { isKO: true, koWinner }
      : { scores: { ...scores } };
    dispatch({ type: "SUBMIT_JUDGE_SCORE", matchId: activeMatch.id, judgeId: currentJudge, data: judgeData });
    setHasSubmitted(true);
    setSubmitResult({ finalized: judgesCount + 1 >= 3 });
  };

  const handleEdit = () => {
    dispatch({ type: "DELETE_JUDGE_SCORE", matchId: activeMatch.id, judgeId: currentJudge });
    setHasSubmitted(false); setSubmitResult(null);
  };

  const handleStart = () => dispatch({ type: "SET_FIGHTING", matchId: activeMatch.id });
  const handleEnd = () => dispatch({ type: "CLEAR_FIGHTING" });
  const handleRepairReset = (robotId) => dispatch({ type: "RESET_REPAIR", robotId, time: new Date().toISOString() });

  const fmtRepair = (ms) => {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (scorable.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Matches Available</h3>
        <p className={t.textMuted}>All matches are complete or waiting for competitors.</p>
      </div>
    );
  }

  const matchesByRound = scorable.reduce((acc, m) => {
    if (!acc[m.roundLabel]) acc[m.roundLabel] = [];
    acc[m.roundLabel].push(m);
    return acc;
  }, {});

  const getMatchIndicator = (m) => {
    if (fightingMatchId === m.id) return "🟡";
    const ra = getRepairStatus(m.p1), rb = getRepairStatus(m.p2);
    if (ra.ready && rb.ready) return "🟢";
    return "🔴";
  };

  return (
    <div className="max-w-xl mx-auto space-y-3 sm:space-y-4">
      {/* Match selector */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3 sm:p-4`}>
        <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>
          Select Match to Score ({scorable.length} available)
        </label>
        <select value={activeMatch?.id ?? ""} onChange={(e) => handleMatchChange(e.target.value)}
          className={`w-full px-3 py-3 sm:py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm`}>
          {Object.entries(matchesByRound).map(([round, rMatches]) => (
            <optgroup key={round} label={round}>
              {rMatches.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMatchIndicator(m)} {m.label}: {rn(m.p1)} vs {rn(m.p2)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {submitResult?.finalized && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-700 font-semibold">🏆 Match Complete!</p>
          <p className={`text-sm ${t.textMuted} mt-1`}>All 3 judges have submitted. Result finalized.</p>
          <p className={`text-xs ${t.textFaint} mt-2`}>Result submitted to Challonge (demo)</p>
        </div>
      )}

      {activeMatch && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
          {/* Match header */}
          <div className="flex justify-between items-start mb-3 sm:mb-4">
            <div>
              <span className={`text-xs px-2 py-0.5 rounded ${t.tableBg} ${t.textMuted} mb-1 inline-block`}>3lb Beetleweight Demo</span>
              <div className={`text-xs ${t.textFaint} font-mono mt-1`}>{activeMatch.label}</div>
              <div className="mt-1">
                <StatusBadge status={activeMatch.status} winMethod={activeMatch.winMethod} scores={activeMatch.scores} t={t} />
              </div>
            </div>
            <div className="text-right">
              <span className={`text-xs ${t.textFaint}`}>Judges ({judgesCount}/3)</span>
              <div className="flex gap-1 justify-end mt-1">
                {[1, 2, 3].map((num) => {
                  const jId = `judge_${num}`;
                  const submitted = submittedJudges.includes(jId);
                  const isCurrent = currentJudge === jId;
                  return (
                    <div key={num}
                      className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        submitted ? "bg-green-500 text-white" :
                        isCurrent ? "bg-amber-100 text-amber-700 border-2 border-amber-400" :
                        `${t.tableBg} ${t.textMuted}`}`}
                      title={`Judge ${num}${submitted ? " (submitted)" : isCurrent ? " (you)" : ""}`}>
                      {submitted ? "✓" : num}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Start/End Match */}
          <div className="mt-3 mb-3">
            {isFighting ? (
              <button onClick={handleEnd}
                className="w-full py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white" />
                End Match (Stop Fighting)
              </button>
            ) : (
              <button onClick={handleStart}
                className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Start Match (Now Fighting)
              </button>
            )}
          </div>

          {/* Repair timer resets */}
          <div className={`mb-3 p-3 rounded-lg ${t.tableBg}`}>
            <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-2`}>Reset Repair Timer (20 min)</p>
            <div className="grid grid-cols-2 gap-2">
              {[activeMatch.p1, activeMatch.p2].map((robotId) => {
                const rs = getRepairStatus(robotId);
                return (
                  <button key={robotId} onClick={() => handleRepairReset(robotId)}
                    className={`py-2 px-3 rounded-lg border ${t.cardBorder} ${t.text} text-xs font-medium ${t.hoverBg} transition-colors flex items-center justify-center gap-1`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {rn(robotId)}
                    {!rs.ready && <span className="text-red-400 ml-1">({fmtRepair(rs.remaining)})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Waiting indicator */}
          {waitingOn.length > 0 && waitingOn.length < 3 && !hasSubmitted && (
            <div className={`mb-4 p-2 rounded-lg ${t.tableBg} flex items-center justify-center gap-2`}>
              <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />
              <span className={`text-xs sm:text-sm ${t.textMuted}`}>
                Waiting on {waitingOn.map((j) => `Judge ${j.split("_")[1]}`).join(", ")}
              </span>
            </div>
          )}

          {/* Robot avatars + live scores */}
          <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
            {[
              { id: activeMatch.p1, score: isKO ? "–" : totalA, colorClass: "bg-blue-100 text-blue-600" },
              null,
              { id: activeMatch.p2, score: isKO ? "–" : totalB, colorClass: "bg-red-100 text-red-600" },
            ].map((item, i) => {
              if (!item) return <div key="vs" className="text-center"><span className={`${t.textFaint} font-medium text-sm`}>vs</span></div>;
              return (
                <div key={i} className="text-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-lg overflow-hidden mb-1 sm:mb-2">
                    <div className={`w-full h-full flex items-center justify-center text-4xl font-bold ${item.colorClass}`}>
                      {rn(item.id)?.[0] ?? "?"}
                    </div>
                  </div>
                  <a href={getEloRobotUrl(rn(item.id))} target="_blank" rel="noopener noreferrer"
                    className={`font-semibold ${t.text} text-xs sm:text-sm hover:underline`}>
                    {rn(item.id)}
                  </a>
                  <p className={`text-xl sm:text-2xl font-bold ${i === 0 ? t.blueText : t.redText} mt-1`}>{item.score}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoring card */}
      {activeMatch && !hasSubmitted && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div>
              <h2 className={`text-base sm:text-lg font-bold ${t.text}`}>Judge as {currentJudge.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
              <p className={`text-xs sm:text-sm ${t.textMuted} mt-0.5`}>Scoring for {rn(activeMatch.p1)} (left) vs {rn(activeMatch.p2)} (right)</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isKO} onChange={(e) => { setIsKO(e.target.checked); setKoWinner(null); }}
                className="w-4 h-4 rounded accent-red-500" />
              <span className={`text-sm font-medium ${t.textMuted}`}>KO</span>
            </label>
          </div>

          {isKO ? (
            <div className="space-y-3 mb-6">
              <p className={`text-sm font-medium ${t.textMuted} text-center`}>Select KO winner:</p>
              <div className="grid grid-cols-2 gap-3">
                {[activeMatch.p1, activeMatch.p2].map((id, i) => (
                  <button key={id} onClick={() => setKoWinner(i === 0 ? "a" : "b")}
                    className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                      koWinner === (i === 0 ? "a" : "b")
                        ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700"
                        : `${t.cardBorder} ${t.text} ${t.hoverBg}`}`}>
                    {rn(id)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {SCORING_CRITERIA.map((c) => (
                <SplitSlider key={c.id} label={c.name} maxPoints={c.points}
                  valueA={scores[c.id] ?? 0}
                  onChange={(v) => setScores((prev) => ({ ...prev, [c.id]: v }))}
                  disabled={hasSubmitted} t={t} />
              ))}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isKO && !koWinner}
            className={`w-full py-3 sm:py-2.5 rounded-xl font-semibold text-sm transition-colors mt-2 ${
              isKO && !koWinner
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"}`}>
            Submit Score
          </button>
        </div>
      )}

      {hasSubmitted && !submitResult?.finalized && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
          <div className={`text-center py-4`}>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className={`font-bold ${t.text} mb-1`}>Score Submitted!</p>
            <p className={`text-sm ${t.textMuted}`}>Waiting for other judges…</p>
            <button onClick={handleEdit} className={`mt-3 text-xs ${t.textFaint} hover:${t.textMuted} underline`}>
              Edit my score
            </button>
          </div>
        </div>
      )}

      {/* Judge switcher (demo-only) */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3`}>
        <p className={`text-xs ${t.textFaint} uppercase tracking-wide mb-2`}>Demo: Switch Active Judge</p>
        <div className="flex gap-2">
          {["judge_1", "judge_2", "judge_3"].map((j) => (
            <button key={j} onClick={() => {
              dispatch({ type: "SET_JUDGE", judge: j });
              setHasSubmitted(activeMatch?.judgeData?.[j] != null);
              setSubmitResult(null);
              setScores(initScores()); setIsKO(false); setKoWinner(null);
            }}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                currentJudge === j
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : `${t.cardBorder} ${t.textMuted} ${t.hoverBg}`}`}>
              Judge {j.split("_")[1]}{activeMatch?.judgeData?.[j] ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case "SET_ACTIVE_MATCH":
      return { ...state, activeMatchId: action.id };

    case "SET_FIGHTING":
      return {
        ...state,
        fightingMatchId: action.matchId,
        matches: state.matches.map((m) =>
          m.id === action.matchId ? { ...m, status: "active" } : m
        ),
      };

    case "CLEAR_FIGHTING":
      return { ...state, fightingMatchId: null };

    case "RESET_REPAIR":
      return { ...state, repairResets: { ...state.repairResets, [action.robotId]: action.time } };

    case "SET_JUDGE":
      return { ...state, currentJudge: action.judge };

    case "SUBMIT_JUDGE_SCORE": {
      const newMatches = state.matches.map((m) => {
        if (m.id !== action.matchId) return m;
        const newJudgeData = { ...m.judgeData, [action.judgeId]: action.data };
        const judgeCount = Object.keys(newJudgeData).length;

        if (judgeCount >= 3 && !action.data.isKO) {
          // Finalize by summing all judge scores
          let totalA = 0, totalB = 0;
          Object.values(newJudgeData).forEach((jd) => {
            if (jd.scores) {
              const a = SCORING_CRITERIA.reduce((s, c) => s + (jd.scores[c.id] || 0), 0);
              totalA += a;
              totalB += TOTAL_MAX - a;
            }
          });
          return {
            ...m, judgeData: newJudgeData, status: "completed", winMethod: "decision",
            scores: { a: totalA, b: totalB },
            winner: totalA >= totalB ? m.p1 : m.p2,
            loser: totalA >= totalB ? m.p2 : m.p1,
            completedAt: new Date().toISOString(),
          };
        }

        if (judgeCount >= 3 && action.data.isKO) {
          const winner = action.data.koWinner === "a" ? m.p1 : m.p2;
          const loser = winner === m.p1 ? m.p2 : m.p1;
          return {
            ...m, judgeData: newJudgeData, status: "completed", winMethod: "ko",
            scores: { a: winner === m.p1 ? 11 : 0, b: winner === m.p2 ? 11 : 0 },
            winner, loser, completedAt: new Date().toISOString(),
          };
        }

        return { ...m, judgeData: newJudgeData };
      });
      return { ...state, matches: newMatches };
    }

    case "DELETE_JUDGE_SCORE": {
      const newMatches = state.matches.map((m) => {
        if (m.id !== action.matchId) return m;
        const newJudgeData = { ...m.judgeData };
        delete newJudgeData[action.judgeId];
        return { ...m, judgeData: newJudgeData };
      });
      return { ...state, matches: newMatches };
    }

    case "RESET":
      return buildInitialState();

    default:
      return state;
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SCARDemo() {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const [darkMode, setDarkMode] = useState(true);
  const [view, setView] = useState("bracket");
  const [selectedMatch, setSelectedMatch] = useState(null);

  const t = themes[darkMode ? "dark" : "light"];
  const { matches, fightingMatchId } = state;

  // Figure out "upcoming" matches (pending, both competitors known)
  const upcomingMatches = matches.filter(
    (m) => m.status !== "completed" && m.p1 && m.p2
  ).sort((a, b) => a.id - b.id);

  // Repair status display for header
  const fightingMatch = matches.find((m) => m.id === fightingMatchId);

  const handleMatchClick = (match) => setSelectedMatch(match);

  return (
    <div className={`min-h-screen ${t.bg} transition-colors`}>
      {/* ── Header (spectator-domain style) ── */}
      <header className={`${t.headerBg} border-b ${t.divider} sticky top-0 z-40`}>
        <div className="max-w-full mx-auto px-4">
          <div className={`text-center py-2 border-b ${t.divider}`}>
            <h1 className={`font-bold ${t.text} text-lg`}>SCAR 3lb Beetleweight — Demo Event</h1>
          </div>
          <div className="flex justify-between items-center h-10">
            <nav className="flex items-center gap-2">
              {[
                { id: "bracket",   label: "Bracket"   },
                { id: "upcoming",  label: "Upcoming"  },
                { id: "completed", label: "Completed" },
                { id: "judge",     label: "⚖ Judge"   },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setView(id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === id ? `${t.activeBg} ${t.text}` : t.textMuted
                  }`}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {fightingMatch && (
                <span className={`hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${t.liveBg} ${t.liveText} font-medium`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {rn(fightingMatch.p1)} vs {rn(fightingMatch.p2)}
                </span>
              )}
              <button onClick={() => dispatch({ type: "RESET" })}
                className={`text-xs px-2 py-1 rounded ${t.textFaint} ${t.hoverBg} transition-colors hidden sm:block`}
                title="Reset demo">
                ↺ Reset
              </button>
              <button onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-md ${t.textMuted} ${t.hoverBg} transition-colors`}>
                {darkMode
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Demo notice ── */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          🤖 Interactive Demo — Top 8 Beetleweights from{" "}
          <a href="https://elo.socalattackrobots.com/class/3lb" target="_blank" rel="noopener noreferrer"
            className="underline hover:text-amber-500">elo.socalattackrobots.com</a>
          {" "}· No login required · All state is simulated
        </p>
      </div>

      {/* ── Content ── */}
      <main className="max-w-full mx-auto px-4 py-4 sm:py-6">

        {/* Bracket */}
        {view === "bracket" && (
          <BracketView state={state} onMatchClick={handleMatchClick} t={t} />
        )}

        {/* Upcoming */}
        {view === "upcoming" && (
          <div className="space-y-4">
            {upcomingMatches.length === 0 ? (
              <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
                <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Upcoming Matches</h3>
                <p className={t.textMuted}>All pending matches are waiting for competitors.</p>
              </div>
            ) : (
              <div className={`${t.card} rounded-xl border ${t.cardBorder} overflow-hidden`}>
                <div className={`px-4 sm:px-5 py-3 border-b ${t.divider} ${t.tableBg}`}>
                  <h2 className={`font-bold ${t.text} text-sm sm:text-base`}>Upcoming Matches</h2>
                  <p className={`text-xs ${t.textMuted}`}>{upcomingMatches.length} matches queued</p>
                </div>
                <div className={`divide-y ${t.divider}`}>
                  {upcomingMatches.map((m) => {
                    const isFight = fightingMatchId === m.id;
                    return (
                      <div key={m.id} onClick={() => handleMatchClick(m)}
                        className={`px-4 sm:px-5 py-3 ${t.hoverBg} cursor-pointer transition-colors`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-mono ${t.textFaint}`}>M{m.id}</span>
                            <RobotAvatar name={rn(m.p1)} size="sm" />
                            <span className={`font-semibold ${t.text} text-sm`}>{rn(m.p1)}</span>
                            <span className={`text-xs ${t.textFaint}`}>vs</span>
                            <RobotAvatar name={rn(m.p2)} size="sm" />
                            <span className={`font-semibold ${t.text} text-sm`}>{rn(m.p2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isFight && <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.liveBg} ${t.liveText} animate-pulse`}>● Fighting</span>}
                            <StatusBadge status={m.status} winMethod={m.winMethod} scores={m.scores} t={t} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed */}
        {view === "completed" && (
          <CompletedView state={state} onMatchClick={handleMatchClick} t={t} />
        )}

        {/* Judge */}
        {view === "judge" && (
          <JudgeScoringView state={state} dispatch={dispatch} t={t} />
        )}
      </main>

      {/* ── Match Detail Popup ── */}
      {selectedMatch && (
        <MatchDetailPopup
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          t={t}
        />
      )}
    </div>
  );
}
