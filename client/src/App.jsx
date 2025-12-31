import React, { useState, useEffect, useCallback } from 'react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Local Storage Keys (for local preferences only)
const STORAGE_KEYS = {
  DARK_MODE: 'scar_dark_mode',
};

// Default scoring criteria
const DEFAULT_SCORING_CRITERIA = [
  { id: 'aggression', name: 'Aggression', points: 3 },
  { id: 'damage', name: 'Damage', points: 5 },
  { id: 'control', name: 'Control', points: 3 },
];

// Helper to get URL parameters
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Helper to update URL without reload
function setUrlParam(param, value) {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(param, value);
  } else {
    url.searchParams.delete(param);
  }
  window.history.replaceState({}, '', url);
}

// API Service
const api = {
  async getTournament(tournamentId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}`);
    if (!response.ok) throw new Error(`Failed to fetch tournament: ${tournamentId}`);
    return response.json();
  },

  async submitJudgeScores(matchId, scoreData) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData),
    });
    if (!response.ok) throw new Error('Failed to submit scores');
    return response.json();
  },

  async getMatchScores(matchId) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`);
    if (!response.ok) throw new Error('Failed to fetch scores');
    return response.json();
  },

  async deleteJudgeScore(matchId, judgeId) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores/${judgeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete score');
    return response.json();
  },

  // Event API
  async getEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch event');
    }
    return response.json();
  },

  async saveEvent(eventId, name, tournaments, scoringCriteria) {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, name, tournaments, scoringCriteria }),
    });
    if (!response.ok) throw new Error('Failed to save event');
    return response.json();
  },

  async deleteEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete event');
    return response.json();
  },
};

// Theme configurations
const themes = {
  light: {
    bg: 'bg-gray-100',
    card: 'bg-white',
    cardBorder: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    textFaint: 'text-gray-500',
    headerBg: 'bg-white',
    inputBg: 'bg-white',
    inputBorder: 'border-gray-300',
    hoverBg: 'hover:bg-gray-50',
    activeBg: 'bg-gray-100',
    tableBg: 'bg-gray-50',
    divider: 'border-gray-200',
    winnerBg: 'bg-green-50',
    winnerText: 'text-green-700',
    pendingBg: 'bg-gray-200',
    pendingText: 'text-gray-600',
    liveBg: 'bg-amber-100',
    liveText: 'text-amber-700',
    koBg: 'bg-red-100',
    koText: 'text-red-700',
    decisionBg: 'bg-green-100',
    decisionText: 'text-green-700',
    blueText: 'text-blue-600',
    redText: 'text-red-600',
    sliderBg: 'bg-gray-200',
    sliderFill: 'bg-blue-500',
    tickMark: 'bg-gray-300',
  },
  dark: {
    bg: 'bg-gray-900',
    card: 'bg-gray-800',
    cardBorder: 'border-gray-700',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textFaint: 'text-gray-500',
    headerBg: 'bg-gray-800',
    inputBg: 'bg-gray-700',
    inputBorder: 'border-gray-600',
    hoverBg: 'hover:bg-gray-700',
    activeBg: 'bg-gray-700',
    tableBg: 'bg-gray-700/50',
    divider: 'border-gray-700',
    winnerBg: 'bg-green-900/30',
    winnerText: 'text-green-400',
    pendingBg: 'bg-gray-700',
    pendingText: 'text-gray-400',
    liveBg: 'bg-amber-900/50',
    liveText: 'text-amber-400',
    koBg: 'bg-red-900/50',
    koText: 'text-red-400',
    decisionBg: 'bg-green-900/50',
    decisionText: 'text-green-400',
    blueText: 'text-blue-400',
    redText: 'text-red-400',
    sliderBg: 'bg-gray-700',
    sliderFill: 'bg-blue-400',
    tickMark: 'bg-gray-600',
  }
};

// Helper to transform Challonge data to our format
function transformChallongeData(challongeData, tournamentUrl) {
  const tournament = challongeData.tournament;
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];

  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.participant.id] = p.participant.name;
  });

  const matchIdToNumber = {};
  matches.forEach(m => {
    const match = m.match;
    matchIdToNumber[match.id] = match.suggested_play_order || match.id;
  });

  const transformedMatches = matches.map(m => {
    const match = m.match;
    const matchNum = match.suggested_play_order || match.id;
    
    const sourceA = match.player1_prereq_match_id ? {
      type: match.player1_is_prereq_match_loser ? 'loser' : 'winner',
      matchNum: matchIdToNumber[match.player1_prereq_match_id] || match.player1_prereq_match_id
    } : null;
    
    const sourceB = match.player2_prereq_match_id ? {
      type: match.player2_is_prereq_match_loser ? 'loser' : 'winner',
      matchNum: matchIdToNumber[match.player2_prereq_match_id] || match.player2_prereq_match_id
    } : null;

    return {
      id: match.id,
      challongeId: match.id,
      competitorA: participantMap[match.player1_id] || null,
      competitorAId: match.player1_id,
      competitorB: participantMap[match.player2_id] || null,
      competitorBId: match.player2_id,
      bracket: match.round > 0 ? 'winners' : 'losers',
      round: Math.abs(match.round),
      matchNum: matchNum,
      status: match.state === 'complete' ? 'completed' : match.state === 'open' ? 'active' : 'pending',
      winner: match.winner_id ? participantMap[match.winner_id] : null,
      winnerId: match.winner_id,
      winMethod: match.state === 'complete' ? 'points' : null,
      scores: match.scores_csv ? parseScores(match.scores_csv) : { a: 0, b: 0 },
      sourceA: sourceA,
      sourceB: sourceB,
      tournamentName: tournament.name,
      tournamentUrl: tournamentUrl || tournament.url,
      tournamentId: tournament.id,
    };
  });

  const maxMatchNum = Math.max(...transformedMatches.map(m => m.matchNum));
  const grandFinalsMatch = transformedMatches.find(m => 
    m.bracket === 'winners' && 
    m.round === Math.max(...transformedMatches.filter(x => x.bracket === 'winners').map(x => x.round))
  );
  
  const filteredMatches = transformedMatches.filter(m => {
    if (m.matchNum === maxMatchNum && !m.competitorA && !m.competitorB && grandFinalsMatch && m.matchNum > grandFinalsMatch.matchNum) {
      return false;
    }
    return true;
  });

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      url: tournamentUrl || tournament.url,
      status: tournament.state,
    },
    participants: participants.map(p => ({
      id: p.participant.id,
      name: p.participant.name,
      seed: p.participant.seed,
    })),
    matches: filteredMatches,
  };
}

