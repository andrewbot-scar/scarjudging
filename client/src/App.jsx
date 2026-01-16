import React, { useState, useEffect, useCallback } from 'react';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// SCAR ELO API Configuration
const ELO_API_BASE_URL = 'https://elo.socalattackrobots.com/api';
const ELO_SITE_BASE_URL = 'https://elo.socalattackrobots.com';

// Helper to build ELO robot page URL
function getEloRobotUrl(weightClassSlug, robotName) {
  const robotSlug = slugifyRobotName(robotName);
  return `${ELO_SITE_BASE_URL}/class/${weightClassSlug}/robot/${robotSlug}`;
}

// Weight class mappings - maps common tournament name patterns to ELO weight class slugs
const WEIGHT_CLASS_PATTERNS = [
  { pattern: /150\s*g/i, slug: '150g', display: '150g' },
  { pattern: /plastic\s*ant|plant/i, slug: 'plant', display: 'Plastic Ant' },
  { pattern: /1\s*lb|antweight/i, slug: '1lb', display: '1lb' },
  { pattern: /3\s*lb|beetleweight/i, slug: '3lb', display: '3lb' },
  { pattern: /12\s*lb|hobbyweight/i, slug: '12lb', display: '12lb' },
  { pattern: /30\s*lb\s*sportsman/i, slug: '30lb_sportsman', display: '30lb Sportsman' },
  { pattern: /30\s*lb|featherweight/i, slug: '30lb', display: '30lb' },
];

// Helper to extract weight class from tournament name
function getWeightClassFromTournament(tournamentName) {
  if (!tournamentName) return null;
  
  for (const { pattern, slug, display } of WEIGHT_CLASS_PATTERNS) {
    if (pattern.test(tournamentName)) {
      return { slug, display };
    }
  }
  return null;
}

// Helper to slugify robot name for ELO API
function slugifyRobotName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

// ELO data cache to avoid repeated API calls
const eloCache = new Map();

// Fetch robot ELO data from SCAR ELO API
async function fetchRobotElo(robotName, weightClassSlug) {
  if (!robotName || !weightClassSlug) return null;
  
  const cacheKey = `${weightClassSlug}:${robotName.toLowerCase()}`;
  
  // Check cache first
  if (eloCache.has(cacheKey)) {
    return eloCache.get(cacheKey);
  }
  
  const robotSlug = slugifyRobotName(robotName);
  if (!robotSlug) return null;
  
  try {
    const response = await fetch(`${ELO_API_BASE_URL}/robot/${weightClassSlug}/${robotSlug}`);
    if (!response.ok) {
      // Cache null result to avoid repeated failed requests
      eloCache.set(cacheKey, null);
      return null;
    }
    
    const data = await response.json();
    // Add the URL to the robot's ELO page
    data.eloUrl = getEloRobotUrl(weightClassSlug, robotName);
    
    // Cache the result
    eloCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`Failed to fetch ELO for ${robotName}:`, err);
    eloCache.set(cacheKey, null);
    return null;
  }
}

// Fetch head-to-head data between two robots
async function fetchHeadToHead(robot1, robot2, weightClassSlug) {
  if (!robot1 || !robot2 || !weightClassSlug) return null;
  
  const cacheKey = `h2h:${weightClassSlug}:${robot1.toLowerCase()}:${robot2.toLowerCase()}`;
  
  if (eloCache.has(cacheKey)) {
    return eloCache.get(cacheKey);
  }
  
  try {
    const response = await fetch(
      `${ELO_API_BASE_URL}/class/${weightClassSlug}/h2h?robot1=${encodeURIComponent(robot1)}&robot2=${encodeURIComponent(robot2)}`
    );
    if (!response.ok) {
      eloCache.set(cacheKey, null);
      return null;
    }
    
    const data = await response.json();
    eloCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`Failed to fetch H2H for ${robot1} vs ${robot2}:`, err);
    eloCache.set(cacheKey, null);
    return null;
  }
}

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

