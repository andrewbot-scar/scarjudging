import React, { useState, useEffect, useCallback } from 'react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// API Service
const api = {
  async getTournament(tournamentId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}`);
    if (!response.ok) throw new Error('Failed to fetch tournament');
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
function transformChallongeData(challongeData) {
  const tournament = challongeData.tournament;
  const participants = tournament.participants || [];
  const matches = tournament.matches || [];

  // Create participant lookup
  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.participant.id] = p.participant.name;
  });

  // Create a mapping from Challonge match ID to suggested_play_order (match number)
  const matchIdToNumber = {};
  matches.forEach(m => {
    const match = m.match;
    matchIdToNumber[match.id] = match.suggested_play_order || match.id;
  });

  // Transform matches
  const transformedMatches = matches.map(m => {
    const match = m.match;
    const matchNum = match.suggested_play_order || match.id;
    
    // Convert prereq match IDs to match numbers
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
    };
  });

  // Filter out bracket reset matches (matches with no players that come after Grand Finals)
  // In double elimination, the bracket reset only happens if the losers bracket winner beats the winners bracket winner
  const maxMatchNum = Math.max(...transformedMatches.map(m => m.matchNum));
  const grandFinalsMatch = transformedMatches.find(m => 
    m.bracket === 'winners' && 
    m.round === Math.max(...transformedMatches.filter(x => x.bracket === 'winners').map(x => x.round))
  );
  
  // Filter out potential bracket reset match (highest match number with no competitors assigned)
  const filteredMatches = transformedMatches.filter(m => {
    // If this is the highest numbered match, has no competitors, and comes after grand finals, hide it
    if (m.matchNum === maxMatchNum && !m.competitorA && !m.competitorB && grandFinalsMatch && m.matchNum > grandFinalsMatch.matchNum) {
      return false;
    }
    return true;
  });

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      url: tournament.url,
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
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/matches/${match.challongeId}/scores/details`);
        if (response.ok) {
          const data = await response.json();
          setJudgeScores(data);
        } else {
          // No scores yet or endpoint doesn't exist
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

  // Calculate totals for each judge
  const getJudgeTotals = (scores) => {
    if (!scores) return { a: 0, b: 0 };
    const totalA = (scores.aggression || 0) + (scores.damage || 0) + (scores.control || 0);
    const totalB = 11 - totalA;
    return { a: totalA, b: totalB };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative w-full max-w-lg ${t.card} rounded-2xl border ${t.cardBorder} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b ${t.divider} flex justify-between items-center`}>
          <div>
            <span className={`text-xs ${t.textFaint} font-mono`}>Match {match.matchNum}</span>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={match.status} winMethod={match.winMethod} theme={theme} />
              {match.winner && (
                <span className={`text-xs ${t.textMuted}`}>Winner: {match.winner}</span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-lg ${t.hoverBg} ${t.textMuted} transition-colors`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Competitors */}
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

        {/* Judge Scores */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <h3 className={`text-sm font-semibold ${t.textFaint} uppercase tracking-wide mb-4`}>
            Judge Scores ({judges.length}/3)
          </h3>

          {isLoading ? (
            <div className="text-center py-8">
              <p className={t.textMuted}>Loading scores...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          ) : !hasScores ? (
            <div className="text-center py-8">
              <p className={t.textMuted}>No judge scores submitted yet</p>
            </div>
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
                        <span className={`text-sm ${t.textMuted}`}>
                          {totals.a} - {totals.b}
                        </span>
                      )}
                    </div>
                    
                    {!judgeData.isKO && judgeData.scores && (
                      <div className="space-y-2">
                        {/* Aggression */}
                        <div className="flex items-center justify-between text-sm">
                          <span className={t.textMuted}>Aggression</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono ${t.blueText}`}>{judgeData.scores.aggression}</span>
                            <div className={`w-16 h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
                              <div 
                                className="h-full bg-blue-500" 
                                style={{ width: `${(judgeData.scores.aggression / 3) * 100}%` }}
                              />
                            </div>
                            <span className={`font-mono ${t.redText}`}>{3 - judgeData.scores.aggression}</span>
                          </div>
                        </div>
                        
                        {/* Damage */}
                        <div className="flex items-center justify-between text-sm">
                          <span className={t.textMuted}>Damage</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono ${t.blueText}`}>{judgeData.scores.damage}</span>
                            <div className={`w-16 h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
                              <div 
                                className="h-full bg-blue-500" 
                                style={{ width: `${(judgeData.scores.damage / 5) * 100}%` }}
                              />
                            </div>
                            <span className={`font-mono ${t.redText}`}>{5 - judgeData.scores.damage}</span>
                          </div>
                        </div>
                        
                        {/* Control */}
                        <div className="flex items-center justify-between text-sm">
                          <span className={t.textMuted}>Control</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono ${t.blueText}`}>{judgeData.scores.control}</span>
                            <div className={`w-16 h-1.5 ${t.sliderBg} rounded-full overflow-hidden`}>
                              <div 
                                className="h-full bg-blue-500" 
                                style={{ width: `${(judgeData.scores.control / 3) * 100}%` }}
                              />
                            </div>
                            <span className={`font-mono ${t.redText}`}>{3 - judgeData.scores.control}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t ${t.divider} ${t.tableBg}`}>
          <button
            onClick={onClose}
            className={`w-full py-2 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to get placeholder text for undetermined competitors
const getCompetitorDisplay = (competitor, source, theme) => {
  if (competitor) return { text: competitor, isPlaceholder: false };
  if (!source) return { text: 'TBD', isPlaceholder: true };
  
  const typeLabel = source.type === 'winner' ? 'Winner' : 'Loser';
  return { text: `${typeLabel} of Match ${source.matchNum}`, isPlaceholder: true };
};

// Split Point Slider Component
const SplitSlider = ({ label, maxPoints, valueA, onChange, disabled, theme }) => {
  const t = themes[theme];
  const valueB = maxPoints - valueA;
  const percentage = (valueA / maxPoints) * 100;
  
  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm font-medium ${t.textMuted}`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>{maxPoints} pts total</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="w-12 text-center">
          <span className={`text-2xl font-bold ${valueA > valueB ? t.blueText : t.textFaint}`}>
            {valueA}
          </span>
        </div>
        
        <div className="flex-1 relative">
          <div className={`h-2 ${t.sliderBg} rounded-full overflow-hidden`}>
            <div 
              className={`h-full ${t.sliderFill} transition-all duration-150`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={maxPoints}
            value={valueA}
            onChange={(e) => onChange(parseInt(e.target.value))}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex justify-between mt-1 px-0.5">
            {[...Array(maxPoints + 1)].map((_, i) => (
              <div key={i} className={`w-0.5 h-1.5 ${t.tickMark} rounded-full`} />
            ))}
          </div>
        </div>
        
        <div className="w-12 text-center">
          <span className={`text-2xl font-bold ${valueB > valueA ? t.redText : t.textFaint}`}>
            {valueB}
          </span>
        </div>
      </div>
    </div>
  );
};

// Match Card Component
const MatchCard = ({ match, onClick, theme }) => {
  const t = themes[theme];
  const isActive = match.status === 'active';
  
  const compA = getCompetitorDisplay(match.competitorA, match.sourceA, theme);
  const compB = getCompetitorDisplay(match.competitorB, match.sourceB, theme);
  
  return (
    <div 
      onClick={onClick}
      className={`
        ${t.card} rounded-lg border overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${isActive ? 'border-amber-400 ring-2 ring-amber-200' : `${t.cardBorder} hover:border-gray-400`}
      `}
    >
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-xs ${t.textFaint} font-mono`}>Match {match.matchNum || match.id}</span>
          <StatusBadge status={match.status} winMethod={match.winMethod} theme={theme} />
        </div>
        
        <div className="space-y-1.5">
          <div className={`flex justify-between items-center p-2 rounded ${
            match.winner === match.competitorA && match.competitorA ? t.winnerBg : t.tableBg
          }`}>
            <span className={`text-sm ${
              compA.isPlaceholder 
                ? `${t.textFaint} italic` 
                : match.winner === match.competitorA 
                  ? `font-semibold ${t.winnerText}` 
                  : `font-semibold ${t.text}`
            }`}>
              {compA.text}
              {match.winner === match.competitorA && match.competitorA && ' ✓'}
            </span>
            {match.status === 'completed' && match.winMethod === 'points' && (
              <span className={`text-sm font-mono ${t.textMuted}`}>{match.scores?.a}</span>
            )}
          </div>
          
          <div className={`flex justify-between items-center p-2 rounded ${
            match.winner === match.competitorB && match.competitorB ? t.winnerBg : t.tableBg
          }`}>
            <span className={`text-sm ${
              compB.isPlaceholder 
                ? `${t.textFaint} italic` 
                : match.winner === match.competitorB 
                  ? `font-semibold ${t.winnerText}` 
                  : `font-semibold ${t.text}`
            }`}>
              {compB.text}
              {match.winner === match.competitorB && match.competitorB && ' ✓'}
            </span>
            {match.status === 'completed' && match.winMethod === 'points' && (
              <span className={`text-sm font-mono ${t.textMuted}`}>{match.scores?.b}</span>
            )}
          </div>
        </div>
        
        {isActive && (
          <div className={`mt-3 pt-2 border-t ${t.divider}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${t.textFaint}`}>Judges submitted</span>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${t.tickMark}`} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Public Bracket View
const PublicBracketView = ({ matches, onMatchClick, theme }) => {
  const t = themes[theme];
  
  // Group matches by bracket and round
  const winnersMatches = matches.filter(m => m.bracket === 'winners');
  const losersMatches = matches.filter(m => m.bracket === 'losers');
  
  // Get unique rounds
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
      if (round === totalRounds - 1) return 'Losers Semifinals';
      return `Round ${round}`;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Winners Bracket */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5`}>
        <h2 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          Winners Bracket
        </h2>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {winnersRounds.map(round => {
            const roundMatches = winnersMatches.filter(m => m.round === round);
            return (
              <div key={round} className="min-w-[260px] flex flex-col">
                <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-3`}>
                  {getRoundLabel(round, winnersRounds.length, true)}
                </p>
                <div className="space-y-3 flex-1 flex flex-col justify-around">
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} onClick={() => onMatchClick(match)} theme={theme} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Losers Bracket */}
      {losersMatches.length > 0 && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5`}>
          <h2 className={`text-lg font-bold ${t.text} mb-4 flex items-center gap-2`}>
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            Losers Bracket
          </h2>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {losersRounds.map(round => {
              const roundMatches = losersMatches.filter(m => m.round === round);
              return (
                <div key={round} className="min-w-[260px] flex flex-col">
                  <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-3`}>
                    {getRoundLabel(round, losersRounds.length, false)}
                  </p>
                  <div className="space-y-3 flex-1 flex flex-col justify-around">
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

// Judge Scoring View with API Integration
const JudgeScoringView = ({ matches, tournamentId, currentUser, onScoreSubmitted, theme }) => {
  const t = themes[theme];
  
  // Get matches that can be scored (active or pending with both competitors assigned)
  const scorableMatches = matches.filter(m => 
    (m.status === 'active' || m.status === 'pending') && 
    m.competitorA && 
    m.competitorB
  );
  
  // State for selected match
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const selectedMatch = selectedMatchId 
    ? matches.find(m => m.id === selectedMatchId)
    : scorableMatches.find(m => m.status === 'active') || scorableMatches[0];
  
  const [scores, setScores] = useState({ aggression: 2, damage: 3, control: 1 });
  const [isKO, setIsKO] = useState(false);
  const [koWinner, setKoWinner] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState(null);
  
  const totalA = scores.aggression + scores.damage + scores.control;
  const totalB = 11 - totalA;

  // Reset form when match changes
  const handleMatchChange = (matchId) => {
    setSelectedMatchId(matchId);
    setScores({ aggression: 2, damage: 3, control: 1 });
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
        tournamentId: tournamentId,
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
        // Match was finalized, trigger refresh
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
  
  if (scorableMatches.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <div className={`w-16 h-16 mx-auto rounded-full ${t.tableBg} flex items-center justify-center mb-4`}>
          <svg className={`w-8 h-8 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Matches Available</h3>
        <p className={t.textMuted}>No matches are ready for scoring yet.</p>
      </div>
    );
  }

  if (!selectedMatch) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>Select a Match</h3>
        <p className={t.textMuted}>Choose a match from the dropdown above to begin scoring.</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Match Selector */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4`}>
        <label className={`block text-sm font-medium ${t.textMuted} mb-2`}>Select Match to Score</label>
        <select
          value={selectedMatch?.id || ''}
          onChange={(e) => handleMatchChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
        >
          {scorableMatches.map(match => (
            <option key={match.id} value={match.id}>
              Match {match.matchNum}: {match.competitorA} vs {match.competitorB}
              {match.status === 'active' ? ' (Live)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-700 font-semibold">Error: {error}</p>
        </div>
      )}

      {/* Match Finalized Notice */}
      {submitResult?.finalized && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-700 font-semibold">🏆 Match Complete!</p>
          <p className={`text-sm ${t.textMuted} mt-1`}>
            Winner: {submitResult.result.winMethod === 'ko' ? 'KO' : `${submitResult.result.scoreA}-${submitResult.result.scoreB}`}
          </p>
          <p className={`text-xs ${t.textFaint} mt-2`}>Result submitted to Challonge</p>
        </div>
      )}

      {/* Match Info Card */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className={`text-xs ${t.textFaint} font-mono`}>Match {selectedMatch.matchNum}</span>
            <div className="mt-1">
              <StatusBadge status={selectedMatch.status} theme={theme} />
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs ${t.textFaint}`}>Judges submitted</span>
            <div className="flex gap-1 justify-end mt-1">
              {[0, 1, 2].map(i => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full ${
                  submitResult ? (i < submitResult.judgeCount ? 'bg-green-500' : t.tickMark) : t.tickMark
                }`} />
              ))}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center mb-2">
              <span className="text-xl font-bold text-blue-600">{selectedMatch.competitorA?.[0] || '?'}</span>
            </div>
            <p className={`font-semibold ${t.text} text-sm`}>{selectedMatch.competitorA || 'TBD'}</p>
            <p className={`text-2xl font-bold ${t.blueText} mt-1`}>{isKO ? '—' : totalA}</p>
          </div>
          <div className="text-center">
            <span className={`${t.textFaint} font-medium`}>vs</span>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-lg bg-red-100 border border-red-200 flex items-center justify-center mb-2">
              <span className="text-xl font-bold text-red-600">{selectedMatch.competitorB?.[0] || '?'}</span>
            </div>
            <p className={`font-semibold ${t.text} text-sm`}>{selectedMatch.competitorB || 'TBD'}</p>
            <p className={`text-2xl font-bold ${t.redText} mt-1`}>{isKO ? '—' : totalB}</p>
          </div>
        </div>
      </div>
      
      {/* Scoring Card */}
      {!isKO && !submitResult?.finalized && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5`}>
          <h3 className={`text-sm font-semibold ${t.textFaint} uppercase tracking-wide mb-4`}>Split Points</h3>
          
          <SplitSlider label="Aggression" maxPoints={3} valueA={scores.aggression}
            onChange={(val) => setScores(s => ({ ...s, aggression: val }))} disabled={hasSubmitted} theme={theme} />
          <SplitSlider label="Damage" maxPoints={5} valueA={scores.damage}
            onChange={(val) => setScores(s => ({ ...s, damage: val }))} disabled={hasSubmitted} theme={theme} />
          <SplitSlider label="Control" maxPoints={3} valueA={scores.control}
            onChange={(val) => setScores(s => ({ ...s, control: val }))} disabled={hasSubmitted} theme={theme} />
          
          <div className={`flex justify-between items-center pt-4 mt-4 border-t ${t.divider}`}>
            <div className="text-center">
              <p className={`text-xs ${t.textFaint} mb-1`}>Total</p>
              <p className={`text-3xl font-bold ${t.blueText}`}>{totalA}</p>
            </div>
            <div className={`text-xs ${t.textFaint}`}>of 11</div>
            <div className="text-center">
              <p className={`text-xs ${t.textFaint} mb-1`}>Total</p>
              <p className={`text-3xl font-bold ${t.redText}`}>{totalB}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* KO Option */}
      {!submitResult?.finalized && (
        <div className={`rounded-xl border p-5 transition-colors ${
          isKO ? 'bg-red-50 border-red-300' : `${t.card} ${t.cardBorder}`
        }`}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isKO}
              onChange={(e) => { setIsKO(e.target.checked); if (!e.target.checked) setKoWinner(null); }}
              disabled={hasSubmitted}
              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <span className={`font-semibold ${isKO ? 'text-red-700' : t.text}`}>Declare Knockout (KO)</span>
          </label>
          
          {isKO && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setKoWinner('a')} disabled={hasSubmitted}
                className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                  koWinner === 'a' ? 'bg-blue-50 border-blue-500 text-blue-700' : `${t.card} ${t.cardBorder} ${t.text}`
                }`}>
                {selectedMatch.competitorA}
              </button>
              <button onClick={() => setKoWinner('b')} disabled={hasSubmitted}
                className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                  koWinner === 'b' ? 'bg-red-50 border-red-500 text-red-700' : `${t.card} ${t.cardBorder} ${t.text}`
                }`}>
                {selectedMatch.competitorB}
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Submit Area */}
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
              className={`w-full py-3 rounded-lg border ${t.cardBorder} ${t.text} font-semibold ${t.hoverBg} transition-colors`}>
              Edit My Scores
            </button>
          </div>
        ) : (
          <button onClick={handleSubmit} disabled={(isKO && !koWinner) || isSubmitting}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Submitting...' : 'Submit Scores'}
          </button>
        )
      )}
    </div>
  );
};

// Admin Dashboard View
const AdminDashboardView = ({ tournament, onRefresh, theme }) => {
  const t = themes[theme];
  const [selectedTab, setSelectedTab] = useState('settings');
  const [challongeUrl, setChallongeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  
  const handleSync = async () => {
    if (!challongeUrl) return;
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      await onRefresh(challongeUrl);
      setSyncStatus({ success: true, message: 'Tournament synced successfully!' });
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-1 inline-flex gap-1`}>
        {['settings', 'judges'].map(tab => (
          <button key={tab} onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              selectedTab === tab ? 'bg-gray-900 text-white' : `${t.textMuted} hover:${t.text}`
            }`}>
            {tab}
          </button>
        ))}
      </div>
      
      {selectedTab === 'settings' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <h3 className={`font-bold ${t.text}`}>Challonge Integration</h3>
          
          {syncStatus && (
            <div className={`p-4 rounded-lg ${syncStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={syncStatus.success ? 'text-green-700' : 'text-red-700'}>{syncStatus.message}</p>
            </div>
          )}
          
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Challonge Tournament URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={challongeUrl}
                onChange={(e) => setChallongeUrl(e.target.value)}
                placeholder="e.g., scar-summer-showdown-2024"
                className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`} 
              />
              <button 
                onClick={handleSync}
                disabled={isLoading || !challongeUrl}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Syncing...' : 'Sync'}
              </button>
            </div>
            <p className={`text-xs ${t.textFaint} mt-1`}>
              Enter the tournament URL slug from challonge.com/YOUR_URL_HERE
            </p>
          </div>

          {tournament && (
            <div className={`pt-4 border-t ${t.divider}`}>
              <p className={`text-sm font-medium ${t.textMuted} mb-2`}>Connected Tournament</p>
              <div className={`${t.tableBg} rounded-lg p-4`}>
                <p className={`font-bold ${t.text}`}>{tournament.name}</p>
                <p className={`text-sm ${t.textMuted}`}>Status: {tournament.status}</p>
                <p className={`text-xs ${t.textFaint}`}>ID: {tournament.id}</p>
              </div>
            </div>
          )}
          
          <div className={`pt-4 border-t ${t.divider}`}>
            <p className={`text-sm font-medium ${t.textMuted} mb-3`}>Scoring Criteria (Fixed)</p>
            <div className="grid grid-cols-3 gap-3">
              {[{ name: 'Aggression', points: 3 }, { name: 'Damage', points: 5 }, { name: 'Control', points: 3 }].map(c => (
                <div key={c.name} className={`${t.tableBg} rounded-lg p-3 text-center`}>
                  <p className={`text-sm font-medium ${t.textMuted}`}>{c.name}</p>
                  <p className={`text-2xl font-bold ${t.blueText}`}>{c.points}</p>
                  <p className={`text-xs ${t.textFaint}`}>points</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {selectedTab === 'judges' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5`}>
          <h3 className={`font-bold ${t.text} mb-4`}>Judge Management</h3>
          <p className={t.textMuted}>Judge management coming soon. For now, judges are identified by their login session.</p>
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
  const [darkMode, setDarkMode] = useState(true);
  const [tournamentData, setTournamentData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const theme = darkMode ? 'dark' : 'light';
  const t = themes[theme];

  const loadTournament = useCallback(async (tournamentUrl) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.getTournament(tournamentUrl);
      const transformed = transformChallongeData(data);
      setTournamentData(transformed);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleScoreSubmitted = useCallback((result) => {
    // Refresh tournament data when a match is finalized
    if (tournamentData?.tournament?.url) {
      setTimeout(() => loadTournament(tournamentData.tournament.url), 1000);
    }
  }, [tournamentData, loadTournament]);
  
  const handleLogin = (role) => {
    setCurrentUser({ 
      id: `judge_${Date.now()}`, 
      role, 
      name: role === 'judge' ? 'Judge Adams' : 'Admin User' 
    });
    setView(role);
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setView('public');
  };
  
  // Demo data for when no tournament is loaded
  const demoMatches = tournamentData?.matches || [];
  
  return (
    <div className={`min-h-screen ${t.bg} transition-colors`}>
      {/* Header */}
      <header className={`${t.headerBg} border-b ${t.divider} sticky top-0 z-40`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-4">
              <a href="#" className={`font-bold ${t.text} text-lg`}>SCAR Judge Portal</a>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <button onClick={() => { setView('public'); setCurrentUser(null); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'public' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Bracket
              </button>
              <button onClick={() => handleLogin('judge')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'judge' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Judge
              </button>
              <button onClick={() => handleLogin('admin')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'admin' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                }`}>
                Admin
              </button>
            </nav>
            
            <div className="flex items-center gap-3">
              {currentUser && (
                <div className={`flex items-center gap-3 pr-3 border-r ${t.divider}`}>
                  <span className={`text-sm ${t.textMuted}`}>{currentUser.name}</span>
                  <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-400 font-medium">
                    Logout
                  </button>
                </div>
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
      
      {/* Tournament Info Bar */}
      <div className={`${t.headerBg} border-b ${t.divider}`}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {tournamentData ? (
              <>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                  Challonge
                </span>
                <h1 className={`text-lg font-bold ${t.text}`}>{tournamentData.tournament.name}</h1>
                <span className={`px-2 py-0.5 ${tournamentData.tournament.status === 'underway' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} text-xs font-semibold rounded`}>
                  {tournamentData.tournament.status}
                </span>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                  Demo Mode
                </span>
                <h1 className={`text-lg font-bold ${t.text}`}>SCAR Tournament Judge Portal</h1>
                <span className={`text-sm ${t.textMuted}`}>Connect a Challonge tournament in Admin settings</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
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
          tournamentData ? (
            <PublicBracketView matches={demoMatches} onMatchClick={setSelectedMatch} theme={theme} />
          ) : (
            <div className={`${t.card} rounded-xl border ${t.cardBorder} p-8 text-center`}>
              <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Tournament Connected</h3>
              <p className={t.textMuted}>Go to Admin → Settings to connect a Challonge tournament</p>
            </div>
          )
        )}
        
        {!isLoading && view === 'judge' && (
          <JudgeScoringView 
            matches={demoMatches} 
            tournamentId={tournamentData?.tournament?.url}
            currentUser={currentUser}
            onScoreSubmitted={handleScoreSubmitted}
            theme={theme} 
          />
        )}
        
        {!isLoading && view === 'admin' && (
          <AdminDashboardView 
            tournament={tournamentData?.tournament}
            onRefresh={loadTournament}
            theme={theme} 
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className={`border-t ${t.divider} ${t.headerBg} mt-auto`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className={`flex flex-col md:flex-row justify-between items-center gap-2 text-sm ${t.textFaint}`}>
            <div>Built for <a href="https://www.socalattackrobots.com/" className={t.blueText}>SCAR</a></div>
            <div className="flex items-center gap-4">
              <span>Challonge Integration Enabled</span>
              <span>•</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Match Detail Popup */}
      {selectedMatch && (
        <MatchDetailPopup 
          match={selectedMatch} 
          onClose={() => setSelectedMatch(null)} 
          theme={theme} 
        />
      )}
    </div>
  );
}
