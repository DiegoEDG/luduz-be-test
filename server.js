// src/server.js

// -- Dependencies ------------------------------------------------------------
import express from 'express'; // Express web framework
import cors from 'cors'; // Enable CORS for HTTP routes
import helmet from 'helmet'; // Security headers
import rateLimit from 'express-rate-limit'; // Rate limiting middleware
import http from 'http'; // Node's HTTP server
import { nanoid } from 'nanoid'; // For generating unique IDs
import { Server as SocketIOServer } from 'socket.io'; // Socket.IO server
import { loadSessions, saveSessions } from './fileStore.js'; // Persistence helpers

// -- App & Server Setup -----------------------------------------------------
const app = express(); // Create an Express app
const server = http.createServer(app); // Wrap in HTTP server for Socket.IO

// Apply security middleware
app.use(helmet());

// Enable CORS for HTTP routes (restrict origin as needed)
app.use(
	cors({
		origin: process.env.FRONTEND_URL || process.env.FRONTEND_URL2 || '*'
	})
);

// Rate limiting for HTTP endpoints
app.use(
	rateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100 // limit each IP to 100 requests per window
	})
);

// Initialize Socket.IO with CORS for WebSocket connections
const io = new SocketIOServer(server, {
	cors: {
		origin: process.env.FRONTEND_URL || '*'
	}
});

const PORT = process.env.PORT || 4000; // Port for the server to listen on

// ---------- HTTP Endpoints --------------------------------------------------
// Basic root endpoint – handy for browsers or simple uptime checks
app.get('/', (req, res) => {
	res.send(`<h1>Quiz Socket Server</h1><p>Status: running on port ${PORT}</p>`);
});
/**
 * Health check endpoint
 * - status: 'ok' if running
 * - uptime: seconds since process start
 * - timestamp: current ISO timestamp
 */
app.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		uptime: process.uptime(),
		timestamp: new Date().toISOString()
	});
});

// ---------- persistent store ----------
// Load existing sessions (from disk or memory)
let sessions = loadSessions();

// Prune any sessions older than TTL (1 day)
const TTL = 24 * 60 * 60 * 1000;
sessions = Object.fromEntries(
	Object.entries(sessions).filter(([, s]) => Date.now() - new Date(s.createdAt).getTime() < TTL)
);

// Helper to save and broadcast session state to a room
function broadcast(code) {
	saveSessions(sessions); // Persist to disk
	io.to(code).emit('sessionUpdate', sessions[code]);
	console.log('📡  sessionUpdate →', code, sessions[code].players.length, 'players');
}

// ---------- socket handlers ----------
io.on('connection', (socket) => {
	console.log('⚡ socket connected:', socket.id);

	// 1️⃣ Host creates a new session
	socket.on('createSession', ({ nickname, sessionName }) => {
		const code = nanoid(6).toUpperCase(); // Generate 6‑char room code
		const playerId = nanoid(); // Unique player ID
		const player = { id: playerId, nickname, score: 0, isHost: true };

		const session = {
			code,
			name: sessionName,
			hostPlayerId: playerId,
			players: [player],
			createdAt: new Date().toISOString(),
			isActive: false // Locked when host starts
		};

		sessions[code] = session;
		socket.join(code);
		socket.data = { code, playerId };

		socket.emit('createSessionResponse', { session, player });
		broadcast(code);
	});

	// 2️⃣ Player joins an existing session
	socket.on('joinSession', ({ code, nickname }) => {
		const session = sessions[code];
		if (!session || session.isActive) return socket.emit('error', 'Session not found or already started');

		const playerId = nanoid();
		const player = { id: playerId, nickname, score: 0, isHost: false };

		session.players.push(player);
		socket.join(code);
		socket.data = { code, playerId };

		socket.emit('joinSessionResponse', { session, player });
		broadcast(code);
	});

	// 3️⃣ Re-join after refresh or hiccup (state reconciliation)
	socket.on('rejoinSession', ({ code, playerId, nickname }) => {
		const session = sessions[code];
		if (!session) return;

		let player = session.players.find((p) => p.id === playerId);

		if (!player) {
			player = {
				id: playerId,
				nickname,
				score: 0,
				isHost: playerId === session.hostPlayerId
			};
			session.players.push(player);
		} else {
			player.isHost = playerId === session.hostPlayerId;
			player.nickname = nickname;
		}

		saveSessions(sessions);
		socket.join(code);
		socket.data = { code, playerId };

		socket.emit('rejoinSessionResponse', { session, player });
		broadcast(code);
	});

	// 4️⃣ Host starts the session (lock joins)
	socket.on('startSession', ({ code }) => {
		const session = sessions[code];
		if (!session || session.isActive) return;
		session.isActive = true;
		broadcast(code);
		io.to(code).emit('sessionStarted');
		console.log('🎮 sessionStarted →', code);
	});

	// 5️⃣ Update a player's score
	socket.on('updateScore', ({ code, playerId, score }) => {
		const session = sessions[code];
		if (!session || !session.isActive) return;
		const player = session.players.find((p) => p.id === playerId);
		if (!player) return;
		player.score = score;
		broadcast(code);
	});

	// 6️⃣ Player leaves session voluntarily
	socket.on('leaveSession', ({ code, playerId }) => {
		const session = sessions[code];
		if (!session) return;
		session.players = session.players.filter((p) => p.id !== playerId);
		socket.leave(code);
		broadcast(code);
	});

	// 7️⃣ Cleanup on disconnect
	socket.on('disconnect', () => {
		const { code, playerId } = socket.data || {};
		const session = sessions[code];
		if (session) {
			if (playerId !== session.hostPlayerId) {
				session.players = session.players.filter((p) => p.id !== playerId);
			}
			broadcast(code);
		}
		console.log('⛔ socket disconnected:', socket.id);
	});
});

// Global HTTP error handler
app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful shutdown
const shutdown = () => {
	console.log('🛑 Graceful shutdown initiated');
	server.close(() => {
		io.close();
		process.exit(0);
	});
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ---------- start server ----------
server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
