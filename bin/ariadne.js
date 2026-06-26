#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDuplicates } from '../lib/find-duplicates.js';
import { buildPhotoTimeline } from '../lib/photo-timeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printHelp() {
  console.log(`ariadne — home photo archive tools

Usage:
  ariadne duplicates <directory> [options]
  ariadne timeline <directory> [options]

Options:
  --json          output as JSON
  --quiet, -q     suppress progress messages
  --help, -h      show this help

Examples:
  ariadne duplicates ~/Pictures
  ariadne timeline /media/photos --json
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = { json: false, quiet: false, help: false };
  const positional = [];

  for (const arg of args) {
    if (arg === '--json') options.json = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  return { positional, options };
}

function formatHuman(groups) {
  if (groups.length === 0) {
    return 'No duplicate photos found.';
  }

  const lines = [`Found ${groups.length} duplicate group(s):\n`];

  groups.forEach((group, index) => {
    lines.push(`Group ${index + 1} (${group.length} files):`);
    for (const file of group) {
      lines.push(`  ${file}`);
    }
    lines.push('');
  });

  const duplicateFiles = groups.reduce((sum, g) => sum + g.length - 1, 0);
  lines.push(`Total redundant files: ${duplicateFiles}`);

  return lines.join('\n');
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimelineHuman(timeline) {
  if (!timeline.total) {
    return 'No photos found in this directory.';
  }

  const lines = [
    `Photos: ${timeline.total}`,
    `Period: ${formatDate(timeline.minDate)} — ${formatDate(timeline.maxDate)} (${timeline.spanDays} days)`,
    `Dates from EXIF: ${timeline.exifCount}, from file date: ${timeline.mtimeCount}`,
    `With GPS: ${timeline.geoCount ?? 0}`,
    `Buckets: per ${timeline.bucketUnitLabel}`,
    '',
  ];

  const maxCount = Math.max(...timeline.buckets.map((b) => b.count));
  const barWidth = 24;

  for (const bucket of timeline.buckets) {
    const filled = maxCount ? Math.max(1, Math.round((bucket.count / maxCount) * barWidth)) : 0;
    const bar = '█'.repeat(filled).padEnd(barWidth, '░');
    lines.push(`${bucket.label.padEnd(22)} ${bar} ${bucket.count}`);
  }

  return lines.join('\n');
}

async function runDuplicates(directory, options) {
  const onProgress = options.quiet
    ? undefined
    : ({ phase, current, total }) => {
        const label = phase === 'scan' ? 'Scanning' : 'Hashing';
        process.stderr.write(`\r${label}: ${current}/${total}`);
        if (current === total) process.stderr.write('\n');
      };

  const groups = await findDuplicates(directory, { onProgress });

  if (options.json) {
    console.log(JSON.stringify({ groups, count: groups.length }, null, 2));
    return;
  }

  console.log(formatHuman(groups));
}

async function runTimeline(directory, options) {
  const onProgress = options.quiet
    ? undefined
    : ({ current, total }) => {
        process.stderr.write(`\rReading dates: ${current}/${total}`);
        if (current === total) process.stderr.write('\n');
      };

  const timeline = await buildPhotoTimeline(directory, { onProgress });

  if (options.json) {
    console.log(JSON.stringify(timeline, null, 2));
    return;
  }

  console.log(formatTimelineHuman(timeline));
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  let parsed;
  try {
    parsed = parseArgs(rest);
  } catch (err) {
    console.error(err.message);
    printHelp();
    process.exit(1);
  }

  if (parsed.options.help) {
    printHelp();
    process.exit(0);
  }

  const [directory] = parsed.positional;
  if (!directory) {
    console.error('Error: directory path is required.\n');
    printHelp();
    process.exit(1);
  }

  if (command !== 'duplicates' && command !== 'timeline') {
    console.error(`Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
  }

  try {
    if (command === 'duplicates') {
      await runDuplicates(directory, parsed.options);
    } else {
      await runTimeline(directory, parsed.options);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
