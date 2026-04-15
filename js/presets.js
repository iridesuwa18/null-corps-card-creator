/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/presets.js
   Part 6: Preset Save / Load System
   ─────────────────────────────────────────────────────────────
   Handles:
     • Saving the full card state as a JSON preset (download)
     • Loading a preset from a local .json file upload
     • Loading a preset from a raw GitHub URL
     • Auto-fetching any *.json files from a /presets/ folder on
       the configured GitHub repo and listing them in the dropdown
     • Territory presets are generated from territories.js data
       and listed in a separate <optgroup>

   JSON Preset format (full card state snapshot):
   {
     "presetName":    "My Card",
     "territory":     "Serenelast",      // or null
     "cardName":      "Rien Greenfield",
     "cardTitle":     "...",
     "cardType":      "Character",
     "era":           "0 ME",
     "uniqueNumber":  "NC-001",
     "atk":           300,
     "def":           200,
     "hp":            1000,
     "shd":           50,
     "energy":        2,
     "cardEffect":    "...",
     "creatorCredit": "iridesuwa",
     "gameName":      "Null Corps",
     "tileImageUrl":  "",
     "crossword": {
       "x": 500, "y": 400, "scale": 1, "angle": 0
     }
   }

   UI elements (all created in index.html Part 1):
     #user-preset-select   — dropdown, user presets listed here
     #btn-save-preset      — download current state as JSON
     #btn-load-preset-file — trigger hidden file input
     #preset-file-input    — hidden <input type="file">
     #preset-github-url    — raw URL input
     #btn-load-preset-url  — fetch + apply from URL
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     GITHUB REPO CONFIGURATION
     Change GITHUB_PRESETS_URL to point to your repository's raw
     presets folder listing (GitHub API endpoint).
     Example: 'https://api.github.com/repos/USERNAME/REPO/contents/presets'
  ══════════════════════════════════════════════════════════════ */
  const GITHUB_PRESETS_API = ''; // Set to your GitHub API URL to enable auto-fetch

  /* ══════════════════════════════════════════════════════════════
     IN-MEMORY PRESET STORE
  ══════════════════════════════════════════════════════════════ */
  // User presets: [{ name, data }]  (loaded from file/URL/GitHub)
  let _userPresets = [];

  /* ══════════════════════════════════════════════════════════════
     SERIALISE — build a full snapshot from NullCorps.state
  ══════════════════════════════════════════════════════════════ */

  /**
   * Collect the full card state into a plain JSON-serialisable object.
   * @param {string} [name]  Optional preset name; prompts if omitted.
   * @returns {object|null}
   */
  function _buildSnapshot(name) {
    const s = window.NullCorps.state;

    // Gather text-layer fields via editor.js if available
    const textState = window.NullCorps.editor
      ? window.NullCorps.editor.getTextState()
      : {};

    // Gather crossword bounding-box state
    const crosswordState = window.NullCorps.crossword
      ? window.NullCorps.crossword.getState()
      : { x: 500, y: 400, scale: 1, angle: 0 };

    return {
      presetName:    name || 'Untitled Preset',
      territory:     s.territory     || null,
      cardName:      textState.cardName      || s.cardName      || '',
      cardTitle:     textState.cardTitle     || s.cardTitle     || '',
      cardType:      textState.cardType      || s.cardType      || '',
      era:           textState.era           || s.era           || '',
      uniqueNumber:  textState.uniqueNumber  || s.uniqueNumber  || '',
      atk:           textState.atk           ?? s.atk           ?? 0,
      def:           textState.def           ?? s.def           ?? 0,
      hp:            textState.hp            ?? s.hp            ?? 0,
      shd:           textState.shd           ?? s.shd           ?? 0,
      energy:        textState.energy        ?? s.energy        ?? 0,
      cardEffect:    textState.cardEffect    || s.cardEffect    || '',
      creatorCredit: textState.creatorCredit || s.creatorCredit || 'iridesuwa',
      gameName:      textState.gameName      || s.gameName      || 'Null Corps',
      tileImageUrl:  textState.tileImageUrl  || s.tileImageUrl  || '',
      crossword:     crosswordState,
    };
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY — push a snapshot into state + rebuild UI
  ══════════════════════════════════════════════════════════════ */

  /**
   * Apply a preset snapshot to the editor.
   * Order matters:
   *   1. Apply territory (rewires energy PNG layers)
   *   2. Apply text state (fills all inputs)
   *   3. Apply crossword bounding box, then rebuild tiles
   *   4. Trigger full layer re-render
   *
   * @param {object} snap  Preset JSON object
   */
  function _applySnapshot(snap) {
    if (!snap || typeof snap !== 'object') {
      console.warn('[presets.js] Invalid snapshot — nothing applied.');
      return;
    }

    const nc = window.NullCorps;

    /* 1 · Territory */
    if (nc.territories && typeof nc.territories.applyTerritory === 'function') {
      nc.territories.applyTerritory(snap.territory || null);
    } else {
      // Fallback: write directly to state
      nc.state.territory = snap.territory || null;
    }

    /* 2 · Text layers */
    const textSnap = {
      cardName:      snap.cardName      || '',
      cardTitle:     snap.cardTitle     || '',
      cardType:      snap.cardType      || '',
      era:           snap.era           || '',
      uniqueNumber:  snap.uniqueNumber  || '',
      cardEffect:    snap.cardEffect    || '',
      atk:           snap.atk          ?? 0,
      def:           snap.def          ?? 0,
      hp:            snap.hp           ?? 0,
      shd:           snap.shd          ?? 0,
      energy:        snap.energy       ?? 0,
      creatorCredit: snap.creatorCredit || 'iridesuwa',
      gameName:      snap.gameName     || 'Null Corps',
      tileImageUrl:  snap.tileImageUrl || '',
    };

    if (nc.editor && typeof nc.editor.applyTextState === 'function') {
      nc.editor.applyTextState(textSnap);
    } else {
      // Fallback: write directly to state
      Object.assign(nc.state, textSnap);
    }

    /* 3 · Crossword bounding box + tile rebuild */
    if (nc.crossword && typeof nc.crossword.applyState === 'function') {
      nc.crossword.applyState(snap.crossword || null);
    } else if (nc.crossword && typeof nc.crossword.build === 'function') {
      nc.crossword.build();
    }

    /* 4 · Full layer re-render */
    if (nc.layers && typeof nc.layers.render === 'function') {
      nc.layers.render();
    }

    _showToast(`Preset "${snap.presetName || 'Unnamed'}" loaded.`);
  }

  /* ══════════════════════════════════════════════════════════════
     SAVE — download current state as a JSON file
  ══════════════════════════════════════════════════════════════ */

  function _savePreset() {
    // Prompt for a name
    const name = window.prompt('Preset name:', window.NullCorps.state.cardName || 'My Card');
    if (name === null) return; // cancelled

    const snap = _buildSnapshot(name.trim() || 'My Card');
    const json = JSON.stringify(snap, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = _toFilename(snap.presetName) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    _showToast(`Saved "${snap.presetName}".`);
  }

  /** Convert a preset name to a safe filename slug. */
  function _toFilename(name) {
    return (name || 'preset')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'preset';
  }

  /* ══════════════════════════════════════════════════════════════
     LOAD FROM FILE
  ══════════════════════════════════════════════════════════════ */

  function _loadFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const snap = JSON.parse(e.target.result);
        _registerUserPreset(snap);
        _applySnapshot(snap);
      } catch (err) {
        _showToast('Error: Could not parse JSON file.', true);
        console.error('[presets.js] JSON parse error:', err);
      }
    };
    reader.readAsText(file);
  }

  /* ══════════════════════════════════════════════════════════════
     LOAD FROM URL
  ══════════════════════════════════════════════════════════════ */

  async function _loadFromUrl(url) {
    if (!url || !url.trim()) {
      _showToast('Please enter a URL.', true);
      return;
    }

    const rawUrl = url.trim();
    _showToast('Fetching…');

    try {
      const resp = await fetch(rawUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const snap = await resp.json();
      _registerUserPreset(snap);
      _applySnapshot(snap);
    } catch (err) {
      _showToast(`Error: ${err.message}`, true);
      console.error('[presets.js] URL fetch error:', err);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     AUTO-FETCH FROM GITHUB /presets/ FOLDER
     Uses the GitHub Contents API to list .json files, then fetches
     each one's raw_url and adds it to the user preset dropdown.
  ══════════════════════════════════════════════════════════════ */

  async function _fetchGithubPresets() {
    if (!GITHUB_PRESETS_API) return; // not configured

    try {
      const resp = await fetch(GITHUB_PRESETS_API);
      if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);
      const files = await resp.json();

      if (!Array.isArray(files)) return;

      const jsonFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const r = await fetch(file.download_url || file.raw_url);
          if (!r.ok) continue;
          const snap = await r.json();
          _registerUserPreset(snap);
        } catch (e) {
          console.warn('[presets.js] Could not load preset file:', file.name, e);
        }
      }

      if (jsonFiles.length > 0) {
        _showToast(`Loaded ${jsonFiles.length} preset(s) from GitHub.`);
      }
    } catch (err) {
      // Non-fatal — editor works fine without GitHub presets
      console.warn('[presets.js] GitHub presets fetch failed:', err.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     USER PRESET DROPDOWN MANAGEMENT
  ══════════════════════════════════════════════════════════════ */

  /**
   * Add a preset to the in-memory list and the dropdown.
   * Silently deduplicates by presetName.
   */
  function _registerUserPreset(snap) {
    if (!snap || !snap.presetName) return;

    // Deduplicate
    const exists = _userPresets.findIndex(p => p.name === snap.presetName);
    if (exists !== -1) {
      _userPresets[exists] = { name: snap.presetName, data: snap };
    } else {
      _userPresets.push({ name: snap.presetName, data: snap });
    }

    _rebuildUserPresetDropdown();
  }

  function _rebuildUserPresetDropdown() {
    const sel = document.getElementById('user-preset-select');
    if (!sel) return;

    sel.innerHTML = '';

    // Placeholder option
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select a user preset —';
    sel.appendChild(placeholder);

    if (_userPresets.length === 0) {
      const empty = document.createElement('option');
      empty.disabled = true;
      empty.textContent = 'No user presets loaded yet';
      sel.appendChild(empty);
      return;
    }

    const group = document.createElement('optgroup');
    group.label = 'User Presets';
    for (const p of _userPresets) {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      group.appendChild(opt);
    }
    sel.appendChild(group);
  }

  /* ══════════════════════════════════════════════════════════════
     TERRITORY PRESET DROPDOWN (populated into #territory-select)
     territories.js already builds this dropdown via its own init.
     We surface the territory preset concept here for completeness
     and add a "Preset: …" label section in the territory dropdown
     if it hasn't been built yet.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Build a minimal territory preset snapshot so that selecting a
   * territory in the territory dropdown also works as a "preset" —
   * any unsaved text fields are kept, but all energy/PNG layers
   * are overridden by the new territory.
   *
   * This is done automatically by territories.js on territory-select
   * change. presets.js does not need to duplicate that wiring.
   */

  /* ══════════════════════════════════════════════════════════════
     TOAST NOTIFICATIONS
     Lightweight, non-blocking status message.
  ══════════════════════════════════════════════════════════════ */

  let _toastTimer = null;

  function _showToast(message, isError = false) {
    let toast = document.getElementById('nc-preset-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'nc-preset-toast';
      toast.style.cssText = [
        'position: fixed',
        'bottom: 24px',
        'left: 50%',
        'transform: translateX(-50%)',
        'background: #1a1a1f',
        'color: #e8e8ec',
        'border: 1px solid #2a2a2f',
        'border-radius: 6px',
        'padding: 10px 20px',
        'font-family: var(--font-ui, Arial, sans-serif)',
        'font-size: 13px',
        'z-index: 99999',
        'pointer-events: none',
        'transition: opacity 0.3s',
        'opacity: 0',
        'white-space: nowrap',
        'box-shadow: 0 4px 16px rgba(0,0,0,0.5)',
      ].join(';');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.borderColor = isError ? '#ff4444' : '#c8ff00';
    toast.style.color       = isError ? '#ff8888' : '#e8e8ec';
    toast.style.opacity     = '1';

    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  /* ══════════════════════════════════════════════════════════════
     PUBLIC API
     Exposed on window.NullCorps.presets so other modules can
     programmatically save/load presets if needed.
  ══════════════════════════════════════════════════════════════ */

  const presets = {
    /**
     * Save the current card state as a JSON file download.
     */
    save: _savePreset,

    /**
     * Apply a preset snapshot object to the editor.
     * @param {object} snap
     */
    apply: _applySnapshot,

    /**
     * Load a preset from a raw URL string.
     * @param {string} url
     */
    loadFromUrl: _loadFromUrl,

    /**
     * Load a preset from a File object (e.g. from an <input type="file">).
     * @param {File} file
     */
    loadFromFile: _loadFromFile,

    /**
     * Register a preset object in the user dropdown.
     * @param {object} snap
     */
    register: _registerUserPreset,

    /**
     * Re-fetch GitHub presets (if GITHUB_PRESETS_API is configured).
     */
    fetchGithub: _fetchGithubPresets,
  };

  /* ══════════════════════════════════════════════════════════════
     INIT — wire UI + auto-fetch
  ══════════════════════════════════════════════════════════════ */

  function init() {
    /* ── Save button ── */
    const btnSave = document.getElementById('btn-save-preset');
    if (btnSave) {
      btnSave.addEventListener('click', _savePreset);
    }

    /* ── Import JSON (file) ── */
    const btnFile   = document.getElementById('btn-load-preset-file');
    const fileInput = document.getElementById('preset-file-input');

    if (btnFile && fileInput) {
      btnFile.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          _loadFromFile(this.files[0]);
          // Reset so same file can be re-imported
          this.value = '';
        }
      });
    }

    /* ── Load from GitHub URL ── */
    const btnUrl = document.getElementById('btn-load-preset-url');
    const urlInput = document.getElementById('preset-github-url');

    if (btnUrl && urlInput) {
      btnUrl.addEventListener('click', () => _loadFromUrl(urlInput.value));
      urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') _loadFromUrl(urlInput.value);
      });
    }

    /* ── User preset dropdown ── */
    const userSelect = document.getElementById('user-preset-select');
    if (userSelect) {
      userSelect.addEventListener('change', function () {
        const name = this.value;
        if (!name) return;
        const found = _userPresets.find(p => p.name === name);
        if (found) {
          _applySnapshot(found.data);
        }
        // Reset so re-selecting the same preset still triggers apply
        this.value = '';
      });
    }

    /* ── Build initial (empty) user preset dropdown ── */
    _rebuildUserPresetDropdown();

    /* ── Auto-fetch presets from GitHub (non-blocking) ── */
    _fetchGithubPresets();

    /* ── Expose on namespace ── */
    window.NullCorps.presets = presets;
  }

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
