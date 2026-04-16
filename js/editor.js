/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/editor.js
   Part 4: Text Layer Editor
   ─────────────────────────────────────────────────────────────
   Wires all settings-panel inputs to NullCorps.state and triggers
   a layers.js re-render on every change.

   Text layers handled:
     Layer 8  · Creator Credit    (TGL Engschrift 9pt, white/black 4px)
     Layer 9  · Game Name         (TGL Engschrift 9pt, white/black 4px)
     Layer 10 · Unique Card #     (TGL Engschrift 9pt, white/black 4px)
     Layer 11 · ATK Stat          (TGL Engschrift 50pt, white/black 4px)
     Layer 12 · DEF Stat          (TGL Engschrift 50pt, white/black 4px)
     Layer 13 · HP Stat           (TGL Engschrift 32pt, black/white 4px)
     Layer 14 · SHD Stat          (TGL Engschrift 32pt, black/white 4px)
     Layer 15 · Energy Stat       (TGL Engschrift 50pt, white/black 4px)
     Layer 25 · Zone Indicator    (TGL Engschrift 50pt, white/black 4px)
     Layer 26 · Hierarchy Text    (TGL Engschrift 21pt, black/white 4px)
     Layer 27 · Card Title        (TGL Engschrift 21pt, white/black 4px, confined)
     Layer 28 · Card Type Text    (TGL Engschrift 21pt, black/white 4px)
     Layer 29 · Card Effect Desc  (Archivo ExtraCondensed Light 17pt, black/white 4px,
                                   confined 2000.7×285.8px)

   All other fields (card name, crossword, tile URL) write to state
   and trigger render — crossword.js reads them separately.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     FIELD MAP
     Maps each input element ID → the NullCorps.state key it drives.
     Type 'number' coerces to Number; 'text' keeps as string.
  ══════════════════════════════════════════════════════════════ */
  const FIELD_MAP = [
    /* Identity & meta */
    { id: 'card-name',       stateKey: 'cardName',       type: 'text'   },
    { id: 'card-title',      stateKey: 'cardTitle',      type: 'text'   },
    { id: 'card-type',       stateKey: 'cardType',       type: 'text'   },
    { id: 'era-text',        stateKey: 'era',            type: 'text'   },
    { id: 'unique-number',   stateKey: 'uniqueNumber',   type: 'text'   },
    { id: 'card-effect',     stateKey: 'cardEffect',     type: 'text'   },
    /* Stats */
    { id: 'stat-atk',        stateKey: 'atk',            type: 'number' },
    { id: 'stat-def',        stateKey: 'def',            type: 'number' },
    { id: 'stat-hp',         stateKey: 'hp',             type: 'number' },
    { id: 'stat-shd',        stateKey: 'shd',            type: 'number' },
    { id: 'stat-energy',     stateKey: 'energy',         type: 'number' },
    /* Creator */
    { id: 'creator-credit',  stateKey: 'creatorCredit',  type: 'text'   },
    { id: 'game-name',       stateKey: 'gameName',       type: 'text'   },
    /* Crossword tile URL */
    { id: 'tile-image-url',  stateKey: 'tileImageUrl',   type: 'text'   },
    /* Zone indicator is wired by territories.js — we still sync state here on manual edit */
    { id: 'zone-indicator',  stateKey: 'zone',           type: 'text'   },
  ];

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */

  /** Trigger a full layer re-render if layers.js is ready. */
  function _triggerRender() {
    if (window.NullCorps.layers && typeof window.NullCorps.layers.render === 'function') {
      window.NullCorps.layers.render();
    }
  }

  /** Trigger crossword rebuild if crossword.js is ready. */
  function _triggerCrossword() {
    if (window.NullCorps.crossword && typeof window.NullCorps.crossword.build === 'function') {
      window.NullCorps.crossword.build();
    }
  }

  /**
   * Sync a single input element's visual value from NullCorps.state.
   * Used when a preset is loaded to push state → UI.
   */
  function _syncInputFromState(fieldDef) {
    const el = document.getElementById(fieldDef.id);
    if (!el) return;
    const val = window.NullCorps.state[fieldDef.stateKey];
    if (val === undefined || val === null) return;

    if (el.tagName === 'SELECT') {
      el.value = String(val);
    } else {
      el.value = fieldDef.type === 'number'
        ? (val === 0 ? '' : String(val))
        : String(val);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT WIRING
  ══════════════════════════════════════════════════════════════ */

  function _wireFields() {
    for (const field of FIELD_MAP) {
      const el = document.getElementById(field.id);
      if (!el) continue;

      const eventType = (el.tagName === 'SELECT') ? 'change' : 'input';

      el.addEventListener(eventType, function () {
        const raw = this.value;
        let val;

        if (field.type === 'number') {
          val = raw === '' ? 0 : Number(raw);
          if (isNaN(val)) val = 0;
        } else {
          val = raw;
        }

        window.NullCorps.state[field.stateKey] = val;

        // Card name changes also need a crossword rebuild
        if (field.id === 'card-name') {
          _triggerCrossword();
        }

        _triggerRender();
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     STATE → UI SYNC
     Call this after a preset is loaded to push all state values
     back into the input elements.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Sync all managed input fields from current NullCorps.state.
   * Does NOT trigger a render — the caller should do that if needed.
   */
  function syncFromState() {
    for (const field of FIELD_MAP) {
      _syncInputFromState(field);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PRESET INTEGRATION
     Expose a helper so js/presets.js can easily rebuild the full
     state snapshot (text fields only).
  ══════════════════════════════════════════════════════════════ */

  /**
   * Return an object with all text-layer state values keyed by their
   * state key. Used when serialising a preset to JSON.
   */
  function getTextState() {
    const s = window.NullCorps.state;
    return {
      cardName:      s.cardName      || '',
      cardTitle:     s.cardTitle     || '',
      cardType:      s.cardType      || '',
      era:           s.era           || '',
      uniqueNumber:  s.uniqueNumber  || '',
      cardEffect:    s.cardEffect    || '',
      atk:           s.atk           ?? 0,
      def:           s.def           ?? 0,
      hp:            s.hp            ?? 0,
      shd:           s.shd           ?? 0,
      energy:        s.energy        ?? 0,
      creatorCredit: s.creatorCredit || 'iridesuwa',
      gameName:      s.gameName      || 'Null Corps',
      tileImageUrl:  s.tileImageUrl  || '',
    };
  }

  /**
   * Apply a text-state snapshot (e.g. from a loaded preset) into
   * NullCorps.state and sync all inputs.
   *
   * @param {object} snap — same shape as getTextState() output
   */
  function applyTextState(snap) {
    if (!snap) return;
    const s = window.NullCorps.state;
    const numberKeys = ['atk', 'def', 'hp', 'shd', 'energy'];

    for (const key of Object.keys(snap)) {
      if (numberKeys.includes(key)) {
        s[key] = Number(snap[key]) || 0;
      } else {
        s[key] = snap[key] ?? '';
      }
    }

    syncFromState();
  }

  /* ══════════════════════════════════════════════════════════════
     CHARACTER COUNTER FOR CARD EFFECT (optional UX enhancement)
     The confined box is 2000.7 × 285.8 px at native card size.
     At the rendering scale it's tight — a live char counter helps.
  ══════════════════════════════════════════════════════════════ */

  function _wireEffectCounter() {
    const textarea = document.getElementById('card-effect');
    if (!textarea) return;

    // Insert a small counter below the textarea
    const counter = document.createElement('div');
    counter.id = 'card-effect-counter';
    counter.style.cssText = [
      'font-size: 10px',
      'font-family: var(--font-mono, monospace)',
      'color: var(--c-text-hint, #555568)',
      'text-align: right',
      'margin-top: -2px',
      'letter-spacing: 0.04em',
    ].join(';');

    // Insert after the hint div if present, otherwise after the textarea
    const parent = textarea.parentElement;
    parent.appendChild(counter);

    function _update() {
      const len = textarea.value.length;
      counter.textContent = `${len} char${len !== 1 ? 's' : ''}`;
      // Subtle warning colour above ~300 chars (box gets crowded)
      counter.style.color = len > 300
        ? 'var(--c-accent, #c8ff00)'
        : 'var(--c-text-hint, #555568)';
    }

    textarea.addEventListener('input', _update);
    _update();
  }

  /* ══════════════════════════════════════════════════════════════
     CARD ART UPLOAD (Layer 36)
     Reads the chosen file as a data URL, stores it in state, and
     triggers a render.  Also wires the ✕ Remove button.
  ══════════════════════════════════════════════════════════════ */

  function _wireCardArt() {
    const fileInput   = document.getElementById('card-art-input');
    const removeBtn   = document.getElementById('btn-remove-card-art');
    const filenameEl  = document.getElementById('card-art-filename');
    const previewWrap = document.getElementById('card-art-preview-wrap');
    const previewImg  = document.getElementById('card-art-preview');

    if (!fileInput) return;

    fileInput.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        window.NullCorps.state.cardArtDataUrl = dataUrl;

        // Update UI
        if (filenameEl)  filenameEl.textContent = file.name;
        if (removeBtn)   removeBtn.style.display = '';
        if (previewImg)  previewImg.src = dataUrl;
        if (previewWrap) previewWrap.style.display = '';

        _triggerRender();
      };
      reader.readAsDataURL(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        _clearCardArt(fileInput, filenameEl, removeBtn, previewWrap, previewImg);
      });
    }
  }

  function _clearCardArt(fileInput, filenameEl, removeBtn, previewWrap, previewImg) {
    window.NullCorps.state.cardArtDataUrl = '';
    if (fileInput)   fileInput.value = '';
    if (filenameEl)  filenameEl.textContent = 'No file chosen';
    if (removeBtn)   removeBtn.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewImg)  previewImg.removeAttribute('src');
    _triggerRender();
  }


  /* ══════════════════════════════════════════════════════════════
     FONT PICKER TOOLBAR (Layer 29 — Card Effect)
     ─────────────────────────────────────────────────────────────
     Photoshop-style text formatting toolbar above the card-effect
     textarea. Highlight text, then pick a font from the dropdown
     and/or enter a size — click Apply (or press Enter in size box)
     to wrap the selection in [[font:Name:text]] and/or [[size:N:text]].

     Also includes B (bold), A+ (large ×1.3), and ✕ strip buttons.
  ══════════════════════════════════════════════════════════════ */

  /* Fonts available in the card renderer */
  const FONT_OPTIONS = [
    { label: 'TGL Engschrift',               value: 'TGL Engschrift',               previewCss: "font-family:'TGL Engschrift',Arial,sans-serif" },
    { label: 'Archivo',                      value: 'Archivo',                      previewCss: "font-family:'Archivo',Arial,sans-serif;font-weight:400" },
    { label: 'Archivo ExtraCondensed',       value: 'Archivo ExtraCondensed',       previewCss: "font-family:'Archivo',Arial,sans-serif;font-weight:400;font-stretch:extra-condensed" },
    { label: 'Archivo ExtraCondensed Light', value: 'Archivo ExtraCondensed Light', previewCss: "font-family:'Archivo',Arial,sans-serif;font-weight:300;font-stretch:extra-condensed" },
    { label: 'Monospace',                    value: 'monospace',                    previewCss: 'font-family:monospace' },
    { label: 'Serif',                        value: 'serif',                        previewCss: 'font-family:serif' },
  ];

  function _wireEffectFontPicker() {
    const textarea = document.getElementById('card-effect');
    if (!textarea) return;

    /* ── Build toolbar container ── */
    const toolbar = document.createElement('div');
    toolbar.id = 'effect-font-toolbar';
    toolbar.style.cssText = [
      'display:flex', 'flex-wrap:wrap', 'gap:5px',
      'margin-bottom:5px', 'align-items:center',
      'background:var(--c-surface-2,#1e1e2e)',
      'border:1px solid var(--c-border,#333348)',
      'border-radius:5px', 'padding:5px 7px',
    ].join(';');

    /* ── Helper: prevent blur on click (but allow select dropdowns to work) ── */
    toolbar.addEventListener('mousedown', e => {
      // Don't prevent default on select elements — they need it to open the dropdown
      if (e.target.tagName !== 'SELECT') e.preventDefault();
    });

    /* ── Core wrap helper (operates on textarea selection) ── */
    function _wrapSelection(prefix, suffix) {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const val   = textarea.value;
      const sel   = val.slice(start, end);
      const placeholder = '…text…';
      const inner = sel || placeholder;
      const wrapped = prefix + inner + suffix;
      textarea.value = val.slice(0, start) + wrapped + val.slice(end);
      if (!sel) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd   = start + prefix.length + placeholder.length;
      } else {
        textarea.selectionStart = start;
        textarea.selectionEnd   = start + wrapped.length;
      }
      textarea.focus();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ── Strip/unwrap helper ── */
    function _stripTag() {
      const val = textarea.value;
      const pos = textarea.selectionStart;
      const tagRe = /\[\[[^\]:]+:[^\]]*\]\]/g;
      let best = null, m;
      while ((m = tagRe.exec(val)) !== null) {
        const mStart = m.index, mEnd = m.index + m[0].length;
        if (mStart <= pos && pos <= mEnd) {
          const inner = m[0].replace(/^\[\[[^\]:]+:/, '').replace(/\]\]$/, '');
          if (!best || (mEnd - mStart) < (best.end - best.start)) {
            best = { start: mStart, end: mEnd, inner };
          }
        }
      }
      if (best) {
        textarea.value = val.slice(0, best.start) + best.inner + val.slice(best.end);
        textarea.selectionStart = best.start;
        textarea.selectionEnd   = best.start + best.inner.length;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        textarea.focus();
      }
    }

    /* ── Font dropdown ── */
    const fontLabel = document.createElement('span');
    fontLabel.textContent = 'Font';
    fontLabel.style.cssText = 'font-size:10px;color:var(--c-text-hint,#555568);font-family:var(--font-mono,monospace);white-space:nowrap;';
    toolbar.appendChild(fontLabel);

    const fontSelect = document.createElement('select');
    fontSelect.id = 'effect-font-select';
    fontSelect.style.cssText = [
      'font-size:11px', 'background:var(--c-surface-3,#2a2a3e)',
      'color:var(--c-text,#e0e0f0)', 'border:1px solid var(--c-border,#333348)',
      'border-radius:3px', 'padding:2px 5px', 'cursor:pointer',
      'font-family:var(--font-mono,monospace)', 'max-width:160px',
    ].join(';');

    // "— no change —" default option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— font —';
    fontSelect.appendChild(defaultOpt);

    for (const f of FONT_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      opt.style.cssText = f.previewCss;
      fontSelect.appendChild(opt);
    }
    toolbar.appendChild(fontSelect);

    /* ── Size input ── */
    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'Size';
    sizeLabel.style.cssText = 'font-size:10px;color:var(--c-text-hint,#555568);font-family:var(--font-mono,monospace);white-space:nowrap;margin-left:4px;';
    toolbar.appendChild(sizeLabel);

    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.id = 'effect-font-size';
    sizeInput.placeholder = 'pt';
    sizeInput.min = 6; sizeInput.max = 200;
    sizeInput.style.cssText = [
      'width:46px', 'font-size:11px', 'background:var(--c-surface-3,#2a2a3e)',
      'color:var(--c-text,#e0e0f0)', 'border:1px solid var(--c-border,#333348)',
      'border-radius:3px', 'padding:2px 5px', 'font-family:var(--font-mono,monospace)',
    ].join(';');
    toolbar.appendChild(sizeInput);

    /* ── Apply button ── */
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = '▶ Apply';
    applyBtn.title = 'Apply font/size to selected text';
    applyBtn.style.cssText = [
      'padding:2px 8px', 'font-size:10px', 'font-family:var(--font-mono,monospace)',
      'background:var(--c-accent,#c8ff00)', 'color:#000',
      'border:none', 'border-radius:3px', 'cursor:pointer',
      'font-weight:bold', 'white-space:nowrap',
    ].join(';');

    function _applyFormatting() {
      const font = fontSelect.value;
      const size = sizeInput.value.trim();
      if (!font && !size) { textarea.focus(); return; }

      // Build prefix/suffix: size wraps inside font if both given
      let prefix = '', suffix = '';
      if (size) { prefix = `[[size:${size}:` + prefix; suffix = suffix + ']]'; }
      if (font) { prefix = `[[font:${font}:` + prefix; suffix = suffix + ']]'; }

      _wrapSelection(prefix, suffix);

      // Reset controls
      fontSelect.value = '';
      sizeInput.value = '';
    }

    applyBtn.addEventListener('click', _applyFormatting);
    sizeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _applyFormatting(); } });
    toolbar.appendChild(applyBtn);

    /* ── Divider ── */
    const div1 = document.createElement('span');
    div1.style.cssText = 'width:1px;height:16px;background:var(--c-border,#333348);margin:0 2px;display:inline-block;align-self:center;';
    toolbar.appendChild(div1);

    /* ── Bold button ── */
    function _mkFmtBtn(text, title, handler) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.title = title;
      b.style.cssText = [
        'padding:2px 7px', 'font-size:10px', 'font-family:var(--font-mono,monospace)',
        'background:var(--c-surface-2,#1e1e2e)', 'color:var(--c-text,#e0e0f0)',
        'border:1px solid var(--c-border,#333348)', 'border-radius:3px',
        'cursor:pointer', 'white-space:nowrap', 'line-height:1.5',
      ].join(';');
      b.addEventListener('mouseover', () => b.style.background = 'var(--c-surface-3,#2a2a3e)');
      b.addEventListener('mouseout',  () => b.style.background = 'var(--c-surface-2,#1e1e2e)');
      b.addEventListener('click', handler);
      toolbar.appendChild(b);
      return b;
    }

    _mkFmtBtn('B', 'Bold — wraps in [[bold:…]]', () => _wrapSelection('[[bold:', ']]'));
    _mkFmtBtn('A+', 'Large (×1.3) — wraps in [[large:…]]', () => _wrapSelection('[[large:', ']]'));
    _mkFmtBtn('✕ strip', 'Remove [[tag:…]] nearest cursor', _stripTag);

    /* ── Insert toolbar before the textarea in the DOM ── */
    const parent = textarea.parentElement;
    parent.insertBefore(toolbar, textarea);

    /* ── Syntax hint below textarea ── */
    const hint = document.getElementById('card-effect-syntax-hint') ||
                 (() => {
                   const h = document.createElement('div');
                   h.id = 'card-effect-syntax-hint';
                   parent.appendChild(h);
                   return h;
                 })();
    hint.style.cssText = 'font-size:9px;font-family:var(--font-mono,monospace);color:var(--c-text-hint,#555568);margin-top:3px;line-height:1.6;';
    hint.innerHTML =
      'Select text → choose font/size → click <b>▶ Apply</b>. ' +
      'Or use tags manually: ' +
      '<code style="color:var(--c-accent,#c8ff00)">[[font:TGL Engschrift:text]]</code> &nbsp;' +
      '<code style="color:var(--c-accent,#c8ff00)">[[size:18:text]]</code> &nbsp;' +
      '<code style="color:var(--c-accent,#c8ff00)">[[bold:text]]</code>. ' +
      'Use <code>\\n</code> for line break.';
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

  function init() {
    _wireFields();
    _wireEffectFontPicker();
    _wireEffectCounter();
    _wireCardArt();

    // Push any initial state values into inputs (e.g. default creator credit)
    syncFromState();
  }

  /* ── Expose public API on NullCorps namespace ── */
  window.NullCorps.editor = {
    init,
    syncFromState,
    getTextState,
    applyTextState,
  };

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

