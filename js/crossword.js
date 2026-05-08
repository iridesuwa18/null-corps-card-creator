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
     |              →  break separator — forces a split between the
                        two words on either side of it (they will not
                        be joined even if they share a letter)

   Layout rules:
     • First word  → horizontal (or vertical if flipped) row of tiles
     • Second word → perpendicular, crossing the first at a shared letter
     • Merge is found automatically: looks for any letter shared between
       adjacent words.  [x] / <x> notation still works but is optional.
     • If no shared letter exists the words are split (same as Separate mode).
     • A | token between two words forces them apart regardless.
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
     • "÷ break" button between each word pair (joined mode).
     • "── BREAK ──" divider with × to remove an existing break.
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

  /* Letter colours — default (non-Dozer): white text, black outline */
  const LETTER_COLOR         = '#ffffff';
  const LETTER_OUTLINE       = '#000000';
  /* Letter colours — Dozer: black text, white outline */
  const LETTER_COLOR_DOZER   = '#000000';
  const LETTER_OUTLINE_DOZER = '#ffffff';

  const LETTER_OUTLINE_W = 8;

  const DEFAULT_TILE       = 'assets/default_tile_dgray.png';
  const DEFAULT_TILE_DOZER = 'assets/default_tile_lgray.png';

  /** Return true when the current card is a Dozer category. */
  function _isDozerMode() {
    const mode = window.NullCorps.state.cardMode || '';
    return mode === 'dozer' || mode === 'dozer-skill';
  }

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
  let _locked           = false;   // "Locked" — freezes all bounding-box interaction
  let _crosswordVisible = true;    // "View" — toggles crossword layer visibility

  // _pairBreaks[i] = true means the pair (word i, word i+1) is force-split.
  // This is serialised as a Set of pair indices in state.
  let _pairBreaks = new Set();     // Set<number> — indices of broken pairs

  // _separatedPairLinks[i] = true means pair (word i, word i+1) should be
  // rendered joined (crossword-linked) even when Separate Words mode is on.
  // Only respected in _separated mode; ignored otherwise.
  let _separatedPairLinks = new Set(); // Set<number>

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

  /**
   * Split cardName into word tokens, also extracting | break separators.
   * Returns { words: string[], breaks: Set<number> }
   * breaks contains the index i meaning "break between word[i] and word[i+1]"
   *
   * e.g. "Cake | Cake Cake Cake"
   *   → words: ['Cake','Cake','Cake','Cake'], breaks: Set{0}
   *
   * The | can appear as its own space-separated token or attached to a word.
   * We normalise by treating any token that is purely | characters as a break.
   */
  function _splitWords(cardName) {
    const raw = (cardName || '').trim().split(/\s+/).filter(Boolean);
    const words  = [];
    const breaks = new Set();

    for (const token of raw) {
      if (/^\|+$/.test(token)) {
        // Pure break token — record break after the last real word
        if (words.length > 0) breaks.add(words.length - 1);
      } else {
        words.push(token);
      }
    }
    return { words, breaks };
  }

  /**
   * Serialise current words + _pairBreaks back to a cardName string.
   * Breaks are re-inserted as " | " between the relevant word pair.
   */
  function _wordsToCardName(words) {
    const parts = [];
    words.forEach((w, i) => {
      parts.push(w);
      if (_pairBreaks.has(i)) parts.push('|');
    });
    return parts.join(' ');
  }

  /* ══════════════════════════════════════════════════════════════
     SMART MERGE FINDER
     Looks for any shared letter between two letter arrays.
     Prefers [merge]-tagged letters first, then falls back to the
     first plain-letter match.  Returns { myIdx, theirIdx } or null.

     FIX (Cake×4 bug): accepts usedAnchorPositions (Set of indices
     already committed as merge anchors on word A) and
     usedNewPositions (Set of indices already committed on word B),
     so that identical consecutive words can each get their own
     distinct crossing tile.
  ══════════════════════════════════════════════════════════════ */

  function _isLetter(ch) { return /^[A-Z]$/.test(ch); }

  function _findMerge(lettersA, lettersB, usedAnchorPositions, usedNewPositions) {
    const usedA = usedAnchorPositions || new Set();
    const usedB = usedNewPositions    || new Set();

    // 1. Explicit [merge] tags on both sides (skip used positions)
    for (let ai = 0; ai < lettersA.length; ai++) {
      if (usedA.has(ai)) continue;
      if (lettersA[ai].type !== 'merge' || !_isLetter(lettersA[ai].char)) continue;
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (usedB.has(bi)) continue;
        if (lettersB[bi].type === 'merge' && lettersB[bi].char === lettersA[ai].char && _isLetter(lettersB[bi].char)) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    // 2. Explicit [merge] on one side matching any letter on the other
    for (let ai = 0; ai < lettersA.length; ai++) {
      if (usedA.has(ai)) continue;
      if (lettersA[ai].type !== 'merge' || !_isLetter(lettersA[ai].char)) continue;
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (usedB.has(bi)) continue;
        if (_isLetter(lettersB[bi].char) && lettersB[bi].char === lettersA[ai].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    for (let bi = 0; bi < lettersB.length; bi++) {
      if (usedB.has(bi)) continue;
      if (lettersB[bi].type !== 'merge' || !_isLetter(lettersB[bi].char)) continue;
      for (let ai = 0; ai < lettersA.length; ai++) {
        if (usedA.has(ai)) continue;
        if (_isLetter(lettersA[ai].char) && lettersA[ai].char === lettersB[bi].char) {
          return { myIdx: ai, theirIdx: bi };
        }
      }
    }
    // 3. Any shared letter — prefer positions farthest from already-used ones.
    const candidates = [];
    for (let ai = 0; ai < lettersA.length; ai++) {
      if (usedA.has(ai)) continue;
      if (!_isLetter(lettersA[ai].char)) continue;
      for (let bi = 0; bi < lettersB.length; bi++) {
        if (usedB.has(bi)) continue;
        if (_isLetter(lettersB[bi].char) && lettersA[ai].char === lettersB[bi].char) {
          candidates.push({ myIdx: ai, theirIdx: bi });
        }
      }
    }
    if (!candidates.length) return null;

    // Find all committed positions on anchor word (existing merge types + usedA)
    const mergePositions = [
      ...lettersA.map((l, i) => (l.type === 'merge' ? i : -1)).filter(i => i >= 0),
      ...usedA,
    ];

    if (!mergePositions.length) return candidates[0];

    // Pick candidate whose anchor index is farthest from all existing merges
    let best = candidates[0];
    let bestDist = -1;
    for (const c of candidates) {
      const minDist = Math.min(...mergePositions.map(mp => Math.abs(c.myIdx - mp)));
      if (minDist > bestDist) { bestDist = minDist; best = c; }
    }
    return best;
  }

  /* ══════════════════════════════════════════════════════════════
     LAYOUT — JOINED MODE
     Returns placed[] with gridX/gridY (tile units) and dir.
     Words that can't find a merge letter are returned with
     separated:true so the renderer treats them independently.

     _pairBreaks: if the pair (wi-1, wi) is in the set, skip merge
     and mark as separated regardless of shared letters.

     usedMergePositions: Map<placedWordIndex, Set<anchorIdx>>
     tracks which positions on each placed word are already in use
     as merge anchors — fixes the Cake×4 identical-word bug.
  ══════════════════════════════════════════════════════════════ */

  function _layoutWords(rawWords) {
  if (!rawWords.length) return [];
  const placed = [];
  const usedAnchorPositions = new Map();

  rawWords.forEach((wordStr, wi) => {
    const letters = _parseWord(wordStr);

    let baseDir;
    if (_fixedOrientation && _separated) {
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
      usedAnchorPositions.set(0, new Set());
      return;
    }

    // In separated mode, only attempt merge if this pair is explicitly linked.
    const pairLinkedInSepMode = _separated && _separatedPairLinks.has(wi - 1);
    if (_separated && !pairLinkedInSepMode) {
      placed.push({ raw: wordStr, letters, dir: baseDir, gridX: 0, gridY: 0, separated: true });
      usedAnchorPositions.set(placed.length - 1, new Set());
      return;
    }

    // Walk backwards through placed words to find the nearest linkable anchor.
    // Skip pairs that are force-broken. Stop as soon as we find a merge.
    let bestAnchor = null, bestMerge = null, bestAnchorPlacedIdx = -1;

    for (let pi = placed.length - 1; pi >= 0; pi--) {
  if (_pairBreaks.has(pi)) break;

  const candidate = placed[pi];
  const anchorUsed = usedAnchorPositions.get(pi) || new Set();
  const newUsed = usedAnchorPositions.get(placed.length) || new Set();
  const m = _findMerge(candidate.letters, letters, anchorUsed, newUsed);
  if (m) {
    bestAnchor = candidate;
    bestMerge = m;
    bestAnchorPlacedIdx = pi;
    break;
  }

  // Only look further back if the immediate predecessor is completely exhausted.
  // Prevents jumping over a word and causing overlaps.
  if (pi === placed.length - 1) {
    const allUsed = anchorUsed.size >= candidate.letters.filter(l => _isLetter(l.char)).length;
    if (!allUsed) break;
  }
}

    if (!bestAnchor) {
      placed.push({ raw: wordStr, letters, dir: baseDir, gridX: 0, gridY: 0, separated: true });
      usedAnchorPositions.set(placed.length - 1, new Set());
      return;
    }

    // Un-separate the anchor if it was floating
    if (bestAnchor.separated) bestAnchor.separated = false;

    const anchorMergeIdx = bestMerge.myIdx;
    const myMergeIdx     = bestMerge.theirIdx;

    if (bestAnchor.letters[anchorMergeIdx].type === 'normal') {
      bestAnchor.letters[anchorMergeIdx] = { ...bestAnchor.letters[anchorMergeIdx], type: 'merge' };
    }
    if (letters[myMergeIdx].type === 'normal') {
      letters[myMergeIdx] = { ...letters[myMergeIdx], type: 'merge' };
    }

    if (!usedAnchorPositions.has(bestAnchorPlacedIdx)) {
      usedAnchorPositions.set(bestAnchorPlacedIdx, new Set());
    }
    usedAnchorPositions.get(bestAnchorPlacedIdx).add(anchorMergeIdx);

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
    const newWordAnchorUsed = new Set();
    newWordAnchorUsed.add(myMergeIdx);
    usedAnchorPositions.set(placed.length - 1, newWordAnchorUsed);
  });

  return placed;
}

  /* ══════════════════════════════════════════════════════════════
     TILE FACTORY
  ══════════════════════════════════════════════════════════════ */

  function _tileUrl() {
    const url = window.NullCorps.state.tileImageUrl;
    if (url && url.trim()) return url.trim();
    return _isDozerMode() ? DEFAULT_TILE_DOZER : DEFAULT_TILE;
  }

  function _makeTile(letter, col, row, forceNoMerge) {
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
    const dozer      = _isDozerMode();
    const letterCol  = dozer ? LETTER_COLOR_DOZER   : LETTER_COLOR;
    const outlineCol = dozer ? LETTER_OUTLINE_DOZER : LETTER_OUTLINE;
    const w = LETTER_OUTLINE_W;
    const shadow = [
      `${w}px 0 0 ${outlineCol}`, `-${w}px 0 0 ${outlineCol}`,
      `0 ${w}px 0 ${outlineCol}`, `0 -${w}px 0 ${outlineCol}`,
      `${w}px ${w}px 0 ${outlineCol}`, `-${w}px ${w}px 0 ${outlineCol}`,
      `${w}px -${w}px 0 ${outlineCol}`, `-${w}px -${w}px 0 ${outlineCol}`,
    ].join(', ');
    span.style.cssText = [
      'position: absolute', 'top: 50%', 'left: 50%',
      'transform: translate(-50%, -50%)',
      `font-family: ${FONT_FAMILY}`, `font-size: ${FONT_SIZE}px`,
      `color: ${letterCol}`, `text-shadow: ${shadow}`,
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

    document.querySelectorAll('.nc-crossword-group').forEach(g => g.remove());

    if (!_words.length) return;
    if (!_crosswordVisible) return;

    if (_separated) {
      _renderSeparated(hContainer);
    } else {
      _renderJoined(hContainer);
    }
  }

  /* ── Joined rendering ── */
  function _renderJoined(container) {
    // In joined mode, words that share a chain cluster together.
    // Auto-separated words (no shared letter, or force-broken) get their own groups.
    // We cluster consecutive non-separated words together.
    const clusters = [];
    let current = [];

    for (let i = 0; i < _words.length; i++) {
      const w = _words[i];
      if (!w.separated) {
        current.push(w);
        // If the NEXT word is force-broken from this one, flush cluster now
        // (the next word will either start a new cluster or be auto-separated)
        if (_pairBreaks.has(i) && i < _words.length - 1) {
          clusters.push({ words: current, separated: false });
          current = [];
        }
      } else {
        if (current.length) { clusters.push({ words: current, separated: false }); current = []; }
        clusters.push({ words: [w], separated: true });
      }
    }
    if (current.length) clusters.push({ words: current, separated: false });

    let bbIdx = 0;
    for (const cluster of clusters) {
      _buildGroup(container, cluster.words, bbIdx, false);
      bbIdx++;
    }
  }

  /* ── Separated rendering ── */
  function _renderSeparated(container) {
    // Build clusters: consecutive words linked via _separatedPairLinks are
    // rendered as one group (crossword-joined); others get their own group.
    const clusters = [];
    let current = [_words[0]];
    for (let i = 1; i < _words.length; i++) {
      if (_separatedPairLinks.has(i - 1) && !_words[i].separated) {
        // This pair is explicitly linked — keep in same cluster
        current.push(_words[i]);
      } else {
        clusters.push(current);
        current = [_words[i]];
      }
    }
    if (current.length) clusters.push(current);

    let bbIdx = 0;
    for (const cluster of clusters) {
      // noMerge=false for linked clusters (show gold merge tiles), true for solo words
      _buildGroup(container, cluster, bbIdx, cluster.length === 1);
      bbIdx++;
    }
  }

  /* ── Build one DOM group ── */
  function _buildGroup(container, words, bbIdx, noMerge) {
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

    group.style.pointerEvents = _locked ? 'none' : 'all';
    group.style.cursor = _locked ? 'default' : 'move';

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
    const m = transform.match(/matrix\(([^,]+)/);
    if (m) return parseFloat(m[1]);
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

    if (!document.getElementById('nc-crossword-mobile-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'nc-crossword-mobile-style';
      styleEl.textContent = '';
      document.head.appendChild(styleEl);
    }

    /* ── Locked + View controls ── */
    const mobileControls = document.createElement('div');
    mobileControls.className = 'nc-crossword-mobile-controls';
    mobileControls.style.cssText = [
      'display: flex', 'align-items: center', 'gap: 8px',
      'margin-bottom: 10px', 'flex-wrap: wrap',
    ].join(';');

    function _mkToggleBtn(labelText, isActive, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = labelText;
      const setStyle = (active) => {
        btn.style.cssText = [
          'padding: 5px 12px', 'font-size: 11px',
          "font-family: var(--font-mono, 'Courier New', monospace)",
          'letter-spacing: 0.06em', 'text-transform: uppercase',
          'border-radius: 4px', 'cursor: pointer', 'font-weight: 600',
          active
            ? 'background: var(--c-accent-dim, rgba(200,255,0,0.15)); color: var(--c-accent, #c8ff00); border: 1px solid var(--c-accent, #c8ff00);'
            : 'background: transparent; color: var(--c-text-label, #8888a0); border: 1px solid var(--c-border, #2a2a2f);',
        ].join(';');
      };
      setStyle(isActive);
      btn.addEventListener('click', () => {
        const newState = onClick();
        setStyle(newState);
      });
      return btn;
    }

    const lockedBtn = _mkToggleBtn('🔒 Locked', _locked, () => {
      _locked = !_locked;
      window.NullCorps.state.crosswordLocked = _locked;
      _renderTiles();
      return _locked;
    });
    mobileControls.appendChild(lockedBtn);

    const viewBtn = _mkToggleBtn('👁 View', _crosswordVisible, () => {
      _crosswordVisible = !_crosswordVisible;
      window.NullCorps.state.crosswordVisible = _crosswordVisible;
      _renderTiles();
      return _crosswordVisible;
    });
    mobileControls.appendChild(viewBtn);

    container.appendChild(mobileControls);

    /* ── Controls row: Separate toggle + Flip direction button ── */
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = [
      'display: flex', 'align-items: center', 'gap: 10px',
      'margin-bottom: 8px', 'flex-wrap: wrap',
    ].join(';');

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

    if (!(_separated && _fixedOrientation)) {
      const flipBtn = document.createElement('button');
      flipBtn.type = 'button';
      flipBtn.textContent = _flipFirst ? '↕ Word 1: V→H' : '↔ Word 1: H→V';
      flipBtn.title = 'Swap the direction of the first word (H ↔ V).';
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

    /* ── Fixed Orientation toggle (Separate mode only) ── */
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

    /* ── Hint about auto-separation (joined mode) ── */
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

    /* ── Per-word inputs with inter-word break controls ── */

    // Styles for break UI elements
    const BREAK_BTN_CSS = [
      'padding: 2px 8px', 'font-size: 9px',
      "font-family: var(--font-mono, 'Courier New', monospace)",
      'background: var(--c-surface-2, #1e1e2e)',
      'color: var(--c-text-hint, #5f5f80)',
      'border: 1px dashed var(--c-border, #2a2a2f)',
      'border-radius: 3px', 'cursor: pointer', 'white-space: nowrap',
      'letter-spacing: 0.04em',
    ].join(';');

    const BREAK_DIVIDER_CSS = [
      'display: flex', 'align-items: center', 'gap: 6px',
      'margin: 4px 0', 'opacity: 0.75',
    ].join(';');

    const BREAK_LINE_CSS = [
      'flex: 1', 'height: 1px',
      'background: var(--c-accent, #c8ff00)', 'opacity: 0.4',
    ].join(';');

    const BREAK_LABEL_CSS = [
      'font-size: 9px', "font-family: var(--font-mono, 'Courier New', monospace)",
      'color: var(--c-accent, #c8ff00)', 'white-space: nowrap', 'letter-spacing: 0.08em',
    ].join(';');

    const BREAK_REMOVE_CSS = [
      'padding: 1px 5px', 'font-size: 9px',
      "font-family: var(--font-mono, 'Courier New', monospace)",
      'background: transparent', 'color: var(--c-text-hint, #5f5f80)',
      'border: 1px solid var(--c-border, #2a2a2f)',
      'border-radius: 3px', 'cursor: pointer',
    ].join(';');

    rawWords.forEach((wordStr, wi) => {
      const placedWord = _words[wi];
      let dirLabel;
      if (_separated && _fixedOrientation) {
        const orient = _wordOrientations[wi] ?? ((wi % 2 === 0) ? 'h' : 'v');
        dirLabel = orient.toUpperCase();
      } else if (_separated) {
        dirLabel = (_flipFirst ? (wi % 2 === 0 ? 'V' : 'H') : (wi % 2 === 0 ? 'H' : 'V'));
      } else {
        dirLabel = placedWord ? placedWord.dir.toUpperCase() : '?';
      }
      const isSeparatedWord = placedWord?.separated;
      const isBreakSep      = !_separated && _pairBreaks.has(wi - 1); // this word was force-broken from prev
      const wordLabel = `Word ${wi + 1} (${dirLabel})${isSeparatedWord ? ' · auto-split' : ''}`;

      /* ── Word group div ── */
      const group = document.createElement('div');
      group.style.cssText = 'margin-bottom: 4px;';

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

      input.addEventListener('input', function () {
        const words = _splitWords(window.NullCorps.state.cardName).words;
        words[wi] = this.value;
        const newName = _wordsToCardName(words);
        window.NullCorps.state.cardName = newName;
        const mainInput = document.getElementById('card-name');
        if (mainInput && mainInput !== document.activeElement) mainInput.value = newName;
        build();
      });

      group.appendChild(label);
      group.appendChild(input);

      // Hint text
      const hint = document.createElement('div');
      hint.style.cssText = [
        'font-size: 9px', 'color: var(--c-text-hint, #5f5f80)',
        "font-family: var(--font-mono, 'Courier New', monospace)",
        'margin-top: 2px', 'line-height: 1.4', 'margin-bottom: 6px',
      ].join(';');
      if (_separated) {
        hint.textContent = 'Special: <X>. Merge tags [X] are ignored in separate mode.';
      } else {
        hint.textContent = 'Auto-merges on first shared letter. Use [X] to force a merge letter.';
      }
      group.appendChild(hint);

      // H/V orientation buttons (fixed orientation mode only)
      if (_separated && _fixedOrientation) {
        const currentOrient = _wordOrientations[wi] ?? ((wi % 2 === 0) ? 'h' : 'v');
        const orientRow = document.createElement('div');
        orientRow.style.cssText = 'display:flex;gap:4px;margin-top:5px;margin-bottom:6px;';

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

      /* ── Inter-word break UI — only in joined mode, between words ── */
      if (!_separated && wi < rawWords.length - 1) {
        const pairIdx = wi; // break between word[wi] and word[wi+1]
        const hasBreak = _pairBreaks.has(pairIdx);

        if (hasBreak) {
          /* Show ── BREAK ── divider with × remove button */
          const divider = document.createElement('div');
          divider.style.cssText = BREAK_DIVIDER_CSS;

          const lineL = document.createElement('div');
          lineL.style.cssText = BREAK_LINE_CSS;

          const lbl = document.createElement('span');
          lbl.textContent = '── BREAK ──';
          lbl.style.cssText = BREAK_LABEL_CSS;

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = '×';
          removeBtn.title = 'Remove break — rejoin these words';
          removeBtn.style.cssText = BREAK_REMOVE_CSS;
          removeBtn.addEventListener('click', () => {
            _pairBreaks.delete(pairIdx);
            _persistBreaks();
            build();
          });

          const lineR = document.createElement('div');
          lineR.style.cssText = BREAK_LINE_CSS;

          divider.appendChild(lineL);
          divider.appendChild(lbl);
          divider.appendChild(removeBtn);
          divider.appendChild(lineR);
          container.appendChild(divider);

        } else {
          /* Show ÷ break button between these two words */
          const breakRow = document.createElement('div');
          breakRow.style.cssText = [
            'display: flex', 'justify-content: center',
            'margin: 2px 0 6px 0',
          ].join(';');

          const breakBtn = document.createElement('button');
          breakBtn.type = 'button';
          breakBtn.textContent = '÷ break';
          breakBtn.title = `Split between Word ${wi + 1} and Word ${wi + 2}`;
          breakBtn.style.cssText = BREAK_BTN_CSS;
          breakBtn.addEventListener('mouseenter', () => {
            breakBtn.style.color = 'var(--c-accent, #c8ff00)';
            breakBtn.style.borderColor = 'var(--c-accent, #c8ff00)';
          });
          breakBtn.addEventListener('mouseleave', () => {
            breakBtn.style.color = 'var(--c-text-hint, #5f5f80)';
            breakBtn.style.borderColor = 'var(--c-border, #2a2a2f)';
          });
          breakBtn.addEventListener('click', () => {
            _pairBreaks.add(pairIdx);
            _persistBreaks();
            build();
          });

          breakRow.appendChild(breakBtn);
          container.appendChild(breakRow);
        }
      }

      /* ── Per-pair link toggle — only in separated mode, between words ── */
      if (_separated && wi < rawWords.length - 1) {
        const pairIdx = wi;
        const isLinked = _separatedPairLinks.has(pairIdx);

        const linkRow = document.createElement('div');
        linkRow.style.cssText = [
          'display: flex', 'align-items: center', 'gap: 6px',
          'margin: 3px 0 6px 0',
        ].join(';');

        const lineL = document.createElement('div');
        lineL.style.cssText = [
          'flex: 1', 'height: 1px',
          `background: ${isLinked ? 'var(--c-accent, #c8ff00)' : 'var(--c-border, #2a2a2f)'}`,
          'opacity: 0.5',
        ].join(';');

        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.textContent = isLinked ? '⊠ linked' : '⊞ link';
        linkBtn.title = isLinked
          ? `Unlink — Word ${wi + 1} and Word ${wi + 2} will be separate`
          : `Link — Word ${wi + 1} and Word ${wi + 2} will crossword-join`;
        linkBtn.style.cssText = [
          'padding: 2px 9px', 'font-size: 9px',
          "font-family: var(--font-mono, 'Courier New', monospace)",
          'border-radius: 3px', 'cursor: pointer', 'white-space: nowrap',
          'letter-spacing: 0.04em', 'font-weight: 600',
          isLinked
            ? 'background: var(--c-accent-dim, rgba(200,255,0,0.12)); color: var(--c-accent, #c8ff00); border: 1px solid var(--c-accent, #c8ff00);'
            : 'background: var(--c-surface-2, #1e1e2e); color: var(--c-text-hint, #5f5f80); border: 1px dashed var(--c-border, #2a2a2f);',
        ].join(';');
        linkBtn.addEventListener('click', () => {
          if (_separatedPairLinks.has(pairIdx)) {
            _separatedPairLinks.delete(pairIdx);
          } else {
            _separatedPairLinks.add(pairIdx);
          }
          _persistSeparatedLinks();
          build();
        });

        const lineR = document.createElement('div');
        lineR.style.cssText = lineL.style.cssText;

        linkRow.appendChild(lineL);
        linkRow.appendChild(linkBtn);
        linkRow.appendChild(lineR);
        container.appendChild(linkRow);
      }
    });
  }

  /** Persist _pairBreaks to NullCorps.state as a plain array */
  function _persistBreaks() {
    window.NullCorps.state.crosswordPairBreaks = Array.from(_pairBreaks);
  }

  /** Persist _separatedPairLinks to NullCorps.state */
  function _persistSeparatedLinks() {
    window.NullCorps.state.crosswordSeparatedPairLinks = Array.from(_separatedPairLinks);
  }

  function _rebuildUI(rawWords) {
    _buildWordInputs(rawWords);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: build()
  ══════════════════════════════════════════════════════════════ */

  function build() {
    // _splitWords now returns { words, breaks } but we keep _pairBreaks
    // as the authoritative source (user edits via buttons); the | tokens
    // in the name string are also respected on first parse.
    const { words: rawWords, breaks: nameBreaks } = _splitWords(window.NullCorps.state.cardName);

    // Merge name-embedded breaks into _pairBreaks (additive on first load,
    // then the Set is authoritative so editing buttons work cleanly).
    // We only do this when _pairBreaks is empty to avoid fighting user edits.
    if (_pairBreaks.size === 0 && nameBreaks.size > 0) {
      for (const b of nameBreaks) _pairBreaks.add(b);
      _persistBreaks();
    }

    _words = _layoutWords(rawWords);
    _renderTiles();
    _buildWordInputs(rawWords);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC: getState / applyState
  ══════════════════════════════════════════════════════════════ */

  function getState() {
    return {
      x:     _bbStates[0].x,
      y:     _bbStates[0].y,
      scale: _bbStates[0].scale,
      angle: _bbStates[0].angle,
      bbStates:         _bbStates.map(b => ({ ...b })),
      separated:        _separated,
      flipFirst:        _flipFirst,
      fixedOrientation: _fixedOrientation,
      wordOrientations: _wordOrientations.slice(),
      locked:           _locked,
      crosswordVisible: _crosswordVisible,
      pairBreaks:       Array.from(_pairBreaks),
      separatedPairLinks: Array.from(_separatedPairLinks),
    };
  }

  function applyState(snap) {
    if (!snap) return;
    if (snap.separated         !== undefined) _separated        = snap.separated;
    if (snap.flipFirst         !== undefined) _flipFirst        = snap.flipFirst;
    if (snap.fixedOrientation  !== undefined) _fixedOrientation = snap.fixedOrientation;
    if (Array.isArray(snap.wordOrientations)) _wordOrientations = snap.wordOrientations.slice();
    if (snap.locked            !== undefined) _locked           = snap.locked;
    if (snap.crosswordVisible  !== undefined) _crosswordVisible = snap.crosswordVisible;
    if (Array.isArray(snap.pairBreaks)) {
      _pairBreaks = new Set(snap.pairBreaks);
    }
    if (Array.isArray(snap.separatedPairLinks)) {
      _separatedPairLinks = new Set(snap.separatedPairLinks);
    }
    if (snap.bbStates && Array.isArray(snap.bbStates)) {
      _bbStates = snap.bbStates.map(b => ({ ...b }));
    } else {
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
    if (window.NullCorps.state.crosswordLocked !== undefined) {
      _locked = !!window.NullCorps.state.crosswordLocked;
    }
    if (window.NullCorps.state.crosswordVisible !== undefined) {
      _crosswordVisible = !!window.NullCorps.state.crosswordVisible;
    }
    if (Array.isArray(window.NullCorps.state.crosswordPairBreaks)) {
      _pairBreaks = new Set(window.NullCorps.state.crosswordPairBreaks);
    }
    if (Array.isArray(window.NullCorps.state.crosswordSeparatedPairLinks)) {
      _separatedPairLinks = new Set(window.NullCorps.state.crosswordSeparatedPairLinks);
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
    } else {
      _buildWordInputs([]);
    }
  }

  function setSeparated(val) {
    _separated = !!val;
    window.NullCorps.state.crosswordSeparated = _separated;
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

  window.NullCorps.crossword = { init, build, getState, applyState, setSeparated, setFixedOrientation };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
