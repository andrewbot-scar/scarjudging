// server/index.js
// Backend server for SCAR Tournament Judge Portal
// Handles Challonge API integration securely

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// DATABASE CONFIGURATION
// ============================================

// PostgreSQL connection pool
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

// Initialize database tables
async function initDatabase() {
  if (!pool) {
    console.log('No DATABASE_URL found - using in-memory storage (data will not persist)');
    return;
  }

  try {
    // Create events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        event_id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tournaments JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create judge_scores table for persistent score storage
    await pool.query(`
      CREATE TABLE IF NOT EXISTS judge_scores (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(255) NOT NULL,
        tournament_id VARCHAR(255) NOT NULL,
        competitor_a_id INTEGER,
        competitor_b_id INTEGER,
        judges JSONB NOT NULL DEFAULT '{}',
        finalized BOOLEAN DEFAULT FALSE,
        result JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(match_id)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

// Initialize database on startup
initDatabase();

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
// IN-MEMORY FALLBACK STORAGE
// ============================================

// Fallback in-memory storage (used when no database is configured)
const memoryStorage = {
  events: {},
  judgeScores: {},
};

// ============================================
// EVENT STORAGE (Database with fallback)
// ============================================

// POST /api/events - Create or update an event
app.post('/api/events', async (req, res) => {
  try {
    const { eventId, name, tournaments } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    if (!tournaments || !Array.isArray(tournaments)) {
      return res.status(400).json({ error: 'tournaments must be an array' });
    }

    const now = new Date().toISOString();

    if (pool) {
      // Use PostgreSQL
      await pool.query(`
        INSERT INTO events (event_id, name, tournaments, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id) 
        DO UPDATE SET name = $2, tournaments = $3, updated_at = $4
      `, [eventId, name || eventId, JSON.stringify(tournaments), now]);

      console.log(`Event saved to database: ${eventId} with ${tournaments.length} tournaments`);
    } else {
      // Fallback to in-memory
      memoryStorage.events[eventId] = {
        name: name || eventId,
        tournaments,
        createdAt: memoryStorage.events[eventId]?.createdAt || now,
        updatedAt: now,
      };
      console.log(`Event saved to memory: ${eventId} with ${tournaments.length} tournaments`);
    }
    
    res.json({
      success: true,
      event: {
        eventId,
        name: name || eventId,
        tournaments,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error('Error saving event:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:eventId - Get an event's configuration
app.get('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    if (pool) {
      // Use PostgreSQL
      const result = await pool.query(
        'SELECT * FROM events WHERE event_id = $1',
        [eventId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const row = result.rows[0];
      res.json({
        eventId: row.event_id,
        name: row.name,
        tournaments: row.tournaments,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } else {
      // Fallback to in-memory
      if (!memoryStorage.events[eventId]) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({
        eventId,
        ...memoryStorage.events[eventId],
      });
    }
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events - List all events
app.get('/api/events', async (req, res) => {
  try {
    if (pool) {
      // Use PostgreSQL
      const result = await pool.query('SELECT * FROM events ORDER BY updated_at DESC');
      const events = result.rows.map(row => ({
        eventId: row.event_id,
        name: row.name,
        tournaments: row.tournaments,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      res.json(events);
    } else {
      // Fallback to in-memory
      const eventList = Object.entries(memoryStorage.events).map(([eventId, data]) => ({
        eventId,
        ...data,
      }));
      res.json(eventList);
    }
  } catch (error) {
    console.error('Error listing events:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/events/:eventId - Delete an event
app.delete('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    if (pool) {
      // Use PostgreSQL
      const result = await pool.query(
        'DELETE FROM events WHERE event_id = $1 RETURNING *',
        [eventId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      console.log(`Event deleted from database: ${eventId}`);
    } else {
      // Fallback to in-memory
      if (!memoryStorage.events[eventId]) {
        return res.status(404).json({ error: 'Event not found' });
      }
      delete memoryStorage.events[eventId];
      console.log(`Event deleted from memory: ${eventId}`);
    }

    res.json({ success: true, message: `Event ${eventId} deleted` });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
});

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
// JUDGE SCORING ENDPOINTS (Database with fallback)
// ============================================

// Helper function to get judge scores from storage
async function getJudgeScoresFromStorage(matchId) {
  if (pool) {
    const result = await pool.query(
      'SELECT * FROM judge_scores WHERE match_id = $1',
      [matchId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        tournamentId: row.tournament_id,
        competitorAId: row.competitor_a_id,
        competitorBId: row.competitor_b_id,
        judges: row.judges,
        finalized: row.finalized,
        result: row.result,
      };
    }
    return null;
  } else {
    return memoryStorage.judgeScores[matchId] || null;
  }
}

// Helper function to save judge scores to storage
async function saveJudgeScoresToStorage(matchId, data) {
  if (pool) {
    await pool.query(`
      INSERT INTO judge_scores (match_id, tournament_id, competitor_a_id, competitor_b_id, judges, finalized, result, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (match_id) 
      DO UPDATE SET 
        tournament_id = $2,
        competitor_a_id = $3,
        competitor_b_id = $4,
        judges = $5,
        finalized = $6,
        result = $7,
        updated_at = CURRENT_TIMESTAMP
    `, [
      matchId,
      data.tournamentId,
      data.competitorAId,
      data.competitorBId,
      JSON.stringify(data.judges),
      data.finalized,
      data.result ? JSON.stringify(data.result) : null,
    ]);
  } else {
    memoryStorage.judgeScores[matchId] = data;
  }
}

// POST /api/matches/:matchId/scores - Submit judge scores
app.post('/api/matches/:matchId/scores', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { judgeId, tournamentId, competitorAId, competitorBId, scores, isKO, koWinnerId } = req.body;

    // Get existing scores or initialize
    let matchScores = await getJudgeScoresFromStorage(matchId);
    
    if (!matchScores) {
      matchScores = {
        tournamentId,
        competitorAId,
        competitorBId,
        judges: {},
        finalized: false,
        result: null,
      };
    }

    // Store judge's scores
    matchScores.judges[judgeId] = {
      scores, // { aggression: X, damage: X, control: X } for competitor A
      isKO,
      koWinnerId,
      submittedAt: new Date().toISOString(),
    };

    // Check if all 3 judges have submitted
    const judgeCount = Object.keys(matchScores.judges).length;
    
    if (judgeCount >= 3 && !matchScores.finalized) {
      // Calculate final result
      const result = calculateMatchResult(matchScores);
      
      // Update Challonge with the result
      const challongeResult = await reportToChallonge(
        matchScores.tournamentId,
        matchId,
        result.winnerId,
        result.scoreA,
        result.scoreB
      );

      matchScores.finalized = true;
      matchScores.result = result;

      // Save to storage
      await saveJudgeScoresToStorage(matchId, matchScores);

      // Save the detailed judge breakdown to Challonge as an attachment
      await saveJudgeBreakdownToChallonge(
        matchScores.tournamentId,
        matchId,
        matchScores
      );

      res.json({
        success: true,
        judgeCount,
        finalized: true,
        result,
        challongeResponse: challongeResult,
      });
    } else {
      // Save to storage
      await saveJudgeScoresToStorage(matchId, matchScores);

      res.json({
        success: true,
        judgeCount,
        finalized: false,
        message: `Waiting for ${3 - judgeCount} more judge(s)`,
      });
    }
  } catch (error) {
    console.error('Error submitting scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matches/:matchId/scores - Get current judge scores for a match
app.get('/api/matches/:matchId/scores', async (req, res) => {
  try {
    const { matchId } = req.params;
    const scores = await getJudgeScoresFromStorage(matchId) || { judges: {} };
    
    res.json({
      matchId,
      judgeCount: Object.keys(scores.judges || {}).length,
      finalized: scores.finalized || false,
      result: scores.result || null,
    });
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matches/:matchId/scores/details - Get detailed judge scores for popup
app.get('/api/matches/:matchId/scores/details', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { tournamentId } = req.query;
    
    // First check storage
    let scores = await getJudgeScoresFromStorage(matchId);
    
    // If not in storage and tournamentId provided, try to fetch from Challonge
    if ((!scores || Object.keys(scores.judges || {}).length === 0) && tournamentId) {
      const challongeData = await getJudgeBreakdownFromChallonge(tournamentId, matchId);
      if (challongeData) {
        scores = {
          judges: challongeData.judges,
          competitorAId: challongeData.competitorAId,
          competitorBId: challongeData.competitorBId,
          result: challongeData.result,
          finalized: true,
          tournamentId,
        };
        // Cache it in storage for future requests
        await saveJudgeScoresToStorage(matchId, scores);
      }
    }
    
    scores = scores || { judges: {} };
    
    res.json({
      matchId,
      competitorAId: scores.competitorAId,
      competitorBId: scores.competitorBId,
      judges: scores.judges || {},
      judgeCount: Object.keys(scores.judges || {}).length,
      finalized: scores.finalized || false,
      result: scores.result || null,
    });
  } catch (error) {
    console.error('Error fetching score details:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/matches/:matchId/scores/:judgeId - Allow judge to edit (delete and resubmit)
app.delete('/api/matches/:matchId/scores/:judgeId', async (req, res) => {
  try {
    const { matchId, judgeId } = req.params;
    
    const scores = await getJudgeScoresFromStorage(matchId);
    
    if (scores?.finalized) {
      return res.status(400).json({ error: 'Match already finalized' });
    }

    if (scores?.judges?.[judgeId]) {
      delete scores.judges[judgeId];
      await saveJudgeScoresToStorage(matchId, scores);
      res.json({ success: true, message: 'Score deleted, you can resubmit' });
    } else {
      res.status(404).json({ error: 'Score not found' });
    }
  } catch (error) {
    console.error('Error deleting score:', error);
    res.status(500).json({ error: error.message });
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

// Save judge score breakdown as a Challonge match attachment
async function saveJudgeBreakdownToChallonge(tournamentId, matchId, judgeData) {
  try {
    const attachmentData = {
      match_attachment: {
        description: JSON.stringify({
          type: 'judge_scores',
          judges: judgeData.judges,
          competitorAId: judgeData.competitorAId,
          competitorBId: judgeData.competitorBId,
          result: judgeData.result,
          savedAt: new Date().toISOString(),
        }),
      },
    };

    const result = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}/attachments.json`,
      'POST',
      attachmentData
    );

    console.log('Saved judge breakdown to Challonge attachment');
    return result;
  } catch (error) {
    console.error('Failed to save judge breakdown to Challonge:', error);
    // Don't throw - this is not critical
    return null;
  }
}

// Retrieve judge score breakdown from Challonge match attachments
async function getJudgeBreakdownFromChallonge(tournamentId, matchId) {
  try {
    const attachments = await challongeRequest(
      `/tournaments/${tournamentId}/matches/${matchId}/attachments.json`
    );

    // Find our judge_scores attachment
    for (const att of attachments) {
      const attachment = att.match_attachment;
      if (attachment.description) {
        try {
          const data = JSON.parse(attachment.description);
          if (data.type === 'judge_scores') {
            return data;
          }
        } catch (e) {
          // Not JSON or not our attachment, skip
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to get judge breakdown from Challonge:', error);
    return null;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: pool ? 'connected' : 'not configured (using memory)',
    challonge: CHALLONGE_API_KEY ? 'configured' : 'not configured',
  };

  if (pool) {
    try {
      await pool.query('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      health.database = 'error: ' + error.message;
      health.status = 'degraded';
    }
  }

  res.json(health);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${pool ? 'PostgreSQL configured' : 'Using in-memory storage'}`);
  console.log(`Challonge API: ${CHALLONGE_API_KEY ? 'configured' : 'NOT configured - set CHALLONGE_API_KEY'}`);
});

module.exports = app;
