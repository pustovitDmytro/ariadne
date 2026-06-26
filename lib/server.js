import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDuplicates } from './find-duplicates.js';
import { walkImages } from './walk-images.js';
import { buildPhotoTimeline } from './photo-timeline.js';
import {
  batchAllowsPath,
  deleteBatch,
  executeBatch,
  getBatch,
  listBatches,
  normalizeDecisions,
  saveBatch,
  saveCleanupBatch,
} from './batches.js';
import { createSession, getSession } from './sessions.js';
import { pickFolder } from './pick-folder.js';
import { loadFolderPreferences, findPredictions, learnFolderPreferences } from './folder-preferences.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isPathInsideRoot(filePath, root) {
  const resolved = path.resolve(filePath);
  const resolvedRoot = path.resolve(root);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
}

async function serveStatic(res, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

async function serveImage(res, filePath) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: 'Not a file' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: 'File not found' });
  }
}

async function handlePickFolder(_req, res) {
  try {
    const result = await pickFolder();
    if (result.cancelled) {
      sendJson(res, 200, { cancelled: true });
      return;
    }
    sendJson(res, 200, { path: result.path });
  } catch (err) {
    sendJson(res, 503, { error: err.message });
  }
}

async function handleTimeline(req, res) {
  const body = await readBody(req);
  const directory = body.path?.trim();

  if (!directory) {
    sendJson(res, 400, { error: 'Path is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const timeline = await buildPhotoTimeline(directory, {
      onProgress: ({ phase, current, total }) => {
        send('progress', { phase, current, total });
      },
    });

    const allFiles = timeline.buckets.flatMap((b) => b.files);
    const sessionId = allFiles.length
      ? createSession(timeline.scanPath, { type: 'timeline', files: allFiles })
      : null;

    send('done', { ...timeline, sessionId });
  } catch (err) {
    send('error', { error: err.message });
  }

  res.end();
}

async function handleScan(req, res) {
  const body = await readBody(req);
  const directory = body.path?.trim();

  if (!directory) {
    sendJson(res, 400, { error: 'Path is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const groups = await findDuplicates(directory, {
      onProgress: ({ phase, current, total }) => {
        send('progress', { phase, current, total });
      },
    });

    const absoluteRoot = path.resolve(directory);
    const sessionId = createSession(absoluteRoot, groups);

    send('done', {
      sessionId,
      scanPath: absoluteRoot,
      count: groups.length,
      groups,
    });
  } catch (err) {
    send('error', { error: err.message });
  }

  res.end();
}

