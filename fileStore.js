// utils/fileStore.js
import { readFileSync, writeFile } from 'fs';

const PATH = './sessions.json';

export function loadSessions() {
	try {
		const raw = readFileSync(PATH, 'utf8');
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

export function saveSessions(sessions) {
	writeFile(PATH, JSON.stringify(sessions, null, 2), (err) => {
		if (err) console.error('Error saving sessions:', err);
	});
}