// Helper for case-insensitive robot image lookup
// Handles mismatches between Challonge names and RCE names (e.g., "Briklit" vs "briklit")
function getRobotImage(robotImages, robotName) {
  if (!robotImages || !robotName) return null;
  
  // Try exact match first
  if (robotImages[robotName]) return robotImages[robotName];
  
  // Try case-insensitive match
  const lowerName = robotName.toLowerCase();
  for (const [key, value] of Object.entries(robotImages)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  return null;
}

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

  async saveEvent(eventId, name, tournaments, scoringCriteria, robotImages, discordWebhookUrl) {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, name, tournaments, scoringCriteria, robotImages, discordWebhookUrl }),
    });
    if (!response.ok) throw new Error('Failed to save event');
    return response.json();
  },

  async testDiscordWebhook(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/test-discord`, {
      method: 'POST',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to test Discord webhook');
    }
    return response.json();
  },

  async deleteEvent(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete event');
    return response.json();
  },

  async scrapeRCE(url) {
    const response = await fetch(`${API_BASE_URL}/scrape-rce?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('Failed to scrape RCE page');
    return response.json();
  },

  // Active Match API
  async getActiveMatches(eventId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/active-matches`);
    if (!response.ok) throw new Error('Failed to fetch active matches');
    return response.json();
  },

  async setActiveMatch(eventId, tournamentId, matchId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/active-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, matchId }),
    });
    if (!response.ok) throw new Error('Failed to set active match');
    return response.json();
  },

  async clearActiveMatch(eventId, tournamentId) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/active-match/${tournamentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear active match');
    return response.json();
  },

  // Repair Timer Reset API
  async getRepairResets(eventId) {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/repair-resets`);
      if (!response.ok) return {}; // Return empty object on error
      return response.json();
    } catch (err) {
      console.error('Failed to fetch repair resets:', err);
      return {}; // Return empty object on error
    }
  },

  async resetRepairTimer(eventId, robotName) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/repair-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robotName }),
    });
    if (!response.ok) throw new Error('Failed to reset repair timer');
    return response.json();
  },

  async clearRepairReset(eventId, robotName) {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/repair-reset/${encodeURIComponent(robotName)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clear repair reset');
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
    cardBorder: 'border-gray-700/50',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textFaint: 'text-gray-500',
    headerBg: 'bg-gray-800',
    inputBg: 'bg-gray-700',
    inputBorder: 'border-gray-600',
    hoverBg: 'hover:bg-gray-700',
    activeBg: 'bg-gray-700',
    tableBg: 'bg-gray-700/50',
    divider: 'border-gray-700/50',
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
      // Use updated_at as completedAt for completed matches (Challonge doesn't have a dedicated completed_at field for matches)
      completedAt: match.state === 'complete' ? (match.completed_at || match.updated_at) : null,
      tournamentName: tournament.name,
      tournamentUrl: tournamentUrl || tournament.url,
      tournamentId: tournament.id,
    };
  });

  // Find the Grand Finals match (highest round in winners bracket)
  const maxWinnersRound = Math.max(...transformedMatches.filter(x => x.bracket === 'winners').map(x => x.round));
  const grandFinalsMatch = transformedMatches.find(m => 
    m.bracket === 'winners' && m.round === maxWinnersRound
  );
  
  // Check grand_finals_modifier from Challonge settings
  // Values: null (standard 1-2 matches), "single_match" (no bracket reset), "skip" (no grand finals)
  const grandFinalsModifier = tournament.grand_finals_modifier;
  
  // Filter out bracket reset matches based on tournament settings
  const filteredMatches = transformedMatches.filter(m => {
    // If grand_finals_modifier is "single_match" or "skip", hide bracket reset matches
    // (matches after Grand Finals)
    if (grandFinalsModifier === 'single_match' || grandFinalsModifier === 'skip') {
      if (grandFinalsMatch && m.matchNum > grandFinalsMatch.matchNum) {
        return false;
      }
    }
    // For standard double elimination (null), also hide empty bracket reset matches
    // but show them if they have competitors (tournament is using bracket reset)
    if (!grandFinalsModifier && grandFinalsMatch && m.matchNum > grandFinalsMatch.matchNum) {
      // Only show if it has competitors assigned (bracket reset is happening)
      if (!m.competitorA && !m.competitorB) {
        return false;
      }
    }
    return true;
  });

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      url: tournamentUrl || tournament.url,
      status: tournament.state,
      grandFinalsModifier: grandFinalsModifier, // Include for reference
      tournamentType: tournament.tournament_type,
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
const StatusBadge = ({ status, winMethod, scores, theme }) => {
  const t = themes[theme];
  
  if (status === 'pending') {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.pendingBg} ${t.pendingText}`}>Upcoming</span>;
  }
  if (status === 'active') {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.liveBg} ${t.liveText}`}>● Live</span>;
  }
  // Detect KO: either winMethod is 'ko' OR one side has 0 points (covers both old 0-0 and new 33-0 format)
  if (winMethod === 'ko' || (scores && (scores.a === 0 || scores.b === 0))) {
    return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>;
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.decisionBg} ${t.decisionText}`}>Decision</span>;
};

// Match Detail Popup Component
const MatchDetailPopup = ({ match, onClose, robotImages, theme }) => {
  const t = themes[theme];
  const [judgeScores, setJudgeScores] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eloDataA, setEloDataA] = useState(null);
  const [eloDataB, setEloDataB] = useState(null);
  const [h2hData, setH2hData] = useState(null);

  // Get weight class from tournament name
  const weightClass = match?.tournamentName ? getWeightClassFromTournament(match.tournamentName) : null;

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

  // Fetch ELO data for both competitors
  useEffect(() => {
    const fetchEloData = async () => {
      if (!match || !weightClass?.slug) return;
      
      // Fetch ELO for competitor A
      if (match.competitorA) {
        const dataA = await fetchRobotElo(match.competitorA, weightClass.slug);
        setEloDataA(dataA);
      }
      
      // Fetch ELO for competitor B
      if (match.competitorB) {
        const dataB = await fetchRobotElo(match.competitorB, weightClass.slug);
        setEloDataB(dataB);
      }
      
      // Fetch head-to-head data
      if (match.competitorA && match.competitorB) {
        const h2h = await fetchHeadToHead(match.competitorA, match.competitorB, weightClass.slug);
        setH2hData(h2h);
      }
    };

    fetchEloData();
  }, [match, weightClass]);

  if (!match) return null;

  const judges = judgeScores?.judges ? Object.entries(judgeScores.judges) : [];
  const hasScores = judges.length > 0;

  const getJudgeTotals = (scores) => {
    if (!scores) return { a: 0, b: 0 };
    const totalA = (scores.aggression || 0) + (scores.damage || 0) + (scores.control || 0);
    const totalB = 11 - totalA;
    return { a: totalA, b: totalB };
  };

  // Calculate H2H record
  const getH2HRecord = () => {
    if (!h2hData?.events) return null;
    let winsA = 0, winsB = 0;
    h2hData.events.forEach(event => {
      event.fights?.forEach(fight => {
        if (fight.winner?.toLowerCase() === match.competitorA?.toLowerCase()) winsA++;
        else if (fight.winner?.toLowerCase() === match.competitorB?.toLowerCase()) winsB++;
      });
    });
    if (winsA === 0 && winsB === 0) return null;
    return { a: winsA, b: winsB };
  };

  const h2hRecord = getH2HRecord();

  // Helper to render ELO badge
  const renderEloBadge = (eloData, robotName) => {
    if (!eloData) return null;
    const eloUrl = getEloRobotUrl(weightClass?.slug, robotName);
    
    return (
      <a 
        href={eloUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${t.tableBg} hover:opacity-80 transition-opacity`}
      >
        <span className={`font-semibold ${
          eloData.tier === 'S' ? 'text-yellow-600' :
          eloData.tier === 'A' ? 'text-purple-600' :
          eloData.tier === 'B' ? 'text-blue-600' :
          eloData.tier === 'C' ? 'text-green-600' :
          t.textMuted
        }`}>{eloData.tier || '?'}</span>
        <span className={t.textMuted}>{eloData.rating}</span>
        <span className={`text-green-600`}>{eloData.wins}W</span>
        <span className={`text-red-600`}>{eloData.losses}L</span>
      </a>
    );
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
              <StatusBadge status={match.status} winMethod={match.winMethod} scores={match.scores} theme={theme} />
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
          {/* Head-to-Head Record */}
          {h2hRecord && (
            <div className={`mb-3 p-2 rounded-lg ${t.tableBg} text-center`}>
              <span className={`text-xs ${t.textFaint} uppercase tracking-wide`}>Head-to-Head Record</span>
              <div className="flex items-center justify-center gap-3 mt-1">
                <span className={`font-bold ${t.blueText}`}>{h2hRecord.a}</span>
                <span className={`text-xs ${t.textFaint}`}>-</span>
                <span className={`font-bold ${t.redText}`}>{h2hRecord.b}</span>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="text-center">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-lg overflow-hidden mb-2 ${match.winner === match.competitorA ? 'ring-2 ring-green-500' : ''}`}>
                {getRobotImage(robotImages, match.competitorA) ? (
                  <img 
                    src={getRobotImage(robotImages, match.competitorA)} 
                    alt={match.competitorA}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-blue-100 border border-blue-200 items-center justify-center ${getRobotImage(robotImages, match.competitorA) ? 'hidden' : 'flex'}`}>
                  <span className="text-2xl sm:text-3xl font-bold text-blue-600">{match.competitorA?.[0] || '?'}</span>
                </div>
              </div>
              {match.competitorA && weightClass?.slug ? (
                <a 
                  href={getEloRobotUrl(weightClass.slug, match.competitorA)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`font-semibold ${t.text} text-sm hover:underline`}
                >
                  {match.competitorA}
                </a>
              ) : (
                <p className={`font-semibold ${t.text} text-sm`}>{match.competitorA || 'TBD'}</p>
              )}
              {eloDataA && renderEloBadge(eloDataA, match.competitorA)}
              {match.status === 'completed' && (
                <p className={`text-xl font-bold ${t.blueText} mt-1`}>{match.scores?.a || 0}</p>
              )}
            </div>
            <div className="text-center">
              <span className={`${t.textFaint} font-medium`}>vs</span>
            </div>
            <div className="text-center">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-lg overflow-hidden mb-2 ${match.winner === match.competitorB ? 'ring-2 ring-green-500' : ''}`}>
                {getRobotImage(robotImages, match.competitorB) ? (
                  <img 
                    src={getRobotImage(robotImages, match.competitorB)} 
                    alt={match.competitorB}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-red-100 border border-red-200 items-center justify-center ${getRobotImage(robotImages, match.competitorB) ? 'hidden' : 'flex'}`}>
                  <span className="text-2xl sm:text-3xl font-bold text-red-600">{match.competitorB?.[0] || '?'}</span>
                </div>
              </div>
              {match.competitorB && weightClass?.slug ? (
                <a 
                  href={getEloRobotUrl(weightClass.slug, match.competitorB)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`font-semibold ${t.text} text-sm hover:underline`}
                >
                  {match.competitorB}
                </a>
              ) : (
                <p className={`font-semibold ${t.text} text-sm`}>{match.competitorB || 'TBD'}</p>
              )}
              {eloDataB && renderEloBadge(eloDataB, match.competitorB)}
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

