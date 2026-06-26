import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');

const BATCH_PREFIXES = ['batch-', 'decisions-'];

export function safeBatchFileName(name) {
  const base = path.basename(name);
  if (!BATCH_PREFIXES.some((p) => base.startsWith(p)) || !base.endsWith('.json')) {
    throw new Error('Invalid batch file name');
  }
  return base;
}

export function batchFilePath(fileName) {
  const safe = safeBatchFileName(fileName);
  const full = path.join(DATA_DIR, safe);
  if (!full.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid batch path');
  }
  return full;
}

export function normalizeDecisions(groups, rawDecisions) {
  return rawDecisions.map((d) => {
    const group = groups[d.groupIndex];
    if (!group) throw new Error(`Invalid group index: ${d.groupIndex}`);

    if (d.action !== 'yes') {
      return {
        groupIndex: d.groupIndex,
        action: 'no',
        files: group,
        keeper: null,
        toDelete: [],
        predicted: false,
      };
    }

    const keeper = d.keeper && group.includes(d.keeper) ? d.keeper : group[0];
    let toDelete;
    if (Array.isArray(d.toDelete) && d.toDelete.length) {
      toDelete = d.toDelete.filter((f) => group.includes(f) && f !== keeper);
    } else {
      toDelete = group.filter((f) => f !== keeper);
    }

    const predictionKind =
      d.predictionKind ?? (toDelete.length < group.length - 1 ? 'partial' : 'full');

    return {
      groupIndex: d.groupIndex,
      action: 'yes',
      files: group,
      keeper,
      toDelete,
      predicted: Boolean(d.predicted),
      predictionKind,
    };
  });
}

export function normalizeCleanupDecisions(files, rawDecisions) {
  return rawDecisions.map((d) => {
    const filePath = files[d.fileIndex];
    if (!filePath) throw new Error(`Invalid file index: ${d.fileIndex}`);

    const deleteFile = d.action === 'yes';
    return {
      fileIndex: d.fileIndex,
      action: deleteFile ? 'yes' : 'no',
      file: filePath,
      toDelete: deleteFile ? [filePath] : [],
    };
  });
}

export function buildSummary(groups, decisions, resumeIndex) {
  const confirmed = decisions.filter((d) => d.action === 'yes');
  return {
    totalGroups: groups.length,
    reviewedGroups: decisions.length,
    resumeIndex,
    pendingGroups: Math.max(0, groups.length - resumeIndex),
    confirmed: confirmed.length,
    rejected: decisions.filter((d) => d.action === 'no').length,
    filesToDelete: confirmed.reduce((sum, d) => sum + d.toDelete.length, 0),
    complete: resumeIndex >= groups.length,
  };
}

export function buildCleanupSummary(files, decisions, resumeIndex, reviewMode) {
  const confirmed = decisions.filter((d) => d.action === 'yes');
  const complete = reviewMode === 'grid' ? true : resumeIndex >= files.length;

  return {
    type: 'cleanup',
    reviewMode,
    totalFiles: files.length,
    reviewedFiles: reviewMode === 'grid' ? files.length : decisions.length,
    resumeIndex,
    pendingFiles: reviewMode === 'grid' ? 0 : Math.max(0, files.length - resumeIndex),
    confirmed: confirmed.length,
    rejected: decisions.filter((d) => d.action === 'no').length,
    filesToDelete: confirmed.reduce((sum, d) => sum + d.toDelete.length, 0),
    complete,
  };
}

function listSummaryFromPayload(fileName, payload) {
  const type = payload.type ?? 'duplicates';

  if (type === 'cleanup') {
    const files = payload.files ?? [];
    const decisions = payload.decisions ?? [];
    const resumeIndex = payload.resumeIndex ?? decisions.length;
    const reviewMode = payload.reviewMode ?? 'tinder';
    const summary = {
      ...buildCleanupSummary(files, decisions, resumeIndex, reviewMode),
      ...(payload.summary ?? {}),
    };

    return {
      fileName,
      type: 'cleanup',
      scanPath: payload.scanPath,
      savedAt: payload.savedAt,
      updatedAt: payload.updatedAt ?? payload.savedAt,
      summary,
    };
  }

  const decisions = payload.decisions ?? [];
  const groups = payload.groups ?? [];
  const resumeIndex = payload.resumeIndex ?? decisions.length;
  const totalGroups =
    groups.length ||
    (decisions.length ? Math.max(...decisions.map((d) => d.groupIndex)) + 1 : 0);

  const base = buildSummary(
    groups.length ? groups : Array(totalGroups).fill([]),
    decisions,
    resumeIndex,
  );

  const summary = {
    ...base,
    ...(payload.summary ?? {}),
    totalGroups: payload.summary?.totalGroups ?? base.totalGroups ?? totalGroups,
    reviewedGroups: payload.summary?.reviewedGroups ?? payload.summary?.total ?? base.reviewedGroups,
    filesToDelete: payload.summary?.filesToDelete ?? base.filesToDelete,
    complete: payload.summary?.complete ?? base.complete,
  };

  return {
    fileName,
    type: 'duplicates',
    scanPath: payload.scanPath,
    savedAt: payload.savedAt,
    updatedAt: payload.updatedAt ?? payload.savedAt,
    summary,
  };
}

