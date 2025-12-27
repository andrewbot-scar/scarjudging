// server/index.js
// Backend server for SCAR Tournament Judge Portal
// Handles Challonge API integration securely

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Challonge API configuration
const CHALLONGE_API_KEY = process.env.CHALLONGE_API_KEY;
const CHALLONGE_USERNAME = process.env.CHALLONGE_USERNAME;
const CHALLONGE_BASE_URL = 'https://api.challonge.com/v1';

// Helper function to make Challonge API requests
async function challongeRequest(endpoint, method = 'GET', body = null) {
  const url = `${CHALLONGE_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Add API key as query parameter
  const separator = endpoint.includes('?') ? '&' : '?';
  const urlWithKey = `${url}${separator}api_key=${CHALLONGE_API_KEY}`;

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(urlWithKey, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Challonge API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================
// TOURNAMENT ENDPOINTS
// ============================================

// GET /api/tournaments - List all tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const data = await challongeRequest('/tournaments.json');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tournaments/:id - Get tournament details with participants and matches
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await challongeRequest(
      `/tournaments/${id}.json?include_participants=1&include_matches=1`
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tournaments/:id/participants - Get tournament participants
app.get('/api/tournaments/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await challongeRequest(`/tournaments/${id}/participants.json`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tournaments/:id/matches - Get tournament matches
app.get('/api/tournaments/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await challongeRequest(`/tournaments/${id}/matches.json`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MATCH ENDPOINTS
// ============================================

// GET /api/tournaments/:tournamentId/matches/:matchId - Get single match
app.get('/api/tournaments/:tournamentId/matches/:matchId', async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const data = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}.json`
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/tournaments/:tournamentId/matches/:matchId - Update match (report scores)
// This is the key endpoint for advancing the tournament
app.put('/api/tournaments/:tournamentId/matches/:matchId', async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winner_id, scores_csv } = req.body;

    // Validate required fields
    if (!winner_id) {
      return res.status(400).json({ error: 'winner_id is required' });
    }

    const matchData = {
      match: {
        winner_id: winner_id,
        scores_csv: scores_csv || '1-0', // Default score if not provided
      },
    };

    const data = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}.json`,
      'PUT',
      matchData
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tournaments/:tournamentId/matches/:matchId/reopen - Reopen a match
app.post('/api/tournaments/:tournamentId/matches/:matchId/reopen', async (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const data = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}/reopen.json`,
      'POST'
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// JUDGE SCORING ENDPOINTS (Local Logic)
// ============================================

// In-memory storage for judge scores (use a database in production)
const judgeScores = {};

// POST /api/matches/:matchId/scores - Submit judge scores
app.post('/api/matches/:matchId/scores', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { judgeId, tournamentId, competitorAId, competitorBId, scores, isKO, koWinnerId } = req.body;

    // Initialize match scores if not exists
    if (!judgeScores[matchId]) {
      judgeScores[matchId] = {
        tournamentId,
        competitorAId,
        competitorBId,
        judges: {},
        finalized: false,
      };
    }

    // Store judge's scores
    judgeScores[matchId].judges[judgeId] = {
      scores, // { aggression: X, damage: X, control: X } for competitor A
      isKO,
      koWinnerId,
      submittedAt: new Date().toISOString(),
    };

    // Check if all 3 judges have submitted
    const judgeCount = Object.keys(judgeScores[matchId].judges).length;
    
    if (judgeCount >= 3 && !judgeScores[matchId].finalized) {
      // Calculate final result
      const result = calculateMatchResult(judgeScores[matchId]);
      
      // Update Challonge with the result
      const challongeResult = await reportToChallonge(
        judgeScores[matchId].tournamentId,
        matchId,
        result.winnerId,
        result.scoreA,
        result.scoreB
      );

      judgeScores[matchId].finalized = true;
      judgeScores[matchId].result = result;

      res.json({
        success: true,
        judgeCount,
        finalized: true,
        result,
        challongeResponse: challongeResult,
      });
    } else {
      res.json({
        success: true,
        judgeCount,
        finalized: false,
        message: `Waiting for ${3 - judgeCount} more judge(s)`,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matches/:matchId/scores - Get current judge scores for a match
app.get('/api/matches/:matchId/scores', (req, res) => {
  const { matchId } = req.params;
  const scores = judgeScores[matchId] || { judges: {} };
  
  res.json({
    matchId,
    judgeCount: Object.keys(scores.judges).length,
    finalized: scores.finalized || false,
    result: scores.result || null,
  });
});

// DELETE /api/matches/:matchId/scores/:judgeId - Allow judge to edit (delete and resubmit)
app.delete('/api/matches/:matchId/scores/:judgeId', (req, res) => {
  const { matchId, judgeId } = req.params;
  
  if (judgeScores[matchId]?.finalized) {
    return res.status(400).json({ error: 'Match already finalized' });
  }

  if (judgeScores[matchId]?.judges[judgeId]) {
    delete judgeScores[matchId].judges[judgeId];
    res.json({ success: true, message: 'Score deleted, you can resubmit' });
  } else {
    res.status(404).json({ error: 'Score not found' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateMatchResult(matchData) {
  const judges = Object.values(matchData.judges);
  
  // Check for KO majority (2/3 judges)
  const koVotes = {};
  judges.forEach(judge => {
    if (judge.isKO && judge.koWinnerId) {
      koVotes[judge.koWinnerId] = (koVotes[judge.koWinnerId] || 0) + 1;
    }
  });

  // Check if any competitor has 2+ KO votes
  for (const [winnerId, votes] of Object.entries(koVotes)) {
    if (votes >= 2) {
      return {
        winnerId: parseInt(winnerId),
        winMethod: 'ko',
        scoreA: 0,
        scoreB: 0,
        koVotes: votes,
      };
    }
  }

  // Calculate point totals
  let totalA = 0;
  let totalB = 0;

  judges.forEach(judge => {
    if (judge.scores) {
      // Competitor A's scores
      const judgeScoreA = judge.scores.aggression + judge.scores.damage + judge.scores.control;
      // Competitor B's scores (11 - A's total, since points are split)
      const judgeScoreB = 11 - judgeScoreA;
      
      totalA += judgeScoreA;
      totalB += judgeScoreB;
    }
  });

  // Determine winner by points
  const winnerId = totalA > totalB ? matchData.competitorAId : matchData.competitorBId;

  return {
    winnerId,
    winMethod: 'points',
    scoreA: totalA,
    scoreB: totalB,
  };
}

async function reportToChallonge(tournamentId, matchId, winnerId, scoreA, scoreB) {
  try {
    const matchData = {
      match: {
        winner_id: winnerId,
        scores_csv: `${scoreA}-${scoreB}`,
      },
    };

    const result = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}.json`,
      'PUT',
      matchData
    );

    return result;
  } catch (error) {
    console.error('Failed to report to Challonge:', error);
    throw error;
  }
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Challonge API integration ${CHALLONGE_API_KEY ? 'configured' : 'NOT configured - set CHALLONGE_API_KEY'}`);
});

module.exports = app;
