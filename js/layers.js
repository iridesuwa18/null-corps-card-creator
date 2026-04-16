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

  /* ── GitHub base URL for assets ────────────────────────────── */
  // Set this to your raw GitHub assets path, e.g.:
  // 'https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/assets/'
  // Falls back to relative 'assets/' for local use.
  const GITHUB_ASSETS_BASE =
    window.NullCorps.config?.assetsBase ?? 'assets/';

  /* ══════════════════════════════════════════════════════════════
     LAYER DEFINITIONS
     Each entry describes one layer.
     type: 'png' | 'text'
     For PNG:  filename(state) → string  (return '' to hide layer)
     For text: value(state) → string, plus layout/style props
  ══════════════════════════════════════════════════════════════ */
  const LAYER_DEFS = [
    /* ── Layer 1: Half Gray Inner Frame (Static PNG) ── */
    {
      id: 1, name: 'Half Gray Inner Frame', type: 'png',
      filename: () => 'half_gray_inner_frame.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 2: Outer Card Outline & Inner Frame (Dynamic — Secondary Energy) ── */
    {
      id: 2, name: 'Outer Card Outline & Inner Frame', type: 'png',
      filename: (s) => s.energySecondary
        ? `${s.energySecondary}_outercard_outline_innerframe.png`
        : 'gray_outercard_outline_innerframe.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 3: Half Gray Outer Frame (Static PNG) ── */
    {
      id: 3, name: 'Half Gray Outer Frame', type: 'png',
      filename: () => 'half_gray_outer_frame.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 4: Outer Frame (Dynamic — Third Energy) ── */
    {
      id: 4, name: 'Outer Frame', type: 'png',
      filename: (s) => s.energyThird
        ? `${s.energyThird}_outerframe.png`
        : 'white_outerframe.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 5: Stats Icon & Text (Static PNG) ── */
    {
      id: 5, name: 'Stats Icon & Text', type: 'png',
      filename: () => 'stats_icon_text.png',
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

    /* ── Layer 17: Main Energy Diamond Half Gray (Static PNG) ── */
    {
      id: 17, name: 'Main Energy Diamond Half Gray', type: 'png',
      filename: () => 'main_energy_diamond_halfgray.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 18: Main Energy Diamond Colour (Dynamic — Main Energy) ── */
    {
      id: 18, name: 'Main Energy Diamond Colour', type: 'png',
      filename: (s) => s.energyMain
        ? `main_${s.energyMain}_energy_diamond_colour.png`
        : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 19: Secondary Energy Diamond (Static PNG) ── */
    {
      id: 19, name: 'Secondary Energy Diamond', type: 'png',
      filename: () => 'secondary_energy_diamond.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 20: Secondary Energy Diamond Half Gray (Static PNG) ── */
    {
      id: 20, name: 'Secondary Energy Diamond Half Gray', type: 'png',
      filename: () => 'secondary_energy_diamond_halfgray.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 21: Secondary Energy Diamond Colour (Dynamic) ── */
    {
      id: 21, name: 'Secondary Energy Diamond Colour', type: 'png',
      filename: (s) => s.energySecondary
        ? `secondary_${s.energySecondary}_energy_diamond_colour.png`
        : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 22: Third Energy Diamond (Static PNG) ── */
    {
      id: 22, name: 'Third Energy Diamond', type: 'png',
      filename: () => 'third_energy_diamond.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 23: Third Energy Diamond Half Gray (Static PNG) ── */
    {
      id: 23, name: 'Third Energy Diamond Half Gray', type: 'png',
      filename: () => 'third_energy_diamond_halfgray.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 24: Third Energy Diamond Colour (Dynamic) ── */
    {
      id: 24, name: 'Third Energy Diamond Colour', type: 'png',
      filename: (s) => s.energyThird
        ? `third_${s.energyThird}_energy_diamond_colour.png`
        : '',
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

    /* ── Layer 30: Territory Symbol (Dynamic PNG) ── */
    {
      id: 30, name: 'Territory Symbol', type: 'png',
      filename: (s) => s.territory
        ? `${_territorySlug(s.territory)}_symbol.png`
        : '',
      x: 172.2, y: 910.7,
    },

    /* ── Layer 31: Energy Symbol (Dynamic — Main Energy) ── */
    {
      id: 31, name: 'Energy Symbol', type: 'png',
      filename: (s) => s.energyMain
        ? `${s.energyMain}_symbol.png`
        : '',
      x: 2021.2, y: 532.2,
    },

    /* ── Layer 32: Church Stained Glass Frame (Static PNG) ── */
    {
      id: 32, name: 'Church Stained Glass Frame', type: 'png',
      filename: () => 'church_stained_glass_frame.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 33: Left Glass Panel (Dynamic — Main Energy) ── */
    {
      id: 33, name: 'Left Glass Panel', type: 'png',
      filename: (s) => s.energyMain
        ? `${s.energyMain}_leftglass.png`
        : 'gray_leftglass.png',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 34: Right Glass Panel (Dynamic — Main Energy) ── */
    {
      id: 34, name: 'Right Glass Panel', type: 'png',
      filename: (s) => s.energyMain
        ? `${s.energyMain}_rightglass.png`
        : '',
      x: CARD_W / 2, y: CARD_H / 2,
    },

    /* ── Layer 35: Text Box Panel & HP+SHD Panels (Static PNG) ── */
    {
      id: 35, name: 'Text Box Panel & HP+SHD Panels', type: 'png',
      filename: () => 'textbox_hpshdpanels.png',
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

    let cssLines = [
      'position: absolute',
      `left: ${def.x}px`,
      `top: ${def.y}px`,
      `font-size: ${px}px`,
      `color: ${def.color}`,
      `text-shadow: ${_outlineShadow(def.outlineColor, def.outlineWidth)}`,
      'white-space: nowrap',
      'pointer-events: none',
      'user-select: none',
      `z-index: ${36 - def.id}`,
    ];

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
    wrapper.addEventListener('mousedown', e => {
      if (locked || e.target !== wrapper) return;
      dragging = true; dsx = e.clientX; dsy = e.clientY;
      origL = parseInt(wrapper.style.left); origT = parseInt(wrapper.style.top);
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const st = document.getElementById('card-stage');
      const sc = st && st.style.transform.match(/scale\(([^)]+)\)/);
      const scale = sc ? parseFloat(sc[1]) : 1;
      wrapper.style.left = Math.round(origL + (e.clientX - dsx) / scale) + 'px';
      wrapper.style.top  = Math.round(origT + (e.clientY - dsy) / scale) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

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

    for (const def of LAYER_DEFS) {
      const el = _layerEls[def.id];
      if (!el) continue;

      if (def.type === 'png') {
        _renderPng(el, def, state);
      } else if (def.type === 'text') {
        _renderText(el, def, state);
      } else if (def.type === 'card-art') {
        _renderCardArt(el, state);
      }
      // crossword layers are managed by crossword.js — skip
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
    const scaleX = vw / CARD_W;
    const scaleY = vh / CARD_H;
    const scale  = Math.min(scaleX, scaleY);

    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = 'top left';

    // Centre the scaled stage inside the viewport
    const scaledW = CARD_W * scale;
    const scaledH = CARD_H * scale;
    stage.style.position  = 'absolute';
    stage.style.left      = Math.round((vw - scaledW) / 2) + 'px';
    stage.style.top       = Math.round((vh - scaledH) / 2) + 'px';
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

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
      window.addEventListener('resize', _scaleStage);
    }

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
  }

  /* ── Expose public API on NullCorps namespace ── */
  window.NullCorps.layers = {
    init,
    render,
    setAssetsBase,
    parseGithubAssetsUrl,
    scaleStage: _scaleStage,  // exposed so other modules can trigger a re-scale
    LAYER_DEFS,   // exposed for inspection / crossword.js z-index queries
    CARD_W,
    CARD_H,
    getEl: (id) => _layerEls[id],
    parseRichText: _parseRichText,  // exposed for use by editor UI / preview
  };

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
