import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findPredictions,
  learnFolderPreferences,
  predictGroup,
} from './folder-preferences.js';

describe('folder preferences', () => {
  const dirA = '/photos/keep';
  const dirB = '/photos/drop';
  const dirC = '/photos/other';

  it('learns after two consistent two-folder decisions', () => {
    const groups = [
      {
        group: [`${dirA}/a1.jpg`, `${dirB}/b1.jpg`],
        keeper: `${dirA}/a1.jpg`,
        action: 'yes',
      },
      {
        group: [`${dirA}/a2.jpg`, `${dirB}/b2.jpg`],
        keeper: `${dirA}/a2.jpg`,
        action: 'yes',
      },
    ];

    const prefs = learnFolderPreferences(groups);
    assert.equal(prefs.size, 1);
    const pref = [...prefs.values()][0];
    assert.equal(pref.keepDir, dirA);
    assert.equal(pref.count, 2);
  });

  it('does not learn from conflicting decisions', () => {
    const groups = [
      {
        group: [`${dirA}/a1.jpg`, `${dirB}/b1.jpg`],
        keeper: `${dirA}/a1.jpg`,
        action: 'yes',
      },
      {
        group: [`${dirA}/a2.jpg`, `${dirB}/b2.jpg`],
        keeper: `${dirB}/b2.jpg`,
        action: 'yes',
      },
    ];

    const prefs = learnFolderPreferences(groups);
    assert.equal(prefs.size, 0);
  });

  it('predicts full two-folder groups', () => {
    const prefs = learnFolderPreferences([
      {
        group: [`${dirA}/a1.jpg`, `${dirB}/b1.jpg`],
        keeper: `${dirA}/a1.jpg`,
        action: 'yes',
      },
      {
        group: [`${dirA}/a2.jpg`, `${dirB}/b2.jpg`],
        keeper: `${dirA}/a2.jpg`,
        action: 'yes',
      },
    ]);

    const prediction = predictGroup([`${dirA}/a3.jpg`, `${dirB}/b3.jpg`], prefs);
    assert.equal(prediction.kind, 'full');
    assert.equal(prediction.keeper, `${dirA}/a3.jpg`);
    assert.deepEqual(prediction.toDelete, [`${dirB}/b3.jpg`]);
  });

  it('predicts partial deletion for three-folder groups', () => {
    const prefs = learnFolderPreferences([
      {
        group: [`${dirA}/a1.jpg`, `${dirB}/b1.jpg`],
        keeper: `${dirA}/a1.jpg`,
        action: 'yes',
      },
      {
        group: [`${dirA}/a2.jpg`, `${dirB}/b2.jpg`],
        keeper: `${dirA}/a2.jpg`,
        action: 'yes',
      },
    ]);

    const group = [`${dirA}/a3.jpg`, `${dirB}/b3.jpg`, `${dirC}/c3.jpg`];
    const prediction = predictGroup(group, prefs);

    assert.equal(prediction.kind, 'partial');
    assert.deepEqual(prediction.toDelete, [`${dirB}/b3.jpg`]);
    assert.deepEqual(prediction.remaining, [`${dirA}/a3.jpg`, `${dirC}/c3.jpg`]);
    assert.equal(prediction.keeper, `${dirA}/a3.jpg`);
  });

  it('learns same-folder duplicate pairs', () => {
    const dir = '/photos/album';
    const prefs = learnFolderPreferences([
      {
        group: [`${dir}/a.jpg`, `${dir}/b.jpg`],
        keeper: `${dir}/a.jpg`,
        action: 'yes',
      },
      {
        group: [`${dir}/c.jpg`, `${dir}/d.jpg`],
        keeper: `${dir}/d.jpg`,
        action: 'yes',
      },
    ]);

    assert.equal(prefs.size, 1);
    const pref = [...prefs.values()][0];
    assert.equal(pref.sameFolder, true);
    assert.equal(pref.dir, dir);
    assert.equal(pref.count, 2);
  });

  it('predicts same-folder duplicate groups', () => {
    const dir = '/photos/album';
    const prefs = learnFolderPreferences([
      {
        group: [`${dir}/a.jpg`, `${dir}/b.jpg`],
        keeper: `${dir}/a.jpg`,
        action: 'yes',
      },
      {
        group: [`${dir}/c.jpg`, `${dir}/d.jpg`],
        keeper: `${dir}/d.jpg`,
        action: 'yes',
      },
    ]);

    const prediction = predictGroup([`${dir}/e.jpg`, `${dir}/f.jpg`], prefs);
    assert.equal(prediction.kind, 'full');
    assert.equal(prediction.sameFolder, true);
    assert.equal(prediction.keeper, `${dir}/e.jpg`);
    assert.deepEqual(prediction.toDelete, [`${dir}/f.jpg`]);
  });

  it('skips reviewed groups when finding predictions', () => {
    const prefs = learnFolderPreferences([
      {
        group: [`${dirA}/a1.jpg`, `${dirB}/b1.jpg`],
        keeper: `${dirA}/a1.jpg`,
        action: 'yes',
      },
      {
        group: [`${dirA}/a2.jpg`, `${dirB}/b2.jpg`],
        keeper: `${dirA}/a2.jpg`,
        action: 'yes',
      },
    ]);

    const groups = [
      [`${dirA}/x.jpg`, `${dirB}/y.jpg`],
      [`${dirA}/z.jpg`, `${dirB}/w.jpg`],
    ];
    const reviewed = new Set([0]);
    const predictions = findPredictions(groups, prefs, reviewed);

    assert.equal(predictions.length, 1);
    assert.equal(predictions[0].groupIndex, 1);
  });
});
