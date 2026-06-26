const $ = (sel) => document.querySelector(sel);

const scanScreen = $('#scan-screen');
const reviewScreen = $('#review-screen');
const doneScreen = $('#done-screen');
const batchScreen = $('#batch-screen');
const scanForm = $('#scan-form');
const pathInput = $('#path-input');
const pathSuggestions = $('#path-suggestions');
const scanBtn = $('#scan-btn');
const pickFolderBtn = $('#pick-folder-btn');
const progress = $('#progress');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');
const batchesList = $('#batches-list');
const counter = $('#counter');
const scanPathEl = $('#scan-path');
const card = $('#card');
const cardImages = $('#card-images');
const cardPaths = $('#card-paths');
const btnNo = $('#btn-no');
const btnYes = $('#btn-yes');
const btnSave = $('#btn-save');
const doneSummary = $('#done-summary');
const doneFile = $('#done-file');
const btnRestart = $('#btn-restart');
const btnBatchBack = $('#btn-batch-back');
const batchTitle = $('#batch-title');
const batchMeta = $('#batch-meta');
const batchDeleteList = $('#batch-delete-list');
const btnExecute = $('#btn-execute');
const btnDeleteBatch = $('#btn-delete-batch');
const btnCancelScan = $('#btn-cancel-scan');
const btnReviewExit = $('#btn-review-exit');
const btnCleanupExit = $('#btn-cleanup-exit');
const predictionModal = $('#prediction-modal');
const predictionModalBackdrop = $('#prediction-modal-backdrop');
const predictionModalMessage = $('#prediction-modal-message');
const predictionModalDetail = $('#prediction-modal-detail');
const btnPredictionApply = $('#btn-prediction-apply');
const btnPredictionDismiss = $('#btn-prediction-dismiss');
const predictionHint = $('#prediction-hint');
const confirmModal = $('#confirm-modal');
const modalBackdrop = $('#modal-backdrop');
const modalTitle = $('#modal-title');
const modalMessage = $('#modal-message');
const modalActions = $('#modal-actions');

const modeDuplicates = $('#mode-duplicates');
const modeCleanup = $('#mode-cleanup');
const modeTimeline = $('#mode-timeline');
const modeBatches = $('#mode-batches');
const scanHint = $('#scan-hint');
const batchesPanel = $('#batches-panel');
const scanIdle = $('#scan-idle');
const scanIdleTitle = $('#scan-idle-title');
const scanIdleMessage = $('#scan-idle-message');
const scanResult = $('#scan-result');
const scanResultIcon = $('#scan-result-icon');
const scanResultTitle = $('#scan-result-title');
const scanResultMessage = $('#scan-result-message');
const scanResultPath = $('#scan-result-path');
const btnScanAgain = $('#btn-scan-again');
const timelineResults = $('#timeline-results');
const timelineMin = $('#timeline-min');
const timelineMax = $('#timeline-max');
const timelineTotal = $('#timeline-total');
const timelineMeta = $('#timeline-meta');
const timelineChart = $('#timeline-chart');
const timelineBucketSection = $('#timeline-bucket-section');
const timelineBucketTitle = $('#timeline-bucket-title');
const timelineBucketGrid = $('#timeline-bucket-grid');
const timelineMapSection = $('#timeline-map-section');
const timelineGeoMeta = $('#timeline-geo-meta');
const timelineMapEl = $('#timeline-map');

let locationMap = null;

let timelineState = {
  sessionId: null,
  selectedBucketKey: null,
};

const cleanupReviewScreen = $('#cleanup-review-screen');
const cleanupDoneScreen = $('#cleanup-done-screen');
const cleanupCounter = $('#cleanup-counter');
const cleanupScanPathEl = $('#cleanup-scan-path');
const cleanupCard = $('#cleanup-card');
const cleanupCardImage = $('#cleanup-card-image');
const cleanupCardPath = $('#cleanup-card-path');
const btnCleanupNo = $('#btn-cleanup-no');
const btnCleanupYes = $('#btn-cleanup-yes');
const btnCleanupSave = $('#btn-cleanup-save');
const cleanupModeTinder = $('#cleanup-mode-tinder');
const cleanupModeGrid = $('#cleanup-mode-grid');
const cleanupTinderView = $('#cleanup-tinder-view');
const cleanupGridView = $('#cleanup-grid-view');
const cleanupGrid = $('#cleanup-grid');
const tileSizeSlider = $('#tile-size-slider');
const cleanupSelectedCount = $('#cleanup-selected-count');
const btnSelectAll = $('#btn-select-all');
const btnDeselectAll = $('#btn-deselect-all');
const btnCleanupGridSave = $('#btn-cleanup-grid-save');
const cleanupDoneSummary = $('#cleanup-done-summary');
const cleanupDoneFile = $('#cleanup-done-file');
const btnCleanupRestart = $('#btn-cleanup-restart');

const toast = document.createElement('div');
toast.className = 'save-toast';
document.body.appendChild(toast);

let state = {
  sessionId: null,
  batchId: null,
  scanPath: '',
  groups: [],
  index: 0,
  keeper: null,
  decisions: [],
  predictionsDismissed: false,
};

let predictionsCache = [];
let predictionModalOpen = false;

let currentBatch = null;
let scanMode = 'duplicates';
let scanResultVisible = false;

const IDLE_CONTENT = {
  duplicates: {
    icon: '◎',
    title: 'Пошук дублікатів',
    message: 'Оберіть папку на сервері — Ariadne знайде однакові файли за вмістом і допоможе вирішити, що залишити.',
  },
  cleanup: {
    icon: '▦',
    title: 'Видалення фото',
    message: 'Оберіть папку — побачите всі зображення картками або плитками та збережете список на видалення.',
  },
  timeline: {
    icon: '◷',
    title: 'Час і місце',
    message: 'Оберіть папку — побачите період зйомки, гістограму за часом і карту місць (за EXIF).',
  },
};

const EMPTY_BATCHES_HTML = `
  <div class="empty-state empty-state-inline">
    <div class="empty-state-icon" aria-hidden="true">📋</div>
    <h3 class="empty-state-title">Немає збережених батчів</h3>
    <p class="empty-state-message">Після перегляду дублікатів або видалення фото тут з'являться черги на видалення. Можна повернутися й продовжити пізніше.</p>
  </div>
`;

let cleanupState = {
  sessionId: null,
  batchId: null,
  scanPath: '',
  files: [],
  index: 0,
  decisions: [],
  reviewMode: 'tinder',
  selected: new Set(),
  tileSize: 120,
};

const PATH_HISTORY_KEY = 'ariadne.pathHistory';

let activeScanAbort = null;
let scanInProgress = false;
let duplicatesSavedSnapshot = '';
let cleanupSavedSnapshot = '';

