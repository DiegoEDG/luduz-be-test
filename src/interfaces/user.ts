/** Rich, extensible application user */
export interface User {
	/* ──────────── identity ──────────── */
	id: string; // immutable primary key (UUID / snowflake)
	username: string; // unique public handle
	displayName?: string; // pretty name shown in UI
	nickname?: string; // optional per‑guild / per‑chat alias
	avatarUrl?: string; // profile image
	profileUrl?: string; // public profile deep‑link
	email?: string; // login or contact address
	phoneNumber?: string; // optional tel
	isEmailVerified?: boolean;
	isPhoneNumberVerified?: boolean;
	creationMethod?: 'email' | 'google' | 'facebook' | 'apple' | 'guest' | string;
	mfaEnabled?: boolean; // multi‑factor auth flag
	passwordHash?: string; // only if using local auth

	/* ───── lifecycle & activity ───── */
	createdAt: string; // ISO 8601
	joinedAt?: string; // alias for createdAt in multi‑tenant apps
	updatedAt?: string; // last profile change
	lastLoginAt?: string; // last auth success
	lastActiveAt?: string; // last heartbeat / presence ping
	status?:
		| 'online'
		| 'idle'
		| 'offline' // live presence
		| 'active'
		| 'banned'
		| 'deleted'
		| 'pending'; // moderation / GDPR states
	version?: number; // optimistic‑locking revision
	ipHash?: string; // anonymised last IP (server‑side only)

	/* ─────────── preferences ────────── */
	locale?: string; // IETF BCP‑47 (e.g., "en-US")
	languagePreference?: string; // legacy alias
	timeZone?: string; // IANA tz (e.g., "America/Chicago")
	themePref?: 'light' | 'dark' | 'system';
	notifications?: {
		email: boolean;
		push: boolean;
		sms?: boolean; // NEW – often toggled separately
	};
	settings?: Record<string, any>; // user‑defined tweaks

	/* ─────── roles & segmentation ───── */
	roles?: string[]; // e.g., ["user", "moderator"]
	tags?: string[]; // AB tests, cohorts, feature flags
	groups?: string[]; // NEW – teams / orgs membership

	/* ───────── content & social ─────── */
	bio?: string; // short “about me”
	location?: string; // free‑text city / country
	links?: {
		// NEW – social links collection
		[service: string]: string; // e.g., { twitter: "https://…" }
	};

	/* ───────── extensibility ────────── */
	metadata?: Record<string, unknown>; // server‑controlled
	data?: Record<string, any>; // client / feature bucket
}
