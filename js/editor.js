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
     INIT
  ══════════════════════════════════════════════════════════════ */

  function init() {
    _wireFields();
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