function loadPathHistory() {
  try {
    return JSON.parse(localStorage.getItem(PATH_HISTORY_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function savePathHistory(history) {
  localStorage.setItem(PATH_HISTORY_KEY, JSON.stringify(history));
}

function recordPathUsage(dirPath) {
  const path = dirPath.trim();
  if (!path) return;

  const history = loadPathHistory();
  const entry = history[path] ?? { count: 0, lastUsed: null };
  entry.count += 1;
  entry.lastUsed = new Date().toISOString();
  history[path] = entry;
  savePathHistory(history);
}

function getTopPaths(limit = 5) {
  return Object.entries(loadPathHistory())
    .sort(([, a], [, b]) => b.count - a.count || new Date(b.lastUsed) - new Date(a.lastUsed))
    .slice(0, limit)
    .map(([path, entry]) => ({ path, count: entry.count }));
}

function showPathSuggestions() {
  const top = getTopPaths(5);
  if (!top.length) {
    pathSuggestions.classList.add('hidden');
    pathSuggestions.innerHTML = '';
    return;
  }

  pathSuggestions.innerHTML = '';
  for (const { path, count } of top) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'path-suggestion';
    btn.innerHTML = `
      <span class="path-suggestion-text">${path}</span>
      <span class="path-suggestion-count">${count}×</span>
    `;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      pathInput.value = path;
      hidePathSuggestions();
    });
    li.appendChild(btn);
    pathSuggestions.appendChild(li);
  }
  pathSuggestions.classList.remove('hidden');
}

function hidePathSuggestions() {
  pathSuggestions.classList.add('hidden');
}

const screens = [scanScreen, reviewScreen, doneScreen, batchScreen, cleanupReviewScreen, cleanupDoneScreen];

const appEl = document.querySelector('.app');

function showScreen(screen) {
  screens.forEach((s) => s.classList.remove('active'));
  screen.classList.add('active');
  const isReview = screen === reviewScreen || screen === cleanupReviewScreen;
  appEl.classList.toggle('review-active', isReview);
  if (screen === scanScreen && scanMode === 'batches') loadBatchesList();
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

function closeModal() {
  confirmModal.classList.add('hidden');
  modalActions.innerHTML = '';
}

function showModal({ title, message, buttons }) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalActions.innerHTML = '';

  for (const btn of buttons) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = btn.label;
    if (btn.primary) el.className = 'primary-btn';
    else if (btn.danger) el.className = 'text-btn danger-btn';
    else el.className = 'text-btn';
    el.addEventListener('click', () => {
      closeModal();
      btn.onClick?.();
    });
    modalActions.appendChild(el);
  }

  confirmModal.classList.remove('hidden');
}

function beginScanAbort() {
  if (activeScanAbort) activeScanAbort.abort();
  activeScanAbort = new AbortController();
  return activeScanAbort;
}

function cancelScan() {
  activeScanAbort?.abort();
}

function finishScanUi() {
  scanInProgress = false;
  btnCancelScan.classList.add('hidden');
  activeScanAbort = null;
  scanBtn.disabled = false;
  if (!scanResultVisible && scanMode !== 'batches') updateScanIdle();
}

function isInReview() {
  return reviewScreen.classList.contains('active') || cleanupReviewScreen.classList.contains('active');
}

function snapshotDuplicates() {
  return JSON.stringify({ decisions: state.decisions, index: state.index });
}

function hasUnsavedDuplicates() {
  return reviewScreen.classList.contains('active') && snapshotDuplicates() !== duplicatesSavedSnapshot;
}

function snapshotCleanup() {
  return JSON.stringify({
    mode: cleanupState.reviewMode,
    selected: [...cleanupState.selected].sort((a, b) => a - b),
    decisions: cleanupState.decisions,
    index: cleanupState.index,
  });
}

function hasUnsavedCleanup() {
  return cleanupReviewScreen.classList.contains('active') && snapshotCleanup() !== cleanupSavedSnapshot;
}

function resetDuplicatesState() {
  state = {
    sessionId: null,
    batchId: null,
    scanPath: '',
    groups: [],
    index: 0,
    keeper: null,
    decisions: [],
    predictionsDismissed: false,
  };
  predictionsCache = [];
  duplicatesSavedSnapshot = '';
}

function resetCleanupState() {
  cleanupState = {
    sessionId: null,
    batchId: null,
    scanPath: '',
    files: [],
    index: 0,
    decisions: [],
    reviewMode: 'tinder',
    selected: new Set(),
    tileSize: cleanupState.tileSize ?? 120,
  };
  cleanupSavedSnapshot = '';
}

function tryCancelScan(onProceed) {
  if (!scanInProgress) {
    onProceed();
    return;
  }

  showModal({
    title: 'Скасувати сканування?',
    message: 'Сканування ще не завершено.',
    buttons: [
      { label: 'Продовжити' },
      {
        label: 'Скасувати сканування',
        danger: true,
        onClick: () => {
          cancelScan();
          progress.classList.add('hidden');
          finishScanUi();
          onProceed();
        },
      },
    ],
  });
}

function tryExitReview(onExit) {
  const isDuplicates = reviewScreen.classList.contains('active');
  const hasUnsaved = isDuplicates ? hasUnsavedDuplicates() : hasUnsavedCleanup();

  if (!hasUnsaved) {
    if (isDuplicates) resetDuplicatesState();
    else resetCleanupState();
    onExit();
    return;
  }

  showModal({
    title: 'Вийти з перегляду?',
    message: 'Є незбережений прогрес. Зберегти перед виходом?',
    buttons: [
      { label: 'Скасувати' },
      {
        label: 'Вийти без збереження',
        danger: true,
        onClick: () => {
          if (isDuplicates) resetDuplicatesState();
          else resetCleanupState();
          onExit();
        },
      },
      {
        label: 'Зберегти і вийти',
        primary: true,
        onClick: async () => {
          try {
            if (isDuplicates) await saveBatch(false);
            else await saveCleanupBatch(false);
            if (isDuplicates) resetDuplicatesState();
            else resetCleanupState();
            onExit();
          } catch {
            // saveBatch/saveCleanupBatch already show errors
          }
        },
      },
    ],
  });
}

function goHome() {
  showScreen(scanScreen);
}

function exitToHome() {
  tryExitReview(goHome);
}

function decidedGroupIndices() {
  return new Set(state.decisions.map((d) => d.groupIndex));
}

function hasDecisionForIndex(index) {
  return decidedGroupIndices().has(index);
}

function getPredictionForIndex(index) {
  return predictionsCache.find((p) => p.groupIndex === index);
}

function advanceIndexPastDecided() {
  const decided = decidedGroupIndices();
  while (state.index < state.groups.length && decided.has(state.index)) {
    state.index += 1;
  }
}

async function refreshPredictions() {
  if (!state.groups.length) return;

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanPath: state.scanPath,
        groups: state.groups,
        decisions: state.decisions,
      }),
    });
    const data = await res.json();
    if (!res.ok) return;

    predictionsCache = data.predictions ?? [];
    updatePredictionModal();
    if (reviewScreen.classList.contains('active')) renderCard();
  } catch {
    // ignore prediction errors
  }
}

function buildPredictionModalText() {
  const full = predictionsCache.filter((p) => p.kind === 'full').length;
  const partial = predictionsCache.filter((p) => p.kind === 'partial').length;
  const sameFolder = predictionsCache.filter((p) => p.sameFolder).length;

  const parts = [];
  if (full) parts.push(`${full} повних`);
  if (partial) parts.push(`${partial} часткових`);
  if (sameFolder) parts.push(`${sameFolder} у тій самій папці`);

  return {
    message: `Знайдено ${predictionsCache.length} груп, які можна вирішити за аналогією з вашими попередніми рішеннями.`,
    detail: parts.length ? `Типи: ${parts.join(', ')}.` : '',
  };
}

function showPredictionModal() {
  if (state.predictionsDismissed || !predictionsCache.length) return;

  const { message, detail } = buildPredictionModalText();
  predictionModalMessage.textContent = message;
  predictionModalDetail.textContent = detail;
  predictionModal.classList.remove('hidden');
  predictionModalOpen = true;
}

function hidePredictionModal() {
  predictionModal.classList.add('hidden');
  predictionModalOpen = false;
}

function updatePredictionModal() {
  if (state.predictionsDismissed || !predictionsCache.length) {
    hidePredictionModal();
    return;
  }
  showPredictionModal();
}

