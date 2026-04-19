/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/crossword.js
   Part 5: Crossword Tile System
   ─────────────────────────────────────────────────────────────
   Reads NullCorps.state.cardName, parses the crossword notation,
   renders tiles (PNG + letter) into Layer 6 (horizontal) and
   Layer 7 (vertical) on the card stage.

   Notation:
     Normal letter  →  plain tile
     [x]            →  merge point — shared letter between two words,
                        receives a colour overlay (gold)
     <x>            →  special letter — receives a colour overlay (cyan)

   Layout rules:
     • First word  → horizontal (or vertical if flipped) row of tiles
     • Second word → perpendicular, crossing the first at a shared letter
     • Merge is found automatically: looks for any letter shared between
       adjacent words.  [x] / <x> notation still works but is optional.
     • If no shared letter exists the words are split (same as Separate mode).
     • If more words are present they alternate H/V.

   Separate Words mode:
     • Each word gets its own independent bounding box (drag/resize/rotate).
     • Merge letters cannot be set (ignored) but special letters still work.

   Bounding Box UI:
     • Drag to move
     • Corner handle to resize (proportional)
     • Rotation handle above the group

   Settings panel:
     • "Separate Words" toggle above the word inputs.
     • "Flip Word 1 Direction" button to swap H↔V for the first word.
     • One editable input per word, pre-filled from the parsed name.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Tile constants ──────────────────────────────────────── */
  const TILE_SIZE   = 160;
  const TILE_GAP    = 0;
  const FONT_SIZE   = 96;
  const FONT_FAMILY = "'Archivo', Arial, sans-serif";

  /* Tile colours */
  const COLOR_MERGE   = 'rgba(212,168,0,0.55)';
  const COLOR_SPECIAL = 'rgba(0,200,220,0.55)';

  /* Letter colours */
  const LETTER_COLOR    = '#ffffff';
  const LETTER_OUTLINE  = '#000000';
  const LETTER_OUTLINE_W = 4;

  const DEFAULT_TILE = 'assets/default_tile.png';

  /* ── Crossword state ──────────────────────────────────────── */
  let _words    = [];
  // _bbState[0] = joined group OR word-0 when separated; [1] = word-1; etc.
  let _bbStates = [
    { x: 500, y: 400, scale: 1, angle: 0 },
    { x: 500, y: 700, scale: 1, angle: 0 },
    { x: 500, y: 1000, scale: 1, angle: 0 },
    { x: 500, y: 1300, scale: 1, angle: 0 },
  ];

  // UI options (persisted in state too)
  let _separated        = false;   // "Separate Words" toggle
  let _flipFirst        = false;   // flip word-0 direction H↔V
  let _fixedOrientation = false;   // "Fixed Orientation" toggle (separate mode only)
  let _wordOrientations = [];      // per-word forced orientation: 'h' | 'v' (index matches word)

  /* ══════════════════════════════════════════════════════════════
     PARSER
  ══════════════════════════════════════════════════════════════ */

  function _parseWord(wordStr) {
    const letters = [];
    let i = 0;
    while (i < wordStr.length) {
      const ch = wordStr[i];
      if (ch === '[') {
        const close = wordStr.indexOf(']', i);
        if (close !== -1) {
          const inner = wordStr.slice(i + 1, close).toUpperCase();
          for (const c of inner) letters.push({ char: c, type: 'merge' });
          i = close + 1;
        } else { letters.push({ char: ch, type: 'normal' }); i++; }
      } else if (ch === '<') {
        const close = wordStr.indexOf('>', i);
        if (close !== -1) {
          const inner = wordStr.slice(i + 1, close).toUpperCase();
          for (const c of inner) letters.push({ char: c, type: 'special' });
          i = close + 1;
        } else { letters.push({ char: ch, type: 'normal' }); i++; }
      } else {
        letters.push({ char: ch.toUpperCase(), type: 'normal' });
        i++;
      }
    }
    return letters;
  }

  function _splitWords(cardName) {
    return (cardName || '').trim().split(/\s+/).filter(Boolean);
  }

  /* ══════════════════════════════════════════════════════════════
     SMART MERGE FINDER
     Looks for any shared letter between two letter arrays.
     Prefers [merge]-tagged letters first, then falls back to the
     first plain-letter match.  Returns { myIdx, theirIdx } or null.
  ══════════════════════════════════════════════════════════════ */

  function _findMerge(lettersA, lettersB) {
    // 1. Explicit [merge] tags on both sides
    for (let ai = 0; ai < lettersA.length; ai++) {
      if (lettersA[ai].type !== 'merge') continue;
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (lettersB[bi].type === 'merge' && lettersB[bi].char === lettersA[ai].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    // 2. Explicit [merge] on one side matching any letter on the other
    for (let ai = 0; ai < lettersA.length; ai++) {
      if (lettersA[ai].type !== 'merge') continue;
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (lettersB[bi].char === lettersA[ai].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    for (let bi = 0; bi < lettersB.length; bi++) {
      if (lettersB[bi].type !== 'merge') continue;
      for (let ai = 0; ai < lettersA.length; ai++) {
        if (lettersA[ai].char === lettersB[bi].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    // 3. Any shared letter (first match wins)
    for (let ai = 0; ai < lettersA.length; ai++) {
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (lettersA[ai].char === lettersB[bi].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    return null; // no merge possible
  }

  /* ══════════════════════════════════════════════════════════════
     LAYOUT — JOINED MODE
     Returns placed[] with gridX/gridY (tile units) and dir.
     Words that can't find a merge letter are returned with
     separated:true so the renderer treats them independently.
  ══════════════════════════════════════════════════════════════ */

  function _layoutWords(rawWords) {
    if (!rawWords.length) return [];
    const placed = [];

    rawWords.forEach((wordStr, wi) => {
      const letters = _parseWord(wordStr);

      // Direction: if fixedOrientation is on (separate mode), use the per-word override.
      // Otherwise respect _flipFirst for word 0, then alternate.
      let baseDir;
      if (_fixedOrientation && _separated) {
        // Ensure slot exists; default alternates H/V
        if (_wordOrientations[wi] === undefined) {
          _wordOrientations[wi] = (wi % 2 === 0) ? 'h' : 'v';
        }
        baseDir = _wordOrientations[wi];
      } else if (_flipFirst) {
        baseDir = (wi % 2 === 0) ? 'v' : 'h';
      } else {
        baseDir = (wi % 2 === 0) ? 'h' : 'v';
      }

      if (wi === 0) {
        placed.push({ raw: wordStr, letters, dir: baseDir, gridX: 0, gridY: 0, separated: false });
        return;
      }

      // Find best anchor word + merge indices
      let bestAnchor = null, bestMerge = null;
      for (const pw of placed) {
        if (pw.separated) continue;
        const m = _findMerge(pw.letters, letters);
        if (m) { bestAnchor = pw; bestMerge = m; break; }
      }

      // If no shared letter, mark as auto-separated
      if (!bestAnchor) {
        placed.push({ raw: wordStr, letters, dir: baseDir, gridX: 0, gridY: 0, separated: true });
        return;
      }

      // Mark merge letters on both words for rendering
      const anchorMergeIdx = bestMerge.myIdx;    // index in anchor word
      const myMergeIdx     = bestMerge.theirIdx; // index in new word

      // Tag the two letters as merge if they weren't already
      if (bestAnchor.letters[anchorMergeIdx].type === 'normal') {
        bestAnchor.letters[anchorMergeIdx] = { ...bestAnchor.letters[anchorMergeIdx], type: 'merge' };
      }
      if (letters[myMergeIdx].type === 'normal') {
        letters[myMergeIdx] = { ...letters[myMergeIdx], type: 'merge' };
      }

      // Position new word so merge tiles overlap
      let gx, gy;
      if (baseDir === 'h') {
        const anchorCol = bestAnchor.dir === 'h'
          ? bestAnchor.gridX + anchorMergeIdx
          : bestAnchor.gridX;
        const anchorRow = bestAnchor.dir === 'v'
          ? bestAnchor.gridY + anchorMergeIdx
          : bestAnchor.gridY;
        gx = anchorCol - myMergeIdx;
        gy = anchorRow;
      } else {
        const anchorCol = bestAnchor.dir === 'h'
          ? bestAnchor.gridX + anchorMergeIdx
          : bestAnchor.gridX;
        const anchorRow = bestAnchor.dir === 'v'
          ? bestAnchor.gridY + anchorMergeIdx
          : bestAnchor.gridY;
        gx = anchorCol;
        gy = anchorRow - myMergeIdx;
      }

      placed.push({ raw: wordStr, letters, dir: baseDir, gridX: gx, gridY: gy, separated: false });
    });

    return placed;
  }

  /* ══════════════════════════════════════════════════════════════
     TILE FACTORY
  ══════════════════════════════════════════════════════════════ */

  function _tileUrl() {
    const url = window.NullCorps.state.tileImageUrl;
    return (url && url.trim()) ? url.trim() : DEFAULT_TILE;
  }

  function _makeTile(letter, col, row, forceNoMerge) {
    // forceNoMerge: in separated mode merge tags are ignored
    const effectiveLetter = (forceNoMerge && letter.type === 'merge')
      ? { char: letter.char, type: 'normal' }
      : letter;

    const wrapper = document.createElement('div');
    wrapper.className = 'nc-tile';
    wrapper.style.cssText = [
      'position: absolute',
      `left: ${col * (TILE_SIZE + TILE_GAP)}px`,
      `top:  ${row * (TILE_SIZE + TILE_GAP)}px`,
      `width:  ${TILE_SIZE}px`,
      `height: ${TILE_SIZE}px`,
      'overflow: hidden',
      'pointer-events: none',
    ].join(';');

    const img = document.createElement('img');
    img.src = _tileUrl();
    img.alt = '';
    img.draggable = false;
    img.style.cssText = [
      'position: absolute', 'top: 0', 'left: 0',
      `width: ${TILE_SIZE}px`, `height: ${TILE_SIZE}px`,
      'object-fit: cover', 'pointer-events: none',
    ].join(';');
    img.onerror = function () { this.style.visibility = 'hidden'; };
    img.onload  = function () { this.style.visibility = 'visible'; };
    wrapper.appendChild(img);

    if (effectiveLetter.type !== 'normal') {
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position: absolute', 'top: 0', 'left: 0',
        `width: ${TILE_SIZE}px`, `height: ${TILE_SIZE}px`,
        `background: ${effectiveLetter.type === 'merge' ? COLOR_MERGE : COLOR_SPECIAL}`,
        'pointer-events: none',
      ].join(';');
      wrapper.appendChild(overlay);
    }

    const span = document.createElement('span');
    span.textContent = effectiveLetter.char;
    const w = LETTER_OUTLINE_W;
    const shadow = [
      `${w}px 0 0 ${LETTER_OUTLINE}`, `-${w}px 0 0 ${LETTER_OUTLINE}`,
      `0 ${w}px 0 ${LETTER_OUTLINE}`, `0 -${w}px 0 ${LETTER_OUTLINE}`,
      `${w}px ${w}px 0 ${LETTER_OUTLINE}`, `-${w}px ${w}px 0 ${LETTER_OUTLINE}`,
      `${w}px -${w}px 0 ${LETTER_OUTLINE}`, `-${w}px -${w}px 0 ${LETTER_OUTLINE}`,
    ].join(', ');
    span.style.cssText = [
      'position: absolute', 'top: 50%', 'left: 50%',
      'transform: translate(-50%, -50%)',
      `font-family: ${FONT_FAMILY}`, `font-size: ${FONT_SIZE}px`,
      `color: ${LETTER_COLOR}`, `text-shadow: ${shadow}`,
      'font-weight: 400', 'line-height: 1',
      'pointer-events: none', 'user-select: none', 'white-space: nowrap',
    ].join(';');
    wrapper.appendChild(span);

    return wrapper;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDERER
  ══════════════════════════════════════════════════════════════ */

  function _renderTiles() {
    const hContainer = document.querySelector('[data-crossword-layer="h"]');
    const vContainer = document.querySelector('[data-crossword-layer="v"]');
    if (!hContainer || !vContainer) return;

    // Remove all existing crossword groups
    document.querySelectorAll('.nc-crossword-group').forEach(g => g.remove());

    if (!_words.length) return;

    if (_separated) {
      _renderSeparated(hContainer);
    } else {
      _renderJoined(hContainer);
    }
  }

  /* ── Joined rendering: one group, auto-separated words get offset ── */
  function _renderJoined(container) {
    // Split into "truly joined" cluster and "auto-separated" stragglers
    const joinedWords  = _words.filter(w => !w.separated);
    const splitWords   = _words.filter(w =>  w.separated);

    // Render the main joined cluster
    if (joinedWords.length) {
      _buildGroup(container, joinedWords, 0, false);
    }

    // Render auto-separated words as individual groups (offset positions)
    splitWords.forEach((word, idx) => {
      const bbIdx = joinedWords.length + idx;
      _buildGroup(container, [word], bbIdx, false);
    });
  }

  /* ── Separated rendering: one group per word ── */
  function _renderSeparated(container) {
    _words.forEach((word, idx) => {
      _buildGroup(container, [word], idx, true /* noMerge */);
    });
  }

  /* ── Build one DOM group from a slice of words ── */
  function _buildGroup(container, words, bbIdx, noMerge) {
    // Ensure bbState slot exists
    while (_bbStates.length <= bbIdx) {
      const prev = _bbStates[_bbStates.length - 1] || { x: 500, y: 400, scale: 1, angle: 0 };
      _bbStates.push({ x: prev.x, y: prev.y + 300, scale: 1, angle: 0 });
    }
    const bb = _bbStates[bbIdx];

    let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
    for (const word of words) {
      word.letters.forEach((_, i) => {
        const col = word.dir === 'h' ? word.gridX + i : word.gridX;
        const row = word.dir === 'v' ? word.gridY + i : word.gridY;
        minCol = Math.min(minCol, col); minRow = Math.min(minRow, row);
        maxCol = Math.max(maxCol, col); maxRow = Math.max(maxRow, row);
      });
    }
    if (!isFinite(minCol)) return;

    const groupW = (maxCol - minCol + 1) * (TILE_SIZE + TILE_GAP);
    const groupH = (maxRow - minRow + 1) * (TILE_SIZE + TILE_GAP);

    const group = document.createElement('div');
    group.className = 'nc-crossword-group';
    group.dataset.bbIdx = bbIdx;
    group.style.cssText = [
      'position: absolute',
      `left: ${bb.x}px`, `top: ${bb.y}px`,
      `width: ${groupW}px`, `height: ${groupH}px`,
      `transform: scale(${bb.scale}) rotate(${bb.angle}deg)`,
      'transform-origin: 50% 50%',
      'pointer-events: none',
    ].join(';');

    const rendered = new Set();
    for (const word of words) {
      word.letters.forEach((letter, i) => {
        const col = word.dir === 'h' ? word.gridX + i : word.gridX;
        const row = word.dir === 'v' ? word.gridY + i : word.gridY;
        const key = `${col},${row}`;
        if (rendered.has(key)) return;
        rendered.add(key);
        const tile = _makeTile(letter, col - minCol, row - minRow, noMerge);
        group.appendChild(tile);
      });
    }

    container.appendChild(group);
    _wireBoundingBox(group, groupW, groupH, bbIdx);
  }

  /* ══════════════════════════════════════════════════════════════
     BOUNDING BOX UI
  ══════════════════════════════════════════════════════════════ */

  function _wireBoundingBox(group, groupW, groupH, bbIdx) {
    const bb = _bbStates[bbIdx];

    group.style.pointerEvents = 'all';
    group.style.cursor = 'move';

    const border = document.createElement('div');
    border.style.cssText = [
      'position: absolute', 'top: -2px', 'left: -2px',
      `width: ${groupW + 4}px`, `height: ${groupH + 4}px`,
      'border: 2px dashed rgba(200,255,0,0.5)',
      'pointer-events: none', 'box-sizing: border-box',
    ].join(';');
    group.appendChild(border);

    const resizeHandle = document.createElement('div');
    resizeHandle.title = 'Resize';
    resizeHandle.style.cssText = [
      'position: absolute', 'bottom: -10px', 'right: -10px',
      'width: 20px', 'height: 20px', 'background: #c8ff00',
      'border: 2px solid #000', 'border-radius: 3px',
      'cursor: se-resize', 'pointer-events: all', 'z-index: 9999',
    ].join(';');
    group.appendChild(resizeHandle);

    const rotHandle = document.createElement('div');
    rotHandle.title = 'Rotate';
    rotHandle.style.cssText = [
      'position: absolute', `top: -40px`,
      `left: ${Math.round(groupW / 2) - 10}px`,
      'width: 20px', 'height: 20px', 'background: #00c8dc',
      'border: 2px solid #000', 'border-radius: 50%',
      'cursor: grab', 'pointer-events: all', 'z-index: 9999',
    ].join(';');
    group.appendChild(rotHandle);

    _makeDraggable(group, {
      onMove(dx, dy) {
        bb.x += dx; bb.y += dy;
        group.style.left = bb.x + 'px';
        group.style.top  = bb.y + 'px';
      },
      excludeTargets: [resizeHandle, rotHandle],
    });

    _makeResizable(resizeHandle, {
      onResize(dx, dy) {
        const delta = (dx + dy) / 2;
        bb.scale = Math.max(0.1, bb.scale + delta / 500);
        group.style.transform = `scale(${bb.scale}) rotate(${bb.angle}deg)`;
      },
    });

    _makeRotatable(rotHandle, group, {
      onRotate(angle) {
        bb.angle = angle;
        group.style.transform = `scale(${bb.scale}) rotate(${angle}deg)`;
      },
    });
  }

  /* ── Pointer helpers ── */
  function _getCardScale() {
    const stage = document.getElementById('card-stage');
    if (!stage) return 1;
    const transform = window.getComputedStyle(stage).transform;
    if (!transform || transform === 'none') return 1;
    // matrix(a,...) — element [0] is X scale
    const m = transform.match(/matrix\(([^,]+)/);
    if (m) return parseFloat(m[1]);
    // matrix3d(a,...) — element [0] is X scale (translate3d + scale resolves to matrix3d)
    const m3 = transform.match(/matrix3d\(([^,]+)/);
    return m3 ? parseFloat(m3[1]) : 1;
  }

  function _makeDraggable(el, { onMove, excludeTargets = [] }) {
    let startX, startY, active = false;
    function onDown(e) {
      if (excludeTargets.some(t => t === e.target || t.contains(e.target))) return;
      active = true;
      startX = e.clientX ?? e.touches?.[0]?.clientX;
      startY = e.clientY ?? e.touches?.[0]?.clientY;
      e.preventDefault();
    }
    function onMove_(e) {
      if (!active) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      const scale = _getCardScale();
      onMove((cx - startX) / scale, (cy - startY) / scale);
      startX = cx; startY = cy;
    }
    function onUp() { active = false; }
    el.addEventListener('mousedown',  onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove_);
    window.addEventListener('touchmove',  onMove_, { passive: false });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onUp);
  }

  function _makeResizable(handle, { onResize }) {
    let startX, startY, active = false;
    handle.addEventListener('mousedown', e => {
      active = true; startX = e.clientX; startY = e.clientY;
      e.stopPropagation(); e.preventDefault();
    });
    handle.addEventListener('touchstart', e => {
      active = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      e.stopPropagation(); e.preventDefault();
    }, { passive: false });
    window.addEventListener('mousemove', e => {
      if (!active) return;
      onResize(e.clientX - startX, e.clientY - startY);
      startX = e.clientX; startY = e.clientY;
    });
    window.addEventListener('touchmove', e => {
      if (!active) return;
      onResize(e.touches[0].clientX - startX, e.touches[0].clientY - startY);
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: false });
    window.addEventListener('mouseup',  () => { active = false; });
    window.addEventListener('touchend', () => { active = false; });
  }

  function _makeRotatable(handle, group, { onRotate }) {
    let active = false, prevAngle = null;
    handle.addEventListener('mousedown', e => {
      active = true; prevAngle = null; e.stopPropagation(); e.preventDefault();
    });
    handle.addEventListener('touchstart', e => {
      active = true; prevAngle = null; e.stopPropagation(); e.preventDefault();
    }, { passive: false });
    function _applyRotation(clientX, clientY) {
      const rect = group.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const raw = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI) + 90;
      if (prevAngle !== null) {
        let delta = raw - prevAngle;
        if (delta >  180) delta -= 360;
        if (delta < -180) delta += 360;
        // Use local bb from the group's data attribute
        const bbIdx = parseInt(group.dataset.bbIdx ?? '0', 10);
        const bb = _bbStates[bbIdx] || _bbStates[0];
        const newAngle = Math.round((bb.angle + delta * 0.6) * 2) / 2;
        onRotate(newAngle);
      }
      prevAngle = raw;
    }
    window.addEventListener('mousemove', e => { if (!active) return; _applyRotation(e.clientX, e.clientY); });
    window.addEventListener('touchmove', e => {
      if (!active) return;
      _applyRotation(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('mouseup',  () => { active = false; prevAngle = null; });
    window.addEventListener('touchend', () => { active = false; prevAngle = null; });
  }

  /* ══════════════════════════════════════════════════════════════
     SETTINGS PANEL
  ══════════════════════════════════════════════════════════════ */

  function _buildWordInputs(rawWords) {
    const container = document.getElementById('crossword-words-container');
    if (!container) return;
    container.innerHTML = '';

    /* ── Controls row: Separate toggle + Flip direction button ── */
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = [
      'display: flex', 'align-items: center', 'gap: 10px',
      'margin-bottom: 8px', 'flex-wrap: wrap',
    ].join(';');

    // Separate Words toggle
    const sepLabel = document.createElement('label');
    sepLabel.style.cssText = [
      'display: flex', 'align-items: center', 'gap: 6px', 'cursor: pointer',
      'font-size: 11px', "font-family: var(--font-mono, 'Courier New', monospace)",
      'letter-spacing: 0.06em', 'color: var(--c-text-label, #8888a0)',
      'text-transform: uppercase', 'user-select: none',
    ].join(';');

    const sepCheck = document.createElement('input');
    sepCheck.type = 'checkbox';
    sepCheck.id = 'crossword-separate-toggle';
    sepCheck.checked = _separated;
    sepCheck.style.cssText = [
      'width: 14px', 'height: 14px', 'cursor: pointer',
      'accent-color: var(--c-accent, #c8ff00)',
    ].join(';');
    sepCheck.addEventListener('change', function () {
      if (typeof window.NullCorps.crossword?.setSeparated === 'function') {
        window.NullCorps.crossword.setSeparated(this.checked);
      } else {
        _separated = this.checked;
        window.NullCorps.state.crosswordSeparated = _separated;
        _rebuildUI(rawWords);
        _renderTiles();
      }
    });

    sepLabel.appendChild(sepCheck);
    sepLabel.appendChild(document.createTextNode('Separate Words'));
    controlsRow.appendChild(sepLabel);

    // Flip Word 1 Direction button — only shown when NOT in fixed orientation mode
    if (!(_separated && _fixedOrientation)) {
      const flipBtn = document.createElement('button');
      flipBtn.type = 'button';
      flipBtn.textContent = _flipFirst ? '↕ Word 1: V→H' : '↔ Word 1: H→V';
      flipBtn.title = 'Swap the direction of the first word (H ↔ V), which sets the alternation order for all words.';
      flipBtn.style.cssText = [
        'padding: 4px 9px', 'font-size: 10px',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'background: var(--c-surface-2, #1e1e2e)',
        'color: var(--c-text, #e0e0f0)',
        'border: 1px solid var(--c-border, #2a2a2f)',
        'border-radius: 4px', 'cursor: pointer', 'white-space: nowrap',
      ].join(';');
      flipBtn.addEventListener('click', () => {
        _flipFirst = !_flipFirst;
        window.NullCorps.state.crosswordFlipFirst = _flipFirst;
        build();
      });
      controlsRow.appendChild(flipBtn);
    }

    container.appendChild(controlsRow);

    // ── Fixed Orientation toggle — only shown when Separate Words is on ──
    if (_separated) {
      const fixedRow = document.createElement('div');
      fixedRow.style.cssText = [
        'display: flex', 'align-items: center', 'gap: 6px',
        'margin-bottom: 10px',
      ].join(';');

      const fixedLabel = document.createElement('label');
      fixedLabel.style.cssText = [
        'display: flex', 'align-items: center', 'gap: 6px', 'cursor: pointer',
        'font-size: 11px', "font-family: var(--font-mono, 'Courier New', monospace)",
        'letter-spacing: 0.06em', 'color: var(--c-text-label, #8888a0)',
        'text-transform: uppercase', 'user-select: none',
      ].join(';');

      const fixedCheck = document.createElement('input');
      fixedCheck.type = 'checkbox';
      fixedCheck.id = 'crossword-fixed-orientation-toggle';
      fixedCheck.checked = _fixedOrientation;
      fixedCheck.style.cssText = [
        'width: 14px', 'height: 14px', 'cursor: pointer',
        'accent-color: var(--c-accent, #c8ff00)',
      ].join(';');
      fixedCheck.addEventListener('change', function () {
        if (typeof window.NullCorps.crossword?.setFixedOrientation === 'function') {
          window.NullCorps.crossword.setFixedOrientation(this.checked);
        } else {
          _fixedOrientation = this.checked;
          window.NullCorps.state.crosswordFixedOrientation = _fixedOrientation;
          build();
        }
      });

      fixedLabel.appendChild(fixedCheck);
      fixedLabel.appendChild(document.createTextNode('Fixed Orientation'));

      const fixedHint = document.createElement('span');
      fixedHint.style.cssText = [
        'font-size: 9px', 'color: var(--c-text-hint, #5f5f80)',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'line-height: 1.3',
      ].join(';');
      fixedHint.textContent = '— set each word H or V freely';

      fixedRow.appendChild(fixedLabel);
      fixedRow.appendChild(fixedHint);
      container.appendChild(fixedRow);
    }

    if (!rawWords.length) {
      const ph = document.createElement('div');
      ph.className = 'crossword-placeholder';
      ph.textContent = 'Set a Card Name above to generate tiles.';
      container.appendChild(ph);
      return;
    }

    /* ── Hint about auto-separation ── */
    const autoSepWords = _words.filter(w => w.separated);
    if (!_separated && autoSepWords.length > 0) {
      const hint = document.createElement('div');
      hint.style.cssText = [
        'font-size: 10px', 'color: var(--c-text-hint, #5f5f80)',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'margin-bottom: 8px', 'line-height: 1.5',
      ].join(';');
      hint.textContent = `⚠ ${autoSepWords.length} word(s) couldn't find a shared letter — rendered separately.`;
      container.appendChild(hint);
    }

    /* ── Per-word inputs ── */
    rawWords.forEach((wordStr, wi) => {
      const placedWord = _words[wi];
      let dirLabel;
      if (_separated && _fixedOrientation) {
        // Show current fixed orientation for this word
        const orient = _wordOrientations[wi] ?? ((wi % 2 === 0) ? 'h' : 'v');
        dirLabel = orient.toUpperCase();
      } else if (_separated) {
        dirLabel = (_flipFirst ? (wi % 2 === 0 ? 'V' : 'H') : (wi % 2 === 0 ? 'H' : 'V'));
      } else {
        dirLabel = placedWord ? placedWord.dir.toUpperCase() : '?';
      }
      const isSeparatedWord = placedWord?.separated;
      const wordLabel = `Word ${wi + 1} (${dirLabel})${isSeparatedWord ? ' · auto-split' : ''}`;

      const label = document.createElement('label');
      label.textContent = wordLabel;
      label.style.cssText = [
        'font-size: 11px',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'letter-spacing: 0.06em', 'color: var(--c-text-label, #8888a0)',
        'text-transform: uppercase', 'display: block', 'margin-bottom: 4px',
      ].join(';');

      const input = document.createElement('input');
      input.type = 'text';
      input.value = wordStr;
      input.dataset.wordIndex = wi;
      input.style.cssText = [
        'width: 100%', 'background: var(--c-bg-input, #111113)',
        'border: 1px solid var(--c-border, #2a2a2f)',
        'color: var(--c-text-primary, #e8e8ec)',
        "font-family: var(--font-ui, Arial, sans-serif)",
        'font-size: 13px', 'padding: 7px 10px',
        'border-radius: 4px', 'outline: none', 'box-sizing: border-box',
      ].join(';');

      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom: 8px;';
      group.appendChild(label);
      group.appendChild(input);

      // Show hint about merge notation when in joined mode
      if (!_separated) {
        const mergeHint = document.createElement('div');
        mergeHint.style.cssText = [
          'font-size: 9px', 'color: var(--c-text-hint, #5f5f80)',
          "font-family: var(--font-mono, 'Courier New', monospace)",
          'margin-top: 2px', 'line-height: 1.4',
        ].join(';');
        mergeHint.textContent = 'Auto-merges on first shared letter. Use [X] to force a merge letter.';

        input.addEventListener('input', function () {
          const words = _splitWords(window.NullCorps.state.cardName);
          words[wi] = this.value;
          const newName = words.join(' ');
          window.NullCorps.state.cardName = newName;
          const mainInput = document.getElementById('card-name');
          if (mainInput && mainInput !== document.activeElement) mainInput.value = newName;
          build();
        });

        group.appendChild(mergeHint);
        container.appendChild(group);
      } else {
        // Separated mode
        const sepWordHint = document.createElement('div');
        sepWordHint.style.cssText = [
          'font-size: 9px', 'color: var(--c-text-hint, #5f5f80)',
          "font-family: var(--font-mono, 'Courier New', monospace)",
          'margin-top: 2px', 'line-height: 1.4',
        ].join(';');
        sepWordHint.textContent = 'Special: <X>. Merge tags [X] are ignored in separate mode.';

        input.addEventListener('input', function () {
          const words = _splitWords(window.NullCorps.state.cardName);
          words[wi] = this.value;
          const newName = words.join(' ');
          window.NullCorps.state.cardName = newName;
          const mainInput = document.getElementById('card-name');
          if (mainInput && mainInput !== document.activeElement) mainInput.value = newName;
          build();
        });

        group.appendChild(sepWordHint);

        // ── H/V orientation toggle buttons — only shown when Fixed Orientation is on ──
        if (_fixedOrientation) {
          const currentOrient = _wordOrientations[wi] ?? ((wi % 2 === 0) ? 'h' : 'v');

          const orientRow = document.createElement('div');
          orientRow.style.cssText = 'display:flex;gap:4px;margin-top:5px;';

          function _mkOrientBtn(dir) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = dir.toUpperCase();
            const isActive = currentOrient === dir;
            btn.style.cssText = [
              'padding: 3px 12px', 'font-size: 10px',
              "font-family: var(--font-mono, 'Courier New', monospace)",
              'border-radius: 3px', 'cursor: pointer', 'font-weight: 600',
              isActive
                ? 'background: var(--c-accent-dim, rgba(200,255,0,0.15)); color: var(--c-accent, #c8ff00); border: 1px solid var(--c-accent, #c8ff00);'
                : 'background: transparent; color: var(--c-text-label, #8888a0); border: 1px solid var(--c-border, #2a2a2f);',
            ].join(';');
            btn.addEventListener('click', () => {
              _wordOrientations[wi] = dir;
              window.NullCorps.state.crosswordWordOrientations = _wordOrientations.slice();
              build();
            });
            return btn;
          }

          orientRow.appendChild(_mkOrientBtn('h'));
          orientRow.appendChild(_mkOrientBtn('v'));
          group.appendChild(orientRow);
        }

        container.appendChild(group);
      }
    });
  }

  /* Re-build just the UI (controls + inputs) without full tile rebuild */
  function _rebuildUI(rawWords) {
    _buildWordInputs(rawWords);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: build()
  ══════════════════════════════════════════════════════════════ */

  function build() {
    const rawWords = _splitWords(window.NullCorps.state.cardName);
    _words = _layoutWords(rawWords);
    _renderTiles();
    _buildWordInputs(rawWords);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: getState / applyState
  ══════════════════════════════════════════════════════════════ */

  function getState() {
    return {
      // Legacy single-bb keys (for back-compat with old presets)
      x:     _bbStates[0].x,
      y:     _bbStates[0].y,
      scale: _bbStates[0].scale,
      angle: _bbStates[0].angle,
      // New multi-bb + options
      bbStates:         _bbStates.map(b => ({ ...b })),
      separated:        _separated,
      flipFirst:        _flipFirst,
      fixedOrientation: _fixedOrientation,
      wordOrientations: _wordOrientations.slice(),
    };
  }

  function applyState(snap) {
    if (!snap) return;
    // Restore options
    if (snap.separated         !== undefined) _separated        = snap.separated;
    if (snap.flipFirst         !== undefined) _flipFirst        = snap.flipFirst;
    if (snap.fixedOrientation  !== undefined) _fixedOrientation = snap.fixedOrientation;
    if (Array.isArray(snap.wordOrientations)) _wordOrientations = snap.wordOrientations.slice();
    // Restore bounding boxes
    if (snap.bbStates && Array.isArray(snap.bbStates)) {
      _bbStates = snap.bbStates.map(b => ({ ...b }));
    } else {
      // Back-compat: single bb
      _bbStates[0].x     = snap.x     ?? _bbStates[0].x;
      _bbStates[0].y     = snap.y     ?? _bbStates[0].y;
      _bbStates[0].scale = snap.scale ?? _bbStates[0].scale;
      _bbStates[0].angle = snap.angle ?? _bbStates[0].angle;
    }
    build();
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

  function init() {
    // Restore options from state if already set (e.g. preset load before init)
    if (window.NullCorps.state.crosswordSeparated !== undefined) {
      _separated = !!window.NullCorps.state.crosswordSeparated;
    }
    if (window.NullCorps.state.crosswordFlipFirst !== undefined) {
      _flipFirst = !!window.NullCorps.state.crosswordFlipFirst;
    }
    if (window.NullCorps.state.crosswordFixedOrientation !== undefined) {
      _fixedOrientation = !!window.NullCorps.state.crosswordFixedOrientation;
    }
    if (Array.isArray(window.NullCorps.state.crosswordWordOrientations)) {
      _wordOrientations = window.NullCorps.state.crosswordWordOrientations.slice();
    }

    const tileInput = document.getElementById('tile-image-url');
    if (tileInput) {
      tileInput.addEventListener('input', function () {
        window.NullCorps.state.tileImageUrl = this.value;
        document.querySelectorAll('.nc-crossword-group .nc-tile img').forEach(img => {
          img.src = _tileUrl();
        });
      });
    }

    if (window.NullCorps.state.cardName) {
      build();
    }
  }

  /* Public setter so editor.js can drive the toggle without a full rebuild loop */
  function setSeparated(val) {
    _separated = !!val;
    window.NullCorps.state.crosswordSeparated = _separated;
    // Sync both checkboxes
    ['crossword-separate-toggle', 'crossword-separate-toggle-identity'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = _separated;
    });
    build();
  }

  function setFixedOrientation(val) {
    _fixedOrientation = !!val;
    window.NullCorps.state.crosswordFixedOrientation = _fixedOrientation;
    build();
  }

  /* ── Expose public API ── */
  window.NullCorps.crossword = { init, build, getState, applyState, setSeparated, setFixedOrientation };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