export async function saveBatch({ fileName, scanPath, groups, decisions, resumeIndex }) {
  await mkdir(DATA_DIR, { recursive: true });

  const normalized = normalizeDecisions(groups, decisions);
  const summary = buildSummary(groups, normalized, resumeIndex);
  const now = new Date().toISOString();

  let targetName = fileName ? safeBatchFileName(fileName) : null;
  let existing = null;

  if (targetName) {
    try {
      existing = JSON.parse(await readFile(batchFilePath(targetName), 'utf8'));
    } catch {
      targetName = null;
    }
  }

  if (!targetName) {
    targetName = `batch-${now.replace(/[:.]/g, '-')}.json`;
  }

  const payload = {
    scanPath,
    savedAt: existing?.savedAt ?? now,
    updatedAt: now,
    groups,
    resumeIndex,
    summary,
    decisions: normalized,
  };

  const filePath = path.join(DATA_DIR, targetName);
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

  return { fileName: targetName, filePath, payload };
}

export async function saveCleanupBatch({
  fileName,
  scanPath,
  files,
  decisions,
  resumeIndex,
  reviewMode,
}) {
  await mkdir(DATA_DIR, { recursive: true });

  const normalized = normalizeCleanupDecisions(files, decisions);
  const summary = buildCleanupSummary(files, normalized, resumeIndex, reviewMode);
  const now = new Date().toISOString();

  let targetName = fileName ? safeBatchFileName(fileName) : null;
  let existing = null;

  if (targetName) {
    try {
      existing = JSON.parse(await readFile(batchFilePath(targetName), 'utf8'));
    } catch {
      targetName = null;
    }
  }

  if (!targetName) {
    targetName = `batch-${now.replace(/[:.]/g, '-')}.json`;
  }

  const payload = {
    type: 'cleanup',
    reviewMode,
    scanPath,
    savedAt: existing?.savedAt ?? now,
    updatedAt: now,
    files,
    resumeIndex,
    summary,
    decisions: normalized,
  };

  const filePath = path.join(DATA_DIR, targetName);
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

  return { fileName: targetName, filePath, payload };
}

export async function listBatches() {
  await mkdir(DATA_DIR, { recursive: true });
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  const batches = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    if (!BATCH_PREFIXES.some((p) => entry.name.startsWith(p))) continue;

    try {
      const content = await readFile(path.join(DATA_DIR, entry.name), 'utf8');
      const payload = JSON.parse(content);
      batches.push(listSummaryFromPayload(entry.name, payload));
    } catch {
      // skip invalid files
    }
  }

  batches.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return batches;
}

export async function getBatch(fileName) {
  const filePath = batchFilePath(fileName);
  const payload = JSON.parse(await readFile(filePath, 'utf8'));
  return { fileName: safeBatchFileName(fileName), filePath, payload };
}

export function batchAllowsPath(batch, filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(batch.scanPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return false;

  if (batch.type === 'cleanup') {
    return (batch.files ?? []).includes(filePath);
  }

  const inDecisions = batch.decisions.some(
    (d) => d.files?.includes(filePath) || d.toDelete.includes(filePath) || d.keeper === filePath,
  );
  if (inDecisions) return true;

  return (batch.groups ?? []).some((group) => group.includes(filePath));
}

export async function deleteBatch(fileName) {
  const { filePath, payload } = await getBatch(fileName);
  await unlink(filePath);
  return { fileName, scanPath: payload.scanPath };
}

export async function executeBatch(fileName) {
  const { filePath, payload } = await getBatch(fileName);
  const toDelete = [
    ...new Set(
      payload.decisions
        .filter((d) => d.action === 'yes')
        .flatMap((d) => d.toDelete),
    ),
  ];

  const deleted = [];
  const missing = [];
  const failed = [];

  for (const file of toDelete) {
    if (!batchAllowsPath(payload, file)) {
      failed.push({ file, error: 'Path not allowed' });
      continue;
    }
    try {
      await unlink(file);
      deleted.push(file);
    } catch (err) {
      if (err.code === 'ENOENT') missing.push(file);
      else failed.push({ file, error: err.message });
    }
  }

  await unlink(filePath);

  return {
    fileName,
    deleted: deleted.length,
    missing: missing.length,
    failed: failed.length,
    details: { deleted, missing, failed },
  };
}