function dismissPredictions() {
  state.predictionsDismissed = true;
  hidePredictionModal();
}

function applyPredictions() {
  if (!predictionsCache.length) return;

  const sorted = [...predictionsCache].sort((a, b) => a.groupIndex - b.groupIndex);
  for (const pred of sorted) {
    state.decisions.push({
      groupIndex: pred.groupIndex,
      action: 'yes',
      keeper: pred.keeper,
      toDelete: pred.toDelete,
      predicted: true,
      predictionKind: pred.kind,
    });
  }

  const count = sorted.length;
  predictionsCache = [];
  hidePredictionModal();
  advanceIndexPastDecided();
  state.keeper = null;

  if (state.index >= state.groups.length) {
    saveBatch(true);
  } else {
    renderCard();
    showToast(`Застосовано ${count} передбачень`);
  }
}

function basename(p) {
  return p.split('/').pop();
}

function formatPhotoDate(iso) {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function hideScanResult() {
  scanResultVisible = false;
  scanResult.classList.add('hidden');
  updateScanIdle();
}

function showScanEmptyResult({ icon = '✓', title, message, path }) {
  scanResultVisible = true;
  scanIdle.classList.add('hidden');
  scanResultIcon.textContent = icon;
  scanResultTitle.textContent = title;
  scanResultMessage.textContent = message;
  scanResultPath.textContent = path ?? '';
  scanResultPath.classList.toggle('hidden', !path);
  scanResult.classList.remove('hidden');
  timelineResults.classList.add('hidden');
  hideTimelineBucketPreview();
  timelineMapSection.classList.add('hidden');
  destroyLocationMap();
}

function updateScanIdle() {
  const isBatches = scanMode === 'batches';
  const hasTimeline = !timelineResults.classList.contains('hidden');

  if (isBatches || scanInProgress || scanResultVisible || hasTimeline) {
    scanIdle.classList.add('hidden');
    return;
  }

  const content = IDLE_CONTENT[scanMode];
  if (!content) {
    scanIdle.classList.add('hidden');
    return;
  }

  scanIdle.querySelector('.empty-state-icon').textContent = content.icon;
  scanIdleTitle.textContent = content.title;
  scanIdleMessage.textContent = content.message;
  scanIdle.classList.remove('hidden');
}

function setScanMode(mode) {
  if (mode !== scanMode) hideScanResult();
  scanMode = mode;
  const isDuplicates = mode === 'duplicates';
  const isCleanup = mode === 'cleanup';
  const isTimeline = mode === 'timeline';
  const isBatches = mode === 'batches';

  modeDuplicates.classList.toggle('active', isDuplicates);
  modeCleanup.classList.toggle('active', isCleanup);
  modeTimeline.classList.toggle('active', isTimeline);
  modeBatches.classList.toggle('active', isBatches);
  modeDuplicates.setAttribute('aria-selected', String(isDuplicates));
  modeCleanup.setAttribute('aria-selected', String(isCleanup));
  modeTimeline.setAttribute('aria-selected', String(isTimeline));
  modeBatches.setAttribute('aria-selected', String(isBatches));

  scanForm.classList.toggle('hidden', isBatches);
  batchesPanel.classList.toggle('hidden', !isBatches);

  if (!isTimeline && !isBatches) {
    timelineResults.classList.add('hidden');
    hideTimelineBucketPreview();
    timelineMapSection.classList.add('hidden');
    destroyLocationMap();
  }

  if (isBatches) {
    hideScanResult();
    progress.classList.add('hidden');
    loadBatchesList();
  } else {
    scanBtn.textContent = isTimeline ? 'Аналізувати' : 'Сканувати';
    if (isDuplicates) {
      scanHint.textContent =
        'Введіть абсолютний шлях або оберіть папку через системний діалог (якщо браузер і сервер на одній машині).';
    } else if (isCleanup) {
      scanHint.textContent =
        'Знайде всі фото в папці. Далі можна переглянути картками або обрати на плитках, що видалити.';
    } else {
      scanHint.textContent =
        'Покаже період і місця зйомки (EXIF). Дату файлу використовує, якщо EXIF відсутній. Шлях можна обрати через «Обрати…».';
    }
    updateScanIdle();
  }
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureLeaflet() {
  if (window.L?.heatLayer) return;
  await loadStylesheet('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  await loadScript('https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js');
}

function destroyLocationMap() {
  if (locationMap) {
    locationMap.remove();
    locationMap = null;
  }
}

async function renderLocationMap(timeline) {
  if (!timeline.locations?.length) {
    timelineMapSection.classList.add('hidden');
    destroyLocationMap();
    return;
  }

  await ensureLeaflet();

  timelineMapSection.classList.remove('hidden');
  timelineGeoMeta.textContent = `${timeline.geoCount.toLocaleString('uk-UA')} фото з координатами`;

  destroyLocationMap();
  locationMap = L.map(timelineMapEl, { scrollWheelZoom: false });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(locationMap);

  const heatPoints = timeline.locations.map((p) => [p.lat, p.lng, 0.6]);
  L.heatLayer(heatPoints, {
    radius: 22,
    blur: 18,
    maxZoom: 14,
    minOpacity: 0.35,
    gradient: {
      0.2: '#3b3486',
      0.5: '#7c6cf0',
      0.8: '#f0c040',
      1.0: '#f05a6e',
    },
  }).addTo(locationMap);

  const bounds = L.latLngBounds(heatPoints.map(([lat, lng]) => [lat, lng]));
  locationMap.fitBounds(bounds.pad(0.15));
  setTimeout(() => locationMap.invalidateSize(), 50);
}

async function renderTimelineResults(timeline) {
  timelineState.sessionId = timeline.sessionId ?? null;
  timelineState.selectedBucketKey = null;
  hideTimelineBucketPreview();

  timelineMin.textContent = formatPhotoDate(timeline.minDate);
  timelineMax.textContent = formatPhotoDate(timeline.maxDate);
  timelineTotal.textContent = timeline.total.toLocaleString('uk-UA');

  const parts = [`Крок: ${timeline.bucketUnitLabel}`];
  if (timeline.exifCount) parts.push(`EXIF: ${timeline.exifCount}`);
  if (timeline.mtimeCount) parts.push(`дата файлу: ${timeline.mtimeCount}`);
  if (timeline.geoCount) parts.push(`геолокація: ${timeline.geoCount}`);
  timelineMeta.textContent = parts.join(' · ');

  timelineChart.innerHTML = '';
  if (timeline.buckets.length) {
    const maxCount = Math.max(...timeline.buckets.map((b) => b.count));
    timelineChart.style.setProperty('--chart-width', `${timeline.buckets.length * 42}px`);

    for (const bucket of timeline.buckets) {
      const heightPct = maxCount ? (bucket.count / maxCount) * 100 : 0;

      const col = document.createElement('div');
      col.className = 'timeline-bar-col';
      col.dataset.bucketKey = bucket.key;
      col.setAttribute('role', 'button');
      col.setAttribute('tabindex', '0');
      col.setAttribute('aria-label', `${bucket.label}: ${bucket.count} фото`);

      const count = document.createElement('span');
      count.className = 'timeline-bar-count';
      count.textContent = bucket.count;

      const bar = document.createElement('div');
      bar.className = 'timeline-bar';
      bar.style.height = `${Math.max(heightPct, bucket.count ? 4 : 0)}%`;
      bar.title = `${bucket.label}: ${bucket.count} фото`;

      const label = document.createElement('span');
      label.className = 'timeline-bar-label';
      label.textContent = bucket.label;

      col.appendChild(count);
      col.appendChild(bar);
      col.appendChild(label);

      const activate = () => selectTimelineBucket(bucket, col);
      col.addEventListener('click', activate);
      col.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });

      timelineChart.appendChild(col);
    }
  }

  await renderLocationMap(timeline);
}

function timelineImageUrl(filePath) {
  return `/api/image?sessionId=${encodeURIComponent(timelineState.sessionId)}&path=${encodeURIComponent(filePath)}`;
}

function hideTimelineBucketPreview() {
  timelineBucketSection.classList.add('hidden');
  timelineBucketTitle.textContent = '';
  timelineBucketGrid.innerHTML = '';
  timelineChart.querySelectorAll('.timeline-bar-col.selected').forEach((col) => {
    col.classList.remove('selected');
    col.setAttribute('aria-pressed', 'false');
  });
}

function selectTimelineBucket(bucket, col) {
  if (timelineState.selectedBucketKey === bucket.key) {
    timelineState.selectedBucketKey = null;
    hideTimelineBucketPreview();
    return;
  }

  timelineState.selectedBucketKey = bucket.key;
  timelineChart.querySelectorAll('.timeline-bar-col.selected').forEach((el) => {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  });
  col.classList.add('selected');
  col.setAttribute('aria-pressed', 'true');
  renderTimelineBucketPreview(bucket);
}

function renderTimelineBucketPreview(bucket) {
  timelineBucketTitle.textContent = `${bucket.label} · ${bucket.count} фото`;
  timelineBucketGrid.innerHTML = '';

  for (const filePath of bucket.files) {
    const tile = document.createElement('div');
    tile.className = 'timeline-bucket-tile';
    tile.title = filePath;

    const img = document.createElement('img');
    img.src = timelineImageUrl(filePath);
    img.alt = basename(filePath);
    img.loading = 'lazy';
    img.onerror = () => {
      img.replaceWith(
        Object.assign(document.createElement('div'), {
          className: 'timeline-bucket-fallback',
          textContent: basename(filePath),
        }),
      );
    };

    const caption = document.createElement('span');
    caption.className = 'timeline-bucket-caption';
    caption.textContent = basename(filePath);

    tile.appendChild(img);
    tile.appendChild(caption);
    timelineBucketGrid.appendChild(tile);
  }

  timelineBucketSection.classList.remove('hidden');
  timelineBucketSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function startTimeline(dirPath) {
  const trimmed = dirPath.trim();
  if (!trimmed) return;

  recordPathUsage(trimmed);
  hidePathSuggestions();
  hideScanResult();

  scanBtn.disabled = true;
  scanIdle.classList.add('hidden');
  timelineResults.classList.add('hidden');
  hideTimelineBucketPreview();
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Читання метаданих…';
  scanInProgress = true;
  btnCancelScan.classList.remove('hidden');
  const abort = beginScanAbort();

  try {
    const res = await fetch('/api/timeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmed }),
      signal: abort.signal,
    });

    if (!res.ok) throw new Error('Timeline request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data = line.slice(6);
        }

        if (!data) continue;
        const parsed = JSON.parse(data);

        if (event === 'progress') {
          const pct = parsed.total ? Math.round((parsed.current / parsed.total) * 100) : 0;
          progressFill.style.width = `${pct}%`;
          progressText.textContent = `Читання метаданих: ${parsed.current} / ${parsed.total}`;
        } else if (event === 'error') {
          throw new Error(parsed.error);
        } else if (event === 'done') {
          progress.classList.add('hidden');
          if (!parsed.total) {
            showScanEmptyResult({
              icon: '◷',
              title: 'Фото не знайдено',
              message: 'У цій папці немає зображень з датою зйомки (EXIF або дата файлу).',
              path: trimmed,
            });
            return;
          }
          renderTimelineResults(parsed).catch((err) => {
            progress.classList.remove('hidden');
            progressText.textContent = `Помилка карти: ${err.message}`;
          });
          timelineResults.classList.remove('hidden');
          scanIdle.classList.add('hidden');
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      progress.classList.add('hidden');
      updateScanIdle();
      return;
    }
    progress.classList.remove('hidden');
    progressText.textContent = `Помилка: ${err.message}`;
  } finally {
    finishScanUi();
  }
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

function imageUrl(filePath) {
  return `/api/image?sessionId=${encodeURIComponent(state.sessionId)}&path=${encodeURIComponent(filePath)}`;
}

function batchImageUrl(batchId, filePath) {
  return `/api/batch-image?batch=${encodeURIComponent(batchId)}&path=${encodeURIComponent(filePath)}`;
}

function cleanupImageUrl(filePath) {
  return `/api/image?sessionId=${encodeURIComponent(cleanupState.sessionId)}&path=${encodeURIComponent(filePath)}`;
}

function renderCard() {
  const group = state.groups[state.index];
  if (!group) return;

  const prediction = getPredictionForIndex(state.index);
  const undecided = !hasDecisionForIndex(state.index);

  if (undecided && prediction?.keeper && group.includes(prediction.keeper)) {
    state.keeper = prediction.keeper;
  } else if (!state.keeper || !group.includes(state.keeper)) {
    state.keeper = group[0];
  }

  counter.textContent = `${state.index + 1} / ${state.groups.length}`;

  if (undecided && prediction) {
    predictionHint.classList.remove('hidden');
    if (prediction.sameFolder) {
      predictionHint.textContent = 'За аналогією: дублікати в одній папці — можна видалити будь-яку копію';
    } else if (prediction.kind === 'partial') {
      predictionHint.textContent = `За аналогією: видалити ${prediction.toDelete.length} з ${group.length} (залишиться ${prediction.remaining.length})`;
    } else {
      predictionHint.textContent = 'За аналогією: залишити копію в обраній папці';
    }
  } else {
    predictionHint.classList.add('hidden');
    predictionHint.textContent = '';
  }

  cardImages.innerHTML = '';
  cardPaths.innerHTML = '';

  for (const filePath of group) {
    const isKeeper = filePath === state.keeper;
    const isPredictedDelete = undecided && prediction?.toDelete.includes(filePath);

    const wrap = document.createElement('div');
    wrap.className =
      'img-wrap' +
      (isKeeper ? ' keeper' : '') +
      (isPredictedDelete ? ' predicted-delete' : '');

    const img = document.createElement('img');
    img.src = imageUrl(filePath);
    img.alt = basename(filePath);
    img.loading = 'lazy';
    img.onerror = () => {
      wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.7rem;color:var(--muted);padding:8px;text-align:center">${basename(filePath)}</div>`;
    };

    if (isKeeper) {
      const badge = document.createElement('span');
      badge.className = 'keeper-badge';
      badge.textContent = 'залишити';
      wrap.appendChild(badge);
    } else if (isPredictedDelete) {
      const badge = document.createElement('span');
      badge.className = 'predicted-delete-badge';
      badge.textContent = 'видалити за аналогією';
      wrap.appendChild(badge);
    }

    wrap.appendChild(img);
    wrap.addEventListener('click', () => selectKeeper(filePath));
    cardImages.appendChild(wrap);

    const pathLine = document.createElement('div');
    pathLine.className = isKeeper ? 'keeper-path' : isPredictedDelete ? 'predicted-delete-path' : '';
    pathLine.textContent = filePath;
    cardPaths.appendChild(pathLine);
  }

  card.classList.remove('swipe-left', 'swipe-right');
  card.style.transform = '';
  card.style.opacity = '';
}

function selectKeeper(filePath) {
  if (state.keeper === filePath) return;
  state.keeper = filePath;
  renderCard();
}

function cycleKeeper(direction) {
  const group = state.groups[state.index];
  const i = group.indexOf(state.keeper);
  const next = (i + direction + group.length) % group.length;
  selectKeeper(group[next]);
}

function swipe(direction) {
  const action = direction === 'right' ? 'yes' : 'no';
  const prediction = getPredictionForIndex(state.index);

  const decision = {
    groupIndex: state.index,
    action,
    keeper: state.keeper,
  };

  if (action === 'yes' && prediction && !hasDecisionForIndex(state.index) && state.keeper === prediction.keeper) {
    decision.toDelete = prediction.toDelete;
    decision.predicted = true;
    decision.predictionKind = prediction.kind;
  }

  state.decisions.push(decision);

  card.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');

  setTimeout(() => {
    state.index += 1;
    state.keeper = null;
    advanceIndexPastDecided();
    if (state.index >= state.groups.length) {
      saveBatch(true);
    } else {
      renderCard();
      refreshPredictions();
    }
  }, 320);
}

async function saveBatch(finished = false) {
  btnSave.disabled = true;
  try {
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        batchId: state.batchId,
        decisions: state.decisions,
        resumeIndex: state.index,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    state.batchId = data.batchId;
    duplicatesSavedSnapshot = snapshotDuplicates();

    if (finished) {
      const s = data.summary;
      doneSummary.textContent =
        `Переглянуто ${s.reviewedGroups} груп. Підтверджено: ${s.confirmed}, відхилено: ${s.rejected}. Файлів до видалення: ${s.filesToDelete}.`;
      doneFile.textContent = `Збережено: ${data.filePath}`;
      showScreen(doneScreen);
    } else {
      showToast(`Збережено (${data.summary.reviewedGroups}/${data.summary.totalGroups} груп)`);
    }
  } catch (err) {
    if (finished) {
      alert(`Помилка збереження: ${err.message}`);
      showScreen(reviewScreen);
    } else {
      showToast(`Помилка: ${err.message}`);
    }
  } finally {
    btnSave.disabled = false;
  }
}

function startReview(sessionData) {
  state = {
    sessionId: sessionData.sessionId,
    batchId: sessionData.batchId ?? null,
    scanPath: sessionData.scanPath,
    groups: sessionData.groups,
    index: sessionData.resumeIndex ?? 0,
    keeper: null,
    decisions: sessionData.decisions ?? [],
    predictionsDismissed: false,
  };

  predictionsCache = [];
  advanceIndexPastDecided();
  scanPathEl.textContent = sessionData.scanPath;
  renderCard();
  duplicatesSavedSnapshot = snapshotDuplicates();
  showScreen(reviewScreen);
  refreshPredictions();
}

async function loadBatchesList() {
  try {
    const res = await fetch('/api/batches');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!data.batches.length) {
      batchesList.innerHTML = EMPTY_BATCHES_HTML;
      return;
    }

    batchesList.innerHTML = '';
    for (const batch of data.batches) {
      const item = document.createElement('div');
      item.className = 'batch-item';

      const s = batch.summary;
      const isCleanup = batch.type === 'cleanup';
      const typeLabel = isCleanup ? 'Видалення' : 'Дублікати';
      const progressLabel = s.complete
        ? 'завершено'
        : isCleanup
          ? `${s.reviewedFiles ?? s.reviewedGroups ?? 0}/${s.totalFiles ?? s.totalGroups ?? 0} фото`
          : `${s.reviewedGroups}/${s.totalGroups} груп`;

      item.innerHTML = `
        <div class="batch-item-type ${isCleanup ? 'cleanup' : 'duplicates'}">${typeLabel}</div>
        <div class="batch-item-date">${formatDate(batch.updatedAt)}</div>
        <div class="batch-item-path">${batch.scanPath}</div>
        <div class="batch-item-stats">
          <span>${progressLabel}</span>
          <span class="delete-count">${s.filesToDelete} на видалення</span>
        </div>
        <div class="batch-item-actions"></div>
      `;

      const actions = item.querySelector('.batch-item-actions');

      if (!s.complete) {
        const resumeBtn = document.createElement('button');
        resumeBtn.type = 'button';
        resumeBtn.className = 'text-btn';
        resumeBtn.textContent = 'Продовжити';
        resumeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (batch.type === 'cleanup') resumeCleanupBatch(batch.fileName);
          else resumeBatch(batch.fileName);
        });
        actions.appendChild(resumeBtn);
      } else if (isCleanup && s.reviewMode === 'grid') {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'text-btn';
        editBtn.textContent = 'Редагувати';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          resumeCleanupBatch(batch.fileName);
        });
        actions.appendChild(editBtn);
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'text-btn danger-btn';
      deleteBtn.textContent = 'Видалити';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteBatch(batch.fileName);
      });
      actions.appendChild(deleteBtn);

      item.addEventListener('click', () => openBatch(batch.fileName));
      batchesList.appendChild(item);
    }
  } catch (err) {
    batchesList.innerHTML = `
      <div class="empty-state empty-state-inline">
        <div class="empty-state-icon" aria-hidden="true">!</div>
        <h3 class="empty-state-title">Не вдалося завантажити</h3>
        <p class="empty-state-message">${err.message}</p>
      </div>
    `;
  }
}

