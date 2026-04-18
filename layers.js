/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/layers.js
   Part 2: Layer Rendering Engine
   ─────────────────────────────────────────────────────────────
   Manages all 36 card layers in z-order (Layer 1 = top, 36 = bottom).
   PNG layers: <img> elements with transparency + silent fallback.
   Text layers: absolutely-positioned <span> elements.
   Dynamic layers resolve PNG filenames from NullCorps.state.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Canvas constants (native card dimensions) ─────────────── */
  const CARD_W = 2250;
  const CARD_H = 3150;

  /* ── Zoom / pan state (Feature 3) ───────────────────────────── */
  // scale: multiplier on top of the fit-to-viewport scale (1 = fit, range 0.5–4)
  // ox/oy: pan offset in screen pixels
  let _zoom = { scale: 1, ox: 0, oy: 0 };

  function _resetZoom() {
    _zoom.scale = 1;
    _zoom.ox    = 0;
    _zoom.oy    = 0;
    _scaleStage();
  }

  /* ── GitHub base URL for assets ────────────────────────────── */
  // Set this to your raw GitHub assets path, e.g.:
  // 'https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/assets/'
  // Falls back to relative 'assets/' for local use.
  const GITHUB_ASSETS_BASE =
    window.NullCorps.config?.assetsBase ?? 'assets/';

  /* ══════════════════════════════════════════════════════════════
     ENERGY TYPE CLASSIFICATION
     Absorb energies lack something — Release energies produce something.
     Each Absorb slug maps to its Release counterpart for shared diamond PNGs.
     12 shared energy PNGs cover all 24 types (absorb reuses release PNG).
  ══════════════════════════════════════════════════════════════ */

  /** Set of energy slugs that are Absorb type. */
  const ABSORB_SLUGS = new Set([
    'quiescent',               // E1  — Lack of Magnetic
    'calmness',                // E3  — Lack of Wind
    'darkness',                // E5  — Lack of Radiant/EM
    'vacuum',                  // E8  — Lack of Sound
    'disconnect',              // E11 — Lack of Electrical
    'durability',              // E12 — Lack of Elastic Potential
    'stillness',               // E13 — Lack of Tidal
    'frigid',                  // E17 — Lack of Thermal
    'dormant',                 // E18 — Lack of Nuclear
    'inactive',                // E19 — Lack of Chemical
    'stability',               // E21 — Lack of Gravitational
    'static',                  // E24 — Lack of Mechanical/Kinetic
  ]);

  /**
   * Map each Absorb slug to the Release slug whose PNG it shares.
   * e.g. 'calmness' → 'wind' (both use wind_energy_diamond_colour.png)
   */
  const ABSORB_TO_RELEASE_SLUG = {
    'quiescent':  'magnetic',
    'calmness':   'wind',
    'darkness':   'radiantelectromagnetic',
    'vacuum':     'sound',
    'disconnect': 'electrical',
    'durability': 'elasticpotential',
    'stillness':  'tidal',
    'frigid':     'thermal',
    'dormant':    'nuclear',
    'inactive':   'chemical',
    'stability':  'gravitational',
    'static':     'mechanicalpotentialkinetic',
  };

  /** Return true if the energy slug is an Absorb type. */
  function _isAbsorb(slug) {
    return slug ? ABSORB_SLUGS.has(slug) : false;
  }

  /**
   * Return the PNG slug for energy diamond colour files.
   * Absorb types share their Release counterpart's PNG (12 files cover all 24).
   */
  function _diamondSlug(slug) {
    if (!slug) return null;
    return ABSORB_TO_RELEASE_SLUG[slug] ?? slug;
  }

  /**
   * Return true when the current card mode should use gray variants for
   * energy diamonds, right glass panel, and textbox panel.
   * Gray modes: 'dreamscape', 'event', 'no-territory'.
   */
  function _isGrayMode(s) {
    const mode = s.cardMode || 'territory';
    return mode === 'dreamscape' || mode === 'event' || mode === 'no-territory' || mode === 'dozer';
  }

  /* ══════════════════════════════════════════════════════════════
     LAYER DEFINITIONS
     Each entry describes one layer.
     type: 'png' | 'text'
     For PNG:  filename(state) → string  (return '' to hide layer)
     For text: value(state) → string, plus layout/style props
  ══════════════════════════════════════════════════════════════ */
  const LAYER_DEFS = [
    /* ── Layer 1: Half Gray Inner Frame ── */
    /* Visible only when Secondary Energy is an Absorb type. Hidden for Release or None. */
    {
      id: 1, name: 'Half Gray Inner Frame', type: 'png',
      filename: (s) => _isAbsorb(s.energySecondary) ? 'half_gray_inner_frame.png' : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 2: Outer Card Outline & Inner Frame (Dynamic — Secondary Energy) ── */
    {
      id: 2, name: 'Outer Card Outline & Inner Frame', type: 'png',
      filename: (s) => s.energySecondary
        ? `${_diamondSlug(s.energySecondary)}_outercard_outline_innerframe.png`
        : 'gray_outercard_outline_innerframe.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 3: Half Gray Outer Frame ── */
    /* Visible only when Third Energy is an Absorb type. Hidden for Release or None. */
    {
      id: 3, name: 'Half Gray Outer Frame', type: 'png',
      filename: (s) => _isAbsorb(s.energyThird) ? 'half_gray_outer_frame.png' : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 4: Outer Frame (Dynamic — Third Energy) ── */
    {
      id: 4, name: 'Outer Frame', type: 'png',
      filename: (s) => s.energyThird
        ? `${_diamondSlug(s.energyThird)}_outerframe.png`
        : 'white_outerframe.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 5: Stats Icon & Text (Static PNG) ── */
    /* Dozer mode → stats_icon_text_dozer.png; all other modes → stats_icon_text.png */
    {
      id: 5, name: 'Stats Icon & Text', type: 'png',
      filename: (s) => (s.cardMode === 'dozer') ? 'stats_icon_text_dozer.png' : 'stats_icon_text.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layers 6 & 7: Crossword Tiles — managed by js/crossword.js ── */
    /* Placeholder divs are injected here; crossword.js renders into them */
    {
      id: 6, name: 'Crossword Tiles (Horizontal)', type: 'crossword-h',
    },
    {
      id: 7, name: 'Crossword Tiles (Vertical)', type: 'crossword-v',
    },

    /* ── Layer 8: Creator Credit (Text) ── */
    {
      id: 8, name: 'iridesuwa (creator credit)', type: 'text',
      value: (s) => s.creatorCredit || 'iridesuwa',
      x: 1125.4, y: 23.0,
      font: 'TGL Engschrift', size: 13,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'center', baseline: 'top',
      confined: false,
    },

    /* ── Layer 9: Null Corps (Game Name) (Text) ── */
    {
      id: 9, name: 'Null Corps (game name)', type: 'text',
      value: (s) => s.gameName || 'Null Corps',
      x: 127, y: 3072.5,
      font: 'TGL Engschrift', size: 12,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'left', baseline: 'top',
      confined: false,
    },

    /* ── Layer 10: Unique Card Number (Text) ── */
    {
      id: 10, name: 'Unique Card Number', type: 'text',
      value: (s) => s.uniqueNumber || '',
      x: 2121, y: 3072.5,
      font: 'TGL Engschrift', size: 12,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'right', baseline: 'top',
      confined: false,
    },

    /* ── Layer 11: ATK Stat (Text) ── */
    {
      id: 11, name: 'ATK Stat', type: 'text',
      value: (s) => String(s.atk ?? ''),
      x: 225.5, y: 29.0,
      font: 'TGL Engschrift', size: 69,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'left', baseline: 'top',
      confined: false,
    },

    /* ── Layer 12: DEF Stat (Text) ── */
    {
      id: 12, name: 'DEF Stat', type: 'text',
      value: (s) => String(s.def ?? ''),
      x: 2027.7, y: 29.0,
      font: 'TGL Engschrift', size: 69,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'right', baseline: 'top',
      confined: false,
    },

    /* ── Layer 13: HP Stat (Text) ── */
    {
      id: 13, name: 'HP Stat', type: 'text',
      value: (s) => String(s.hp ?? ''),
      x: 791.3, y: 2884.0,
      font: 'TGL Engschrift', size: 42,
      color: '#000000', outlineColor: '#ffffff', outlineWidth: 4,
      align: 'left', baseline: 'top',
      confined: false,
    },

    /* ── Layer 14: SHD Stat (Text) ── */
    {
      id: 14, name: 'SHD Stat', type: 'text',
      value: (s) => String(s.shd ?? ''),
      x: 1476.5, y: 2884.0,
      font: 'TGL Engschrift', size: 42,
      color: '#000000', outlineColor: '#ffffff', outlineWidth: 4,
      align: 'right', baseline: 'top',
      confined: false,
    },

    /* ── Layer 15: Energy Stat (Text) ── */
    {
      id: 15, name: 'Energy Stat', type: 'text',
      value: (s) => String(s.energy ?? ''),
      x: 1125.4, y: 96.0,
      font: 'TGL Engschrift', size: 67,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'center', baseline: 'top',
      confined: false,
    },

    /* ── Layer 16: Main Energy Diamond (Static PNG) ── */
    {
      id: 16, name: 'Main Energy Diamond', type: 'png',
      filename: () => 'main_energy_diamond.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 17: Main Energy Diamond Half Gray ── */
    /* Visible only when Main Energy is an Absorb type. Hidden for Release or None. */
    {
      id: 17, name: 'Main Energy Diamond Half Gray', type: 'png',
      filename: (s) => _isAbsorb(s.energyMain) ? 'main_energy_diamond_halfgray.png' : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 18: Main Energy Diamond Colour (Dynamic — Main Energy) ── */
    /* Uses 12 shared PNGs: Absorb types reuse their Release counterpart's file.   */
    /* In Dreamscape/Event/No-Territory modes: uses a single shared gray PNG       */
    /* (main_energy_diamond_gray.png) — slug is irrelevant in gray mode.           */
    {
      id: 18, name: 'Main Energy Diamond Colour', type: 'png',
      filename: (s) => {
        if (_isGrayMode(s)) {
          return s.energyMain ? 'main_energy_diamond_gray.png' : '';
        }
        const ds = _diamondSlug(s.energyMain);
        return ds ? `main_${ds}_energy_diamond_colour.png` : '';
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 19: Secondary Energy Diamond (Static PNG) ── */
    {
      id: 19, name: 'Secondary Energy Diamond', type: 'png',
      filename: () => 'secondary_energy_diamond.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 20: Secondary Energy Diamond Half Gray ── */
    /* Visible only when Secondary Energy is an Absorb type. Hidden for Release or None. */
    {
      id: 20, name: 'Secondary Energy Diamond Half Gray', type: 'png',
      filename: (s) => _isAbsorb(s.energySecondary) ? 'secondary_energy_diamond_halfgray.png' : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 21: Secondary Energy Diamond Colour (Dynamic) ── */
    /* Uses 12 shared PNGs: Absorb types reuse their Release counterpart's file. */
    /* In Dreamscape/Event/No-Territory modes: uses a single shared gray PNG     */
    /* (secondary_energy_diamond_gray.png) — slug is irrelevant in gray mode.    */
    {
      id: 21, name: 'Secondary Energy Diamond Colour', type: 'png',
      filename: (s) => {
        if (_isGrayMode(s)) {
          return s.energySecondary ? 'secondary_energy_diamond_gray.png' : '';
        }
        const ds = _diamondSlug(s.energySecondary);
        return ds ? `secondary_${ds}_energy_diamond_colour.png` : '';
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 22: Third Energy Diamond (Static PNG) ── */
    {
      id: 22, name: 'Third Energy Diamond', type: 'png',
      filename: () => 'third_energy_diamond.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 23: Third Energy Diamond Half Gray ── */
    /* Visible only when Third Energy is an Absorb type. Hidden for Release or None. */
    {
      id: 23, name: 'Third Energy Diamond Half Gray', type: 'png',
      filename: (s) => _isAbsorb(s.energyThird) ? 'third_energy_diamond_halfgray.png' : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 24: Third Energy Diamond Colour (Dynamic) ── */
    /* Uses 12 shared PNGs: Absorb types reuse their Release counterpart's file. */
    /* In Dreamscape/Event/No-Territory modes: uses a single shared gray PNG     */
    /* (third_energy_diamond_gray.png) — slug is irrelevant in gray mode.        */
    {
      id: 24, name: 'Third Energy Diamond Colour', type: 'png',
      filename: (s) => {
        if (_isGrayMode(s)) {
          return s.energyThird ? 'third_energy_diamond_gray.png' : '';
        }
        const ds = _diamondSlug(s.energyThird);
        return ds ? `third_${ds}_energy_diamond_colour.png` : '';
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 25: Zone Indicator (Text) ── */
    {
      id: 25, name: 'Zone Indicator', type: 'text',
      value: (s) => s.zone || '',
      x: 234.7, y: 414.0,
      font: 'TGL Engschrift', size: 72,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'center', baseline: 'top',
      confined: false,
    },

    /* ── Layer 26: Hierarchy Text (Text) ── */
    {
      id: 26, name: 'Hierarchy Text', type: 'text',
      value: (s) => s.era || '',
      x: 162.3, y: 2378.0,
      font: 'TGL Engschrift', size: 31,
      color: '#000000', outlineColor: '#ffffff', outlineWidth: 4,
      align: 'left', baseline: 'top',
      confined: false,
    },

    /* ── Layer 27: Card Title Text (Text, confined) ── */
    {
      id: 27, name: 'Card Title Text', type: 'text',
      value: (s) => s.cardTitle || '',
      x: 475.0, y: 2375.0,
      font: 'TGL Engschrift', size: 31,
      color: '#ffffff', outlineColor: '#000000', outlineWidth: 4,
      align: 'center', baseline: 'middle',
      confined: true,
      confinedW: 1300.0,
      confinedH: 120.0,
      richText: true,
      showBounds: true,
    },

    /* ── Layer 28: Card Type Text (Text) ── */
    {
      id: 28, name: 'Card Type Text', type: 'text',
      value: (s) => s.cardType || '',
      x: 2094.0, y: 2378.0,
      font: 'TGL Engschrift', size: 31,
      color: '#000000', outlineColor: '#ffffff', outlineWidth: 4,
      align: 'right', baseline: 'top',
      confined: false,
    },

    /* ── Layer 29: Card Effect Description (Text, confined box, rich text) ── */
    {
      id: 29, name: 'Card Effect Description', type: 'text',
      value: (s) => s.cardEffect || '',
      x: 135.0, y: 2550.0,
      font: 'Archivo ExtraCondensed Light', size: 23,
      color: '#000000', outlineColor: '#ffffff', outlineWidth: 3,
      align: 'center', baseline: 'middle',
      confined: true,
      confinedW: 1980.0,
      confinedH: 290.0,
      richText: true,  // enables \n → <br> and [[bold:text]], [[large:text]], [[font:name:text]]
      showBounds: true,
      richTextEditor: true,  // enables Photoshop-style font selector UI
    },

    /* ── Layer 30: Territory / Mode Symbol (Dynamic PNG) ── */
    /* Territory mode: [territory_slug]_symbol.png                               */
    /* Dreamscape mode: dreamscape_symbol.png                                    */
    /* Event mode: event_[subtype]_symbol.png (e.g. event_daydream_symbol.png)  */
    /*             Falls back to event_symbol.png if no subtype is set.          */
    /* No-Territory / Dozer modes: hidden (no symbol shown here).               */
    {
      id: 30, name: 'Territory Symbol', type: 'png',
      filename: (s) => {
        const mode = s.cardMode || 'territory';
        if (mode === 'dreamscape') return 'dreamscape_symbol.png';
        if (mode === 'event') {
          const sub = s.eventSubtype || '';
          return sub ? `event_${sub}_symbol.png` : 'event_symbol.png';
        }
        if (mode === 'no-territory' || mode === 'dozer') return '';
        // Default: territory
        return s.territory ? `${_territorySlug(s.territory)}_symbol.png` : '';
      },
      x: 172.2, y: 910.7,
    },

    /* ── Layer 31: Energy Symbol (Dynamic — Main Energy) ── */
    /* In Dreamscape/Event modes: shows the mode/subtype symbol here as well.    */
    /* In territory/no-territory modes: shows the main energy symbol as normal.  */
    /* In Dozer mode: hidden (no symbols shown for Dozers).                      */
    {
      id: 31, name: 'Energy Symbol', type: 'png',
      filename: (s) => {
        const mode = s.cardMode || 'territory';
        if (mode === 'dreamscape') return 'dreamscape_symbol.png';
        if (mode === 'event') {
          const sub = s.eventSubtype || '';
          return sub ? `event_${sub}_symbol.png` : 'event_symbol.png';
        }
        if (mode === 'dozer') return '';
        return s.energyMain ? `${s.energyMain}_symbol.png` : '';
      },
      x: 2021.2, y: 532.2,
    },

    /* ── Layer 32: Church Stained Glass Frame (Static PNG) ── */
    /* Dozer mode → church_stained_glass_frame_dozer.png; all others → church_stained_glass_frame.png */
    {
      id: 32, name: 'Church Stained Glass Frame', type: 'png',
      filename: (s) => (s.cardMode === 'dozer') ? 'church_stained_glass_frame_dozer.png' : 'church_stained_glass_frame.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 33: Left Glass Panel (Dynamic — Main Energy) ── */
    /* Absorb main → gray_leftglass.png; Release main → [slug]_leftglass.png; None → gray */
    {
      id: 33, name: 'Left Glass Panel', type: 'png',
      filename: (s) => {
        if (!s.energyMain) return 'gray_leftglass.png';
        return _isAbsorb(s.energyMain)
          ? 'gray_leftglass.png'
          : `${s.energyMain}_leftglass.png`;
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 34: Right Glass Panel (Dynamic — Main Energy) ── */
    /* Always uses the release-counterpart slug so e.g. Calmness → wind_rightglass.png. */
    /* In Dreamscape/Event/No-Territory modes: uses gray_rightglass.png (like left panel). */
    /* Hidden when no main energy is set (and not in a gray mode).                        */
    {
      id: 34, name: 'Right Glass Panel', type: 'png',
      filename: (s) => {
        if (_isGrayMode(s)) return 'gray_rightglass.png';
        const ds = _diamondSlug(s.energyMain);
        return ds ? `${ds}_rightglass.png` : '';
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 35: Text Box Panel & HP+SHD Panels (Dynamic PNG) ── */
    /* Dozer mode → textbox_hpshdpanels_dozer.png                                */
    /* Dreamscape / Event / No-Territory modes → textbox_hpshdpanels_gray.png    */
    /* All other modes → textbox_hpshdpanels.png                                  */
    {
      id: 35, name: 'Text Box Panel & HP+SHD Panels', type: 'png',
      filename: (s) => {
        if (s.cardMode === 'dozer') return 'textbox_hpshdpanels_dozer.png';
        return _isGrayMode(s) ? 'textbox_hpshdpanels_gray.png' : 'textbox_hpshdpanels.png';
      },
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 36: Card Art (User-uploaded image — bottom-most layer) ── */
    {
      id: 36, name: 'Card Art', type: 'card-art',
    },
  ];

  /* ══════════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════════ */

  /** Convert a territory display name to its PNG slug (lowercase, no spaces). */
  function _territorySlug(name) {
    return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }

  /** Build the full URL for an asset filename. */
  function _assetUrl(filename) {
    if (!filename) return '';
    // If absolute URL (e.g. http/https) leave as-is
    if (/^https?:\/\//i.test(filename)) return filename;
    return GITHUB_ASSETS_BASE + filename;
  }

  /**
   * Create a centered CSS outline-text shadow value.
   * Simulates a stroke by spreading a shadow in 8 directions.
   */
  function _outlineShadow(color, width) {
    const w = width;
    const dirs = [
      `${w}px 0 0 ${color}`,
      `-${w}px 0 0 ${color}`,
      `0 ${w}px 0 ${color}`,
      `0 -${w}px 0 ${color}`,
      `${w}px ${w}px 0 ${color}`,
      `-${w}px ${w}px 0 ${color}`,
      `${w}px -${w}px 0 ${color}`,
      `-${w}px -${w}px 0 ${color}`,
    ];
    return dirs.join(', ');
  }

  /* ══════════════════════════════════════════════════════════════
     DOM LAYER CACHE
     One DOM element per layer, created once, updated on render.
  ══════════════════════════════════════════════════════════════ */
  const _layerEls = {}; // keyed by layer id

  /**
   * Build and mount all layer DOM elements into #card-stage.
   * Layer 36 is inserted first (bottom); Layer 1 last (top).
   * We use z-index matching the layer id (inverted: z = 36 - id).
   */
  function _buildDOM() {
    const stage = document.getElementById('card-stage');
    if (!stage) {
      console.error('[layers.js] #card-stage not found.');
      return;
    }

    // Set stage to native card dimensions; CSS scaling is handled by styles.css
    stage.style.width  = CARD_W + 'px';
    stage.style.height = CARD_H + 'px';
    stage.style.position = 'relative';
    stage.style.overflow = 'hidden';

    // Insert layers bottom-up so DOM order matches visual stacking
    for (let i = LAYER_DEFS.length - 1; i >= 0; i--) {
      const def = LAYER_DEFS[i];
      let el;

      if (def.type === 'png') {
        el = document.createElement('img');
        el.alt = '';
        el.draggable = false;
        // Silent fallback: if PNG 404s, hide the element
        el.onerror = function () { this.style.visibility = 'hidden'; };
        el.onload  = function () { this.style.visibility = 'visible'; };
        _applyPngStyles(el, def);

      } else if (def.type === 'text') {
        el = document.createElement('span');
        _applyTextStyles(el, def);

      } else if (def.type === 'crossword-h' || def.type === 'crossword-v') {
        // Placeholder div — crossword.js will manage its contents
        el = document.createElement('div');
        el.dataset.crosswordLayer = def.type === 'crossword-h' ? 'h' : 'v';
        el.style.cssText = [
          'position: absolute',
          'left: 0', 'top: 0',
          'width: 100%', 'height: 100%',
          'pointer-events: none',
          `z-index: ${36 - def.id}`,
        ].join(';');

      } else if (def.type === 'card-art') {
        // Bottom-most layer: user-uploaded card art image
        el = document.createElement('img');
        el.alt = '';
        el.draggable = false;
        el.style.cssText = [
          'position: absolute',
          'left: 0',
          'top: 0',
          'width: '  + CARD_W + 'px',
          'height: ' + CARD_H + 'px',
          'object-fit: cover',
          'pointer-events: none',
          'user-select: none',
          'visibility: hidden',
          `z-index: ${36 - def.id}`,
        ].join(';');

      } else {
        el = document.createElement('div');
      }

      el.id = `layer-${def.id}`;
      el.dataset.layerId = def.id;
      el.dataset.layerName = def.name;
      stage.appendChild(el);
      _layerEls[def.id] = el;
    }
  }

  /** Apply base CSS for a centred PNG layer. */
  function _applyPngStyles(el, def) {
    el.style.cssText = [
      'position: absolute',
      'display: block',
      // PNG layers are all 2250×3150 full-canvas images positioned at centre
      'left: 50%',
      'top: 50%',
      'width: ' + CARD_W + 'px',
      'height: ' + CARD_H + 'px',
      'transform: translate(-50%, -50%)',
      'object-fit: cover',
      'pointer-events: none',
      'user-select: none',
      `z-index: ${36 - def.id}`,
    ].join(';');
    // For non-centred PNG layers (Territory Symbol, Energy Symbol)
    // we override to absolute x/y after
    if (def.x !== CARD_W / 2 || def.y !== CARD_H / 2) {
      el.style.left      = def.x + 'px';
      el.style.top       = def.y + 'px';
      el.style.transform = '';
      el.style.width     = 'auto';
      el.style.height    = 'auto';
    }
  }

  /** Apply base CSS for a text layer. */
  function _applyTextStyles(el, def) {
    const ptToPx = 3;   // 1pt ≈ 3px at 2250px card width (96dpi × 2250/750)
    const px = def.size * ptToPx;

    // Archivo fonts: use -webkit-text-stroke + paint-order:stroke fill for a clean
    // vector-like outline (matches Affinity Designer stroke-outside behaviour).
    // paint-order paints the stroke first so fill covers the inward half — net result
    // is outlineWidth px of clean stroke visible only *outside* each glyph.
    // TGL / other fonts: keep the 8-direction text-shadow which suits their heavier weight.
    const _isArchivo = def.font && def.font.includes('Archivo');

    let cssLines = [
      'position: absolute',
      `left: ${def.x}px`,
      `top: ${def.y}px`,
      `font-size: ${px}px`,
      `color: ${def.color}`,
      'white-space: nowrap',
      'pointer-events: none',
      'user-select: none',
      `z-index: ${36 - def.id}`,
    ];

    if (_isArchivo) {
      // stroke width × 2 because -webkit-text-stroke is centered on the glyph edge;
      // paint-order:stroke fill makes fill cover the inward half, leaving exactly
      // outlineWidth px of clean stroke visible outside the character.
      cssLines.push(`-webkit-text-stroke: ${def.outlineWidth * 2}px ${def.outlineColor}`);
      cssLines.push('paint-order: stroke fill');
    } else {
      cssLines.push(`text-shadow: ${_outlineShadow(def.outlineColor, def.outlineWidth)}`);
    }

    // Font family selection
    if (def.font && def.font.includes('Archivo')) {
      cssLines.push("font-family: 'Archivo', Arial, sans-serif");
      if (def.font.includes('ExtraCondensed') || def.font.includes('Light')) {
        cssLines.push('font-weight: 300');
        cssLines.push('font-stretch: extra-condensed');
      }
    } else {
      cssLines.push("font-family: 'TGL Engschrift', 'Archivo', Arial, sans-serif");
    }

    // Horizontal alignment
    if (!def.confined) {
      if (def.align === 'center') {
        cssLines.push('transform: translateX(-50%)');
        cssLines.push('text-align: center');
      } else if (def.align === 'right') {
        cssLines.push('transform: translateX(-100%)');
        cssLines.push('text-align: right');
      } else {
        // left (default)
        cssLines.push('text-align: left');
      }
    }

    // Confined box (e.g. Card Effect Description)
    if (def.confined && def.confinedW) {
      cssLines.push(`width: ${def.confinedW}px`);
      cssLines.push('white-space: normal');
      cssLines.push('word-break: break-word');
      cssLines.push('overflow: hidden');
      if (def.confinedH) {
        cssLines.push(`height: ${def.confinedH}px`);
      }
      // Vertical centering via flexbox
      cssLines.push('display: flex');
      cssLines.push('flex-direction: column');
      cssLines.push('justify-content: center');
      if (def.align === 'center') {
        cssLines.push('text-align: center');
        cssLines.push('align-items: stretch');
        // x is the left edge of the box — no translateX needed
      } else if (def.align === 'left') {
        cssLines.push('align-items: stretch');
      } else if (def.align === 'right') {
        cssLines.push('align-items: stretch');
      }
    }

    el.style.cssText = cssLines.join(';');

    // Confined layers: inject an inner div so the flex container centres it
    // cleanly without overflow clipping affecting the text nodes directly.
    if (def.confined && def.confinedW) {
      const inner = document.createElement('div');
      inner.className = 'confined-inner';
      inner.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:inherit;';
      el.appendChild(inner);
    }

    // Bounding Box Overlay — draws a draggable cyan dashed outline over
    // confined text layers (Card Title, Card Effect) with a lock toggle.
    if (def.showBounds) {
      _ensureBoundsOverlay(def);
    }
  }

  /* ── Bounding Box Overlays ────────────────────────────────────────── */
  const _boundsOverlays = {};

  function _ensureBoundsOverlay(def) {
    if (_boundsOverlays[def.id]) return;
    const stage = document.getElementById('card-stage');
    if (!stage) { setTimeout(() => _ensureBoundsOverlay(def), 200); return; }

    const bw = def.confinedW || 400;
    const bh = def.confinedH || 60;
    let locked = false, visible = true;

    const wrapper = document.createElement('div');
    wrapper.id = 'bounds-overlay-' + def.id;
    wrapper.style.cssText = [
      'position:absolute', 'left:' + def.x + 'px', 'top:' + def.y + 'px',
      'width:' + bw + 'px', 'height:' + bh + 'px',
      'border:3px dashed rgba(0,200,255,0.85)', 'box-sizing:border-box',
      'pointer-events:all', 'cursor:move', 'z-index:' + (36 - def.id + 200),
    ].join(';');

    const label = document.createElement('div');
    label.textContent = def.name;
    label.style.cssText = 'position:absolute;top:-22px;left:0;font-size:18px;font-family:Arial,sans-serif;color:rgba(0,200,255,0.95);background:rgba(0,0,0,0.6);padding:1px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;';
    wrapper.appendChild(label);

    function _mkBtn(text, right) {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'position:absolute;top:-22px;right:' + right + 'px;font-size:13px;background:rgba(0,0,0,0.6);color:#0cf;border:1px solid #0cf;border-radius:3px;cursor:pointer;padding:1px 6px;line-height:1.5;';
      b.addEventListener('mousedown', e => e.preventDefault());
      wrapper.appendChild(b);
      return b;
    }

    const lockBtn = _mkBtn('🔓 Unlock', 0);
    const eyeBtn  = _mkBtn('👁 Hide', 78);

    function _updateLock() {
      lockBtn.textContent = locked ? '🔒 Locked' : '🔓 Unlock';
      lockBtn.style.color = locked ? '#f90' : '#0cf';
      lockBtn.style.borderColor = locked ? '#f90' : '#0cf';
      wrapper.style.cursor = locked ? 'not-allowed' : 'move';
      wrapper.style.borderStyle = locked ? 'solid' : 'dashed';
    }
    lockBtn.addEventListener('click', e => { e.stopPropagation(); locked = !locked; _updateLock(); });
    eyeBtn.addEventListener('click', e => {
      e.stopPropagation(); visible = !visible;
      wrapper.style.borderColor = visible ? 'rgba(0,200,255,0.85)' : 'transparent';
      label.style.opacity = visible ? '1' : '0';
      lockBtn.style.opacity = visible ? '1' : '0';
      eyeBtn.textContent = visible ? '👁 Hide' : '👁 Show';
    });

    let dragging = false, dsx, dsy, origL, origT;

    function _startDrag(clientX, clientY, e) {
      if (locked) return;
      dragging = true; dsx = clientX; dsy = clientY;
      origL = parseInt(wrapper.style.left); origT = parseInt(wrapper.style.top);
      e.preventDefault();
    }

    function _moveDrag(clientX, clientY) {
      if (!dragging) return;
      const st = document.getElementById('card-stage');
      const sc = st && st.style.transform.match(/scale\(([^)]+)\)/);
      const scale = sc ? parseFloat(sc[1]) : 1;
      wrapper.style.left = Math.round(origL + (clientX - dsx) / scale) + 'px';
      wrapper.style.top  = Math.round(origT + (clientY - dsy) / scale) + 'px';
    }

    wrapper.addEventListener('mousedown', e => {
      if (e.target !== wrapper) return;
      _startDrag(e.clientX, e.clientY, e);
    });
    wrapper.addEventListener('touchstart', e => {
      if (e.target !== wrapper || e.touches.length !== 1) return;
      _startDrag(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      _moveDrag(e.clientX, e.clientY);
    });
    document.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      _moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('mouseup',  () => { dragging = false; });
    document.addEventListener('touchend', () => { dragging = false; });

    stage.appendChild(wrapper);
    _boundsOverlays[def.id] = wrapper;
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
     Called on every state change. Updates only what changed.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Full render pass — update all layers from current NullCorps.state.
   */
  function render() {
    const state = window.NullCorps.state;

    // Ensure layerVisibility object exists on state
    if (!state.layerVisibility) state.layerVisibility = {};

    // Layers that are auto-hidden in Dreamscape and Event modes
    // (Atk=11, Def=12, HP=13, SHD=14, TerritorySymbol=30, StatsIconText=5)
    const HIDE_IN_DREAMSCAPE_EVENT = new Set([5, 11, 12, 13, 14, 30]);

    const mode = state.cardMode || 'territory';
    const isDreamscapeOrEvent = mode === 'dreamscape' || mode === 'event';

    for (const def of LAYER_DEFS) {
      const el = _layerEls[def.id];
      if (!el) continue;

      // Feature 5: respect per-layer visibility (missing key = visible)
      const vis = state.layerVisibility[def.id];
      if (vis === false) {
        el.style.display = 'none';
        continue;
      }

      // Auto-hide stat layers in dreamscape/event modes
      // (layer 30 is handled dynamically via its filename() returning '')
      if (isDreamscapeOrEvent && (def.id === 5 || def.id === 11 || def.id === 12 || def.id === 13 || def.id === 14)) {
        el.style.display = 'none';
        continue;
      }

      if (def.type === 'png') {
        _renderPng(el, def, state);
      } else if (def.type === 'text') {
        _renderText(el, def, state);
      } else if (def.type === 'card-art') {
        _renderCardArt(el, state);
      } else if (def.type === 'crossword-h' || def.type === 'crossword-v') {
        el.style.display = '';
      }
      // crossword layers are managed by crossword.js for content — skip content render
    }
  }

  function _renderCardArt(el, state) {
    const dataUrl = state.cardArtDataUrl || '';
    if (!dataUrl) {
      el.style.visibility = 'hidden';
      el.removeAttribute('src');
      return;
    }
    if (el.getAttribute('src') !== dataUrl) {
      el.src = dataUrl;
      el.style.visibility = 'visible';
    }
  }

  function _renderPng(el, def, state) {
    const filename = def.filename(state);
    if (!filename) {
      // Dynamic layer with no applicable PNG → hide silently
      el.style.visibility = 'hidden';
      el.removeAttribute('src');
      return;
    }
    const url = _assetUrl(filename);
    if (el.getAttribute('src') !== url) {
      el.style.visibility = 'hidden'; // hide until loaded
      el.src = url;
    }
  }

  function _renderText(el, def, state) {
    const val = def.value(state);
    // Show/hide based on whether there's content
    el.style.display = val ? '' : 'none';
    if (!val) return;

    // Dozer mode: all font colours and outlines are reversed (white↔black).
    // All text layers use either #ffffff or #000000 for color/outlineColor.
    const mode = state.cardMode || 'territory';
    const _isArchivo = def.font && def.font.includes('Archivo');

    if (mode === 'dozer') {
      const fc = def.color       === '#ffffff' ? '#000000' : '#ffffff';
      const oc = def.outlineColor === '#000000' ? '#ffffff' : '#000000';
      el.style.color = fc;
      if (_isArchivo) {
        el.style.webkitTextStroke = `${def.outlineWidth * 2}px ${oc}`;
        el.style.textShadow = 'none';
      } else {
        el.style.textShadow = _outlineShadow(oc, def.outlineWidth);
      }
    } else {
      // Restore default colors (needed when switching away from dozer mode)
      el.style.color = def.color;
      if (_isArchivo) {
        el.style.webkitTextStroke = `${def.outlineWidth * 2}px ${def.outlineColor}`;
        el.style.textShadow = 'none';
      } else {
        el.style.textShadow = _outlineShadow(def.outlineColor, def.outlineWidth);
      }
    }

    // For confined layers, write into the inner div so flex centering is preserved
    const target = el.querySelector('.confined-inner') || el;

    if (def.richText) {
      // Parse rich-text markup:
      //   \n                    → <br>
      //   [[bold:text]]         → <strong>text</strong>
      //   [[large:text]]        → <span style="font-size:1.3em">text</span>
      //   [[font:FontName:text]] → <span style="font-family:FontName">text</span>
      const html = _parseRichText(val);
      if (target.innerHTML !== html) {
        target.innerHTML = html;
      }
    } else {
      if (target.textContent !== val) {
        target.textContent = val;
      }
    }
  }

  /**
   * Convert rich-text markup string to safe HTML.
   * Supports: \n, [[bold:…]], [[large:…]], [[font:Name:…]]
   */
  function _parseRichText(raw) {
    // Escape HTML entities first
    let out = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // [[font:FontName:text]]
    // Maps known font names to their full CSS so @font-face weight/stretch
    // descriptors are honoured correctly by the browser.
    const _FONT_CSS = {
      'tgl engschrift':              "font-family:'TGL Engschrift','Archivo',Arial,sans-serif;font-weight:normal;font-stretch:normal",
      'archivo':                     "font-family:'Archivo',Arial,sans-serif;font-weight:400;font-stretch:normal",
      'archivo extracondensed':      "font-family:'Archivo',Arial,sans-serif;font-weight:400;font-stretch:extra-condensed",
      'archivo extracondensed light':"font-family:'Archivo',Arial,sans-serif;font-weight:300;font-stretch:extra-condensed",
    };
    out = out.replace(/\[\[font:([^\]:]+):([^\]]*)\]\]/g, (_, fname, text) => {
      const key = fname.trim().toLowerCase();
      const css = _FONT_CSS[key]
        || ("font-family:'" + fname.replace(/['"\\]/g, '') + "',Arial,sans-serif");
      return '<span style="' + css + '">' + text + '</span>';
    });

    // [[size:N:text]]  (N = font size in pt, converted at 3px/pt)
    out = out.replace(/\[\[size:(\d+(?:\.\d+)?):([^\]]*)\]\]/g, (_, pts, text) => {
      const px = Math.round(parseFloat(pts) * 3);
      return `<span style="font-size:${px}px">${text}</span>`;
    });

    // [[bold:text]]
    out = out.replace(/\[\[bold:([^\]]*)\]\]/g, (_, text) => `<strong>${text}</strong>`);

    // [[large:text]]
    out = out.replace(/\[\[large:([^\]]*)\]\]/g, (_, text) =>
      `<span style="font-size:1.3em">${text}</span>`);

    // \n → <br>
    out = out.replace(/\\n/g, '<br>');
    out = out.replace(/\n/g, '<br>');

    return out;
  }

  /* ══════════════════════════════════════════════════════════════
     GITHUB URL LOADER
     Called by js/presets.js when the user pastes a GitHub URL.
     Also exposed so other modules can hot-swap the assets base.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Set a new assets base URL at runtime (e.g. after user provides a
   * GitHub raw URL). Triggers a full re-render.
   *
   * @param {string} url  Full raw GitHub base URL, ending with '/assets/'
   *                      e.g. 'https://raw.githubusercontent.com/user/repo/main/assets/'
   */
  function setAssetsBase(url) {
    // Normalise trailing slash
    const base = url.endsWith('/') ? url : url + '/';
    window.NullCorps._assetsBase = base;
    // Patch the module-level variable for subsequent renders
    Object.defineProperty(window.NullCorps.config ?? (window.NullCorps.config = {}),
      'assetsBase', { value: base, writable: true, configurable: true });
    // Force re-render by clearing cached src attributes
    for (const def of LAYER_DEFS) {
      if (def.type === 'png') {
        const el = _layerEls[def.id];
        if (el) el.removeAttribute('src');
      }
    }
    render();
  }

  /**
   * Parse a GitHub blob/raw URL pasted by the user and derive the
   * raw assets base URL. Returns null if the URL cannot be parsed.
   *
   * Supported inputs:
   *   https://github.com/user/repo/tree/main/assets/
   *   https://raw.githubusercontent.com/user/repo/main/assets/
   *   https://github.com/user/repo  (uses /assets/ by default)
   *
   * @param {string} input  Raw user input from the GitHub URL field.
   * @returns {string|null}
   */
  function parseGithubAssetsUrl(input) {
    if (!input) return null;
    input = input.trim();

    // Already a raw URL pointing into assets/
    if (/^https:\/\/raw\.githubusercontent\.com\/.+\/assets\/?$/i.test(input)) {
      return input.endsWith('/') ? input : input + '/';
    }

    // raw.githubusercontent.com — strip to repo root, append /assets/
    const rawMatch = input.match(
      /^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+\/[^/]+)/
    );
    if (rawMatch) {
      return `https://raw.githubusercontent.com/${rawMatch[1]}/assets/`;
    }

    // github.com blob or tree URL
    const ghMatch = input.match(
      /^https:\/\/github\.com\/([^/]+\/[^/]+)(?:\/(?:tree|blob)\/([^/]+))?/
    );
    if (ghMatch) {
      const repoPath = ghMatch[1];
      const branch   = ghMatch[2] || 'main';
      return `https://raw.githubusercontent.com/${repoPath}/${branch}/assets/`;
    }

    return null;
  }

  /* ══════════════════════════════════════════════════════════════
     CARD STAGE SCALING
     Reads #card-viewport dimensions and applies a CSS scale()
     transform to #card-stage so the 2250×3150 canvas fits the
     available panel space at any window size.
  ══════════════════════════════════════════════════════════════ */

  function _scaleStage() {
    const viewport = document.getElementById('card-viewport');
    const stage    = document.getElementById('card-stage');
    if (!viewport || !stage) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (!vw || !vh) return;

    // Fit the card within the viewport, preserving its 2250×3150 ratio
    const scaleX   = vw / CARD_W;
    const scaleY   = vh / CARD_H;
    const fitScale = Math.min(scaleX, scaleY);

    // Apply the user zoom multiplier on top of the fit scale
    const totalScale = fitScale * _zoom.scale;

    stage.style.transform       = `scale(${totalScale})`;
    stage.style.transformOrigin = 'top left';
    stage.style.position        = 'absolute';

    // Centre the stage, then offset by the pan translation
    stage.style.left = Math.round((vw - CARD_W * totalScale) / 2 + _zoom.ox) + 'px';
    stage.style.top  = Math.round((vh - CARD_H * totalScale) / 2 + _zoom.oy) + 'px';
  }

  /* ══════════════════════════════════════════════════════════════
     ZOOM & PAN  (Feature 3)
     Wires scroll-wheel zoom, pinch-to-zoom, double-click/tap reset,
     and pointer-drag pan — all constrained to #card-viewport.
  ══════════════════════════════════════════════════════════════ */

  function _wireZoom() {
    const viewport = document.getElementById('card-viewport');
    if (!viewport) return;

    /* ── Scroll-wheel zoom ─────────────────────────────────────── */
    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const factor  = e.deltaY < 0 ? 1.1 : 0.9;
      _zoom.scale   = Math.max(0.5, Math.min(4, _zoom.scale * factor));
      _scaleStage();
    }, { passive: false });

    /* ── Double-click / double-tap to reset zoom ───────────────── */
    viewport.addEventListener('dblclick', _resetZoom);

    let _lastTapTime = 0;

    /* ── Pointer drag to pan (active only when zoomed in) ─────── */
    let _panning = false, _panStartX = 0, _panStartY = 0, _panBaseOx = 0, _panBaseOy = 0;

    viewport.addEventListener('pointerdown', e => {
      // Only pan when zoomed beyond fit level
      if (_zoom.scale <= 1) return;
      // Don't intercept clicks on bounds-overlay controls or buttons
      if (e.target.closest('button') || e.target.closest('[id^="bounds-overlay"]')) return;
      _panning    = true;
      _panStartX  = e.clientX;
      _panStartY  = e.clientY;
      _panBaseOx  = _zoom.ox;
      _panBaseOy  = _zoom.oy;
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    }, { passive: false });

    viewport.addEventListener('pointermove', e => {
      if (!_panning) return;
      _zoom.ox = _panBaseOx + (e.clientX - _panStartX);
      _zoom.oy = _panBaseOy + (e.clientY - _panStartY);
      _scaleStage();
    });

    viewport.addEventListener('pointerup',    () => { _panning = false; });
    viewport.addEventListener('pointercancel', () => { _panning = false; });

    /* ── Pinch-to-zoom (two-finger touch) ─────────────────────── */
    let _pinchDist = null;

    function _getTouchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    viewport.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        _pinchDist = _getTouchDist(e.touches);
        e.preventDefault(); // prevent browser pinch-zoom on the page
      }
    }, { passive: false });

    viewport.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && _pinchDist !== null) {
        const newDist = _getTouchDist(e.touches);
        const factor  = newDist / _pinchDist;
        _zoom.scale   = Math.max(0.5, Math.min(4, _zoom.scale * factor));
        _pinchDist    = newDist;
        _scaleStage();
        e.preventDefault();
      }
    }, { passive: false });

    viewport.addEventListener('touchend', e => {
      if (e.touches.length < 2) _pinchDist = null;
      // Double-tap to reset zoom (two taps within 300 ms, no remaining fingers)
      if (e.touches.length === 0) {
        const now = Date.now();
        if (now - _lastTapTime < 300) _resetZoom();
        _lastTapTime = now;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

  /* ── Simple debounce utility ────────────────────────────────── */
  function _debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function init() {
    _buildDOM();
    _scaleStage();
    render();

    // Re-scale on window resize via ResizeObserver (falls back to window resize)
    const viewport = document.getElementById('card-viewport');
    if (viewport && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(_scaleStage);
      ro.observe(viewport);
    } else {
      window.addEventListener('resize', _debounce(_scaleStage, 100));
    }

    // Wire zoom / pan interactions (Feature 3)
    _wireZoom();

    // Wire the GitHub URL "Load" button
    const urlInput = document.getElementById('preset-github-url');
    const loadBtn  = document.getElementById('btn-load-preset-url');
    if (urlInput && loadBtn) {
      loadBtn.addEventListener('click', function () {
        const raw = parseGithubAssetsUrl(urlInput.value);
        if (raw) {
          setAssetsBase(raw);
          // Visual feedback
          urlInput.style.borderColor = 'var(--c-accent)';
          setTimeout(() => urlInput.style.borderColor = '', 1500);
        } else {
          urlInput.style.borderColor = '#ff4444';
          setTimeout(() => urlInput.style.borderColor = '', 2000);
          console.warn('[layers.js] Could not parse GitHub URL:', urlInput.value);
        }
      });
    }

    // Wire Export PNG button (Feature 4)
    const exportBtn = document.getElementById('btn-export-png');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportPNG);
    }

    // Build and wire the Layer Visibility popup (Feature 5)
    _buildLayerMenu();
  }

  /* ══════════════════════════════════════════════════════════════
     LAYER VISIBILITY MENU  (Feature 5)
     Fullscreen modal listing all layers with eye-icon toggles.
     Mounted to document.body so it's never clipped by card-panel.
     Closes via its own ✕ Close button or the Escape key.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Toggle visibility of a single layer by id.
   * Updates NullCorps.state.layerVisibility and re-renders.
   */
  function setLayerVisibility(id, visible) {
    const state = window.NullCorps.state;
    if (!state.layerVisibility) state.layerVisibility = {};
    state.layerVisibility[id] = visible;
    render();
  }

  /**
   * Build the fullscreen layer modal and wire the Layers button.
   */
  function _buildLayerMenu() {
    const state = window.NullCorps.state;
    if (!state.layerVisibility) state.layerVisibility = {};

    const layersBtn = document.getElementById('btn-layers-menu');
    if (!layersBtn) return;

    // ── Build fullscreen modal ────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'layer-menu-modal';
    modal.className = 'layer-menu-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Layer Visibility');
    modal.setAttribute('aria-modal', 'true');

    // Header row: title + close button
    const header = document.createElement('div');
    header.className = 'layer-menu-header';

    const titleEl = document.createElement('span');
    titleEl.className = 'layer-menu-title';
    titleEl.textContent = 'Layer Visibility';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'layer-menu-close-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.setAttribute('aria-label', 'Close layer menu');

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Scrollable layer list
    const list = document.createElement('ul');
    list.className = 'layer-menu-list';

    for (const def of LAYER_DEFS) {
      const li = document.createElement('li');
      li.className = 'layer-menu-item';
      li.dataset.layerId = def.id;

      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'layer-eye-btn';
      eyeBtn.setAttribute('aria-label', `Toggle visibility of ${def.name}`);
      eyeBtn.setAttribute('title', `Toggle ${def.name}`);

      const isVisible = state.layerVisibility[def.id] !== false;
      eyeBtn.textContent = isVisible ? '👁' : '🚫';
      eyeBtn.classList.toggle('layer-hidden', !isVisible);

      eyeBtn.addEventListener('click', () => {
        const nowVisible = state.layerVisibility[def.id] !== false;
        const next = !nowVisible;
        setLayerVisibility(def.id, next);
        eyeBtn.textContent = next ? '👁' : '🚫';
        eyeBtn.classList.toggle('layer-hidden', !next);
        li.classList.toggle('layer-item-hidden', !next);
      });

      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = `${def.id}. ${def.name}`;

      li.appendChild(eyeBtn);
      li.appendChild(nameSpan);
      if (!isVisible) li.classList.add('layer-item-hidden');
      list.appendChild(li);
    }

    modal.appendChild(list);

    // Mount to body so it's never clipped by card-panel overflow:hidden
    document.body.appendChild(modal);

    // ── Open / close ─────────────────────────────────────────
    function _openMenu() {
      modal.classList.remove('hidden');
      layersBtn.setAttribute('aria-expanded', 'true');
      // Shift focus to close button for keyboard / screen-reader users
      closeBtn.focus();
    }

    function _closeMenu() {
      modal.classList.add('hidden');
      layersBtn.setAttribute('aria-expanded', 'false');
      layersBtn.focus();
    }

    layersBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      modal.classList.contains('hidden') ? _openMenu() : _closeMenu();
    });

    closeBtn.addEventListener('click', () => _closeMenu());

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        _closeMenu();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     EXPORT PNG  (Feature 4)
     Composites all visible layers at native card resolution onto an
     offscreen <canvas> and triggers a PNG download.
     Hidden layers (display:none / visibility:hidden) are excluded.
     Zoom level is ignored — export always uses native 2250×3150.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Export the card as a PNG file named null-corps-card.png.
   * Uses html2canvas to capture #card-stage at native resolution.
   * Shows a loading state on the export button while rendering.
   */
  function exportPNG() {
    const btn = document.getElementById('btn-export-png');
    if (btn) {
      btn._origText = btn.textContent;
      btn.textContent = 'Exporting…';
      btn.disabled = true;
    }

    // Temporarily reset zoom/pan so html2canvas captures the stage
    // at native resolution (the stage is always 2250×3150 internally;
    // we just need to make sure the scale transform doesn't confuse it).
    const stage = document.getElementById('card-stage');
    if (!stage) {
      if (btn) { btn.textContent = btn._origText; btn.disabled = false; }
      return;
    }

    // Snapshot current transform so we can restore it after capture
    const savedTransform = stage.style.transform;
    const savedLeft      = stage.style.left;
    const savedTop       = stage.style.top;

    // Remove CSS scale — html2canvas works on the element's natural size
    stage.style.transform = 'none';
    stage.style.left      = '0';
    stage.style.top       = '0';

    // Await font loading so canvas text renders with the correct @font-face fonts
    const fontsReady = document.fonts && document.fonts.ready
      ? document.fonts.ready
      : Promise.resolve();

    fontsReady.then(() =>
      import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js')
      .catch(() => {
        // ESM import failed — fall back to script tag injection
        return new Promise((resolve, reject) => {
          if (window.html2canvas) { resolve({ default: window.html2canvas }); return; }
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload  = () => resolve({ default: window.html2canvas });
          s.onerror = reject;
          document.head.appendChild(s);
        });
      })
      .then(mod => {
        const h2c = mod.default || mod;
        return h2c(stage, {
          scale: 1,           // stage is already at native 2250×3150
          useCORS: true,
          allowTaint: false,
          width:  CARD_W,
          height: CARD_H,
          backgroundColor: null,
          // Ignore elements that are hidden — html2canvas respects display:none
          // and visibility:hidden automatically.
          logging: false,
        });
      })
      .then(canvas => {
        const a = document.createElement('a');
        a.href     = canvas.toDataURL('image/png');
        a.download = 'null-corps-card.png';
        a.click();
      })
      .catch(err => {
        console.error('[layers.js] exportPNG failed:', err);
        alert('Export failed. Check the console for details.\n\nIf assets are hosted cross-origin, ensure CORS headers are set.');
      })
      .finally(() => {
        // Restore stage transform
        stage.style.transform = savedTransform;
        stage.style.left      = savedLeft;
        stage.style.top       = savedTop;

        if (btn) {
          btn.textContent = btn._origText || 'Export PNG';
          btn.disabled    = false;
        }
      })
    ); // end fontsReady.then()
  }

  /* ── Expose public API on NullCorps namespace ── */
  window.NullCorps.layers = {
    init,
    render,
    setAssetsBase,
    parseGithubAssetsUrl,
    scaleStage: _scaleStage,
    resetZoom:  _resetZoom,
    LAYER_DEFS,
    CARD_W,
    CARD_H,
    getEl: (id) => _layerEls[id],
    parseRichText: _parseRichText,
    exportPNG,
    setLayerVisibility,   // Feature 5: toggle individual layer visibility
  };

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