// Robot Avatar Component - displays robot image or fallback initial
const RobotAvatar = ({ name, robotImages, size = 'md', colorClass = 'bg-gray-100 text-gray-600' }) => {
  const imageUrl = getRobotImage(robotImages, name);
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl',
    xl: 'w-24 h-24 sm:w-28 sm:h-28 text-3xl sm:text-4xl',
  };
  
  if (imageUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden flex-shrink-0`}>
        <img 
          src={imageUrl} 
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // On error, replace with initial
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `<span class="w-full h-full flex items-center justify-center ${colorClass} font-bold">${name?.[0] || '?'}</span>`;
          }}
        />
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-lg ${colorClass} border border-opacity-50 flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold">{name?.[0] || '?'}</span>
    </div>
  );
};

// Robot Link Component - Clickable robot name with ELO info tooltip
const RobotLink = ({ name, weightClass, isWinner, isPlaceholder, className, theme }) => {
  const t = themes[theme];
  const [eloData, setEloData] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch ELO data on hover
  const handleMouseEnter = async () => {
    if (!name || isPlaceholder || !weightClass?.slug) return;
    
    setShowTooltip(true);
    
    if (eloData === null && !isLoading) {
      setIsLoading(true);
      const data = await fetchRobotElo(name, weightClass.slug);
      setEloData(data || false); // false means "tried but not found"
      setIsLoading(false);
    }
  };
  
  const handleMouseLeave = () => {
    setShowTooltip(false);
  };
  
  const handleClick = (e) => {
    if (!name || isPlaceholder || !weightClass?.slug) return;
    
    // Open ELO page in new tab
    e.stopPropagation(); // Prevent match card click
    window.open(getEloRobotUrl(weightClass.slug, name), '_blank');
  };
  
  // If placeholder or no weight class, render without link
  if (isPlaceholder || !weightClass?.slug) {
    return <span className={className}>{name}</span>;
  }
  
  return (
    <span 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span 
        onClick={handleClick}
        className={`${className} cursor-pointer hover:underline`}
        title="Click to view ELO stats"
      >
        {name}
        {isWinner && ' ✓'}
      </span>
      
      {/* ELO Tooltip */}
      {showTooltip && (
        <div className={`absolute z-50 left-0 top-full mt-1 p-2 rounded-lg shadow-lg border min-w-[180px] ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          {isLoading ? (
            <div className={`text-xs ${t.textMuted}`}>Loading ELO data...</div>
          ) : eloData ? (
            <div className="text-xs space-y-1">
              <div className="flex justify-between items-center gap-3">
                <span className={t.textMuted}>Rating:</span>
                <span className={`font-bold ${t.text}`}>{eloData.rating}</span>
              </div>
              {eloData.tier && (
                <div className="flex justify-between items-center gap-3">
                  <span className={t.textMuted}>Tier:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-xs ${
                    eloData.tier === 'S' ? 'bg-yellow-100 text-yellow-800' :
                    eloData.tier === 'A' ? 'bg-purple-100 text-purple-800' :
                    eloData.tier === 'B' ? 'bg-blue-100 text-blue-800' :
                    eloData.tier === 'C' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{eloData.tier}</span>
                </div>
              )}
              {eloData.rank && (
                <div className="flex justify-between items-center gap-3">
                  <span className={t.textMuted}>Rank:</span>
                  <span className={`font-semibold ${t.text}`}>#{eloData.rank}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className={t.textMuted}>Record:</span>
                <span className={t.text}>
                  <span className="text-green-600">{eloData.wins}W</span>
                  {' - '}
                  <span className="text-red-600">{eloData.losses}L</span>
                </span>
              </div>
              {eloData.team && (
                <div className={`pt-1 mt-1 border-t ${t.divider}`}>
                  <span className={t.textFaint}>{eloData.team}</span>
                </div>
              )}
              <div className={`pt-1 text-blue-500 text-xs`}>
                Click to view full stats →
              </div>
            </div>
          ) : (
            <div className={`text-xs ${t.textMuted}`}>
              Not found in ELO database
            </div>
          )}
        </div>
      )}
    </span>
  );
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
const MatchCard = ({ match, onClick, showTournament = false, displayStatus, weightClass, theme }) => {
  const t = themes[theme];
  
  // Use displayStatus if provided, otherwise fall back to basic status check
  const status = displayStatus || (match.status === 'active' ? 'onDeck' : match.status === 'completed' ? 'completed' : 'pending');
  
  const compA = getCompetitorDisplay(match.competitorA, match.sourceA);
  const compB = getCompetitorDisplay(match.competitorB, match.sourceB);
  
  // Determine border styling based on display status
  const getBorderClass = () => {
    switch (status) {
      case 'fighting':
        return 'border-amber-400 ring-2 ring-amber-400/50';
      case 'onDeck':
        return 'border-green-500 ring-2 ring-green-500/30';
      case 'repairing':
        return 'border-red-500 ring-2 ring-red-500/30';
      default:
        return `${t.cardBorder} hover:border-gray-400`;
    }
  };
  
  // Get the appropriate status badge
  const getStatusBadge = () => {
    if (match.status === 'completed') {
      // Show KO or Decision for completed matches
      const isKO = match.winMethod === 'ko' || match.scores?.a === 0 || match.scores?.b === 0;
      if (isKO) {
        return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.koBg} ${t.koText}`}>KO</span>;
      }
      return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.decisionBg} ${t.decisionText}`}>Decision</span>;
    }
    
    switch (status) {
      case 'fighting':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">● NOW FIGHTING</span>;
      case 'onDeck':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">On Deck</span>;
      case 'repairing':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">⏱ Repairing</span>;
      default:
        return <span className={`px-2 py-0.5 text-xs font-semibold rounded ${t.pendingBg} ${t.pendingText}`}>Upcoming</span>;
    }
  };
  
  return (
    <div 
      onClick={onClick}
      className={`
        ${t.card} rounded-lg border overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-md active:scale-[0.98]
        ${getBorderClass()}
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
          {getStatusBadge()}
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
              {compA.isPlaceholder ? (
                compA.text
              ) : (
                <RobotLink
                  name={compA.text}
                  weightClass={weightClass}
                  isWinner={match.winner === match.competitorA}
                  isPlaceholder={false}
                  theme={theme}
                />
              )}
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
              {compB.isPlaceholder ? (
                compB.text
              ) : (
                <RobotLink
                  name={compB.text}
                  weightClass={weightClass}
                  isWinner={match.winner === match.competitorB}
                  isPlaceholder={false}
                  theme={theme}
                />
              )}
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
const PublicBracketView = ({ tournaments, onMatchClick, robotImages, activeMatches, repairResets, theme }) => {
  const t = themes[theme];
  const [selectedTournamentIndex, setSelectedTournamentIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  
  // Update time every second for repair countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Get all completed matches to track when robots last fought
  const allCompletedMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => m.status === 'completed')
  );
  
  // Build a map of robot name -> last fight end time
  const robotLastFight = {};
  allCompletedMatches.forEach(match => {
    if (match.completedAt) {
      const time = new Date(match.completedAt).getTime();
      if (match.competitorA) {
        if (!robotLastFight[match.competitorA] || time > robotLastFight[match.competitorA]) {
          robotLastFight[match.competitorA] = time;
        }
      }
      if (match.competitorB) {
        if (!robotLastFight[match.competitorB] || time > robotLastFight[match.competitorB]) {
          robotLastFight[match.competitorB] = time;
        }
      }
    }
  });
  
  // Calculate repair time remaining (20 minutes = 1200000ms)
  const REPAIR_TIME_MS = 20 * 60 * 1000;
  
  const getRepairStatus = (robotName) => {
    // Check for manual reset first (case-insensitive)
    let resetTime = null;
    if (repairResets) {
      for (const [key, value] of Object.entries(repairResets)) {
        if (key.toLowerCase() === robotName?.toLowerCase()) {
          resetTime = new Date(value).getTime();
          break;
        }
      }
    }
    
    const lastFight = robotLastFight[robotName];
    
    // Use the more recent of: last fight or manual reset
    const effectiveStart = Math.max(lastFight || 0, resetTime || 0);
    
    if (!effectiveStart) return { ready: true, remaining: 0 };
    
    const elapsed = now.getTime() - effectiveStart;
    const remaining = REPAIR_TIME_MS - elapsed;
    
    return {
      ready: remaining <= 0,
      remaining: Math.max(0, remaining)
    };
  };
  
  // Helper to check if a match is the active "NOW FIGHTING" match
  const isNowFighting = (match) => {
    const activeMatch = activeMatches?.[match.tournamentUrl];
    return activeMatch?.matchId === String(match.challongeId);
  };
  
  // Get match status for bracket display
  const getMatchDisplayStatus = (match) => {
    if (match.status === 'completed') return 'completed';
    if (isNowFighting(match)) return 'fighting';
    
    // Check if both competitors are known and ready
    if (match.competitorA && match.competitorB) {
      const statusA = getRepairStatus(match.competitorA);
      const statusB = getRepairStatus(match.competitorB);
      if (statusA.ready && statusB.ready) return 'onDeck';
      return 'repairing';
    }
    
    return 'pending';
  };
  
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
  
  // Extract weight class from tournament name for ELO lookup
  const currentWeightClass = currentTournament?.tournament?.name 
    ? getWeightClassFromTournament(currentTournament.tournament.name)
    : null;
  
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
                    <MatchCard key={match.id} match={match} onClick={() => onMatchClick(match)} displayStatus={getMatchDisplayStatus(match)} weightClass={currentWeightClass} theme={theme} />
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
                      <MatchCard key={match.id} match={match} onClick={() => onMatchClick(match)} displayStatus={getMatchDisplayStatus(match)} weightClass={currentWeightClass} theme={theme} />
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

// Upcoming Matches View - Shows next matches with repair countdown timers
const UpcomingMatchesView = ({ tournaments, robotImages, activeMatches, repairResets, theme }) => {
  const t = themes[theme];
  const [now, setNow] = useState(new Date());
  const [selectedTournament, setSelectedTournament] = useState('all');
  
  // Update time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Get all completed matches to track when robots last fought
  const allCompletedMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => m.status === 'completed')
  );
  
  // Build a map of robot name -> last fight end time
  const robotLastFight = {};
  allCompletedMatches.forEach(match => {
    if (match.completedAt) {
      const time = new Date(match.completedAt).getTime();
      if (match.competitorA) {
        if (!robotLastFight[match.competitorA] || time > robotLastFight[match.competitorA]) {
          robotLastFight[match.competitorA] = time;
        }
      }
      if (match.competitorB) {
        if (!robotLastFight[match.competitorB] || time > robotLastFight[match.competitorB]) {
          robotLastFight[match.competitorB] = time;
        }
      }
    }
  });
  
  // Helper to check if a match is the active "NOW FIGHTING" match
  const isNowFighting = (match) => {
    const activeMatch = activeMatches?.[match.tournamentUrl];
    return activeMatch?.matchId === String(match.challongeId);
  };
  
  // Get upcoming matches (pending or active with both competitors known)
  const upcomingMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => 
      (m.status === 'pending' || m.status === 'active') && 
      m.competitorA && 
      m.competitorB
    )
  );
  
  // Filter by selected tournament
  const filteredMatches = selectedTournament === 'all' 
    ? upcomingMatches 
    : upcomingMatches.filter(m => m.tournamentUrl === selectedTournament);
  
  // Calculate repair time remaining (20 minutes = 1200000ms)
  const REPAIR_TIME_MS = 20 * 60 * 1000;
  
  const getRepairStatus = (robotName) => {
    // Check for manual reset first (case-insensitive)
    let resetTime = null;
    if (repairResets) {
      for (const [key, value] of Object.entries(repairResets)) {
        if (key.toLowerCase() === robotName?.toLowerCase()) {
          resetTime = new Date(value).getTime();
          break;
        }
      }
    }
    
    const lastFight = robotLastFight[robotName];
    
    // Use the more recent of: last fight or manual reset
    const effectiveStart = Math.max(lastFight || 0, resetTime || 0);
    
    if (!effectiveStart) return { ready: true, remaining: 0 };
    
    const elapsed = now.getTime() - effectiveStart;
    const remaining = REPAIR_TIME_MS - elapsed;
    
    return {
      ready: remaining <= 0,
      remaining: Math.max(0, remaining)
    };
  };
  
  // Helper to check if both robots in a match are ready (On Deck)
  const isBothReady = (match) => {
    const statusA = getRepairStatus(match.competitorA);
    const statusB = getRepairStatus(match.competitorB);
    return statusA.ready && statusB.ready;
  };

  // Sort: NOW FIGHTING first, then On Deck (both ready), then by match number
  const sortedUpcoming = [...filteredMatches]
    .sort((a, b) => {
      // NOW FIGHTING matches go first
      const aFighting = isNowFighting(a);
      const bFighting = isNowFighting(b);
      if (aFighting && !bFighting) return -1;
      if (bFighting && !aFighting) return 1;
      
      // On Deck (both robots ready) goes next
      const aReady = isBothReady(a);
      const bReady = isBothReady(b);
      if (aReady && !bReady) return -1;
      if (bReady && !aReady) return 1;
      
      // Then sort by match number
      return a.matchNum - b.matchNum;
    })
    .slice(0, 10);
  
  const formatCountdown = (ms) => {
    if (ms <= 0) return 'Ready';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  if (sortedUpcoming.length === 0) {
    return (
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-6 sm:p-8 text-center`}>
        <div className={`w-16 h-16 mx-auto rounded-full ${t.tableBg} flex items-center justify-center mb-4`}>
          <svg className={`w-8 h-8 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className={`text-lg font-bold ${t.text} mb-2`}>No Upcoming Matches</h3>
        <p className={t.textMuted}>Waiting for matches to be scheduled.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className={`text-lg font-bold ${t.text}`}>Upcoming Matches</h2>
            <p className={`text-sm ${t.textMuted}`}>20 minute repair time countdown</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-500/20"></div>
              <span className={`text-xs ${t.textMuted}`}>Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-500/20"></div>
              <span className={`text-xs ${t.textMuted}`}>Repairing</span>
            </div>
          </div>
        </div>
        
        {/* Tournament Filter */}
        {tournaments.length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTournament('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedTournament === 'all'
                    ? 'bg-blue-600 text-white'
                    : `${t.tableBg} ${t.textMuted} hover:${t.text}`
                }`}
              >
                All ({upcomingMatches.length})
              </button>
              {tournaments.map(tourney => {
                const count = upcomingMatches.filter(m => m.tournamentUrl === tourney.tournament.url).length;
                if (count === 0) return null;
                return (
                  <button
                    key={tourney.tournament.url}
                    onClick={() => setSelectedTournament(tourney.tournament.url)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedTournament === tourney.tournament.url
                        ? 'bg-blue-600 text-white'
                        : `${t.tableBg} ${t.textMuted} hover:${t.text}`
                    }`}
                  >
                    {tourney.tournament.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Matches List */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} overflow-hidden`}>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedUpcoming.map((match, index) => {
            const statusA = getRepairStatus(match.competitorA);
            const statusB = getRepairStatus(match.competitorB);
            const bothReady = statusA.ready && statusB.ready;
            const fighting = isNowFighting(match);
            const weightClass = getWeightClassFromTournament(match.tournamentName);
            
            return (
              <div 
                key={`${match.tournamentId}-${match.id}`}
                className={`p-4 ${fighting ? 'bg-amber-500/10' : ''}`}
              >
                {/* Match header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-mono ${t.textFaint}`}>#{index + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${t.tableBg} ${t.textMuted}`}>
                      M{match.matchNum}
                    </span>
                    <span className={`text-xs ${t.textFaint}`}>{match.tournamentName}</span>
                  </div>
                  {fighting ? (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">
                      ● NOW FIGHTING
                    </span>
                  ) : bothReady ? (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                      On Deck
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">
                      ⏱ Repairing
                    </span>
                  )}
                </div>
                
                {/* Competitors */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Competitor A */}
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-lg overflow-hidden border-4 ${
                      statusA.ready ? 'border-green-500' : 'border-red-500'
                    }`}>
                      {getRobotImage(robotImages, match.competitorA) ? (
                        <img 
                          src={getRobotImage(robotImages, match.competitorA)} 
                          alt={match.competitorA}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xl font-bold text-blue-600">{match.competitorA?.[0]}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${t.text}`}>
                        <RobotLink name={match.competitorA} weightClass={weightClass} theme={theme} />
                      </p>
                      {!statusA.ready && (
                        <p className="text-red-500 font-mono text-sm">{formatCountdown(statusA.remaining)}</p>
                      )}
                      {statusA.ready && robotLastFight[match.competitorA] && (
                        <p className="text-green-500 text-xs">✓ Ready</p>
                      )}
                      {!robotLastFight[match.competitorA] && (
                        <p className={`text-xs ${t.textFaint}`}>No recent fight</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Competitor B */}
                  <div className="flex items-center gap-3 justify-end text-right">
                    <div>
                      <p className={`font-semibold ${t.text}`}>
                        <RobotLink name={match.competitorB} weightClass={weightClass} theme={theme} />
                      </p>
                      {!statusB.ready && (
                        <p className="text-red-500 font-mono text-sm">{formatCountdown(statusB.remaining)}</p>
                      )}
                      {statusB.ready && robotLastFight[match.competitorB] && (
                        <p className="text-green-500 text-xs">✓ Ready</p>
                      )}
                      {!robotLastFight[match.competitorB] && (
                        <p className={`text-xs ${t.textFaint}`}>No recent fight</p>
                      )}
                    </div>
                    <div className={`w-16 h-16 rounded-lg overflow-hidden border-4 ${
                      statusB.ready ? 'border-green-500' : 'border-red-500'
                    }`}>
                      {getRobotImage(robotImages, match.competitorB) ? (
                        <img 
                          src={getRobotImage(robotImages, match.competitorB)} 
                          alt={match.competitorB}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-red-100 flex items-center justify-center">
                          <span className="text-xl font-bold text-red-600">{match.competitorB?.[0]}</span>
                        </div>
                      )}
                    </div>
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

// Completed Matches View
const CompletedMatchesView = ({ tournaments, onMatchClick, robotImages, theme }) => {
  const t = themes[theme];
  
  // Helper to detect if a match was a KO
  // KO matches have winMethod 'ko', or one side has 0 points (old 0-0 format or new 33-0 format)
  const isKnockout = (match) => {
    if (match.winMethod === 'ko') return true;
    if (match.scores?.a === 0 || match.scores?.b === 0) return true;
    return false;
  };
  
  // Get all completed matches from all tournaments
  const allCompletedMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => m.status === 'completed')
  );

  // Sort by most recent completion time first (newest at top)
  const sortedMatches = [...allCompletedMatches].sort((a, b) => {
    // Sort by completedAt timestamp if available, most recent first
    if (a.completedAt && b.completedAt) {
      return new Date(b.completedAt) - new Date(a.completedAt);
    }
    // If no timestamp, fall back to match number (higher = more recent)
    return b.matchNum - a.matchNum;
  });

  // Helper to format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  };

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
              {sortedMatches.filter(m => isKnockout(m)).length}
            </p>
            <p className={`text-xs sm:text-sm ${t.textMuted}`}>KOs</p>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-bold ${t.text}`}>
              {sortedMatches.filter(m => !isKnockout(m)).length}
            </p>
            <p className={`text-xs sm:text-sm ${t.textMuted}`}>Decisions</p>
          </div>
        </div>
      </div>

      {/* Single unified list of all matches */}
      <div className={`${t.card} rounded-xl border ${t.cardBorder} overflow-hidden`}>
        <div className={`px-4 sm:px-5 py-3 border-b ${t.divider} ${t.tableBg}`}>
          <h2 className={`font-bold ${t.text} text-sm sm:text-base`}>All Completed Matches</h2>
          <p className={`text-xs ${t.textMuted}`}>Most recent at top</p>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedMatches.map(match => {
            const weightClass = getWeightClassFromTournament(match.tournamentName);
            return (
            <div 
              key={`${match.tournamentId}-${match.id}`}
              onClick={() => onMatchClick(match)}
              className={`px-4 sm:px-5 py-3 ${t.hoverBg} cursor-pointer transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 text-center w-10">
                    <span className={`text-xs ${t.textFaint} font-mono block`}>M{match.matchNum}</span>
                    <span className={`text-xs ${t.textFaint} block truncate`}>{match.tournamentName.split(' ')[0]}</span>
                  </div>
                  
                  {/* Robot images */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <RobotAvatar name={match.competitorA} robotImages={robotImages} size="md" colorClass="bg-blue-100 text-blue-600" />
                    <RobotAvatar name={match.competitorB} robotImages={robotImages} size="md" colorClass="bg-red-100 text-red-600" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${match.winner === match.competitorA ? t.winnerText : t.text} text-sm truncate`}>
                        <RobotLink 
                          name={match.competitorA} 
                          weightClass={weightClass} 
                          isWinner={match.winner === match.competitorA}
                          theme={theme} 
                        />
                      </span>
                      <span className={`text-xs ${t.textFaint}`}>vs</span>
                      <span className={`font-semibold ${match.winner === match.competitorB ? t.winnerText : t.text} text-sm truncate`}>
                        <RobotLink 
                          name={match.competitorB} 
                          weightClass={weightClass} 
                          isWinner={match.winner === match.competitorB}
                          theme={theme} 
                        />
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  {match.completedAt && (
                    <span className={`text-xs ${t.textFaint} hidden sm:block`}>
                      {formatTime(match.completedAt)}
                    </span>
                  )}
                  {isKnockout(match) ? (
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
              {/* Mobile timestamp - show below on small screens */}
              {match.completedAt && (
                <p className={`text-xs ${t.textFaint} mt-1 sm:hidden`}>
                  {formatTime(match.completedAt)}
                </p>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Judge Scoring View
const JudgeScoringView = ({ tournaments, currentUser, onScoreSubmitted, onStartMatch, onEndMatch, onResetRepairTimer, scoringCriteria, robotImages, activeMatches, repairResets, eventId, theme }) => {
  const t = themes[theme];
  const [now, setNow] = useState(new Date());
  
  // Update time every second for repair status
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Use provided criteria or default
  const criteria = scoringCriteria || DEFAULT_SCORING_CRITERIA;
  const totalMaxPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  
  // Get all completed matches to track when robots last fought
  const allCompletedMatches = tournaments.flatMap(tourney => 
    (tourney.matches || []).filter(m => m.status === 'completed')
  );
  
  // Build a map of robot name -> last fight end time
  const robotLastFight = {};
  allCompletedMatches.forEach(match => {
    if (match.completedAt) {
      const time = new Date(match.completedAt).getTime();
      if (match.competitorA) {
        if (!robotLastFight[match.competitorA] || time > robotLastFight[match.competitorA]) {
          robotLastFight[match.competitorA] = time;
        }
      }
      if (match.competitorB) {
        if (!robotLastFight[match.competitorB] || time > robotLastFight[match.competitorB]) {
          robotLastFight[match.competitorB] = time;
        }
      }
    }
  });
  
  // Calculate repair time remaining (20 minutes = 1200000ms)
  const REPAIR_TIME_MS = 20 * 60 * 1000;
  
  const getRepairStatus = (robotName) => {
    // Check for manual reset first (case-insensitive)
    let resetTime = null;
    if (repairResets) {
      for (const [key, value] of Object.entries(repairResets)) {
        if (key.toLowerCase() === robotName?.toLowerCase()) {
          resetTime = new Date(value).getTime();
          break;
        }
      }
    }
    
    const lastFight = robotLastFight[robotName];
    
    // Use the more recent of: last fight or manual reset
    const effectiveStart = Math.max(lastFight || 0, resetTime || 0);
    
    if (!effectiveStart) return { ready: true, remaining: 0 };
    
    const elapsed = now.getTime() - effectiveStart;
    const remaining = REPAIR_TIME_MS - elapsed;
    
    return {
      ready: remaining <= 0,
      remaining: Math.max(0, remaining)
    };
  };
  
  // Check if both robots in a match are ready
  const isMatchReady = (match) => {
    const statusA = getRepairStatus(match.competitorA);
    const statusB = getRepairStatus(match.competitorB);
    return statusA.ready && statusB.ready;
  };
  
  // Helper to check if a match is currently fighting
  const isMatchFighting = (match) => {
    const activeMatch = activeMatches?.[match.tournamentUrl];
    return activeMatch?.matchId === String(match.challongeId);
  };
  
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
  const [judgeStatus, setJudgeStatus] = useState({ judges: {}, judgeCount: 0 });
  
  // Poll for judge status every 3 seconds
  useEffect(() => {
    if (!selectedMatch) return;

    const fetchJudgeStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/matches/${selectedMatch.challongeId}/scores/details?tournamentId=${selectedMatch.tournamentUrl || ''}`);
        if (response.ok) {
          const data = await response.json();
          setJudgeStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch judge status:', err);
      }
    };

    fetchJudgeStatus();
    const interval = setInterval(fetchJudgeStatus, 3000);
    return () => clearInterval(interval);
  }, [selectedMatch]);
  
  // Calculate totals dynamically
  const totalA = criteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);
  const totalB = totalMaxPoints - totalA;
  
  // Get submitted judges info
  const submittedJudges = Object.keys(judgeStatus.judges || {});
  const waitingOn = ['judge_1', 'judge_2', 'judge_3'].filter(j => !submittedJudges.includes(j));

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

  // Get status indicator for dropdown
  const getMatchIndicator = (match) => {
    if (isMatchFighting(match)) return '🟡'; // Yellow for NOW FIGHTING
    if (isMatchReady(match)) return '🟢'; // Green if both robots ready
    return '🔴'; // Red if either robot still repairing
  };

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
                  {getMatchIndicator(match)} M{match.matchNum}: {match.competitorA} vs {match.competitorB}
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
              <StatusBadge status={selectedMatch.status} winMethod={selectedMatch.winMethod} scores={selectedMatch.scores} theme={theme} />
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs ${t.textFaint}`}>Judges ({submittedJudges.length}/3)</span>
            <div className="flex gap-1 justify-end mt-1">
              {[1, 2, 3].map(num => {
                const judgeId = `judge_${num}`;
                const hasJudgeSubmitted = submittedJudges.includes(judgeId);
                const isCurrentJudge = currentUser?.id === judgeId;
                return (
                  <div 
                    key={num} 
                    className={`w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      hasJudgeSubmitted 
                        ? 'bg-green-500 text-white' 
                        : isCurrentJudge 
                          ? 'bg-amber-100 text-amber-700 border-2 border-amber-400'
                          : `${t.tableBg} ${t.textMuted}`
                    }`}
                    title={`Judge ${num}${hasJudgeSubmitted ? ' (submitted)' : isCurrentJudge ? ' (you)' : ''}`}
                  >
                    {hasJudgeSubmitted ? '✓' : num}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Start/End Match Button */}
        {eventId && (
          <div className="mt-3 mb-3">
            {isMatchFighting(selectedMatch) ? (
              <button
                onClick={() => onEndMatch && onEndMatch(selectedMatch.tournamentUrl)}
                className="w-full py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white"></span>
                End Match (Stop Fighting)
              </button>
            ) : (
              <button
                onClick={() => onStartMatch && onStartMatch(selectedMatch.tournamentUrl, selectedMatch.challongeId)}
                className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                Start Match (Now Fighting)
              </button>
            )}
          </div>
        )}

        {/* Repair Timer Reset */}
        {eventId && onResetRepairTimer && (
          <div className={`mb-3 p-3 rounded-lg ${t.tableBg}`}>
            <p className={`text-xs font-semibold ${t.textFaint} uppercase tracking-wide mb-2`}>Reset Repair Timer (20 min)</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onResetRepairTimer(selectedMatch.competitorA)}
                className={`py-2 px-3 rounded-lg border ${t.cardBorder} ${t.text} text-xs font-medium ${t.hoverBg} transition-colors flex items-center justify-center gap-1`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {selectedMatch.competitorA}
              </button>
              <button
                onClick={() => onResetRepairTimer(selectedMatch.competitorB)}
                className={`py-2 px-3 rounded-lg border ${t.cardBorder} ${t.text} text-xs font-medium ${t.hoverBg} transition-colors flex items-center justify-center gap-1`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {selectedMatch.competitorB}
              </button>
            </div>
          </div>
        )}
        
        {/* Waiting indicator */}
        {waitingOn.length > 0 && waitingOn.length < 3 && !hasSubmitted && (
          <div className={`mb-4 p-2 rounded-lg ${t.tableBg} flex items-center justify-center gap-2`}>
            <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500"></div>
            <span className={`text-xs sm:text-sm ${t.textMuted}`}>
              Waiting on {waitingOn.map(j => `Judge ${j.split('_')[1]}`).join(', ')}
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-3 items-center gap-2 sm:gap-4">
          <div className="text-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-lg overflow-hidden mb-1 sm:mb-2">
              {getRobotImage(robotImages, selectedMatch.competitorA) ? (
                <img 
                  src={getRobotImage(robotImages, selectedMatch.competitorA)} 
                  alt={selectedMatch.competitorA}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full bg-blue-100 border border-blue-200 items-center justify-center ${getRobotImage(robotImages, selectedMatch.competitorA) ? 'hidden' : 'flex'}`}>
                <span className="text-3xl sm:text-4xl font-bold text-blue-600">{selectedMatch.competitorA?.[0] || '?'}</span>
              </div>
            </div>
            <p className={`font-semibold ${t.text} text-xs sm:text-sm truncate px-1`}>{selectedMatch.competitorA || 'TBD'}</p>
            <p className={`text-xl sm:text-2xl font-bold ${t.blueText} mt-1`}>{isKO ? '—' : totalA}</p>
          </div>
          <div className="text-center">
            <span className={`${t.textFaint} font-medium text-sm`}>vs</span>
          </div>
          <div className="text-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-lg overflow-hidden mb-1 sm:mb-2">
              {getRobotImage(robotImages, selectedMatch.competitorB) ? (
                <img 
                  src={getRobotImage(robotImages, selectedMatch.competitorB)} 
                  alt={selectedMatch.competitorB}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full bg-red-100 border border-red-200 items-center justify-center ${getRobotImage(robotImages, selectedMatch.competitorB) ? 'hidden' : 'flex'}`}>
                <span className="text-3xl sm:text-4xl font-bold text-red-600">{selectedMatch.competitorB?.[0] || '?'}</span>
              </div>
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
const AdminDashboardView = ({ eventId, eventName, tournamentUrls, tournaments, scoringCriteria, robotImages, discordWebhookUrl, onEventIdChange, onEventNameChange, onAddTournament, onRemoveTournament, onRefreshAll, onSaveToServer, onCopyLink, onScoringCriteriaChange, onRobotImagesChange, onDiscordWebhookUrlChange, theme }) => {
  const t = themes[theme];
  const [selectedTab, setSelectedTab] = useState('settings');
  const [newTournamentUrl, setNewTournamentUrl] = useState('');
  const [newRceUrl, setNewRceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [localEventId, setLocalEventId] = useState(eventId);
  const [localEventName, setLocalEventName] = useState(eventName);
  const [localCriteria, setLocalCriteria] = useState(scoringCriteria);
  const [localRobotImages, setLocalRobotImages] = useState(robotImages || {});
  const [localDiscordWebhookUrl, setLocalDiscordWebhookUrl] = useState(discordWebhookUrl || '');
  
  useEffect(() => {
    setLocalEventId(eventId);
    setLocalEventName(eventName);
    setLocalCriteria(scoringCriteria);
    setLocalRobotImages(robotImages || {});
    setLocalDiscordWebhookUrl(discordWebhookUrl || '');
  }, [eventId, eventName, scoringCriteria, robotImages, discordWebhookUrl]);

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

  const handleScrapeRCE = async () => {
    if (!newRceUrl.trim()) return;
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      const result = await api.scrapeRCE(newRceUrl.trim());
      if (result.success && result.robots) {
        // Merge new robot images with existing ones
        const newImages = { ...localRobotImages };
        let addedCount = 0;
        result.robots.forEach(robot => {
          if (robot.imageUrl && robot.name) {
            // Normalize the name for matching (lowercase, trimmed)
            const normalizedName = robot.name.trim();
            newImages[normalizedName] = robot.imageUrl;
            addedCount++;
          }
        });
        setLocalRobotImages(newImages);
        onRobotImagesChange(newImages);
        setSyncStatus({ success: true, message: `Found ${result.robotCount} robots, ${addedCount} with images!` });
        setNewRceUrl('');
      }
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearRobotImages = () => {
    setLocalRobotImages({});
    onRobotImagesChange({});
    setSyncStatus({ success: true, message: 'Robot images cleared' });
  };

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
      onDiscordWebhookUrlChange(localDiscordWebhookUrl.trim());
      await onSaveToServer(localEventId.trim(), localEventName.trim(), localDiscordWebhookUrl.trim());
      setSyncStatus({ success: true, message: 'Event saved! Share the link with judges.' });
    } catch (err) {
      setSyncStatus({ success: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!localEventId.trim()) {
      setSyncStatus({ success: false, message: 'Save the event first before testing Discord' });
      return;
    }
    if (!localDiscordWebhookUrl.trim()) {
      setSyncStatus({ success: false, message: 'Enter a Discord webhook URL first' });
      return;
    }
    
    setIsLoading(true);
    setSyncStatus(null);
    
    try {
      // First save the event to ensure webhook URL is stored
      await onSaveToServer(localEventId.trim(), localEventName.trim(), localDiscordWebhookUrl.trim());
      // Then test the webhook
      await api.testDiscordWebhook(localEventId.trim());
      setSyncStatus({ success: true, message: '✓ Test message sent to Discord!' });
    } catch (err) {
      setSyncStatus({ success: false, message: `Discord test failed: ${err.message}` });
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
      <div className={`${t.card} rounded-xl border ${t.cardBorder} p-1 inline-flex gap-1 flex-wrap`}>
        {['settings', 'tournaments', 'images', 'discord', 'share'].map(tab => (
          <button key={tab} onClick={() => setSelectedTab(tab)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              selectedTab === tab ? 'bg-gray-900 text-white' : `${t.textMuted} hover:${t.text}`
            }`}>
            {tab === 'images' ? 'Robot Images' : tab === 'discord' ? '🔔 Discord' : tab}
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

      {selectedTab === 'images' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <h3 className={`font-bold ${t.text}`}>Robot Images</h3>
          
          <div className={`${t.tableBg} rounded-lg p-4`}>
            <p className={`text-sm ${t.textMuted}`}>
              Import robot photos from RobotCombatEvents registration pages. Images will display in brackets, completed matches, and judge scoring.
            </p>
          </div>

          {/* RCE URL Input */}
          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>RobotCombatEvents Registration URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newRceUrl}
                onChange={(e) => setNewRceUrl(e.target.value)}
                placeholder="https://www.robotcombatevents.com/events/XXXX/competitions/YYYY"
                className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm`}
              />
              <button 
                onClick={handleScrapeRCE}
                disabled={isLoading || !newRceUrl.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : '📷 Import'}
              </button>
            </div>
            <p className={`text-xs ${t.textFaint} mt-1`}>
              Paste the URL of a competition registration page to import robot photos
            </p>
          </div>

          {/* Current Images Summary */}
          <div className={`pt-4 border-t ${t.divider}`}>
            <div className="flex justify-between items-center mb-3">
              <p className={`text-sm font-medium ${t.textMuted}`}>
                Loaded Images ({Object.keys(localRobotImages).length})
              </p>
              {Object.keys(localRobotImages).length > 0 && (
                <button
                  onClick={handleClearRobotImages}
                  className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {Object.keys(localRobotImages).length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto">
                {Object.entries(localRobotImages).map(([name, url]) => (
                  <div key={name} className="text-center">
                    <div className={`w-12 h-12 mx-auto rounded-lg ${t.tableBg} overflow-hidden`}>
                      <img 
                        src={url} 
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <p className={`text-xs ${t.textFaint} mt-1 truncate`} title={name}>{name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${t.tableBg} rounded-lg p-6 text-center`}>
                <p className={t.textMuted}>No robot images loaded yet</p>
                <p className={`text-xs ${t.textFaint} mt-1`}>Import from RobotCombatEvents above</p>
              </div>
            )}
          </div>

          <p className={`text-xs ${t.textFaint}`}>
            Remember to save the event (Share tab) to persist robot images.
          </p>
        </div>
      )}

      {selectedTab === 'discord' && (
        <div className={`${t.card} rounded-xl border ${t.cardBorder} p-5 space-y-5`}>
          <h3 className={`font-bold ${t.text}`}>Discord Integration</h3>
          
          <div className={`${t.tableBg} rounded-lg p-4`}>
            <p className={`text-sm ${t.textMuted}`}>
              Get real-time match results posted to your Discord server! When a match is finalized by all 3 judges, a notification will be automatically sent.
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.textMuted} mb-1`}>Discord Webhook URL</label>
            <input 
              type="text" 
              value={localDiscordWebhookUrl}
              onChange={(e) => setLocalDiscordWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className={`w-full px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`} 
            />
            <p className={`text-xs ${t.textFaint} mt-1`}>
              Create a webhook in your Discord server: Server Settings → Integrations → Webhooks → New Webhook
            </p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleTestDiscord}
              disabled={isLoading || !localDiscordWebhookUrl.trim() || !localEventId.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Testing...' : '🧪 Test Webhook'}
            </button>
            <button 
              onClick={handleSaveEvent}
              disabled={isLoading || !localEventId.trim()}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>

          <div className={`pt-4 border-t ${t.divider}`}>
            <p className={`text-sm font-medium ${t.textMuted} mb-2`}>How it works</p>
            <div className="space-y-2">
              <div className={`${t.tableBg} rounded-lg p-3 flex items-start gap-3`}>
                <span className="text-lg">1️⃣</span>
                <div>
                  <p className={`text-sm ${t.text}`}>Create a webhook in Discord</p>
                  <p className={`text-xs ${t.textFaint}`}>Server Settings → Integrations → Webhooks</p>
                </div>
              </div>
              <div className={`${t.tableBg} rounded-lg p-3 flex items-start gap-3`}>
                <span className="text-lg">2️⃣</span>
                <div>
                  <p className={`text-sm ${t.text}`}>Paste the webhook URL above</p>
                  <p className={`text-xs ${t.textFaint}`}>Then click "Test Webhook" to verify</p>
                </div>
              </div>
              <div className={`${t.tableBg} rounded-lg p-3 flex items-start gap-3`}>
                <span className="text-lg">3️⃣</span>
                <div>
                  <p className={`text-sm ${t.text}`}>Match results posted automatically</p>
                  <p className={`text-xs ${t.textFaint}`}>Winner, loser, score, and KO/Decision status</p>
                </div>
              </div>
            </div>
          </div>

          {localDiscordWebhookUrl && (
            <div className={`${t.tableBg} rounded-lg p-3`}>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className={`text-sm ${t.text}`}>Webhook configured</span>
              </div>
              <p className={`text-xs ${t.textFaint} mt-1`}>
                Match results will be posted to Discord when finalized
              </p>
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

              {/* Spectator Link - Subdomain */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${t.textMuted}`}>👀 Spectator Link (Recommended)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={`https://brackets.socalattackrobots.com/?event=${encodeURIComponent(localEventId)}`}
                    readOnly
                    className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm`}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://brackets.socalattackrobots.com/?event=${encodeURIComponent(localEventId)}`);
                      setSyncStatus({ success: true, message: 'Spectator link copied!' });
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className={`text-xs ${t.textFaint}`}>
                  For competitors & audience - separate domain with no access to Judge/Admin
                </p>
              </div>

              {/* Legacy Spectator Link */}
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${t.textFaint}`}>👀 Spectator Link (Legacy)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={`${shareableLink}&spectator=true`}
                    readOnly
                    className={`flex-1 px-3 py-2 rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text} text-sm opacity-60`}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${shareableLink}&spectator=true`);
                      setSyncStatus({ success: true, message: 'Legacy spectator link copied!' });
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    📋 Copy
                  </button>
                </div>
                <p className={`text-xs ${t.textFaint}`}>
                  Alternate link using URL parameter (less secure)
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
  const [robotImages, setRobotImages] = useState({});
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [activeMatches, setActiveMatches] = useState({});
  const [repairResets, setRepairResets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventLoaded, setEventLoaded] = useState(false);
  
  // Check if viewing via shared link (hides admin by default)
  // But allow admin access with ?admin=true parameter
  const hasAdminOverride = getUrlParam('admin') === 'true';
  const isSharedView = Boolean(getUrlParam('event')) && !hasAdminOverride;
  
  // Check if spectator mode - either by URL param OR by hostname
  // brackets.socalattackrobots.com = always spectator mode
  const hostname = window.location.hostname;
  const isSpectatorDomain = hostname.startsWith('brackets.') || hostname.startsWith('spectator.');
  const isSpectatorView = isSpectatorDomain || getUrlParam('spectator') === 'true' || getUrlParam('view') === 'spectator';
  
  const theme = darkMode ? 'dark' : 'light';
  const t = themes[theme];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, JSON.stringify(darkMode));
  }, [darkMode]);

  // Load active matches and repair resets when event is loaded
  const loadActiveMatches = useCallback(async () => {
    if (!eventId) return;
    try {
      const [matches, resets] = await Promise.all([
        api.getActiveMatches(eventId),
        api.getRepairResets(eventId)
      ]);
      setActiveMatches(matches);
      setRepairResets(resets);
    } catch (err) {
      console.error('Failed to load active matches:', err);
    }
  }, [eventId]);

  // Poll for active matches every 5 seconds on spectator site
  useEffect(() => {
    if (!eventId) return;
    
    loadActiveMatches();
    
    // Poll more frequently on spectator site for real-time updates
    const interval = setInterval(loadActiveMatches, isSpectatorDomain ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [eventId, loadActiveMatches, isSpectatorDomain]);

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
            setRobotImages(eventData.robotImages || {});
            setDiscordWebhookUrl(eventData.discordWebhookUrl || '');
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

  const saveToServer = async (id, name, webhookUrl) => {
    await api.saveEvent(id, name, tournamentUrls, scoringCriteria, robotImages, webhookUrl || discordWebhookUrl);
    setUrlParam('event', id);
  };

  const copyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(eventId)}`;
    navigator.clipboard.writeText(link);
  };

  const handleScoreSubmitted = useCallback((result) => {
    // When match is finalized, clear the active match and refresh
    if (result.finalized) {
      loadActiveMatches();
    }
    setTimeout(() => loadAllTournaments(), 1000);
  }, [loadAllTournaments, loadActiveMatches]);

  // Start a match (mark as "Now Fighting")
  const handleStartMatch = async (tournamentId, matchId) => {
    if (!eventId) return;
    try {
      await api.setActiveMatch(eventId, tournamentId, String(matchId));
      await loadActiveMatches();
    } catch (err) {
      console.error('Failed to start match:', err);
    }
  };

  // End a match (clear "Now Fighting" status)
  const handleEndMatch = async (tournamentId) => {
    if (!eventId) return;
    try {
      await api.clearActiveMatch(eventId, tournamentId);
      await loadActiveMatches();
    } catch (err) {
      console.error('Failed to end match:', err);
    }
  };

  // Reset a robot's repair timer (restart 20 min countdown)
  const handleResetRepairTimer = async (robotName) => {
    if (!eventId) return;
    try {
      await api.resetRepairTimer(eventId, robotName);
      await loadActiveMatches(); // This also loads repair resets
    } catch (err) {
      console.error('Failed to reset repair timer:', err);
    }
  };

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
      {/* Header - simplified on spectator domain */}
      {isSpectatorDomain ? (
        <header className={`${t.headerBg} border-b ${t.divider} sticky top-0 z-40`}>
          <div className="max-w-full mx-auto px-4">
            {/* Event name on its own line */}
            {eventName && (
              <div className={`text-center py-2 border-b ${t.divider}`}>
                <h1 className={`font-bold ${t.text} text-lg`}>{eventName}</h1>
              </div>
            )}
            {/* Navigation row */}
            <div className="flex justify-between items-center h-10">
              {/* Nav tabs */}
              <nav className="flex items-center gap-2">
                <button onClick={() => setView('public')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'public' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Bracket
                </button>
                <button onClick={() => setView('upcoming')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'upcoming' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Upcoming
                </button>
                <button onClick={() => setView('completed')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'completed' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Completed
                </button>
              </nav>
              
              {/* Dark mode toggle */}
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
        </header>
      ) : (
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
              {!isSpectatorDomain && (
                <button onClick={() => handleLogin('judge')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'judge' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Judge
                </button>
              )}
              {!isSharedView && !isSpectatorDomain && (
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
                Completed
              </button>
              {!isSpectatorDomain && (
                <button onClick={() => handleLogin('judge')}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'judge' ? `${t.activeBg} ${t.text}` : `${t.textMuted}`
                  }`}>
                  Judge
                </button>
              )}
              {!isSharedView && !isSpectatorDomain && (
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
      )}
      
      {/* Event Info Bar - Hide on spectator domain, show elsewhere */}
      {!isSpectatorDomain && (
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
      )}
      
      {/* Main content - wider on spectator domain for TV display */}
      <main className={`${isSpectatorDomain ? 'max-w-full px-4' : 'max-w-6xl px-3 sm:px-4'} mx-auto py-4 sm:py-6`}>
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
            robotImages={robotImages}
            activeMatches={activeMatches}
            repairResets={repairResets}
            theme={theme} 
          />
        )}

        {!isLoading && view === 'upcoming' && (
          <UpcomingMatchesView 
            tournaments={tournaments} 
            robotImages={robotImages}
            activeMatches={activeMatches}
            repairResets={repairResets}
            theme={theme} 
          />
        )}

        {!isLoading && view === 'completed' && (
          <CompletedMatchesView 
            tournaments={tournaments} 
            onMatchClick={setSelectedMatch} 
            robotImages={robotImages}
            theme={theme} 
          />
        )}
        
        {!isLoading && view === 'judge' && (
          <JudgeScoringView 
            tournaments={tournaments}
            currentUser={currentUser}
            onScoreSubmitted={handleScoreSubmitted}
            onStartMatch={handleStartMatch}
            onEndMatch={handleEndMatch}
            onResetRepairTimer={handleResetRepairTimer}
            scoringCriteria={scoringCriteria}
            robotImages={robotImages}
            activeMatches={activeMatches}
            repairResets={repairResets}
            eventId={eventId}
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
            robotImages={robotImages}
            discordWebhookUrl={discordWebhookUrl}
            onEventIdChange={setEventId}
            onEventNameChange={setEventName}
            onAddTournament={addTournament}
            onRemoveTournament={removeTournament}
            onRefreshAll={loadAllTournaments}
            onSaveToServer={saveToServer}
            onCopyLink={copyLink}
            onScoringCriteriaChange={setScoringCriteria}
            onRobotImagesChange={setRobotImages}
            onDiscordWebhookUrlChange={setDiscordWebhookUrl}
            theme={theme} 
          />
        )}
      </main>
      
      {/* Footer - hide on spectator domain */}
      {!isSpectatorDomain && (
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
      )}

      {selectedMatch && (
        <MatchDetailPopup 
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)} 
          robotImages={robotImages}
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