async function openBatch(fileName) {
  try {
    const res = await fetch(`/api/batches/${encodeURIComponent(fileName)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    currentBatch = { fileName, ...data };
    renderBatchDetail();
    showScreen(batchScreen);
  } catch (err) {
    alert(`Помилка: ${err.message}`);
  }
}

function renderBatchDetail() {
  const b = currentBatch;
  const isCleanup = b.type === 'cleanup';

  if (isCleanup) {
    renderCleanupBatchDetail();
    return;
  }

  const reviewed = b.summary.reviewedGroups ?? b.summary.total ?? b.decisions.length;
  const total = b.summary.totalGroups ?? b.summary.total ?? reviewed;
  const filesToDelete =
    b.summary.filesToDelete ??
    b.decisions.filter((d) => d.action === 'yes').reduce((n, d) => n + d.toDelete.length, 0);
  const confirmedCount = b.summary.confirmed ?? b.decisions.filter((d) => d.action === 'yes').length;
  const rejected = b.summary.rejected ?? b.decisions.filter((d) => d.action === 'no').length;

  batchTitle.textContent = formatDate(b.updatedAt ?? b.savedAt);
  batchMeta.innerHTML = `
    <dl>
      <dt>Шлях:</dt><dd>${b.scanPath}</dd>
      <dt>Груп:</dt><dd>${reviewed} / ${total} переглянуто</dd>
      <dt>Підтверджено:</dt><dd>${confirmedCount}</dd>
      <dt>Відхилено:</dt><dd>${rejected}</dd>
      <dt>На видалення:</dt><dd>${filesToDelete} файлів</dd>
    </dl>
  `;

  batchDeleteList.innerHTML = '';
  const confirmedDecisions = b.decisions.filter((d) => d.action === 'yes' && d.toDelete.length);

  if (!confirmedDecisions.length) {
    batchDeleteList.innerHTML = '<p class="hint">Немає файлів для видалення в цьому батчі</p>';
    btnExecute.disabled = true;
    btnExecute.textContent = 'Execute — нічого видаляти';
    return;
  }

  btnExecute.disabled = false;
  btnExecute.textContent = `Execute — видалити ${filesToDelete} файлів`;

  confirmedDecisions.forEach((decision, i) => {
    const group = document.createElement('div');
    group.className = 'delete-group';
    group.innerHTML = `<div class="delete-group-title">Група ${decision.groupIndex + 1}</div>`;

    const images = document.createElement('div');
    images.className = 'delete-group-images';

    for (const filePath of decision.files) {
      const isKeeper = filePath === decision.keeper;
      const isDelete = decision.toDelete.includes(filePath);
      if (!isKeeper && !isDelete) continue;

      const cell = document.createElement('div');
      const predictedLabel = decision.predicted ? ' · за аналогією' : '';
      cell.innerHTML = `
        <div class="delete-thumb ${isKeeper ? 'keeper' : 'remove'}">
          <img src="${batchImageUrl(b.fileName, filePath)}" alt="${basename(filePath)}" loading="lazy">
          <span class="label">${isKeeper ? 'залишити' : 'видалити'}${predictedLabel}</span>
        </div>
        <div class="path">${filePath}</div>
      `;
      images.appendChild(cell);
    }

    group.appendChild(images);
    batchDeleteList.appendChild(group);
  });
}

function renderCleanupBatchDetail() {
  const b = currentBatch;
  const filesToDelete = b.decisions.filter((d) => d.action === 'yes');
  const count = b.summary.filesToDelete ?? filesToDelete.length;

  batchTitle.textContent = formatDate(b.updatedAt ?? b.savedAt);
  batchMeta.innerHTML = `
    <dl>
      <dt>Тип:</dt><dd>Видалення</dd>
      <dt>Шлях:</dt><dd>${b.scanPath}</dd>
      <dt>Режим:</dt><dd>${b.reviewMode === 'grid' ? 'Плитки' : 'Картки'}</dd>
      <dt>Фото в папці:</dt><dd>${b.files?.length ?? 0}</dd>
      <dt>На видалення:</dt><dd>${count} файлів</dd>
    </dl>
  `;

  batchDeleteList.innerHTML = '';

  if (!filesToDelete.length) {
    batchDeleteList.innerHTML = '<p class="hint">Немає файлів для видалення в цьому батчі</p>';
    btnExecute.disabled = true;
    btnExecute.textContent = 'Execute — нічого видаляти';
    return;
  }

  btnExecute.disabled = false;
  btnExecute.textContent = `Execute — видалити ${count} файлів`;

  const group = document.createElement('div');
  group.className = 'delete-group';
  group.innerHTML = '<div class="delete-group-title">Файли на видалення</div>';

  const images = document.createElement('div');
  images.className = 'cleanup-delete-list';

  for (const decision of filesToDelete) {
    const filePath = decision.file ?? b.files?.[decision.fileIndex];
    if (!filePath) continue;

    const cell = document.createElement('div');
    cell.innerHTML = `
      <div class="delete-thumb remove">
        <img src="${batchImageUrl(b.fileName, filePath)}" alt="${basename(filePath)}" loading="lazy">
        <span class="label">видалити</span>
      </div>
      <div class="path">${filePath}</div>
    `;
    images.appendChild(cell);
  }

  group.appendChild(images);
  batchDeleteList.appendChild(group);
}

async function confirmDeleteBatch(fileName) {
  showModal({
    title: 'Видалити батч?',
    message: 'Запис батчу буде видалено. Файли на диску не чіпаються.',
    buttons: [
      { label: 'Скасувати' },
      {
        label: 'Видалити',
        danger: true,
        onClick: () => deleteBatchFile(fileName),
      },
    ],
  });
}

async function deleteBatchFile(fileName) {
  try {
    const res = await fetch(`/api/batches/${encodeURIComponent(fileName)}/delete`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (currentBatch?.fileName === fileName) {
      currentBatch = null;
      setScanMode('batches');
      showScreen(scanScreen);
    } else {
      loadBatchesList();
    }
    showToast('Батч видалено');
  } catch (err) {
    alert(`Помилка: ${err.message}`);
  }
}

async function executeBatch() {
  if (!currentBatch) return;

  const count =
    currentBatch.type === 'cleanup'
      ? (currentBatch.summary.filesToDelete ??
        currentBatch.decisions.filter((d) => d.action === 'yes').length)
      : (currentBatch.summary.filesToDelete ??
        currentBatch.decisions
          .filter((d) => d.action === 'yes')
          .reduce((n, d) => n + d.toDelete.length, 0));

  const msg = `Видалити ${count} файлів? Цю дію не можна скасувати.`;
  if (!confirm(msg)) return;

  btnExecute.disabled = true;
  btnExecute.textContent = 'Виконую…';

  try {
    const res = await fetch(`/api/batches/${encodeURIComponent(currentBatch.fileName)}/execute`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Видалено ${data.deleted} файлів`);
    currentBatch = null;
    setScanMode('batches');
    showScreen(scanScreen);
  } catch (err) {
    alert(`Помилка: ${err.message}`);
    btnExecute.disabled = false;
    renderBatchDetail();
  }
}

