// src/services/api.js
// API service for communicating with the backend server

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
  // ============================================
  // TOURNAMENT METHODS
  // ============================================

  async getTournaments() {
    const response = await fetch(`${API_BASE_URL}/tournaments`);
    if (!response.ok) throw new Error('Failed to fetch tournaments');
    return response.json();
  }

  async getTournament(tournamentId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}`);
    if (!response.ok) throw new Error('Failed to fetch tournament');
    return response.json();
  }

  async getParticipants(tournamentId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/participants`);
    if (!response.ok) throw new Error('Failed to fetch participants');
    return response.json();
  }

  async getMatches(tournamentId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/matches`);
    if (!response.ok) throw new Error('Failed to fetch matches');
    return response.json();
  }

  // ============================================
  // MATCH METHODS
  // ============================================

  async getMatch(tournamentId, matchId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/matches/${matchId}`);
    if (!response.ok) throw new Error('Failed to fetch match');
    return response.json();
  }

  async updateMatch(tournamentId, matchId, winnerId, scoresCsv) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/matches/${matchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_id: winnerId, scores_csv: scoresCsv }),
    });
    if (!response.ok) throw new Error('Failed to update match');
    return response.json();
  }

  async reopenMatch(tournamentId, matchId) {
    const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/matches/${matchId}/reopen`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to reopen match');
    return response.json();
  }

  // ============================================
  // JUDGE SCORING METHODS
  // ============================================

  async submitJudgeScores(matchId, scoreData) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoreData),
    });
    if (!response.ok) throw new Error('Failed to submit scores');
    return response.json();
  }

  async getMatchScores(matchId) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores`);
    if (!response.ok) throw new Error('Failed to fetch scores');
    return response.json();
  }

  async deleteJudgeScore(matchId, judgeId) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/scores/${judgeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete score');
    return response.json();
  }
}

export const api = new ApiService();
export default api;
