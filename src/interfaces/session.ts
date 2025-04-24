interface actions {
	event: string; // event name
	createdAt: string; // ISO 8601
}

/** Online board‑game lobby → match → results */
export interface BoardGameSession {
	/* ───────── identity ───────── */
	id: string; // room / invite code
	gameId: string; // ruleset identifier (e.g., "catan‑base")
	name?: string; // “Friday Night Catan”

	/* ───── ownership & lifecycle ───── */
	hostId: string; // lobby creator
	createdAt: string; // ISO 8601
	startedAt?: string; // first move timestamp
	endedAt?: string; // match finished
	status: 'lobby' | 'inProgress' | 'completed' | 'cancelled' | 'expired';

	/* ───────── players ───────── */
	players: string[]; // userIds seated in play order
	maxPlayers?: number;
	spectatorsEnabled?: boolean; // true if observers allowed
	spectatorIds?: string[];

	/* ─────── security & privacy ─────── */
	isPrivate?: boolean; // invite‑only if true

	/* ───────── game flow ───────── */
	turnOrder?: string[]; // canonical play order
	currentTurnPlayerId?: string; // whose move now
	phase?: string; // "setup" | "main" | "scoring" | …
	round?: number; // 1‑based round / age / year
	turnTimers?: {
		// optional chess‑clock style timers
		perTurnSeconds?: number;
		totalTimebankSeconds?: number;
	};
	timeline?: actions[];

	/* ─────── board state buckets ─────── */
	sharedState?: Record<string, unknown>; // public board: tiles, tokens…
	privateStates?: Record<string, Record<string, unknown>>;
	// { userId: { hand: [...], resources: … } }

	/* ───── outcome / results ───── */
	scores?: Record<string, number>; // { userId: victoryPoints }
	winners?: string[]; // one or more userIds
	tiebreakerUsed?: boolean;
	finalRankings?: string[]; // ordered by placement

	/** Custom inventory tracking
	 *  Example:
	 *  {
	 *    global: { wood: 28, brick: 19 },            // pool left on board
	 *    perPlayer: {
	 *      "user‑123": { wood: 4, brick: 1, wheat: 3 },
	 *      "user‑456": { wood: 2, sheep: 5 }
	 *    }
	 *  }
	 */
	gameState?: {
		global?: Record<string, number>; // remaining / spent totals
		perPlayer?: Record<string, Record<string, number>>;
	};

	/* ─────── UX features ─────── */
	chatEnabled?: boolean;
	trackerEnabled?: boolean; // e.g., action log

	/* ───────── configuration ───────── */
	settings: Record<string, unknown>; // house rules, expansions, map seed…
	rulesVersion?: string; // game patch / edition id

	/* ───── tagging & metadata ───── */
	labels?: string[]; // "ranked", "friendly", …
	version?: number; // optimistic‑locking
	metadata?: Record<string, unknown>; // extensibility bucket
}