async function resumeBatch(fileName) {
  try {
    const res = await fetch(`/api/batches/${encodeURIComponent(fileName)}/resume`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    startReview({
      sessionId: data.sessionId,
      batchId: data.batchId,
      scanPath: data.scanPath,
      groups: data.groups,
      resumeIndex: data.resumeIndex,
      decisions: data.decisions.map((d) => ({
        groupIndex: d.groupIndex,
        action: d.action,
        keeper: d.keeper,
        toDelete: d.toDelete,
        predicted: d.predicted,
        predictionKind: d.predictionKind,
      })),
    });
  } catch (err) {
    alert(`Помилка: ${err.message}`);
  }
}

function setCleanupReviewMode(mode) {
  cleanupState.reviewMode = mode;
  const isTinder = mode === 'tinder';

  cleanupModeTinder.classList.toggle('active', isTinder);
  cleanupModeGrid.classList.toggle('active', !isTinder);
  cleanupModeTinder.setAttribute('aria-selected', String(isTinder));
  cleanupModeGrid.setAttribute('aria-selected', String(!isTinder));

  cleanupTinderView.classList.toggle('hidden', !isTinder);
  cleanupGridView.classList.toggle('hidden', isTinder);

  if (!isTinder) {
    cleanupState.selected.clear();
    for (const d of cleanupState.decisions) {
      if (d.action === 'yes') cleanupState.selected.add(d.fileIndex);
    }
  }

  if (isTinder) renderCleanupCard();
  else renderCleanupGrid();
}

function startCleanupReview(sessionData) {
  const selected = new Set();
  for (const d of sessionData.decisions ?? []) {
    if (d.action === 'yes') selected.add(d.fileIndex);
  }

  cleanupState = {
    sessionId: sessionData.sessionId,
    batchId: sessionData.batchId ?? null,
    scanPath: sessionData.scanPath,
    files: sessionData.files,
    index: sessionData.resumeIndex ?? 0,
    decisions: (sessionData.decisions ?? []).map((d) => ({
      fileIndex: d.fileIndex,
      action: d.action,
    })),
    reviewMode: sessionData.reviewMode ?? 'tinder',
    selected,
    tileSize: cleanupState.tileSize ?? 120,
  };

  cleanupScanPathEl.textContent = sessionData.scanPath;
  tileSizeSlider.value = String(cleanupState.tileSize);
  cleanupGrid.style.setProperty('--tile-size', `${cleanupState.tileSize}px`);

  setCleanupReviewMode(cleanupState.reviewMode);
  cleanupSavedSnapshot = snapshotCleanup();
  showScreen(cleanupReviewScreen);
}

function renderCleanupCard() {
  const filePath = cleanupState.files[cleanupState.index];
  if (!filePath) return;

  cleanupCounter.textContent = `${cleanupState.index + 1} / ${cleanupState.files.length}`;

  cleanupCardImage.innerHTML = '';
  const img = document.createElement('img');
  img.src = cleanupImageUrl(filePath);
  img.alt = basename(filePath);
  img.onerror = () => {
    cleanupCardImage.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;color:var(--muted);padding:16px;text-align:center">${basename(filePath)}</div>`;
  };
  cleanupCardImage.appendChild(img);

  cleanupCardPath.textContent = filePath;
  cleanupCard.classList.remove('swipe-left', 'swipe-right');
  cleanupCard.style.transform = '';
  cleanupCard.style.opacity = '';
}

function cleanupSwipe(direction) {
  const action = direction === 'right' ? 'yes' : 'no';

  cleanupState.decisions.push({
    fileIndex: cleanupState.index,
    action,
  });

  cleanupCard.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');

  setTimeout(() => {
    cleanupState.index += 1;
    if (cleanupState.index >= cleanupState.files.length) {
      saveCleanupBatch(true);
    } else {
      renderCleanupCard();
    }
  }, 320);
}

function renderCleanupGrid() {
  cleanupGrid.style.setProperty('--tile-size', `${cleanupState.tileSize}px`);
  cleanupGrid.innerHTML = '';

  cleanupState.files.forEach((filePath, i) => {
    const tile = document.createElement('div');
    tile.className = 'cleanup-tile' + (cleanupState.selected.has(i) ? ' selected' : '');
    tile.dataset.index = String(i);

    const badge = document.createElement('span');
    badge.className = 'select-badge';
    badge.textContent = '✓';

    const img = document.createElement('img');
    img.src = cleanupImageUrl(filePath);
    img.alt = basename(filePath);
    img.loading = 'lazy';
    img.onerror = () => {
      img.replaceWith(
        Object.assign(document.createElement('div'), {
          style: 'display:flex;align-items:center;justify-content:center;height:100%;font-size:0.65rem;color:var(--muted);padding:4px;text-align:center',
          textContent: basename(filePath),
        }),
      );
    };

    tile.appendChild(badge);
    tile.appendChild(img);
    tile.addEventListener('click', () => toggleCleanupSelection(i));
    cleanupGrid.appendChild(tile);
  });

  updateCleanupSelectedCount();
  cleanupCounter.textContent = `${cleanupState.files.length} фото`;
}

function toggleCleanupSelection(index) {
  if (cleanupState.selected.has(index)) cleanupState.selected.delete(index);
  else cleanupState.selected.add(index);
  renderCleanupGrid();
}

function updateCleanupSelectedCount() {
  cleanupSelectedCount.textContent = `${cleanupState.selected.size} обрано`;
}

function buildGridDecisions() {
  return [...cleanupState.selected].sort((a, b) => a - b).map((fileIndex) => ({
    fileIndex,
    action: 'yes',
  }));
}

async function saveCleanupBatch(finished = false) {
  const btn = cleanupState.reviewMode === 'grid' ? btnCleanupGridSave : btnCleanupSave;
  btn.disabled = true;

  const decisions =
    cleanupState.reviewMode === 'grid'
      ? buildGridDecisions()
      : cleanupState.decisions;

  const resumeIndex =
    cleanupState.reviewMode === 'grid'
      ? cleanupState.files.length
      : cleanupState.index;

  try {
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: cleanupState.sessionId,
        batchId: cleanupState.batchId,
        decisions,
        resumeIndex,
        reviewMode: cleanupState.reviewMode,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    cleanupState.batchId = data.batchId;
    cleanupSavedSnapshot = snapshotCleanup();

    if (finished) {
      const s = data.summary;
      if (cleanupState.reviewMode === 'tinder') {
        cleanupDoneSummary.textContent =
          `Переглянуто ${s.reviewedFiles} фото. На видалення: ${s.filesToDelete}, залишити: ${s.rejected}.`;
      } else {
        cleanupDoneSummary.textContent = `Обрано ${s.filesToDelete} фото на видалення з ${s.totalFiles}.`;
      }
      cleanupDoneFile.textContent = `Збережено: ${data.filePath}`;
      showScreen(cleanupDoneScreen);
    } else {
      const label =
        cleanupState.reviewMode === 'grid'
          ? `${data.summary.filesToDelete} на видалення`
          : `${data.summary.reviewedFiles}/${data.summary.totalFiles} фото`;
      showToast(`Збережено (${label})`);
    }
  } catch (err) {
    if (finished) {
      alert(`Помилка збереження: ${err.message}`);
      showScreen(cleanupReviewScreen);
    } else {
      showToast(`Помилка: ${err.message}`);
    }
  } finally {
    btn.disabled = false;
  }
}

async function resumeCleanupBatch(fileName) {
  try {
    const res = await fetch(`/api/batches/${encodeURIComponent(fileName)}/resume`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    startCleanupReview({
      sessionId: data.sessionId,
      batchId: data.batchId,
      scanPath: data.scanPath,
      files: data.files,
      reviewMode: data.reviewMode,
      resumeIndex: data.resumeIndex,
      decisions: data.decisions.map((d) => ({
        fileIndex: d.fileIndex,
        action: d.action,
      })),
    });
  } catch (err) {
    alert(`Помилка: ${err.message}`);
  }
}

async function startCleanupScan(dirPath) {
  const trimmed = dirPath.trim();
  if (!trimmed) return;

  recordPathUsage(trimmed);
  hidePathSuggestions();
  hideScanResult();

  scanBtn.disabled = true;
  scanIdle.classList.add('hidden');
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Сканування фото…';
  scanInProgress = true;
  btnCancelScan.classList.remove('hidden');
  const abort = beginScanAbort();

  try {
    const res = await fetch('/api/scan-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmed }),
      signal: abort.signal,
    });

    if (!res.ok) throw new Error('Scan request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data = line.slice(6);
        }

        if (!data) continue;
        const parsed = JSON.parse(data);

        if (event === 'progress') {
          const pct = parsed.total ? Math.round((parsed.current / parsed.total) * 100) : 0;
          progressFill.style.width = `${pct}%`;
          progressText.textContent = `Сканування: ${parsed.current} / ${parsed.total}`;
        } else if (event === 'error') {
          throw new Error(parsed.error);
        } else if (event === 'done') {
          progress.classList.add('hidden');

          if (parsed.count === 0) {
            showScanEmptyResult({
              icon: '▦',
              title: 'Фото не знайдено',
              message: 'У цій папці немає зображень для перегляду.',
              path: parsed.scanPath ?? trimmed,
            });
            return;
          }

          startCleanupReview({
            sessionId: parsed.sessionId,
            batchId: null,
            scanPath: parsed.scanPath,
            files: parsed.files,
            resumeIndex: 0,
            reviewMode: 'tinder',
            decisions: [],
          });
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      progress.classList.add('hidden');
      return;
    }
    progress.classList.remove('hidden');
    progressText.textContent = `Помилка: ${err.message}`;
  } finally {
    finishScanUi();
  }
}

async function startScan(dirPath) {
  const trimmed = dirPath.trim();
  if (!trimmed) return;

  recordPathUsage(trimmed);
  hidePathSuggestions();
  hideScanResult();

  scanBtn.disabled = true;
  scanIdle.classList.add('hidden');
  progress.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = 'Початок сканування…';
  scanInProgress = true;
  btnCancelScan.classList.remove('hidden');
  const abort = beginScanAbort();

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
      signal: abort.signal,
    });

    if (!res.ok) throw new Error('Scan request failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          else if (line.startsWith('data: ')) data = line.slice(6);
        }

        if (!data) continue;
        const parsed = JSON.parse(data);

        if (event === 'progress') {
          const pct = parsed.total ? Math.round((parsed.current / parsed.total) * 100) : 0;
          progressFill.style.width = `${pct}%`;
          const label = parsed.phase === 'scan' ? 'Сканування' : 'Хешування';
          progressText.textContent = `${label}: ${parsed.current} / ${parsed.total}`;
        } else if (event === 'error') {
          throw new Error(parsed.error);
        } else if (event === 'done') {
          progress.classList.add('hidden');

          if (parsed.count === 0) {
            showScanEmptyResult({
              icon: '✓',
              title: 'Дублікатів не знайдено',
              message: 'Усі файли в папці унікальні за вмістом — нічого порівнювати.',
              path: parsed.scanPath ?? trimmed,
            });
            return;
          }

          startReview({
            sessionId: parsed.sessionId,
            batchId: null,
            scanPath: parsed.scanPath,
            groups: parsed.groups,
            resumeIndex: 0,
            decisions: [],
          });
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      progress.classList.add('hidden');
      return;
    }
    progressText.textContent = `Помилка: ${err.message}`;
  } finally {
    finishScanUi();
  }
}