function parseScores(scoresCsv) {
  if (!scoresCsv) return { a: 0, b: 0 };
  const parts = scoresCsv.split('-');
  return { a: parseInt(parts[0]) || 0, b: parseInt(parts[1]) || 0 };
}

// Status Badge Component
const StatusBadge = ({ status, winMethod, theme }) => {
  const t = themes[theme];
  
  if (status === 'pending') {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.pendingBg} ${t.pendingText}`}>Upcoming</span>;
  }
  if (status === 'active') {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.liveBg} ${t.liveText}`}>● Live</span>;
  }
  if (winMethod === 'ko') {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>;
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.decisionBg} ${t.decisionText}`}>Decision</span>;
};

// Match Detail Popup Component
const MatchDetailPopup = ({ match, onClose, theme }) => {
  const t = themes[theme];
  const [judgeScores, setJudgeScores] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchScores = async () => {
      if (!match) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const url = `${API_BASE_URL}/matches/${match.challongeId}/scores/details?tournamentId=${match.tournamentUrl || ''}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setJudgeScores(data);
        } else {
          setJudgeScores({ judges: {} });
        }
      } catch (err) {
        setError('Could not load judge scores');
        setJudgeScores({ judges: {} });
      } finally {
        setIsLoading(false);
      }
    };

    fetchScores();
  }, [match]);

  if (!match) return null;

  const judges = judgeScores?.judges ? Object.entries(judgeScores.judges) : [];
  const hasScores = judges.length > 0;

  const getJudgeTotals = (scores) => {
    if (!scores) return { a: 0, b: 0 };
    const totalA = (scores.aggression || 0) + (scores.damage || 0) + (scores.control || 0);
    const totalB = 11 - totalA;
    return { a: totalA, b: totalB };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-lg ${t.card} rounded-2xl border ${t.cardBorder} shadow-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.divider} flex justify-between items-center`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${t.tableBg} ${t.textMuted}`}>{match.tournamentName}</span>
            </div>
            <span className={`text-xs ${t.textFaint} font-mono`}>Match {match.matchNum}</span>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={match.status} winMethod={match.winMethod} theme={theme} />
              {match.winner && (
                <span className={`text-xs ${t.textMuted}`}>Winner: {match.winner}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg ${t.hoverBg} ${t.textMuted} transition-colors`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`px-5 py-4 border-b ${t.divider}`}>
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="text-center">
              <div className={`w-12 h-12 mx-auto rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center mb-2 ${match.winner === match.competitorA ? 'ring-2 ring-green-500' : ''}`}>
                <span className="text-lg font-bold text-blue-600">{match.competitorA?.[0] || '?'}</span>
              </div>
              <p className={`font-semibold ${t.text} text-sm`}>{match.competitorA || 'TBD'}</p>
              {match.status === 'completed' && (
                <p className={`text-xl font-bold ${t.blueText} mt-1`}>{match.scores?.a || 0}</p>
              )}
            </div>
            <div className="text-center">
              <span className={`${t.textFaint} font-medium`}>vs</span>
            </div>
            <div className="text-center">
              <div className={`w-12 h-12 mx-auto rounded-lg bg-red-100 border border-red-200 flex items-center justify-center mb-2 ${match.winner === match.competitorB ? 'ring-2 ring-green-500' : ''}`}>
                <span className="text-lg font-bold text-red-600">{match.competitorB?.[0] || '?'}</span>
              </div>
              <p className={`font-semibold ${t.text} text-sm`}>{match.competitorB || 'TBD'}</p>
              {match.status === 'completed' && (
                <p className={`text-xl font-bold ${t.redText} mt-1`}>{match.scores?.b || 0}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <h3 className={`text-sm font-semibold ${t.textFaint} uppercase tracking-wide mb-4`}>
            Judge Scores ({judges.length}/3)
          </h3>

          {isLoading ? (
            <div className="text-center py-8"><p className={t.textMuted}>Loading scores...</p></div>
          ) : error ? (
            <div className="text-center py-8"><p className="text-red-500">{error}</p></div>
          ) : !hasScores ? (
            <div className="text-center py-8"><p className={t.textMuted}>No judge scores submitted yet</p></div>
          ) : (
            <div className="space-y-4">
              {judges.map(([judgeId, judgeData], index) => {
                const totals = getJudgeTotals(judgeData.scores);
                return (
                  <div key={judgeId} className={`${t.tableBg} rounded-lg p-4`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`font-semibold ${t.text}`}>Judge {index + 1}</span>
                      {judgeData.isKO ? (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">
                          KO: {judgeData.koWinnerId === match.competitorAId ? match.competitorA : match.competitorB}
                        </span>
                      ) : (
                        <span className={`text-sm ${t.textMuted}`}>{totals.a} - {totals.b}</span>
                      )}
                    </div>
                    
                    {!judgeData.isKO && judgeData.scores && (
                      <div className="space-y-2">
                        {['aggression', 'damage', 'control'].map(cat => {
                          const max = cat === 'damage' ? 5 : 3;
                          const val = judgeData.scores[cat];
                          return (
                            <div key={cat} className="flex items-center justify-between text-sm">
                              <span className={`${t.textMuted} capitalize`}>{cat}</span>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono ${t.blueText}`}>{val}</span>
                                <div className={`w-16 h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
                                  <div className="h-full bg-blue-500" style={{ width: `${(val / max) * 100}%` }} />
                                </div>
                                <span className={`font-mono ${t.redText}`}>{max - val}</span>
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
          <button onClick={onClose} className={`w-full py-2 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to get placeholder text for undetermined competitors
const getCompetitorDisplay = (competitor, source) => {
  if (competitor) return { text: competitor, isPlaceholder: false };
  if (!source) return { text: 'TBD', isPlaceholder: true };
  
  const typeLabel = source.type === 'winner' ? 'Winner' : 'Loser';
  return { text: `${typeLabel} of Match ${source.matchNum}`, isPlaceholder: true };
};

// Split Point Slider Component - Mobile Optimized
const SplitSlider = ({ label, maxPoints, valueA, onChange, disabled, theme }) => {
  const t = themes[theme];
  const valueB = maxPoints - valueA;
  const percentage = (valueA / maxPoints) * 100;
  
  return (
    <div className="mb-6 sm:mb-5">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm font-medium ${t.textMuted}`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>{maxPoints} pts total</span>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 sm:w-12 text-center">
          <span className={`text-xl sm:text-2xl font-bold ${valueA > valueB ? t.blueText : t.textFaint}`}>{valueA}</span>
        </div>
        
        <div className="flex-1 relative py-2">
          <div className={`h-3 sm:h-2 ${t.sliderBg} rounded-full overflow-hidden`}>
            <div className={`h-full ${t.sliderFill} transition-all duration-150`} style={{ width: `${percentage}%` }} />
          </div>
          <input
            type="range" min={0} max={maxPoints} value={valueA}
            onChange={(e) => onChange(parseInt(e.target.value))}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            style={{ touchAction: 'none' }}
          />
          <div className="flex justify-between mt-2 px-0.5">
            {[...Array(maxPoints + 1)].map((_, i) => (
              <div key={i} className={`w-1 sm:w-0.5 h-2 sm:h-1.5 ${t.tickMark} rounded-full`} />
            ))}
          </div>
        </div>
        
        <div className="w-10 sm:w-12 text-center">
          <span className={`text-xl sm:text-2xl font-bold ${valueB > valueA ? t.redText : t.textFaint}`}>{valueB}</span>
        </div>
      </div>
    </div>
  );
};

// Match Card Component - Mobile Optimized
const MatchCard = ({ match, onClick, showTournament = false, theme }) => {
  const t = themes[theme];
  const isActive = match.status === 'active';
  
  const compA = getCompetitorDisplay(match.competitorA, match.sourceA);
  const compB = getCompetitorDisplay(match.competitorB, match.sourceB);
  
  return (
    <div 
      onClick={onClick}
      className={`
        ${t.card} rounded-lg border overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-md active:scale-[0.98]
        ${isActive ? 'border-amber-400 ring-2 ring-amber-200' : `${t.cardBorder} hover:border-gray-400`}
      `}
    >
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showTournament && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${t.tableBg} ${t.textFaint} truncate max-w-[100px] sm:max-w-[120px]`}>
                {match.tournamentName}
              </span>
            )}
            <span className={`text-xs ${t.textFaint} font-mono flex-shrink-0`}>M{match.matchNum}</span>
          </div>
          <StatusBadge status={match.status} winMethod={match.winMethod} theme={theme} />
        </div>
        
        <div className="space-y-1.5">
          <div className={`flex justify-between items-center p-2 rounded ${
            match.winner === match.competitorA && match.competitorA ? t.winnerBg : t.tableBg
          }`}>
            <span className={`text-sm truncate mr-2 ${
              compA.isPlaceholder ? `${t.textFaint} italic` 
                : match.winner === match.competitorA ? `font-semibold ${t.winnerText}` 
                : `font-semibold ${t.text}`
            }`}>
              {compA.text}
              {match.winner === match.competitorA && match.competitorA && ' ✓'}
            </span>
            {match.status === 'completed' && match.winMethod === 'points' && (
              <span className={`text-sm font-mono ${t.textMuted} flex-shrink-0`}>{match.scores?.a}</span>
            )}
          </div>
          
          <div className={`flex justify-between items-center p-2 rounded ${
            match.winner === match.competitorB && match.competitorB ? t.winnerBg : t.tableBg
          }`}>
            <span className={`text-sm truncate mr-2 ${
              compB.isPlaceholder ? `${t.textFaint} italic` 
                : match.winner === match.competitorB ? `font-semibold ${t.winnerText}` 
                : `font-semibold ${t.text}`
            }`}>
              {compB.text}
              {match.winner === match.competitorB && match.competitorB && ' ✓'}
            </span>
            {match.status === 'completed' && match.winMethod === 'points' && (
              <span className={`text-sm font-mono ${t.textMuted} flex-shrink-0`}>{match.scores?.b}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Public Bracket View - Mobile Optimized
const PublicBracketView = ({ tournaments, onMatchClick, theme }) => {
  const t = themes[theme];
  const [selectedTournamentIndex, setSelectedTournamentIndex] = useState(0);
  
  if (!tournaments || tournaments.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-6 sm:p-8 text-center`}>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Tournaments Connected</h3>
        <p className={t.textMuted}>Go to Admin → Tournaments to add tournament URLs</p>
      </div>
    );
  }

  const currentTournament = tournaments[selectedTournamentIndex];
  const matches = currentTournament?.matches || [];
  
  const winnersMatches = matches.filter(m => m.bracket === 'winners');
  const losersMatches = matches.filter(m => m.bracket === 'losers');
  
  const winnersRounds = [...new Set(winnersMatches.map(m => m.round))].sort((a, b) => a - b);
  const losersRounds = [...new Set(losersMatches.map(m => m.round))].sort((a, b) => a - b);
  
  const getRoundLabel = (round, totalRounds, isWinners) => {
    if (isWinners) {
      if (round === totalRounds) return 'Grand Finals';
      if (round === totalRounds - 1) return 'Winners Finals';
      if (round === totalRounds - 2) return 'Semifinals';
      return `Round ${round}`;
    } else {
      if (round === totalRounds) return 'Losers Finals';
      if (round === totalRounds - 1) return 'Losers Semis';
      return `Round ${round}`;
    }
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      {tournaments.length > 1 && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-2`}>
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
            {tournaments.map((tourney, index) => (
              <button
                key={tourney.tournament.id}
                onClick={() => setSelectedTournamentIndex(index)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                  selectedTournamentIndex === index 
                    ? 'bg-blue-600 text-white' 
                    : `${t.textMuted} ${t.hoverBg}`
                }`}
              >
                {tourney.tournament.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3 sm:p-5`}>
        <h2 className={`text-base sm:text-lg font-bold ${t.text} mb-3 sm:mb-4 flex items-center gap-2`}>
          <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></span>
          <span className="truncate">Winners Bracket</span>
          <span className={`text-xs sm:text-sm font-normal ${t.textMuted} truncate hidden sm:inline`}>- {currentTournament?.tournament.name}</span>
        </h2>
        <div className="flex gap-3 sm:gap-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          {winnersRounds.map(round => {
            const roundMatches = winnersMatches.filter(m => m.round === round);
            return (
              <div key={round} className="min-w-[220px] sm:min-w-[260px] flex flex-col flex-shrink-0">
                <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-2 sm:mb-3`}>
                  {getRoundLabel(round, winnersRounds.length, true)}
                </p>
                <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col justify-around">
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} onClick={() => onMatchClick(match)} theme={theme} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {losersMatches.length > 0 && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3 sm:p-5`}>
          <h2 className={`text-base sm:text-lg font-bold ${t.text} mb-3 sm:mb-4 flex items-center gap-2`}>
            <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></span>
            Losers Bracket
          </h2>
          <div className="flex gap-3 sm:gap-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            {losersRounds.map(round => {
              const roundMatches = losersMatches.filter(m => m.round === round);
              return (
                <div key={round} className="min-w-[220px] sm:min-w-[260px] flex flex-col flex-shrink-0">
                  <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-2 sm:mb-3`}>
                    {getRoundLabel(round, losersRounds.length, false)}
                  </p>
                  <div className="space-y-2 sm:space-y-3 flex-1 flex flex-col justify-around">
                    {roundMatches.map(match => (
                      <MatchCard key={match.id} match={match} onClick={() => onMatchClick(match)} theme={theme} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Completed Matches View
const CompletedMatchesView = ({ tournaments, onMatchClick, theme }) => {
  const t = themes[theme];
  
  // Get all completed matches from all tournaments
  const allCompletedMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => m.status === 'completed')
  );

  // Sort by most recent (highest match number first, assuming higher = more recent)
  const sortedMatches = [...allCompletedMatches].sort((a, b) => {
    // Sort by tournament first, then by match number descending
    if (a.tournamentName !== b.tournamentName) {
      return a.tournamentName.localeCompare(b.tournamentName);
    }
    return b.matchNum - a.matchNum;
  });

  if (sortedMatches.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-6 sm:p-8 text-center`}>
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

  // Group matches by tournament
  const matchesByTournament = sortedMatches.reduce((acc, match) => {
    if (!acc[match.tournamentName]) acc[match.tournamentName] = [];
    acc[match.tournamentName].push(match);
    return acc;
  }, {});

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Stats */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={`text-2xl sm:text-3xl font-bold ${t.text}`}>{sortedMatches.length}</p>
            <p className={`text-xs sm:text-sm ${t.textMuted}`}>Completed</p>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-bold ${t.blueText}`}>
              {sortedMatches.filter(m => m.winMethod === 'ko').length}
            </p>
            <p className={`text-xs sm:text-sm ${t.textMuted}`}>KOs</p>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-bold ${t.text}`}>
              {sortedMatches.filter(m => m.winMethod !== 'ko').length}
            </p>
            <p className={`text-xs sm:text-sm ${t.textMuted}`}>Decisions</p>
          </div>
        </div>
      </div>

      {/* Matches List by Tournament */}
      {Object.entries(matchesByTournament).map(([tournamentName, matches]) => (
        <div key={tournamentName} className={`${t.card} rounded-xl border ${t.cardBorder} overflow-hidden`}>
          <div className={`px-4 sm:px-5 py-3 border-b ${t.divider} ${t.tableBg}`}>
            <h2 className={`font-bold ${t.text} text-sm sm:text-base`}>{tournamentName}</h2>
            <p className={`text-xs ${t.textMuted}`}>{matches.length} completed match{matches.length !== 1 ? 'es' : ''}</p>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {matches.map(match => (
              <div 
                key={match.id}
                onClick={() => onMatchClick(match)}
                className={`px-4 sm:px-5 py-3 ${t.hoverBg} cursor-pointer transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`text-xs ${t.textFaint} font-mono flex-shrink-0`}>M{match.matchNum}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold ${match.winner === match.competitorA ? t.winnerText : t.text} text-sm truncate`}>
                          {match.competitorA}
                          {match.winner === match.competitorA && ' ✓'}
                        </span>
                        <span className={`text-xs ${t.textFaint}`}>vs</span>
                        <span className={`font-semibold ${match.winner === match.competitorB ? t.winnerText : t.text} text-sm truncate`}>
                          {match.competitorB}
                          {match.winner === match.competitorB && ' ✓'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {match.winMethod === 'ko' ? (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>
                    ) : (
                      <span className={`text-sm font-mono ${t.textMuted}`}>
                        {match.scores?.a}-{match.scores?.b}
                      </span>
                    )}
                    <svg className={`w-4 h-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Judge Scoring View
const JudgeScoringView = ({ tournaments, currentUser, onScoreSubmitted, scoringCriteria, theme }) => {
  const t = themes[theme];
  
  // Use provided criteria or default
  const criteria = scoringCriteria || DEFAULT_SCORING_CRITERIA;
  const totalMaxPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  
  const allScorableMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => 
      (m.status === 'active' || m.status === 'pending') && 
      m.competitorA && 
      m.competitorB &&
      m.status !== 'completed'
    )
  );

  const sortedMatches = [...allScorableMatches].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    if (a.tournamentName !== b.tournamentName) return a.tournamentName.localeCompare(b.tournamentName);
    return a.matchNum - b.matchNum;
  });

  const [selectedMatchKey, setSelectedMatchKey] = useState(() => {
    const activeMatch = sortedMatches.find(m => m.status === 'active');
    const firstMatch = activeMatch || sortedMatches[0];
    return firstMatch ? `${firstMatch.tournamentUrl}-${firstMatch.id}` : null;
  });
  
  const selectedMatch = selectedMatchKey 
    ? sortedMatches.find(m => `${m.tournamentUrl}-${m.id}` === selectedMatchKey) || sortedMatches[0]
    : sortedMatches[0];
  
  // Initialize scores based on criteria (start at middle value)
  const initializeScores = () => {
    const initialScores = {};
    criteria.forEach(c => {
      initialScores[c.id] = Math.floor(c.points / 2);
    });
    return initialScores;
  };
  
  const [scores, setScores] = useState(initializeScores);
  const [isKO, setIsKO] = useState(false);
  const [koWinner, setKoWinner] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Calculate totals dynamically
  const totalA = criteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);
  const totalB = totalMaxPoints - totalA;

  const handleMatchChange = (matchKey) => {
    setSelectedMatchKey(matchKey);
    setScores(initializeScores());
    setIsKO(false);
    setKoWinner(null);
    setHasSubmitted(false);
    setSubmitResult(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedMatch || !currentUser) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const scoreData = {
        judgeId: currentUser.id,
        tournamentId: selectedMatch.tournamentUrl,
        competitorAId: selectedMatch.competitorAId,
        competitorBId: selectedMatch.competitorBId,
        scores: isKO ? null : scores,
        isKO: isKO,
        koWinnerId: isKO ? (koWinner === 'a' ? selectedMatch.competitorAId : selectedMatch.competitorBId) : null,
      };

      const result = await api.submitJudgeScores(selectedMatch.challongeId, scoreData);
      setSubmitResult(result);
      setHasSubmitted(true);

      if (result.finalized) {
        onScoreSubmitted && onScoreSubmitted(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedMatch || !currentUser) return;

    try {
      await api.deleteJudgeScore(selectedMatch.challongeId, currentUser.id);
      setHasSubmitted(false);
      setSubmitResult(null);
    } catch (err) {
      setError(err.message);
    }
  };
  
  if (sortedMatches.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <div className={`w-16 h-16 mx-auto rounded-full ${t.tableBg} flex items-center justify-center mb-4`}>
          <svg className={`w-8 h-8 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Matches Available</h3>
        <p className={t.textMuted}>No matches are ready for scoring across any tournament.</p>
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>Select a Match</h3>
        <p className={t.textMuted}>Choose a match from the dropdown to begin scoring.</p>
      </div>
    );
  }
  
  const matchesByTournament = sortedMatches.reduce((acc, match) => {
    if (!acc[match.tournamentName]) acc[match.tournamentName] = [];
    acc[match.tournamentName].push(match);
    return acc;
  }, {});

  return (
    <div className="max-w-xl mx-auto space-y-3 sm:space-y-4">
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-3 sm:p-4`}>
        <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>
          Select Match to Score ({sortedMatches.length} available)
        </label>
        <select
          value={selectedMatchKey || ''}
          onChange={(e) => handleMatchChange(e.target.value)}
          className={`w-full px-3 py-3 sm:py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm`}
        >
          {Object.entries(matchesByTournament).map(([tournamentName, matches]) => (
            <optgroup key={tournamentName} label={tournamentName}>
              {matches.map(match => (
                <option key={`${match.tournamentUrl}-${match.id}`} value={`${match.tournamentUrl}-${match.id}`}>
                  {match.status === 'active' ? '🔴 ' : ''}
                  M{match.matchNum}: {match.competitorA} vs {match.competitorB}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700 font-semibold">Error: {error}</p>
        </div>
      )}

      {submitResult?.finalized && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-700 font-semibold">🏆 Match Complete!</p>
          <p className={`text-sm ${t.textMuted} mt-1`}>
            Winner: {submitResult.result.winMethod === 'ko' ? 'KO' : `${submitResult.result.scoreA}-${submitResult.result.scoreB}`}
          </p>
          <p className={`text-xs ${t.textFaint} mt-2`}>Result submitted to Challonge</p>
        </div>
      )}

      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div>
            <span className={`text-xs px-2 py-0.5 rounded ${t.tableBg} ${t.textMuted} mb-1 inline-block`}>
              {selectedMatch.tournamentName}
            </span>
            <div className={`text-xs ${t.textFaint} font-mono mt-1`}>Match {selectedMatch.matchNum}</div>
            <div className="mt-1">
              <StatusBadge status={selectedMatch.status} theme={theme} />
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs ${t.textFaint}`}>Judges</span>
            <div className="flex gap-1 justify-end mt-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full ${
                  submitResult ? (i < submitResult.judgeCount ? 'bg-green-500' : t.tickMark) : t.tickMark
                }`} />
              ))}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center mb-1 sm:mb-2">
              <span className="text-lg sm:text-xl font-bold text-blue-600">{selectedMatch.competitorA?.[0] || '?'}</span>
            </div>
            <p className={`font-semibold ${t.text} text-xs sm:text-sm truncate px-1`}>{selectedMatch.competitorA || 'TBD'}</p>
            <p className={`text-xl sm:text-2xl font-bold ${t.blueText} mt-1`}>{isKO ? '—' : totalA}</p>
          </div>
          <div className="text-center">
            <span className={`${t.textFaint} font-medium text-sm`}>vs</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-lg bg-red-100 border border-red-200 flex items-center justify-center mb-1 sm:mb-2">
              <span className="text-lg sm:text-xl font-bold text-red-600">{selectedMatch.competitorB?.[0] || '?'}</span>
            </div>
            <p className={`font-semibold ${t.text} text-xs sm:text-sm truncate px-1`}>{selectedMatch.competitorB || 'TBD'}</p>
            <p className={`text-xl sm:text-2xl font-bold ${t.redText} mt-1`}>{isKO ? '—' : totalB}</p>
          </div>
        </div>
      </div>
      
      {!isKO && !submitResult?.finalized && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4 sm:p-5`}>
          <h3 className={`text-sm font-semibold ${t.textFaint} uppercase tracking-wide mb-4`}>Split Points</h3>
          
          {criteria.map(criterion => (
            <SplitSlider 
              key={criterion.id}
              label={criterion.name} 
              maxPoints={criterion.points} 
              valueA={scores[criterion.id] || 0}
              onChange={(val) => setScores(s => ({ ...s, [criterion.id]: val }))} 
              disabled={hasSubmitted} 
              theme={theme} 
            />
          ))}
          
          <div className={`flex justify-between items-center pt-4 mt-4 border-t ${t.divider}`}>
            <div className="text-center">
              <p className={`text-xs ${t.textFaint} mb-1`}>Total</p>
              <p className={`text-2xl sm:text-3xl font-bold ${t.blueText}`}>{totalA}</p>
            </div>
            <div className={`text-xs ${t.textFaint}`}>of {totalMaxPoints}</div>
            <div className="text-center">
              <p className={`text-xs ${t.textFaint} mb-1`}>Total</p>
              <p className={`text-2xl sm:text-3xl font-bold ${t.redText}`}>{totalB}</p>
            </div>
          </div>
        </div>
      )}
      
      {!submitResult?.finalized && (
        <div className={`rounded-xl border p-4 sm:p-5 transition-colors ${
          isKO ? 'bg-red-50 border-red-300' : `${t.card} ${t.cardBorder}`
        }`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isKO}
              onChange={(e) => { setIsKO(e.target.checked); if (!e.target.checked) setKoWinner(null); }}
              disabled={hasSubmitted}
              className="w-6 h-6 sm:w-5 sm:h-5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span className={`font-semibold ${isKO ? 'text-red-700' : t.text}`}>Declare Knockout (KO)</span>
          </label>
          
          {isKO && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setKoWinner('a')} disabled={hasSubmitted}
                className={`p-3 sm:p-3 rounded-lg border-2 font-semibold transition-all text-sm sm:text-base ${
                  koWinner === 'a' ? 'bg-blue-50 border-blue-500 text-blue-700' : `${t.card} ${t.cardBorder} ${t.text}`
                }`}>
                {selectedMatch.competitorA}
              </button>
              <button onClick={() => setKoWinner('b')} disabled={hasSubmitted}
                className={`p-3 rounded-lg border-2 font-semibold transition-all text-sm sm:text-base ${
                  koWinner === 'b' ? 'bg-red-50 border-red-500 text-red-700' : `${t.card} ${t.cardBorder} ${t.text}`
                }`}>
                {selectedMatch.competitorB}
              </button>
            </div>
          )}
        </div>
      )}
      
      {!submitResult?.finalized && (
        hasSubmitted ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-semibold">✓ Scores Submitted</p>
              <p className={`text-sm ${t.textFaint} mt-1`}>
                Waiting for {3 - (submitResult?.judgeCount || 1)} more judge(s)...
              </p>
            </div>
            <button onClick={handleEdit}
              className={`w-full py-4 sm:py-3 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors active:scale-[0.98]`}>
              Edit My Scores
            </button>
          </div>
        ) : (
          <button onClick={handleSubmit} disabled={(isKO && !koWinner) || isSubmitting}
            className="w-full py-4 sm:py-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
            {isSubmitting ? 'Submitting...' : 'Submit Scores'}
          </button>
        )
      )}
    </div>
  );
};

// Admin Dashboard View
const AdminDashboardView = ({ eventId, eventName, tournamentUrls, tournaments, scoringCriteria, onEventIdChange, onEventNameChange, onAddTournament, onRemoveTournament, onRefreshAll, onSaveToServer, onCopyLink, onScoringCriteriaChange, theme }) => {
  const t = themes[theme];
  const [selectedTab, setSelectedTab] = useState('settings');
  const [newTournamentUrl, setNewTournamentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [localEventId, setLocalEventId] = useState(eventId);
  const [localEventName, setLocalEventName] = useState(eventName);
  const [localCriteria, setLocalCriteria] = useState(scoringCriteria);
  
  useEffect(() => {
    setLocalEventId(eventId);
    setLocalEventName(eventName);
    setLocalCriteria(scoringCriteria);
  }, [eventId, eventName, scoringCriteria]);

  const updateCriterion = (index, field, value) => {
    const updated = [...localCriteria];
    if (field === 'points') {
      const numValue = parseInt(value) || 0;
      updated[index] = { ...updated[index], [field]: Math.max(1, Math.min(10, numValue)) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setLocalCriteria(updated);
  };

  const addCriterion = () => {
    if (localCriteria.length >= 6) return; // Max 6 criteria
    const newId = `criterion_${Date.now()}`;
    setLocalCriteria([...localCriteria, { id: newId, name: 'New Category', points: 3 }]);
  };

  const removeCriterion = (index) => {
    if (localCriteria.length <= 1) return; // Min 1 criterion
    setLocalCriteria(localCriteria.filter((_, i) => i !== index));
  };

  const totalPoints = localCriteria.reduce((sum, c) => sum + c.points, 0);

  const handleAddTournament = async () => {
    if (!newTournamentUrl.trim()) return;
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      await onAddTournament(newTournamentUrl.trim());
      setNewTournamentUrl('');
      setSyncStatus({ success: true, message: 'Tournament added successfully!' });
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      await onRefreshAll();
      setSyncStatus({ success: true, message: 'All tournaments refreshed!' });
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!localEventId.trim()) {
      setSyncStatus({ success: false, message: 'Event ID is required' });
      return;
    }
    
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      onEventIdChange(localEventId.trim());
      onEventNameChange(localEventName.trim());
      onScoringCriteriaChange(localCriteria);
      await onSaveToServer(localEventId.trim(), localEventName.trim());
      setSyncStatus({ success: true, message: 'Event saved! Share the link with judges.' });
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    onCopyLink();
    setSyncStatus({ success: true, message: 'Link copied to clipboard!' });
  };

  const shareableLink = localEventId ? `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(localEventId)}` : '';
  
  return (
    <div className="space-y-4">
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-1 inline-flex gap-1`}>
        {['settings', 'tournaments', 'share'].map(tab => (
          <button key={tab} onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              selectedTab === tab ? 'bg-gray-900 text-white' : `${t.textMuted} hover:${t.text}`
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {syncStatus && (
        <div className={`p-4 rounded-lg ${syncStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={syncStatus.success ? 'text-green-700' : 'text-red-700'}>{syncStatus.message}</p>
        </div>
      )}
      
      {selectedTab === 'settings' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <h3 className={`font-bold ${t.text}`}>Event Configuration</h3>
          
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Event ID (for URL)</label>
            <input 
              type="text" 
              value={localEventId}
              onChange={(e) => setLocalEventId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
              placeholder="e.g., TexasCup25"
              className={`w-full px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`} 
            />
            <p className={`text-xs ${t.textFaint} mt-1`}>
              Letters, numbers, dashes, and underscores only. This will be used in the shareable URL.
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Event Display Name</label>
            <input 
              type="text" 
              value={localEventName}
              onChange={(e) => setLocalEventName(e.target.value)}
              placeholder="e.g., Texas Cup 2025"
              className={`w-full px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`} 
            />
            <p className={`text-xs ${t.textFaint} mt-1`}>
              This name will display in the header for everyone
            </p>
          </div>
          
          <div className={`pt-4 border-t ${t.divider}`}>
            <div className="flex justify-between items-center mb-3">
              <p className={`text-sm font-medium ${t.textMuted}`}>Scoring Criteria</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${t.textFaint}`}>Total: {totalPoints} pts</span>
                {localCriteria.length < 6 && (
                  <button
                    onClick={addCriterion}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {localCriteria.map((criterion, index) => (
                <div key={criterion.id} className={`${t.tableBg} rounded-lg p-3 flex items-center gap-3`}>
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                    placeholder="Category name"
                    className={`flex-1 px-2 py-1 rounded border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm`}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={criterion.points}
                      onChange={(e) => updateCriterion(index, 'points', e.target.value)}
                      className={`w-14 px-2 py-1 rounded border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm text-center`}
                    />
                    <span className={`text-xs ${t.textFaint}`}>pts</span>
                  </div>
                  {localCriteria.length > 1 && (
                    <button
                      onClick={() => removeCriterion(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove category"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className={`text-xs ${t.textFaint} mt-2`}>
              Points are split between competitors for each category. Save the event to apply changes.
            </p>
          </div>
        </div>
      )}

      {selectedTab === 'tournaments' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <div className="flex justify-between items-center">
            <h3 className={`font-bold ${t.text}`}>Tournament URLs ({tournamentUrls.length})</h3>
            {tournamentUrls.length > 0 && (
              <button 
                onClick={handleRefreshAll}
                disabled={isLoading}
                className={`px-3 py-1.5 text-sm font-semibold ${t.textMuted} ${t.hoverBg} rounded-lg transition-colors disabled:opacity-50`}
              >
                {isLoading ? 'Refreshing...' : '↻ Refresh All'}
              </button>
            )}
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Add Tournament</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newTournamentUrl}
                onChange={(e) => setNewTournamentUrl(e.target.value)}
                placeholder="e.g., TexasCup25-1lb-antweight"
                className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`} 
              />
              <button 
                onClick={handleAddTournament}
                disabled={isLoading || !newTournamentUrl.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
            <p className={`text-xs ${t.textFaint} mt-1`}>
              Enter the tournament URL slug from challonge.com/YOUR_URL_HERE
            </p>
          </div>

          {tournamentUrls.length > 0 ? (
            <div className="space-y-2">
              {tournamentUrls.map((url) => {
                const tourneyData = tournaments.find(t => t.tournament.url === url);
                return (
                  <div key={url} className={`${t.tableBg} rounded-lg p-4 flex justify-between items-center`}>
                    <div>
                      <p className={`font-semibold ${t.text}`}>
                        {tourneyData?.tournament.name || url}
                      </p>
                      <p className={`text-xs ${t.textFaint}`}>{url}</p>
                      {tourneyData && (
                        <p className={`text-xs ${t.textMuted} mt-1`}>
                          Status: {tourneyData.tournament.status} • {tourneyData.matches?.length || 0} matches
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => onRemoveTournament(url)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove tournament"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${t.tableBg} rounded-lg p-8 text-center`}>
              <p className={t.textMuted}>No tournaments added yet</p>
              <p className={`text-xs ${t.textFaint} mt-1`}>Add tournament URLs above to get started</p>
            </div>
          )}
        </div>
      )}
      
      {selectedTab === 'share' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <h3 className={`font-bold ${t.text}`}>Share Event</h3>
          
          <div className={`${t.tableBg} rounded-lg p-4`}>
            <p className={`text-sm ${t.textMuted} mb-2`}>
              Save your event configuration to the server, then share the appropriate link.
            </p>
          </div>

          <button 
            onClick={handleSaveEvent}
            disabled={isLoading || !localEventId.trim() || tournamentUrls.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : '💾 Save Event to Server'}
          </button>

          {localEventId && (
            <>
              {/* Judge Link */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${t.textMuted}`}>🎯 Judge Link</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={shareableLink}
                    readOnly
                    className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm`}
                  />
                  <button 
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className={`text-xs ${t.textFaint}`}>
                  For judges - shows Bracket, Completed, and Judge tabs
                </p>
              </div>

              {/* Spectator Link */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${t.textMuted}`}>👀 Spectator Link</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={`${shareableLink}&spectator=true`}
                    readOnly
                    className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm`}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${shareableLink}&spectator=true`);
                      setSyncStatus({ success: true, message: 'Spectator link copied!' });
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className={`text-xs ${t.textFaint}`}>
                  For competitors & audience - shows Bracket and Completed only (no Judge tab)
                </p>
              </div>
            </>
          )}

          <div className={`pt-4 border-t ${t.divider}`}>
            <p className={`text-sm font-medium ${t.textMuted} mb-2`}>Current Configuration</p>
            <div className={`${t.tableBg} rounded-lg p-3 text-sm`}>
              <p className={t.text}><strong>Event ID:</strong> {localEventId || '(not set)'}</p>
              <p className={t.text}><strong>Event Name:</strong> {localEventName || '(not set)'}</p>
              <p className={t.text}><strong>Tournaments:</strong> {tournamentUrls.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component
export default function TournamentJudgingApp() {
  const [view, setView] = useState('public');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [eventId, setEventId] = useState('');
  const [eventName, setEventName] = useState('');
  const [tournamentUrls, setTournamentUrls] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [scoringCriteria, setScoringCriteria] = useState(DEFAULT_SCORING_CRITERIA);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventLoaded, setEventLoaded] = useState(false);
  
  // Check if viewing via shared link (hides admin)
  const isSharedView = Boolean(getUrlParam('event'));
  // Check if spectator mode (hides judge tab too)
  const isSpectatorView = getUrlParam('spectator') === 'true' || getUrlParam('view') === 'spectator';
  
  const theme = darkMode ? 'dark' : 'light';
  const t = themes[theme];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const loadEventFromUrl = async () => {
      const urlEventId = getUrlParam('event');
      if (urlEventId && !eventLoaded) {
        setIsLoading(true);
        try {
          const eventData = await api.getEvent(urlEventId);
          if (eventData) {
            setEventId(eventData.eventId);
            setEventName(eventData.name || eventData.eventId);
            setTournamentUrls(eventData.tournaments || []);
            setScoringCriteria(eventData.scoringCriteria || DEFAULT_SCORING_CRITERIA);
            setEventLoaded(true);
          }
        } catch (err) {
          console.error('Failed to load event from URL:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadEventFromUrl();
  }, [eventLoaded]);

  const loadAllTournaments = useCallback(async () => {
    if (tournamentUrls.length === 0) {
      setTournaments([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        tournamentUrls.map(async (url) => {
          try {
            const data = await api.getTournament(url);
            return transformChallongeData(data, url);
          } catch (err) {
            console.error(`Failed to load tournament ${url}:`, err);
            return null;
          }
        })
      );

      setTournaments(results.filter(Boolean));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentUrls]);

  useEffect(() => {
    if (tournamentUrls.length > 0) {
      loadAllTournaments();
    }
  }, [tournamentUrls, loadAllTournaments]);

  const addTournament = async (url) => {
    if (tournamentUrls.includes(url)) {
      throw new Error('Tournament already added');
    }

    const data = await api.getTournament(url);
    const transformed = transformChallongeData(data, url);

    setTournamentUrls(prev => [...prev, url]);
    setTournaments(prev => [...prev, transformed]);
  };

  const removeTournament = (url) => {
    setTournamentUrls(prev => prev.filter(u => u !== url));
    setTournaments(prev => prev.filter(t => t.tournament.url !== url));
  };

  const saveToServer = async (id, name) => {
    await api.saveEvent(id, name, tournamentUrls, scoringCriteria);
    setUrlParam('event', id);
  };

  const copyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(eventId)}`;
    navigator.clipboard.writeText(link);
  };

  const handleScoreSubmitted = useCallback((result) => {
    setTimeout(() => loadAllTournaments(), 1000);
  }, [loadAllTournaments]);

  const availableJudges = [
    { id: 'judge_1', name: 'Judge 1' },
    { id: 'judge_2', name: 'Judge 2' },
    { id: 'judge_3', name: 'Judge 3' },
  ];
  
  const handleLogin = (role, judgeData = null) => {
    if (role === 'judge' && !judgeData) {
      setShowJudgeSelect(true);
      return;
    }
    
    if (role === 'judge' && judgeData) {
      setCurrentUser({ id: judgeData.id, role: 'judge', name: judgeData.name });
      setShowJudgeSelect(false);
      setView('judge');
      return;
    }
    
    setCurrentUser({ id: `admin_${Date.now()}`, role: 'admin', name: 'Admin User' });
    setView('admin');
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setView('public');
    setShowJudgeSelect(false);
  };
  
  return (
    <div className={`min-h-screen ${t.bg} transition-colors`}>
      <header className={`${t.headerBg} border-b ${t.divider} sticky top-0 z-40`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2 sm:gap-4">
              <a href="#" className={`font-bold ${t.text} text-base sm:text-lg`}>SCAR Judge Portal</a>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1">
              <button onClick={() => { setView('public'); setCurrentUser(null); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'public' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Bracket
              </button>
              <button onClick={() => setView('completed')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'completed' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Completed
              </button>
              {!isSpectatorView && (
                <button onClick={() => handleLogin('judge')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'judge' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Judge
                </button>
              )}
              {!isSharedView && (
                <button onClick={() => handleLogin('admin')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'admin' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Admin
                </button>
              )}
            </nav>

            {/* Mobile Navigation */}
            <nav className="flex sm:hidden items-center gap-1">
              <button onClick={() => { setView('public'); setCurrentUser(null); }}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'public' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Bracket
              </button>
              <button onClick={() => setView('completed')}
                className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  view === 'completed' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Done
              </button>
              {!isSpectatorView && (
                <button onClick={() => handleLogin('judge')}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'judge' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Judge
                </button>
              )}
              {!isSharedView && (
                <button onClick={() => handleLogin('admin')}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'admin' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Admin
                </button>
              )}
            </nav>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {currentUser && (
                <div className={`hidden sm:flex items-center gap-3 pr-3 border-r ${t.divider}`}>
                  <span className={`text-sm ${t.textMuted}`}>{currentUser.name}</span>
                  <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-400 font-medium">
                    Logout
                  </button>
                </div>
              )}
              {currentUser && (
                <button onClick={handleLogout} className="sm:hidden text-xs text-red-500 font-medium px-2 py-1">
                  Logout
                </button>
              )}
              
              <button onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-md ${t.textMuted} ${t.hoverBg} transition-colors`}
                title="Toggle dark mode">
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Event Info Bar - Mobile Responsive */}
      <div className={`${t.headerBg} border-b ${t.divider}`}>
        <div className="max-w-6xl mx-auto px-4 py-2 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {tournaments.length > 0 ? (
              <>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  {tournaments.length} Tournament{tournaments.length !== 1 ? 's' : ''}
                </span>
                <h1 className={`text-base sm:text-lg font-bold ${t.text}`}>
                  {eventName || 'SCAR Event'}
                </h1>
                <span className="hidden sm:inline px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                  Connected
                </span>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  No Tournaments
                </span>
                <h1 className={`text-base sm:text-lg font-bold ${t.text}`}>SCAR Judge Portal</h1>
                <span className={`hidden sm:inline text-sm ${t.textMuted}`}>Add tournaments in Admin</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {isLoading && (
          <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
            <p className={t.text}>Loading tournament data...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!isLoading && view === 'public' && (
          <PublicBracketView 
            tournaments={tournaments} 
            onMatchClick={setSelectedMatch} 
            theme={theme} 
          />
        )}

        {!isLoading && view === 'completed' && (
          <CompletedMatchesView 
            tournaments={tournaments} 
            onMatchClick={setSelectedMatch} 
            theme={theme} 
          />
        )}
        
        {!isLoading && view === 'judge' && (
          <JudgeScoringView 
            tournaments={tournaments}
            currentUser={currentUser}
            onScoreSubmitted={handleScoreSubmitted}
            scoringCriteria={scoringCriteria}
            theme={theme} 
          />
        )}
        
        {!isLoading && view === 'admin' && (
          <AdminDashboardView 
            eventId={eventId}
            eventName={eventName}
            tournamentUrls={tournamentUrls}
            tournaments={tournaments}
            scoringCriteria={scoringCriteria}
            onEventIdChange={setEventId}
            onEventNameChange={setEventName}
            onAddTournament={addTournament}
            onRemoveTournament={removeTournament}
            onRefreshAll={loadAllTournaments}
            onSaveToServer={saveToServer}
            onCopyLink={copyLink}
            onScoringCriteriaChange={setScoringCriteria}
            theme={theme} 
          />
        )}
      </main>
      
      <footer className={`border-t ${t.divider} ${t.headerBg} mt-auto`}>
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className={`flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 text-xs sm:text-sm ${t.textFaint}`}>
            <div>Built for <a href="https://www.socalattackrobots.com/" className={t.blueText}>SCAR</a></div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span>{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Shareable via URL</span>
            </div>
          </div>
        </div>
      </footer>

      {selectedMatch && (
        <MatchDetailPopup 
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)} 
          theme={theme} 
        />
      )}

      {showJudgeSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowJudgeSelect(false)} />
          <div className={`relative w-full max-w-sm ${t.card} rounded-2xl border ${t.cardBorder} shadow-2xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${t.divider}`}>
              <h2 className={`text-lg font-bold ${t.text}`}>Select Your Judge Position</h2>
              <p className={`text-sm ${t.textMuted} mt-1`}>Choose which judge you are</p>
            </div>
            <div className="p-5 space-y-3">
              {availableJudges.map(judge => (
                <button
                  key={judge.id}
                  onClick={() => handleLogin('judge', judge)}
                  className={`w-full p-4 rounded-xl border-2 ${t.cardBorder} ${t.hoverBg} transition-all text-left flex items-center gap-4`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-600">{judge.name.split(' ')[1]}</span>
                  </div>
                  <div>
                    <p className={`font-semibold ${t.text}`}>{judge.name}</p>
                    <p className={`text-sm ${t.textMuted}`}>Click to login</p>
                  </div>
                </button>
              ))}
            </div>
            <div className={`px-5 py-3 border-t ${t.divider} ${t.tableBg}`}>
              <button
                onClick={() => setShowJudgeSelect(false)}
                className={`w-full py-2 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
