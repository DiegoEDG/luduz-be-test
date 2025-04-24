// src/server.js

// -- Dependencies ------------------------------------------------------------
import express from 'express'; // Express web framework
import http from 'http'; // Node's HTTP server
import { nanoid } from 'nanoid'; // For generating unique IDs
import { Server as SocketIOServer } from 'socket.io';
import { loadSessions, saveSessions } from './fileStore.js'; // Persistence helpers

// -- App & Server Setup -----------------------------------------------------
const app = express(); // Create an Express app
const server = http.createServer(app); // Wrap in HTTP server for Socket.IO

// Initialize Socket.IO, allow all origins (CORS)
const io = new SocketIOServer(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 4000; // Port for the server to listen on

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
	io.to(code).emit('sessionUpdate', sessions[code]); // Emit update event
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
			players: [player], // Host is first player
			createdAt: new Date().toISOString(),
			isActive: false // Locked when host starts
		};

		sessions[code] = session; // Store session
		socket.join(code); // Join socket.io "room"
		socket.data = { code, playerId }; // Attach metadata

		socket.emit('createSessionResponse', { session, player });
		broadcast(code); // Notify everyone in room (just host now)
	});

	// 2️⃣ Player joins an existing session
	socket.on('joinSession', ({ code, nickname }) => {
		const session = sessions[code];
		// Reject if not found or already active
		if (!session || session.isActive) return socket.emit('error', 'Session not found or already started');

		const playerId = nanoid();
		const player = { id: playerId, nickname, score: 0, isHost: false };

		session.players.push(player); // Add new player
		socket.join(code);
		socket.data = { code, playerId };

		socket.emit('joinSessionResponse', { session, player });
		broadcast(code); // Notify all players of updated roster
	});

	// 3️⃣ Re-join after refresh or hiccup (state reconciliation)
	socket.on('rejoinSession', ({ code, playerId, nickname }) => {
		const session = sessions[code]; // Must exist
		if (!session) return;

		let player = session.players.find((p) => p.id === playerId);

		if (!player) {
			// If missing, re-create with original host flag
			player = { id: playerId, nickname, score: 0, isHost: playerId === session.hostPlayerId };
			session.players.push(player);
		} else {
			// Restore nickname & host status
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
		broadcast(code); // Update lobby state
		io.to(code).emit('sessionStarted');
		console.log('🎮 sessionStarted →', code);
	});

	// 5️⃣ Update a player's score
	socket.on('updateScore', ({ code, playerId, score }) => {
		const session = sessions[code];
		if (!session || !session.isActive) return;
		const player = session.players.find((p) => p.id === playerId);
		if (!player) return;
		player.score = score; // Set new score
		broadcast(code); // Broadcast changes
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
			// Remove non-host only
			if (playerId !== session.hostPlayerId) {
				session.players = session.players.filter((p) => p.id !== playerId);
			}
			broadcast(code);
		}
		console.log('⛔ socket disconnected:', socket.id);
	});
});

// ---------- start server ----------
server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
