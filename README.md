# SCAR Tournament Judge Portal

A web application for tournament judging with Challonge API integration. Supports double-elimination brackets with a split-point scoring system.

## Features

- **Challonge Integration**: Sync tournaments, participants, and matches from Challonge
- **Judge Scoring**: Split-point system (Aggression: 3, Damage: 5, Control: 3)
- **KO Declaration**: 2/3 majority required for knockout wins
- **Auto-Advance**: When all 3 judges submit, results automatically push to Challonge
- **Real-time Status**: See judge submission progress
- **Dark/Light Mode**: Toggle between themes

## Architecture

```
scar-tournament/
├── client/                 # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx        # Main application
│   │   ├── index.js       # Entry point
│   │   └── services/
│   │       └── api.js     # API service layer
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── index.js           # Express server with Challonge API
│   ├── package.json
│   └── .env.example       # Environment variables template
│
└── README.md
```

## Setup

### 1. Get Challonge API Key

1. Go to [challonge.com/settings/developer](https://challonge.com/settings/developer)
2. Generate an API key
3. Note your Challonge username

### 2. Configure Server

```bash
cd server
npm install

# Create .env file from template
cp .env.example .env

# Edit .env with your credentials
CHALLONGE_API_KEY=your_api_key_here
CHALLONGE_USERNAME=your_username_here
PORT=3001
```

### 3. Configure Client

```bash
cd client
npm install
```

### 4. Run the Application

**Terminal 1 - Start Server:**
```bash
cd server
npm start
```

**Terminal 2 - Start Client:**
```bash
cd client
npm start
```

The app will open at `http://localhost:3000`

## Usage

### Connecting a Tournament

1. Go to **Admin** → **Settings**
2. Enter your Challonge tournament URL (e.g., `my-tournament-2024`)
3. Click **Sync**
4. The bracket will populate with your tournament data

### Judge Scoring Flow

1. Start a match in Challonge (mark it as "underway")
2. In the **Judge** view, judges will see the active match
3. Each judge adjusts the sliders to split points between competitors
4. Or checks "Declare KO" and selects a winner
5. Click **Submit Scores**
6. When all 3 judges submit:
   - Points are totaled (33 total possible, no ties)
   - Or KO is confirmed if 2/3 judges agree
   - Winner is automatically reported to Challonge
   - Tournament bracket advances

### Scoring System

| Criterion   | Points | Description |
|-------------|--------|-------------|
| Aggression  | 3      | Split between competitors |
| Damage      | 5      | Split between competitors |
| Control     | 3      | Split between competitors |
| **Total**   | **11** | Per judge (33 total) |

### Win Conditions

1. **Points Victory**: Higher total points wins (ties impossible with 33 points)
2. **Knockout (KO)**: 2/3 judges must declare same KO winner

## API Endpoints

### Tournament Endpoints
- `GET /api/tournaments` - List all tournaments
- `GET /api/tournaments/:id` - Get tournament with participants and matches
- `GET /api/tournaments/:id/matches` - Get all matches

### Match Endpoints
- `GET /api/tournaments/:tournamentId/matches/:matchId` - Get single match
- `PUT /api/tournaments/:tournamentId/matches/:matchId` - Update match (report winner)

### Judge Scoring Endpoints
- `POST /api/matches/:matchId/scores` - Submit judge scores
- `GET /api/matches/:matchId/scores` - Get current scores for a match
- `DELETE /api/matches/:matchId/scores/:judgeId` - Delete a judge's score (for editing)

## Challonge API Reference

This app uses [Challonge API v1](https://api.challonge.com/v1):

- **Authentication**: API key as query parameter
- **Rate Limits**: ~1 request/second
- **Match Update**: `PUT /tournaments/{id}/matches/{match_id}.json`
  - `winner_id`: Participant ID of winner
  - `scores_csv`: Score string like "19-14"

## Development

### Environment Variables

**Server (.env)**
```
CHALLONGE_API_KEY=your_key
CHALLONGE_USERNAME=your_username
PORT=3001
```

**Client (.env)**
```
REACT_APP_API_URL=http://localhost:3001/api
```

### Running in Development

```bash
# Server with auto-reload
cd server
npm run dev

# Client
cd client
npm start
```

## Deployment

### Option 1: Railway/Render

1. Push to GitHub
2. Connect to Railway or Render
3. Set environment variables
4. Deploy both client and server

### Option 2: Vercel + Heroku

1. Deploy client to Vercel
2. Deploy server to Heroku
3. Update `REACT_APP_API_URL` to point to Heroku

### Option 3: Docker

```dockerfile
# Dockerfile example coming soon
```

## Troubleshooting

**"Failed to fetch tournament"**
- Check your Challonge API key is correct
- Verify the tournament URL exists
- Ensure you have access to the tournament

**Scores not submitting**
- Check server is running on port 3001
- Verify match is in "open" state in Challonge
- Check browser console for errors

**Match not advancing**
- Ensure all 3 judges have submitted
- Check the Challonge match ID is correct
- Verify API key has write access

## License

MIT License - Built for SCAR (SoCal Attack Robots)