async function handleScanPhotos(req, res) {
  const body = await readBody(req);
  const directory = body.path?.trim();

  if (!directory) {
    sendJson(res, 400, { error: 'Path is required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let scanned = 0;
    const files = await walkImages(path.resolve(directory));
    scanned = files.length;

    send('progress', { phase: 'scan', current: scanned, total: scanned });

    const absoluteRoot = path.resolve(directory);
    const sessionId = createSession(absoluteRoot, { type: 'cleanup', files });

    send('done', {
      sessionId,
      scanPath: absoluteRoot,
      count: files.length,
      files,
    });
  } catch (err) {
    send('error', { error: err.message });
  }

  res.end();
}

async function handleImage(req, res, url) {
  const sessionId = url.searchParams.get('sessionId');
  const filePath = url.searchParams.get('path');

  if (!sessionId || !filePath) {
    sendJson(res, 400, { error: 'sessionId and path are required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    sendJson(res, 404, { error: 'Session expired or not found' });
    return;
  }

  if (!isPathInsideRoot(filePath, session.root)) {
    sendJson(res, 403, { error: 'Access denied' });
    return;
  }

  if (session.type === 'cleanup' || session.type === 'timeline') {
    if (!session.files.includes(filePath)) {
      sendJson(res, 403, { error: 'File not in scan results' });
      return;
    }
  } else {
    const inGroup = session.groups.some((group) => group.includes(filePath));
    if (!inGroup) {
      sendJson(res, 403, { error: 'File not in scan results' });
      return;
    }
  }

  await serveImage(res, filePath);
}

async function handleBatchImage(req, res, url) {
  const batchId = url.searchParams.get('batch');
  const filePath = url.searchParams.get('path');

  if (!batchId || !filePath) {
    sendJson(res, 400, { error: 'batch and path are required' });
    return;
  }

  try {
    const { payload } = await getBatch(batchId);
    if (!batchAllowsPath(payload, filePath)) {
      sendJson(res, 403, { error: 'Access denied' });
      return;
    }
    await serveImage(res, filePath);
  } catch (err) {
    sendJson(res, 404, { error: err.message });
  }
}

async function handleSaveBatch(req, res) {
  const body = await readBody(req);
  const { sessionId, decisions, resumeIndex, batchId, reviewMode } = body;

  if (!sessionId || !Array.isArray(decisions) || resumeIndex === undefined) {
    sendJson(res, 400, { error: 'sessionId, decisions and resumeIndex are required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    sendJson(res, 404, { error: 'Session expired or not found' });
    return;
  }

  try {
    if (session.type === 'cleanup') {
      const result = await saveCleanupBatch({
        fileName: batchId,
        scanPath: session.root,
        files: session.files,
        decisions,
        resumeIndex,
        reviewMode: reviewMode ?? 'tinder',
      });

      sendJson(res, 200, {
        ok: true,
        batchId: result.fileName,
        fileName: result.fileName,
        filePath: result.filePath,
        summary: result.payload.summary,
      });
      return;
    }

    const result = await saveBatch({
      fileName: batchId,
      scanPath: session.root,
      groups: session.groups,
      decisions,
      resumeIndex,
    });

    sendJson(res, 200, {
      ok: true,
      batchId: result.fileName,
      fileName: result.fileName,
      filePath: result.filePath,
      summary: result.payload.summary,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleFolderPreferences(_req, res, url) {
  try {
    const scanPath = url.searchParams.get('scanPath')?.trim() || undefined;
    const result = await loadFolderPreferences({ scanPath });
    sendJson(res, 200, {
      preferences: result.preferencesList,
      evidenceDecisions: result.evidenceDecisions,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handlePredict(req, res) {
  const body = await readBody(req);
  const { scanPath, groups, decisions } = body;

  if (!Array.isArray(groups) || !Array.isArray(decisions)) {
    sendJson(res, 400, { error: 'groups and decisions arrays are required' });
    return;
  }

  try {
    const stored = await loadFolderPreferences({ scanPath: scanPath?.trim() || undefined });
    const sessionGroups = decisions
      .filter((d) => d.action === 'yes' && d.keeper)
      .map((d) => ({
        group: groups[d.groupIndex] ?? [],
        keeper: d.keeper,
        action: d.action,
      }))
      .filter((d) => d.group.length >= 2);

    const preferences = learnFolderPreferences([...stored.decisionGroups, ...sessionGroups]);

    const reviewed = new Set(decisions.map((d) => d.groupIndex));
    const predictions = findPredictions(groups, preferences, reviewed);

    sendJson(res, 200, {
      predictions,
      preferenceCount: preferences.size,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleListBatches(_req, res) {
  try {
    const batches = await listBatches();
    sendJson(res, 200, { batches });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleGetBatch(_req, res, fileName) {
  try {
    const batch = await getBatch(fileName);
    sendJson(res, 200, {
      fileName: batch.fileName,
      ...batch.payload,
    });
  } catch (err) {
    sendJson(res, 404, { error: err.message });
  }
}

async function handleExecuteBatch(_req, res, fileName) {
  try {
    const result = await executeBatch(fileName);
    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleDeleteBatch(_req, res, fileName) {
  try {
    const result = await deleteBatch(fileName);
    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    sendJson(res, 404, { error: err.message });
  }
}

async function handleResumeBatch(_req, res, fileName) {
  try {
    const batch = await getBatch(fileName);
    const { groups, decisions, resumeIndex, scanPath, type, files, reviewMode } = batch.payload;

    if (type === 'cleanup') {
      if (!files?.length) {
        sendJson(res, 400, { error: 'Batch has no files to resume' });
        return;
      }

      const mode = reviewMode ?? 'tinder';
      if (mode === 'tinder' && resumeIndex >= files.length) {
        sendJson(res, 400, { error: 'Batch review is already complete' });
        return;
      }

      const sessionId = createSession(scanPath, { type: 'cleanup', files });
      sendJson(res, 200, {
        type: 'cleanup',
        sessionId,
        batchId: batch.fileName,
        scanPath,
        files,
        reviewMode: mode,
        decisions,
        resumeIndex,
        count: files.length,
      });
      return;
    }

    if (!groups?.length) {
      sendJson(res, 400, { error: 'Batch has no groups to resume' });
      return;
    }

    if (resumeIndex >= groups.length) {
      sendJson(res, 400, { error: 'Batch review is already complete' });
      return;
    }

    const sessionId = createSession(scanPath, groups);
    sendJson(res, 200, {
      sessionId,
      batchId: batch.fileName,
      scanPath,
      groups,
      decisions,
      resumeIndex,
      count: groups.length,
    });
  } catch (err) {
    sendJson(res, 404, { error: err.message });
  }
}

// Legacy endpoint
async function handleDecisions(req, res) {
  const body = await readBody(req);
  const { sessionId, decisions } = body;

  if (!sessionId || !Array.isArray(decisions)) {
    sendJson(res, 400, { error: 'sessionId and decisions array are required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    sendJson(res, 404, { error: 'Session expired or not found' });
    return;
  }

  try {
    const result = await saveBatch({
      scanPath: session.root,
      groups: session.groups,
      decisions,
      resumeIndex: session.groups.length,
    });

    sendJson(res, 200, {
      ok: true,
      batchId: result.fileName,
      fileName: result.fileName,
      filePath: result.filePath,
      summary: result.payload.summary,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

export function startServer(port = 3847) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const batchMatch = url.pathname.match(/^\/api\/batches\/([^/]+)(\/execute|\/resume|\/delete)?$/);

    try {
      if (req.method === 'POST' && url.pathname === '/api/pick-folder') {
        await handlePickFolder(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/scan') {
        await handleScan(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/scan-photos') {
        await handleScanPhotos(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/timeline') {
        await handleTimeline(req, res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/image') {
        await handleImage(req, res, url);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/batch-image') {
        await handleBatchImage(req, res, url);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/batches') {
        await handleSaveBatch(req, res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/batches') {
        await handleListBatches(req, res);
        return;
      }
      if (req.method === 'POST' && url.pathname === '/api/predict') {
        await handlePredict(req, res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/folder-preferences') {
        await handleFolderPreferences(req, res, url);
        return;
      }
      if (batchMatch) {
        const fileName = decodeURIComponent(batchMatch[1]);
        const action = batchMatch[2];

        if (req.method === 'GET' && !action) {
          await handleGetBatch(req, res, fileName);
          return;
        }
        if (req.method === 'POST' && action === '/execute') {
          await handleExecuteBatch(req, res, fileName);
          return;
        }
        if (req.method === 'POST' && action === '/resume') {
          await handleResumeBatch(req, res, fileName);
          return;
        }
        if (req.method === 'POST' && action === '/delete') {
          await handleDeleteBatch(req, res, fileName);
          return;
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/decisions') {
        await handleDecisions(req, res);
        return;
      }
      if (req.method === 'GET') {
        await serveStatic(res, url.pathname);
        return;
      }
      sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  server.listen(port, () => {
    console.log(`Ariadne web UI: http://localhost:${port}`);
  });

  return server;
}