async function pickFolderFromDialog() {
  pickFolderBtn.disabled = true;
  try {
    const res = await fetch('/api/pick-folder', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не вдалося відкрити діалог');
    if (!data.cancelled && data.path) {
      pathInput.value = data.path;
      hidePathSuggestions();
    }
  } catch (err) {
    showToast(err.message);
  } finally {
    pickFolderBtn.disabled = false;
  }
}

pickFolderBtn.addEventListener('click', pickFolderFromDialog);

scanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (scanMode === 'batches') return;
  const dirPath = pathInput.value.trim();
  if (scanMode === 'timeline') {
    startTimeline(dirPath);
  } else if (scanMode === 'cleanup') {
    startCleanupScan(dirPath);
  } else {
    startScan(dirPath);
  }
});

modeDuplicates.addEventListener('click', () => {
  const switchTo = () => setScanMode('duplicates');
  if (isInReview()) tryExitReview(switchTo);
  else if (scanInProgress) tryCancelScan(switchTo);
  else switchTo();
});
modeCleanup.addEventListener('click', () => {
  const switchTo = () => setScanMode('cleanup');
  if (isInReview()) tryExitReview(switchTo);
  else if (scanInProgress) tryCancelScan(switchTo);
  else switchTo();
});
modeTimeline.addEventListener('click', () => {
  const switchTo = () => setScanMode('timeline');
  if (isInReview()) tryExitReview(switchTo);
  else if (scanInProgress) tryCancelScan(switchTo);
  else switchTo();
});
modeBatches.addEventListener('click', () => {
  const switchTo = () => setScanMode('batches');
  if (isInReview()) tryExitReview(switchTo);
  else if (scanInProgress) tryCancelScan(switchTo);
  else switchTo();
});

