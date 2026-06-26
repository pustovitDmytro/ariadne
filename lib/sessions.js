import { randomUUID } from 'node:crypto';

/** @type {Map<string, { root: string, type: string, groups: string[][], files: string[], createdAt: number }>} */
const sessions = new Map();

const TTL_MS = 2 * 60 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > TTL_MS) sessions.delete(id);
  }
}

export function createSession(root, groupsOrOpts) {
  prune();
  const sessionId = randomUUID();

  if (Array.isArray(groupsOrOpts)) {
    sessions.set(sessionId, {
      root,
      type: 'duplicates',
      groups: groupsOrOpts,
      files: [],
      createdAt: Date.now(),
    });
  } else {
    const { type = 'duplicates', groups = [], files = [] } = groupsOrOpts ?? {};
    sessions.set(sessionId, {
      root,
      type,
      groups,
      files,
      createdAt: Date.now(),
    });
  }

  return sessionId;
}

export function getSession(sessionId) {
  prune();
  return sessions.get(sessionId) ?? null;
}
