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
     • First word  → horizontal row of tiles
     • Second word → vertical column of tiles, crossing the first
       at the [merge] letter
     • If more words are present they alternate H/V and each must
       share a [merge] letter with any already-placed word.

   Bounding Box UI (applied to the whole crossword group):
     • Drag to move
     • Corner handle to resize (proportional)
     • Rotation handle above the group

   Settings panel:
     • One editable input per word, pre-filled from the parsed name.
     • Changing an input rebuilds that word's tiles in real-time.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Tile constants ──────────────────────────────────────── */
  const TILE_SIZE   = 160;   // px on the 2250×3150 native canvas
  const TILE_GAP    = 0;     // tiles are flush
  const FONT_SIZE   = 96;    // px — Archivo, fits ~60% of tile height
  const FONT_FAMILY = "'Archivo', Arial, sans-serif";

  /* Tile colours */
  const COLOR_NORMAL  = 'rgba(0,0,0,0)';        // transparent — shows PNG
  const COLOR_MERGE   = 'rgba(212,168,0,0.55)'; // gold overlay
  const COLOR_SPECIAL = 'rgba(0,200,220,0.55)'; // cyan overlay

  /* Letter colours */
  const LETTER_COLOR   = '#ffffff';
  const LETTER_OUTLINE = '#000000';
  const LETTER_OUTLINE_W = 4;

  /* Default tile image (can be overridden via state.tileImageUrl) */
  const DEFAULT_TILE = 'assets/default_tile.png';

  /* ── Crossword state ──────────────────────────────────────── */
  // Parsed words, grid positions, bounding-box transform
  let _words    = [];   // [{ text, letters:[{char,type}], dir, gridX, gridY }]
  let _bbState  = {     // bounding box transform (in native canvas px)
    x: 500, y: 400,     // top-left of the group
    scale: 1,
    angle: 0,
  };

  /* ══════════════════════════════════════════════════════════════
     PARSER
     Converts a raw card-name string into an array of word objects.

     Input examples:
       "Rien Greenfield"
       "Ri[e]n Gr[e]enfield"
       "Na<m>e W[o]rld"
  ══════════════════════════════════════════════════════════════ */

  /**
   * Parse a single word string into an array of letter descriptors.
   * Strips brackets but records letter type (normal / merge / special).
   *
   * @param {string} wordStr  Raw word possibly containing [x] and <x>
   * @returns {{ char: string, type: 'normal'|'merge'|'special' }[]}
   */
  function _parseWord(wordStr) {
    const letters = [];
    let i = 0;
    while (i < wordStr.length) {
      const ch = wordStr[i];
      if (ch === '[') {
        // merge letter
        const close = wordStr.indexOf(']', i);
        if (close !== -1) {
          const inner = wordStr.slice(i + 1, close).toUpperCase();
          for (const c of inner) letters.push({ char: c, type: 'merge' });
          i = close + 1;
        } else {
          letters.push({ char: ch, type: 'normal' });
          i++;
        }
      } else if (ch === '<') {
        // special letter
        const close = wordStr.indexOf('>', i);
        if (close !== -1) {
          const inner = wordStr.slice(i + 1, close).toUpperCase();
          for (const c of inner) letters.push({ char: c, type: 'special' });
          i = close + 1;
        } else {
          letters.push({ char: ch, type: 'normal' });
          i++;
        }
      } else {
        letters.push({ char: ch.toUpperCase(), type: 'normal' });
        i++;
      }
    }
    return letters;
  }

  /**
   * Split a raw card name into space-separated word strings,
   * keeping bracket groups intact (a space inside [] is unusual but safe).
   */
  function _splitWords(cardName) {
    return (cardName || '').trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Given parsed words, assign grid positions.
   * Word 0 is horizontal at (0,0).
   * Each subsequent word is perpendicular and is positioned so that
   * its first [merge] letter aligns with the matching [merge] letter
   * of any already-placed word.
   *
   * Returns an array of word objects with gridX/gridY (in tile units)
   * and dir ('h' or 'v').
   */
  function _layoutWords(rawWords) {
    if (!rawWords.length) return [];

    const placed = [];

    rawWords.forEach((wordStr, wi) => {
      const letters = _parseWord(wordStr);
      const dir = (wi % 2 === 0) ? 'h' : 'v';

      if (wi === 0) {
        placed.push({ raw: wordStr, letters, dir, gridX: 0, gridY: 0 });
        return;
      }

      // Find the first merge letter in this word
      const myMergeIdx = letters.findIndex(l => l.type === 'merge');

      // Find a matching merge letter in any placed word
      let anchorWord = null;
      let anchorLetterIdx = -1;

      for (const pw of placed) {
        const idx = pw.letters.findIndex(l => l.type === 'merge' && myMergeIdx !== -1
          && l.char === letters[myMergeIdx]?.char);
        if (idx !== -1) {
          anchorWord = pw;
          anchorLetterIdx = idx;
          break;
        }
      }

      let gx = 0, gy = 0;

      if (anchorWord && myMergeIdx !== -1 && anchorLetterIdx !== -1) {
        // Position so [merge] letters overlap
        if (dir === 'h') {
          // Horizontal word: anchor col aligns with anchorLetterIdx in anchor word
          const anchorCol = anchorWord.dir === 'h'
            ? anchorWord.gridX + anchorLetterIdx
            : anchorWord.gridX;
          const anchorRow = anchorWord.dir === 'v'
            ? anchorWord.gridY + anchorLetterIdx
            : anchorWord.gridY;
          gx = anchorCol - myMergeIdx;
          gy = anchorRow;
        } else {
          // Vertical word
          const anchorCol = anchorWord.dir === 'h'
            ? anchorWord.gridX + anchorLetterIdx
            : anchorWord.gridX;
          const anchorRow = anchorWord.dir === 'v'
            ? anchorWord.gridY + anchorLetterIdx
            : anchorWord.gridY;
          gx = anchorCol;
          gy = anchorRow - myMergeIdx;
        }
      } else {
        // No merge point found — stack adjacent
        const prev = placed[placed.length - 1];
        if (dir === 'v') {
          gx = prev.dir === 'h' ? prev.gridX : prev.gridX + prev.letters.length + 1;
          gy = prev.dir === 'h' ? prev.gridY - 1 : prev.gridY;
        } else {
          gx = prev.gridX;
          gy = prev.dir === 'v' ? prev.gridY : prev.gridY + 1;
        }
      }

      placed.push({ raw: wordStr, letters, dir, gridX: gx, gridY: gy });
    });

    return placed;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDERER
     Draws each tile as a <div> containing:
       • An <img> for the tile PNG (silent 404 fallback)
       • An overlay <div> for merge/special colour
       • A <span> for the letter
  ══════════════════════════════════════════════════════════════ */

  /** Return the tile image URL from state or default. */
  function _tileUrl() {
    const url = window.NullCorps.state.tileImageUrl;
    return (url && url.trim()) ? url.trim() : DEFAULT_TILE;
  }

  /**
   * Create a single tile DOM element at the given grid position.
   *
   * @param {{ char, type }} letter
   * @param {number} col  grid column (tile units from group origin)
   * @param {number} row  grid row
   * @returns {HTMLElement}
   */
  function _makeTile(letter, col, row) {
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

    // PNG background
    const img = document.createElement('img');
    img.src = _tileUrl();
    img.alt = '';
    img.draggable = false;
    img.style.cssText = [
      'position: absolute',
      'top: 0', 'left: 0',
      `width: ${TILE_SIZE}px`,
      `height: ${TILE_SIZE}px`,
      'object-fit: cover',
      'pointer-events: none',
    ].join(';');
    img.onerror = function () { this.style.visibility = 'hidden'; };
    img.onload  = function () { this.style.visibility = 'visible'; };
    wrapper.appendChild(img);

    // Colour overlay for merge / special
    if (letter.type !== 'normal') {
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position: absolute',
        'top: 0', 'left: 0',
        `width: ${TILE_SIZE}px`,
        `height: ${TILE_SIZE}px`,
        `background: ${letter.type === 'merge' ? COLOR_MERGE : COLOR_SPECIAL}`,
        'pointer-events: none',
      ].join(';');
      wrapper.appendChild(overlay);
    }

    // Letter span
    const span = document.createElement('span');
    span.textContent = letter.char;
    // Build outline text-shadow in 8 directions
    const w = LETTER_OUTLINE_W;
    const shadow = [
      `${w}px 0 0 ${LETTER_OUTLINE}`,
      `-${w}px 0 0 ${LETTER_OUTLINE}`,
      `0 ${w}px 0 ${LETTER_OUTLINE}`,
      `0 -${w}px 0 ${LETTER_OUTLINE}`,
      `${w}px ${w}px 0 ${LETTER_OUTLINE}`,
      `-${w}px ${w}px 0 ${LETTER_OUTLINE}`,
      `${w}px -${w}px 0 ${LETTER_OUTLINE}`,
      `-${w}px -${w}px 0 ${LETTER_OUTLINE}`,
    ].join(', ');
    span.style.cssText = [
      'position: absolute',
      'top: 50%', 'left: 50%',
      'transform: translate(-50%, -50%)',
      `font-family: ${FONT_FAMILY}`,
      `font-size: ${FONT_SIZE}px`,
      `color: ${LETTER_COLOR}`,
      `text-shadow: ${shadow}`,
      'font-weight: 400',
      'line-height: 1',
      'pointer-events: none',
      'user-select: none',
      'white-space: nowrap',
    ].join(';');
    wrapper.appendChild(span);

    return wrapper;
  }

  /**
   * Render all words into the two crossword layer containers.
   * Horizontal words → layer-6 container, vertical → layer-7.
   */
  function _renderTiles() {
    const hContainer = document.querySelector('[data-crossword-layer="h"]');
    const vContainer = document.querySelector('[data-crossword-layer="v"]');
    if (!hContainer || !vContainer) return;

    // Clear previous tiles (keep the bounding box group if present)
    const bboxGroup = document.getElementById('nc-crossword-group');
    if (bboxGroup) bboxGroup.remove();

    // Build a single group element that holds ALL tiles
    // (bounding-box transforms are applied to this group)
    const group = document.createElement('div');
    group.id = 'nc-crossword-group';
    group.style.cssText = [
      'position: absolute',
      `left: ${_bbState.x}px`,
      `top:  ${_bbState.y}px`,
      `transform: scale(${_bbState.scale}) rotate(${_bbState.angle}deg)`,
      'transform-origin: top left',
      'pointer-events: none', // children that need pointer events set it themselves
    ].join(';');

    // Calculate bounding box extents so we can size the group
    let minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity;
    for (const word of _words) {
      word.letters.forEach((_, i) => {
        const col = word.dir === 'h' ? word.gridX + i : word.gridX;
        const row = word.dir === 'v' ? word.gridY + i : word.gridY;
        minCol = Math.min(minCol, col);
        minRow = Math.min(minRow, row);
        maxCol = Math.max(maxCol, col);
        maxRow = Math.max(maxRow, row);
      });
    }

    if (!isFinite(minCol)) {
      // No words — nothing to render
      hContainer.appendChild(group);
      return;
    }

    // Offset all grid positions so group starts at (0,0)
    const offX = -minCol * (TILE_SIZE + TILE_GAP);
    const offY = -minRow * (TILE_SIZE + TILE_GAP);
    const groupW = (maxCol - minCol + 1) * (TILE_SIZE + TILE_GAP);
    const groupH = (maxRow - minRow + 1) * (TILE_SIZE + TILE_GAP);
    group.style.width  = groupW + 'px';
    group.style.height = groupH + 'px';

    // Track which grid cells have already been rendered (for merge dedup)
    const rendered = new Set();

    for (const word of _words) {
      word.letters.forEach((letter, i) => {
        const col = word.dir === 'h' ? word.gridX + i : word.gridX;
        const row = word.dir === 'v' ? word.gridY + i : word.gridY;
        const key = `${col},${row}`;

        // Skip if already rendered by a crossing word (merge cell)
        // but upgrade to merge/special type if needed
        if (rendered.has(key)) return;
        rendered.add(key);

        const displayCol = col - minCol;
        const displayRow = row - minRow;
        const tile = _makeTile(letter, displayCol, displayRow);
        group.appendChild(tile);
      });
    }

    // Attach to h-layer container (all tiles are in one group regardless of direction)
    hContainer.appendChild(group);

    // Wire bounding box UI onto the group
    _wireBoundingBox(group, groupW, groupH);
  }

  /* ══════════════════════════════════════════════════════════════
     BOUNDING BOX UI
     Handles: drag to move, corner resize (proportional), rotation.
  ══════════════════════════════════════════════════════════════ */

  function _wireBoundingBox(group, groupW, groupH) {
    // Enable pointer events on the group for dragging
    group.style.pointerEvents = 'all';
    group.style.cursor = 'move';

    // ── Outline border (visual indicator) ──
    const border = document.createElement('div');
    border.style.cssText = [
      'position: absolute',
      'top: -2px', 'left: -2px',
      `width: ${groupW + 4}px`,
      `height: ${groupH + 4}px`,
      'border: 2px dashed rgba(200,255,0,0.5)',
      'pointer-events: none',
      'box-sizing: border-box',
    ].join(';');
    group.appendChild(border);

    // ── Resize handle (bottom-right corner) ──
    const resizeHandle = document.createElement('div');
    resizeHandle.title = 'Resize';
    resizeHandle.style.cssText = [
      'position: absolute',
      `bottom: -10px`, `right: -10px`,
      'width: 20px', 'height: 20px',
      'background: #c8ff00',
      'border: 2px solid #000',
      'border-radius: 3px',
      'cursor: se-resize',
      'pointer-events: all',
      'z-index: 9999',
    ].join(';');
    group.appendChild(resizeHandle);

    // ── Rotation handle (above top-centre) ──
    const rotHandle = document.createElement('div');
    rotHandle.title = 'Rotate';
    rotHandle.style.cssText = [
      'position: absolute',
      `top: -40px`,
      `left: ${Math.round(groupW / 2) - 10}px`,
      'width: 20px', 'height: 20px',
      'background: #00c8dc',
      'border: 2px solid #000',
      'border-radius: 50%',
      'cursor: grab',
      'pointer-events: all',
      'z-index: 9999',
    ].join(';');
    group.appendChild(rotHandle);

    // ── Drag (move) ──
    _makeDraggable(group, {
      onMove(dx, dy) {
        _bbState.x += dx;
        _bbState.y += dy;
        group.style.left = _bbState.x + 'px';
        group.style.top  = _bbState.y + 'px';
      },
      excludeTargets: [resizeHandle, rotHandle],
    });

    // ── Resize ──
    _makeResizable(resizeHandle, {
      onResize(dx, dy) {
        // Average dx/dy to proportional scale delta
        const delta = (dx + dy) / 2;
        const newScale = Math.max(0.1, _bbState.scale + delta / 500);
        _bbState.scale = newScale;
        group.style.transform = `scale(${newScale}) rotate(${_bbState.angle}deg)`;
      },
    });

    // ── Rotation ──
    _makeRotatable(rotHandle, group, {
      onRotate(angle) {
        _bbState.angle = angle;
        group.style.transform = `scale(${_bbState.scale}) rotate(${angle}deg)`;
      },
    });
  }

  /* ── Pointer drag helper ── */
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
      startX = cx;
      startY = cy;
    }

    function onUp() { active = false; }

    el.addEventListener('mousedown',  onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove',  onMove_);
    window.addEventListener('touchmove',  onMove_, { passive: false });
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchend',  onUp);
  }

  /* ── Resize handle helper ── */
  function _makeResizable(handle, { onResize }) {
    let startX, startY, active = false;

    handle.addEventListener('mousedown', e => {
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      e.stopPropagation();
      e.preventDefault();
    });

    handle.addEventListener('touchstart', e => {
      active = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('mousemove', e => {
      if (!active) return;
      onResize(e.clientX - startX, e.clientY - startY);
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('touchmove', e => {
      if (!active) return;
      onResize(e.touches[0].clientX - startX, e.touches[0].clientY - startY);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: false });

    window.addEventListener('mouseup',  () => { active = false; });
    window.addEventListener('touchend', () => { active = false; });
  }

  /* ── Rotation handle helper ── */
  function _makeRotatable(handle, group, { onRotate }) {
    let active = false;

    handle.addEventListener('mousedown', e => {
      active = true;
      e.stopPropagation();
      e.preventDefault();
    });

    handle.addEventListener('touchstart', e => {
      active = true;
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('mousemove', e => {
      if (!active) return;
      const rect   = group.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const angle  = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) + 90;
      onRotate(Math.round(angle * 10) / 10);
    });

    window.addEventListener('touchmove', e => {
      if (!active) return;
      const rect   = group.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const touch  = e.touches[0];
      const angle  = Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI) + 90;
      onRotate(Math.round(angle * 10) / 10);
    }, { passive: false });

    window.addEventListener('mouseup',  () => { active = false; });
    window.addEventListener('touchend', () => { active = false; });
  }

  /** Get the current CSS scale of the card stage (for pointer ↔ canvas coords). */
  function _getCardScale() {
    const stage = document.getElementById('card-stage');
    if (!stage) return 1;
    const transform = window.getComputedStyle(stage).transform;
    if (!transform || transform === 'none') return 1;
    // matrix(a,b,c,d,e,f) — a is the x scale
    const m = transform.match(/matrix\(([^,]+)/);
    return m ? parseFloat(m[1]) : 1;
  }

  /* ══════════════════════════════════════════════════════════════
     SETTINGS PANEL — WORD INPUTS
     One text input per word. Editing updates that word and rebuilds.
  ══════════════════════════════════════════════════════════════ */

  function _buildWordInputs(rawWords) {
    const container = document.getElementById('crossword-words-container');
    if (!container) return;
    container.innerHTML = '';

    if (!rawWords.length) {
      container.innerHTML = '<div class="crossword-placeholder">Set a Card Name above to generate tiles.</div>';
      return;
    }

    rawWords.forEach((wordStr, wi) => {
      const dir   = wi % 2 === 0 ? 'H' : 'V';
      const label = document.createElement('label');
      label.textContent = `Word ${wi + 1} (${dir})`;
      label.style.cssText = [
        'font-size: 11px',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'letter-spacing: 0.06em',
        'color: var(--c-text-label, #8888a0)',
        'text-transform: uppercase',
        'display: block',
        'margin-bottom: 4px',
      ].join(';');

      const input = document.createElement('input');
      input.type = 'text';
      input.value = wordStr;
      input.dataset.wordIndex = wi;
      input.style.cssText = [
        'width: 100%',
        'background: var(--c-bg-input, #111113)',
        'border: 1px solid var(--c-border, #2a2a2f)',
        'color: var(--c-text-primary, #e8e8ec)',
        "font-family: var(--font-ui, Arial, sans-serif)",
        'font-size: 13px',
        'padding: 7px 10px',
        'border-radius: 4px',
        'outline: none',
        'box-sizing: border-box',
      ].join(';');

      input.addEventListener('input', function () {
        // Update that word in the card name, rebuild
        const words = _splitWords(window.NullCorps.state.cardName);
        words[wi] = this.value;
        const newName = words.join(' ');
        window.NullCorps.state.cardName = newName;

        // Also update the main card-name input to stay in sync
        const mainInput = document.getElementById('card-name');
        if (mainInput && mainInput !== document.activeElement) {
          mainInput.value = newName;
        }

        build();
      });

      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom: 8px;';
      group.appendChild(label);
      group.appendChild(input);
      container.appendChild(group);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: build()
     Full rebuild from NullCorps.state.cardName.
     Called by editor.js on card-name input changes.
  ══════════════════════════════════════════════════════════════ */

  function build() {
    const rawWords = _splitWords(window.NullCorps.state.cardName);
    _words = _layoutWords(rawWords);
    _renderTiles();
    _buildWordInputs(rawWords);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: getState / applyState
     For preset serialisation/restore (used by js/presets.js).
  ══════════════════════════════════════════════════════════════ */

  function getState() {
    return {
      x:     _bbState.x,
      y:     _bbState.y,
      scale: _bbState.scale,
      angle: _bbState.angle,
    };
  }

  function applyState(snap) {
    if (!snap) return;
    _bbState.x     = snap.x     ?? _bbState.x;
    _bbState.y     = snap.y     ?? _bbState.y;
    _bbState.scale = snap.scale ?? _bbState.scale;
    _bbState.angle = snap.angle ?? _bbState.angle;
    build();
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

  function init() {
    // Wire tile-image-url input to rebuild tiles when changed
    const tileInput = document.getElementById('tile-image-url');
    if (tileInput) {
      tileInput.addEventListener('input', function () {
        window.NullCorps.state.tileImageUrl = this.value;
        // Update all existing tile images without a full rebuild
        document.querySelectorAll('#nc-crossword-group .nc-tile img').forEach(img => {
          img.src = _tileUrl();
        });
      });
    }

    // Initial build if there's already a card name in state
    if (window.NullCorps.state.cardName) {
      build();
    }
  }

  /* ── Expose public API ── */
  window.NullCorps.crossword = {
    init,
    build,
    getState,
    applyState,
  };

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
