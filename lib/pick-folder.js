import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';

function commandExists(cmd) {
  const result = spawnSync('which', [cmd], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', env: process.env });
}

function parseDialogResult(result) {
  const selected = result.stdout?.trim();
  if (result.status === 0 && selected) {
    return { path: selected };
  }
  if (result.status === 1 || !selected) {
    return { cancelled: true };
  }
  const stderr = result.stderr?.trim();
  throw new Error(stderr || `Помилка діалогу (${result.status})`);
}

async function validateDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  const fileStat = await stat(resolved);
  if (!fileStat.isDirectory()) {
    throw new Error('Обраний шлях не є каталогом');
  }
  return resolved;
}

function pickFolderLinux(title) {
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('Немає графічного середовища (DISPLAY). Введіть шлях вручну.');
  }

  if (commandExists('zenity')) {
    return parseDialogResult(
      run('zenity', ['--file-selection', '--directory', '--title', title]),
    );
  }

  if (commandExists('kdialog')) {
    const startDir = process.env.HOME || '/';
    return parseDialogResult(
      run('kdialog', ['--getexistingdirectory', startDir, '--title', title]),
    );
  }

  if (commandExists('yad')) {
    return parseDialogResult(
      run('yad', ['--file', '--directory', '--title', title]),
    );
  }

  throw new Error(
    'Не знайдено zenity, kdialog або yad. Встановіть один з них або введіть шлях вручну.',
  );
}

function pickFolderMac(title) {
  const escaped = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `POSIX path of (choose folder with prompt "${escaped}")`;
  return parseDialogResult(run('osascript', ['-e', script]));
}

function pickFolderWindows(title) {
  const escaped = title.replace(/'/g, "''");
  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$f = New-Object System.Windows.Forms.FolderBrowserDialog',
    `$f.Description = '${escaped}'`,
    'if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }',
  ].join('; ');

  return parseDialogResult(run('powershell', ['-NoProfile', '-Command', ps]));
}

export async function pickFolder({ title = 'Обрати папку' } = {}) {
  let result;

  if (process.platform === 'linux' || process.platform === 'freebsd') {
    result = pickFolderLinux(title);
  } else if (process.platform === 'darwin') {
    result = pickFolderMac(title);
  } else if (process.platform === 'win32') {
    result = pickFolderWindows(title);
  } else {
    throw new Error('Вибір папки не підтримується на цій платформі');
  }

  if (result.cancelled) {
    return result;
  }

  result.path = await validateDirectory(result.path);
  return result;
}