btnScanAgain.addEventListener('click', () => {
  hideScanResult();
  pathInput.focus();
  pathInput.select();
});

pathInput.addEventListener('focus', showPathSuggestions);
pathInput.addEventListener('click', showPathSuggestions);
pathInput.addEventListener('blur', () => {
  setTimeout(hidePathSuggestions, 150);
});

btnNo.addEventListener('click', () => swipe('left'));
btnYes.addEventListener('click', () => swipe('right'));
btnSave.addEventListener('click', () => saveBatch(false));
btnReviewExit.addEventListener('click', exitToHome);
btnCleanupExit.addEventListener('click', exitToHome);
btnPredictionApply.addEventListener('click', () => {
  hidePredictionModal();
  applyPredictions();
});
btnPredictionDismiss.addEventListener('click', dismissPredictions);
predictionModalBackdrop.addEventListener('click', dismissPredictions);
btnCancelScan.addEventListener('click', () => tryCancelScan(() => {}));
modalBackdrop.addEventListener('click', closeModal);

btnRestart.addEventListener('click', () => {
  progress.classList.add('hidden');
  timelineResults.classList.add('hidden');
  hideTimelineBucketPreview();
  timelineMapSection.classList.add('hidden');
  destroyLocationMap();
  hideScanResult();
  showScreen(scanScreen);
  updateScanIdle();
});

