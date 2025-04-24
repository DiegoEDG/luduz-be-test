/** A player’s seat in a particular board game session */
export interface PlayerInGame {
	id: string; // Unique identifier for the player in the session
	sessionId: string; // ID of the session
	userId: string; // ID of the user

	seat?: number; // 0-based table position
	role: 'player' | 'observer' | 'bot'; // Role of the player (e.g., player, observer, bot)
	joinedAt: string; // Timestamp of when the player joined
	status: 'active' | 'away' | 'left' | 'kicked' | 'waitingForAction'; // Current player status
	lastActionAt?: string; // Timestamp of the player's last significant action
	order?: number; // Player's turn order (if applicable)
	color?: string; // Player's color (if applicable)

	/* Game-Specific State (mutable) */
	inventory?: {
		points?: number; // Victory points or score
		resources?: Record<string, number>; // Player's resources (e.g., coins, wood, etc.)
		readiness?: boolean; // Ready state (if applicable)
		currentTurn?: boolean; // Whether it’s this player's turn
		level?: number; // Player's current level (if applicable)
		hand?: string[]; // Cards in hand (if card-based game)
		position?: number; // Position on the board (if relevant)
		achievements?: string[]; // List of achievements or milestones
		controlledUnits?: string[]; // Units/pieces the player controls (if relevant)
	};
	privateState?: Record<string, unknown>; // Player-specific hidden game state (e.g., hand, secret info)

	avatarUrl?: string; // Avatar image URL (if player has custom avatar)

	/* Optional: Team or Group Information */
	teamId?: string; // The player's team (if team-based game)
	permissions?: string[]; // Player-specific session permissions (e.g., “canKick”, “canChat”)
}
