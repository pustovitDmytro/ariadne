import path from 'node:path';
import { getBatch, listBatches } from './batches.js';

const MIN_EVIDENCE = 2;

export function parentDir(filePath) {
  return path.dirname(filePath);
}

export function folderPairKey(dirA, dirB) {
  return [dirA, dirB].sort().join('\0');
}

export function sameDirKey(dir) {
  return `same:\0${dir}`;
}

function groupByDir(files) {
  const map = new Map();
  for (const file of files) {
    const dir = parentDir(file);
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir).push(file);
  }
  return map;
}

function extractLearnablePair(group, keeper) {
  const dirToFiles = groupByDir(group);
  const dirs = [...dirToFiles.keys()];

  if (dirs.length === 2) {
    if (dirToFiles.get(dirs[0]).length !== 1 || dirToFiles.get(dirs[1]).length !== 1) return null;

    const keepDir = parentDir(keeper);
    const loseDir = dirs.find((d) => d !== keepDir);
    if (!loseDir) return null;

    return {
      type: 'two-folder',
      keepDir,
      loseDir,
      key: folderPairKey(keepDir, loseDir),
    };
  }

  if (dirs.length === 1 && dirToFiles.get(dirs[0]).length === 2) {
    return {
      type: 'same-folder',
      dir: dirs[0],
      key: sameDirKey(dirs[0]),
    };
  }

  return null;
}

export function learnFolderPreferences(decisionGroups) {
  const votes = new Map();
  const sameDirVotes = new Map();

  for (const { group, keeper, action } of decisionGroups) {
    if (action !== 'yes' || !keeper) continue;

    const pair = extractLearnablePair(group, keeper);
    if (!pair) continue;

    if (pair.type === 'same-folder') {
      sameDirVotes.set(pair.key, (sameDirVotes.get(pair.key) ?? 0) + 1);
      continue;
    }

    if (!votes.has(pair.key)) votes.set(pair.key, new Map());
    const dirVotes = votes.get(pair.key);
    dirVotes.set(pair.keepDir, (dirVotes.get(pair.keepDir) ?? 0) + 1);
  }

  const preferences = new Map();

  for (const [key, dirVotes] of votes) {
    let keepDir = null;
    let count = 0;
    for (const [dir, dirCount] of dirVotes) {
      if (dirCount > count) {
        count = dirCount;
        keepDir = dir;
      }
    }
    if (count >= MIN_EVIDENCE && keepDir) {
      preferences.set(key, { keepDir, count, sameFolder: false });
    }
  }

  for (const [key, count] of sameDirVotes) {
    if (count >= MIN_EVIDENCE) {
      preferences.set(key, {
        sameFolder: true,
        dir: key.slice('same:\0'.length),
        count,
      });
    }
  }

  return preferences;
}

function getPreference(dirA, dirB, preferences) {
  const key = folderPairKey(dirA, dirB);
  const pref = preferences.get(key);
  if (!pref || pref.sameFolder) return null;
  return pref;
}

function getSameDirPreference(dir, preferences) {
  const pref = preferences.get(sameDirKey(dir));
  if (!pref?.sameFolder) return null;
  return pref;
}

function sortedPair(files) {
  return [...files].sort();
}

export function predictGroup(group, preferences) {
  const dirToFiles = groupByDir(group);
  const dirs = [...dirToFiles.keys()];

  if (dirs.length === 1) {
    const files = dirToFiles.get(dirs[0]);
    if (files.length === 2) {
      const pref = getSameDirPreference(dirs[0], preferences);
      if (pref) {
        const [keeper, toDrop] = sortedPair(files);
        return {
          kind: 'full',
          keeper,
          toDelete: [toDrop],
          keepDir: dirs[0],
          sameFolder: true,
          evidenceCount: pref.count,
        };
      }
    }
  }

  if (dirs.length === 2) {
    const [dirA, dirB] = dirs;
    if (dirToFiles.get(dirA).length === 1 && dirToFiles.get(dirB).length === 1) {
      const pref = getPreference(dirA, dirB, preferences);
      if (pref) {
        const keeper = dirToFiles.get(pref.keepDir)[0];
        return {
          kind: 'full',
          keeper,
          toDelete: group.filter((f) => f !== keeper),
          keepDir: pref.keepDir,
          sameFolder: false,
          evidenceCount: pref.count,
        };
      }
    }
  }

  const toDelete = [];
  const deleteReasons = new Map();

  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const dirA = dirs[i];
      const dirB = dirs[j];
      const pref = getPreference(dirA, dirB, preferences);
      if (!pref) continue;

      const loseDir = pref.keepDir === dirA ? dirB : dirA;
      const loseFiles = dirToFiles.get(loseDir);
      const keepFiles = dirToFiles.get(pref.keepDir);
      if (loseFiles.length !== 1 || keepFiles.length !== 1) continue;

      const loseFile = loseFiles[0];
      if (!toDelete.includes(loseFile)) {
        toDelete.push(loseFile);
        deleteReasons.set(loseFile, {
          keepDir: pref.keepDir,
          loseDir,
          evidenceCount: pref.count,
        });
      }
    }
  }

  if (!toDelete.length) return null;

  const remaining = group.filter((f) => !toDelete.includes(f));
  const preferredKeeper = remaining.find((f) => parentDir(f) === [...deleteReasons.values()][0]?.keepDir);
  const keeper = preferredKeeper ?? remaining[0] ?? null;

  return {
    kind: 'partial',
    keeper,
    toDelete,
    remaining,
    keepDir: keeper ? parentDir(keeper) : null,
    sameFolder: false,
    evidenceCount: Math.min(...[...deleteReasons.values()].map((r) => r.evidenceCount)),
  };
}

export function findPredictions(groups, preferences, reviewedIndices = new Set()) {
  const predictions = [];
  for (let i = 0; i < groups.length; i++) {
    if (reviewedIndices.has(i)) continue;
    const prediction = predictGroup(groups[i], preferences);
    if (prediction) predictions.push({ groupIndex: i, ...prediction });
  }
  return predictions;
}

export function preferencesToJson(preferences) {
  return [...preferences.entries()].map(([key, value]) => {
    if (value.sameFolder) {
      return { type: 'same-folder', dir: value.dir, count: value.count };
    }
    const [dirA, dirB] = key.split('\0');
    return { type: 'two-folder', dirA, dirB, keepDir: value.keepDir, count: value.count };
  });
}

export function decisionGroupsFromBatch(payload) {
  if (payload.type === 'cleanup' || !payload.groups?.length) return [];

  const groups = payload.groups;
  return (payload.decisions ?? [])
    .filter((d) => d.action === 'yes' && d.keeper)
    .map((d) => ({
      group: d.files ?? groups[d.groupIndex] ?? [],
      keeper: d.keeper,
      action: d.action,
    }))
    .filter((d) => d.group.length >= 2);
}

export async function loadFolderPreferences({ scanPath } = {}) {
  const batches = await listBatches();
  const decisionGroups = [];

  for (const batch of batches) {
    if (batch.type === 'cleanup') continue;
    if (scanPath && batch.scanPath !== scanPath) continue;

    try {
      const { payload } = await getBatch(batch.fileName);
      decisionGroups.push(...decisionGroupsFromBatch(payload));
    } catch {
      // skip invalid batches
    }
  }

  const preferences = learnFolderPreferences(decisionGroups);
  return {
    preferences,
    preferencesList: preferencesToJson(preferences),
    evidenceDecisions: decisionGroups.length,
    decisionGroups,
  };
}