btnCleanupRestart.addEventListener('click', () => {
  progress.classList.add('hidden');
  hideScanResult();
  showScreen(scanScreen);
  updateScanIdle();
});

btnBatchBack.addEventListener('click', () => {
  setScanMode('batches');
  showScreen(scanScreen);
});
btnExecute.addEventListener('click', executeBatch);
btnDeleteBatch.addEventListener('click', () => {
  if (currentBatch) confirmDeleteBatch(currentBatch.fileName);
});

btnCleanupNo.addEventListener('click', () => cleanupSwipe('left'));
btnCleanupYes.addEventListener('click', () => cleanupSwipe('right'));
btnCleanupSave.addEventListener('click', () => saveCleanupBatch(false));
btnCleanupGridSave.addEventListener('click', () => saveCleanupBatch(true));
cleanupModeTinder.addEventListener('click', () => setCleanupReviewMode('tinder'));
cleanupModeGrid.addEventListener('click', () => setCleanupReviewMode('grid'));

tileSizeSlider.addEventListener('input', () => {
  cleanupState.tileSize = Number(tileSizeSlider.value);
  cleanupGrid.style.setProperty('--tile-size', `${cleanupState.tileSize}px`);
});

btnSelectAll.addEventListener('click', () => {
  cleanupState.selected = new Set(cleanupState.files.map((_, i) => i));
  renderCleanupGrid();
});

btnDeselectAll.addEventListener('click', () => {
  cleanupState.selected.clear();
  renderCleanupGrid();
});

// Touch swipe — duplicates
let touchStartX = 0;
let dragging = false;

card.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  dragging = true;
}, { passive: true });

card.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  const dx = e.touches[0].clientX - touchStartX;
  card.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
  card.style.opacity = String(1 - Math.abs(dx) / 400);
}, { passive: true });

card.addEventListener('touchend', (e) => {
  if (!dragging) return;
  dragging = false;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx > 80) swipe('right');
  else if (dx < -80) swipe('left');
  else {
    card.style.transform = '';
    card.style.opacity = '';
  }
});

// Touch swipe — cleanup
let cleanupTouchStartX = 0;
let cleanupDragging = false;

cleanupCard.addEventListener('touchstart', (e) => {
  cleanupTouchStartX = e.touches[0].clientX;
  cleanupDragging = true;
}, { passive: true });

cleanupCard.addEventListener('touchmove', (e) => {
  if (!cleanupDragging) return;
  const dx = e.touches[0].clientX - cleanupTouchStartX;
  cleanupCard.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
  cleanupCard.style.opacity = String(1 - Math.abs(dx) / 400);
}, { passive: true });

cleanupCard.addEventListener('touchend', (e) => {
  if (!cleanupDragging) return;
  cleanupDragging = false;
  const dx = e.changedTouches[0].clientX - cleanupTouchStartX;
  if (dx > 80) cleanupSwipe('right');
  else if (dx < -80) cleanupSwipe('left');
  else {
    cleanupCard.style.transform = '';
    cleanupCard.style.opacity = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (predictionModalOpen) {
    if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault();
      dismissPredictions();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      hidePredictionModal();
      applyPredictions();
    }
    return;
  }

  if (cleanupReviewScreen.classList.contains('active') && cleanupState.reviewMode === 'tinder') {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cleanupSwipe('left');
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      cleanupSwipe('right');
    }
    return;
  }

  if (!reviewScreen.classList.contains('active')) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    cycleKeeper(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    cycleKeeper(1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    swipe('right');
  }
});

loadBatchesList();
setScanMode('duplicates');
updateScanIdle();
