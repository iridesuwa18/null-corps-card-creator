/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/gamedata_export.js
   Game Data Export Modal
   ─────────────────────────────────────────────────────────────
   Opens a form-style overlay pre-filled from the current card
   editor state. The user fills in the blanks (id, img, charTag,
   effects, etc.) then clicks Export to download a .js snippet
   ready to paste into data.js → CARDS[].

   Add to index.html AFTER the other scripts:
     <script src="js/gamedata_export.js"></script>

   Also add the trigger button inside #section-export in index.html:
     <button class="btn btn-secondary" id="btn-export-gamedata"
       style="width:100%;justify-content:center;margin-top:8px;">
       ⬡ Export to Game Data
     </button>
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Card mode → game type mapping ──────────────────────────── */
  const MODE_TO_TYPE = {
    'territory':   null,       // depends on isMainChar / isSideChar → CH or sub-type
    'char-skill':  null,       // CHS or CHSS depending on sub-skill toggle
    'dreamscape':  'DR',
    'event':       'EV',
    'dozer':       'DZ',
    'dozer-skill': 'DZS',
    'no-territory': null,      // Could be many things — let user pick
  };

  /* Types that need linking fields */
  const NEEDS_CHARTAG  = new Set(['CH','CHS','CHSS','DA','DAS','DASS','DZ','LO','EV']);
  const NEEDS_PARENTTAG= new Set(['DZS','DZSS']);
  const HAS_STATS      = new Set(['CH','DA','DZ']);
  const HAS_TERRITORY  = new Set(['CH','DA','LO']);
  const IS_CHARACTER   = new Set(['CH','DA']);
  const IS_SKILL_CARD  = new Set(['CHS','CHSS','DAS','DASS','DZS','DZSS']);

  /* ── CSS ─────────────────────────────────────────────────────── */
  const MODAL_CSS = `
  #gde-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(5, 6, 14, 0.93);
    display: none; align-items: flex-start; justify-content: center;
    overflow-y: auto; padding: 24px 12px 48px;
    backdrop-filter: blur(4px);
    font-family: 'Courier New', monospace;
  }
  #gde-overlay.open { display: flex; }

  #gde-panel {
    background: #0e0e1a;
    border: 1px solid #2a2a40;
    border-radius: 10px;
    width: 100%; max-width: 560px;
    box-shadow: 0 0 60px rgba(200,255,0,0.06), 0 0 0 1px rgba(200,255,0,0.04);
    overflow: hidden;
    animation: gde-slide-in 0.22s ease;
  }
  @keyframes gde-slide-in {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }

  #gde-header {
    background: #13131f;
    border-bottom: 1px solid #222235;
    padding: 16px 20px 14px;
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px;
  }
  #gde-title {
    font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase;
    color: #c8ff00; font-weight: normal;
  }
  #gde-subtitle {
    font-size: 10px; color: #555568; letter-spacing: 0.06em;
  }
  #gde-close {
    background: transparent; border: 1px solid #2a2a40; color: #555568;
    border-radius: 4px; padding: 4px 10px; cursor: pointer;
    font-size: 13px; font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  #gde-close:hover { border-color: #e03c5a; color: #e03c5a; }

  #gde-body { padding: 0 20px 20px; }

  .gde-section {
    margin-top: 20px;
    border-top: 1px solid #1e1e2e;
    padding-top: 14px;
  }
  .gde-section:first-child { border-top: none; margin-top: 16px; }

  .gde-section-label {
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: #555568; margin-bottom: 10px;
  }

  .gde-row {
    display: flex; gap: 10px; margin-bottom: 8px;
  }
  .gde-row.col-1 { flex-direction: column; }

  .gde-field {
    display: flex; flex-direction: column; gap: 4px; flex: 1;
  }

  .gde-label {
    font-size: 10px; color: #8888a0; letter-spacing: 0.06em;
    display: flex; align-items: center; gap: 6px;
  }
  .gde-label .gde-tag-required {
    font-size: 8px; background: rgba(224,60,90,0.15);
    color: #e03c5a; border: 1px solid rgba(224,60,90,0.25);
    border-radius: 3px; padding: 1px 5px; letter-spacing: 0.06em;
  }
  .gde-label .gde-tag-auto {
    font-size: 8px; background: rgba(200,255,0,0.08);
    color: #c8ff00; border: 1px solid rgba(200,255,0,0.2);
    border-radius: 3px; padding: 1px 5px; letter-spacing: 0.06em;
  }
  .gde-label .gde-tag-optional {
    font-size: 8px; background: rgba(100,100,160,0.15);
    color: #6666a0; border: 1px solid rgba(100,100,160,0.2);
    border-radius: 3px; padding: 1px 5px; letter-spacing: 0.06em;
  }

  .gde-input, .gde-select, .gde-textarea {
    background: #13131f; color: #e0e0f0;
    border: 1px solid #2a2a40; border-radius: 5px;
    padding: 7px 10px; font-size: 12px;
    font-family: 'Courier New', monospace;
    transition: border-color 0.15s;
    width: 100%; box-sizing: border-box;
  }
  .gde-input:focus, .gde-select:focus, .gde-textarea:focus {
    outline: none; border-color: rgba(200,255,0,0.4);
  }
  .gde-input.auto-filled {
    border-color: rgba(200,255,0,0.2);
    background: #111120;
    color: #c8ff00;
  }
  .gde-input.needs-fill {
    border-color: rgba(224,60,90,0.25);
    background: #130a0e;
  }
  .gde-input.needs-fill::placeholder { color: #7a3040; }

  .gde-textarea {
    resize: vertical; min-height: 72px; line-height: 1.5;
  }
  .gde-select option { background: #13131f; }

  .gde-hint {
    font-size: 9px; color: #444460; line-height: 1.6;
    margin-top: 2px;
  }

  .gde-readonly {
    background: #0c0c18; color: #555568;
    border: 1px solid #1a1a28; border-radius: 5px;
    padding: 7px 10px; font-size: 12px;
    font-family: 'Courier New', monospace;
    width: 100%; box-sizing: border-box;
  }

  /* Toggle row */
  .gde-toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 6px 0;
  }
  .gde-toggle-label { font-size: 11px; color: #8888a0; }
  .gde-toggle {
    position: relative; display: inline-block; width: 36px; height: 20px;
    flex-shrink: 0;
  }
  .gde-toggle input { opacity:0; width:0; height:0; }
  .gde-toggle-slider {
    position: absolute; inset: 0; background: #1e1e2e;
    border: 1px solid #2a2a40; border-radius: 20px; cursor: pointer;
    transition: background 0.15s;
  }
  .gde-toggle-slider::before {
    content: ''; position: absolute;
    width: 14px; height: 14px; left: 2px; top: 2px;
    background: #555568; border-radius: 50%;
    transition: transform 0.15s, background 0.15s;
  }
  .gde-toggle input:checked + .gde-toggle-slider { background: rgba(200,255,0,0.15); border-color: rgba(200,255,0,0.3); }
  .gde-toggle input:checked + .gde-toggle-slider::before { transform: translateX(16px); background: #c8ff00; }

  /* Char snippet (for CHARACTERS[]) */
  #gde-char-section {
    margin-top: 20px; border-top: 1px solid #1e1e2e; padding-top: 14px;
    display: none;
  }

  /* Footer */
  #gde-footer {
    padding: 16px 20px;
    background: #0b0b16;
    border-top: 1px solid #1a1a28;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  }
  #gde-btn-export {
    background: rgba(200,255,0,0.12); color: #c8ff00;
    border: 1px solid rgba(200,255,0,0.3);
    border-radius: 5px; padding: 9px 22px;
    font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
    font-family: 'Courier New', monospace; cursor: pointer;
    transition: background 0.15s;
  }
  #gde-btn-export:hover { background: rgba(200,255,0,0.2); }
  #gde-btn-cancel {
    background: transparent; color: #555568;
    border: 1px solid #2a2a40;
    border-radius: 5px; padding: 9px 16px;
    font-size: 11px; font-family: 'Courier New', monospace; cursor: pointer;
    transition: color 0.15s;
  }
  #gde-btn-cancel:hover { color: #8888a0; }
  #gde-export-status {
    font-size: 10px; color: #555568; flex: 1; text-align: right;
    letter-spacing: 0.06em;
  }
  `;

  /* ── Inject CSS ───────────────────────────────────────────────── */
  function _injectCSS() {
    const style = document.createElement('style');
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);
  }

  /* ── Build modal HTML ─────────────────────────────────────────── */
  function _buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'gde-overlay';
    overlay.innerHTML = `
      <div id="gde-panel">
        <div id="gde-header">
          <div>
            <div id="gde-title">⬡ Export to Game Data</div>
            <div id="gde-subtitle">Fill in the blanks · Export as .js snippet</div>
          </div>
          <button id="gde-close">✕</button>
        </div>
        <div id="gde-body">
          <!-- Populated dynamically by _populateForm() -->
        </div>
        <div id="gde-footer">
          <button id="gde-btn-export">↓ Export Snippet</button>
          <button id="gde-btn-cancel">Cancel</button>
          <div id="gde-export-status"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('gde-close').addEventListener('click', closeModal);
    document.getElementById('gde-btn-cancel').addEventListener('click', closeModal);
    document.getElementById('gde-btn-export').addEventListener('click', doExport);

    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }

  /* ── Helper: create a label+input field ──────────────────────── */
  function _field(opts) {
    // opts: { id, label, tag, value, placeholder, hint, type, readonly, isAuto }
    const wrap = document.createElement('div');
    wrap.className = 'gde-field';

    const lbl = document.createElement('div');
    lbl.className = 'gde-label';
    lbl.textContent = opts.label + ' ';
    if (opts.tag) {
      const t = document.createElement('span');
      t.className = `gde-tag-${opts.tag}`;
      t.textContent = opts.tag === 'required' ? 'fill in' : opts.tag === 'auto' ? 'auto-filled' : 'optional';
      lbl.appendChild(t);
    }
    wrap.appendChild(lbl);

    if (opts.readonly) {
      const ro = document.createElement('div');
      ro.className = 'gde-readonly';
      ro.textContent = opts.value || '—';
      ro.id = opts.id;
      wrap.appendChild(ro);
    } else {
      const inp = document.createElement('input');
      inp.type = opts.type || 'text';
      inp.className = 'gde-input' + (opts.isAuto ? ' auto-filled' : ' needs-fill');
      inp.id = opts.id;
      inp.value = opts.value || '';
      if (opts.placeholder) inp.placeholder = opts.placeholder;
      wrap.appendChild(inp);
    }

    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'gde-hint';
      h.textContent = opts.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  /* ── Helper: create a label+select field ─────────────────────── */
  function _selectField(opts) {
    // opts: { id, label, tag, options:[{value,label}], selected, hint, isAuto }
    const wrap = document.createElement('div');
    wrap.className = 'gde-field';

    const lbl = document.createElement('div');
    lbl.className = 'gde-label';
    lbl.textContent = opts.label + ' ';
    if (opts.tag) {
      const t = document.createElement('span');
      t.className = `gde-tag-${opts.tag}`;
      t.textContent = opts.tag === 'required' ? 'fill in' : opts.tag === 'auto' ? 'auto-filled' : 'optional';
      lbl.appendChild(t);
    }
    wrap.appendChild(lbl);

    const sel = document.createElement('select');
    sel.className = 'gde-select' + (opts.isAuto ? ' auto-filled' : '');
    sel.id = opts.id;
    for (const o of opts.options) {
      const op = document.createElement('option');
      op.value = o.value;
      op.textContent = o.label;
      if (o.value === opts.selected) op.selected = true;
      sel.appendChild(op);
    }
    wrap.appendChild(sel);

    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'gde-hint';
      h.textContent = opts.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  /* ── Helper: create a label+textarea field ───────────────────── */
  function _textareaField(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'gde-field';

    const lbl = document.createElement('div');
    lbl.className = 'gde-label';
    lbl.textContent = opts.label + ' ';
    if (opts.tag) {
      const t = document.createElement('span');
      t.className = `gde-tag-${opts.tag}`;
      t.textContent = opts.tag === 'required' ? 'fill in' : opts.tag === 'auto' ? 'auto-filled' : 'optional';
      lbl.appendChild(t);
    }
    wrap.appendChild(lbl);

    const ta = document.createElement('textarea');
    ta.className = 'gde-textarea' + (opts.isAuto ? ' auto-filled' : ' needs-fill');
    ta.id = opts.id;
    ta.value = opts.value || '';
    if (opts.placeholder) ta.placeholder = opts.placeholder;
    wrap.appendChild(ta);

    if (opts.hint) {
      const h = document.createElement('div');
      h.className = 'gde-hint';
      h.textContent = opts.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  /* ── Helper: create a toggle ─────────────────────────────────── */
  function _toggleField(id, label, checked) {
    const row = document.createElement('div');
    row.className = 'gde-toggle-row';

    const lbl = document.createElement('div');
    lbl.className = 'gde-toggle-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const tog = document.createElement('label');
    tog.className = 'gde-toggle';
    tog.innerHTML = `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
      <span class="gde-toggle-slider"></span>`;
    row.appendChild(tog);
    return row;
  }

  /* ── Helper: section wrapper ─────────────────────────────────── */
  function _section(label) {
    const sec = document.createElement('div');
    sec.className = 'gde-section';
    const lbl = document.createElement('div');
    lbl.className = 'gde-section-label';
    lbl.textContent = label;
    sec.appendChild(lbl);
    return sec;
  }

  function _row(...fields) {
    const row = document.createElement('div');
    row.className = 'gde-row';
    for (const f of fields) row.appendChild(f);
    return row;
  }

  /* ── Determine game card type from editor state ───────────────── */
  function _inferType(s) {
    const mode = s.cardMode || 'territory';
    if (mode === 'dreamscape') return 'DR';
    if (mode === 'event') return 'EV';
    if (mode === 'dozer') return 'DZ';
    if (mode === 'dozer-skill') return 'DZS';
    if (mode === 'char-skill') return 'CHS'; // default; user can change to CHSS
    if (mode === 'no-territory') return 'CH'; // most likely; user can change
    // territory mode — most likely CH or DA
    return 'CH';
  }

  /* ── Populate the form from current editor state ─────────────── */
  function _populateForm() {
    const s = window.NullCorps.state;
    const body = document.getElementById('gde-body');
    body.innerHTML = '';

    const inferredType = _inferType(s);

    /* ─── SECTION: Card Identity ─────────────────────────────── */
    const secId = _section('Card Identity');

    // Card ID
    const idRow = _row(
      _field({ id:'gde-id', label:'Card ID', tag:'required',
        placeholder:'e.g. 001-MCS-CH1',
        hint:'Format: [number]-[set]-[type][index]. Must be unique across all cards.' })
    );
    secId.appendChild(idRow);

    // Card type selector
    const typeOptions = [
      { value:'CH',   label:'CH — Character' },
      { value:'CHS',  label:'CHS — Character Skill' },
      { value:'CHSS', label:'CHSS — Character Sub-Skill' },
      { value:'DA',   label:'DA — Dazed Character' },
      { value:'DAS',  label:'DAS — Dazed Skill' },
      { value:'DASS', label:'DASS — Dazed Sub-Skill' },
      { value:'DZ',   label:'DZ — Dozer' },
      { value:'DZS',  label:'DZS — Dozer Skill' },
      { value:'DZSS', label:'DZSS — Dozer Sub-Skill' },
      { value:'DR',   label:'DR — Dreamscape' },
      { value:'LO',   label:'LO — Location' },
      { value:'EV',   label:'EV — Event' },
    ];
    const typeRow = _row(
      _selectField({ id:'gde-type', label:'Card Type', tag:'auto',
        options: typeOptions, selected: inferredType, isAuto: true,
        hint:'Inferred from card mode. Adjust if needed (e.g. CHSS vs CHS, DA vs CH).' })
    );
    secId.appendChild(typeRow);

    // Set code
    const setOptions = [
      { value:'', label:'— Select set —' },
      { value:'OHS', label:'OHS — Original Hand Set' },
      { value:'MCS', label:'MCS — Main Character Set' },
      { value:'HS',  label:'HS — Hero Set' },
      { value:'GS',  label:'GS — General Set' },
    ];
    secId.appendChild(_row(
      _selectField({ id:'gde-set', label:'Set', tag:'required',
        options: setOptions, selected: '',
        hint:'Which card set does this belong to?' })
    ));

    // Name & title (auto from editor)
    secId.appendChild(_row(
      _field({ id:'gde-name', label:'Card Name', tag:'auto',
        value: s.cardName || '', isAuto: true }),
      _field({ id:'gde-title', label:'Card Title / Flavour', tag:'auto',
        value: s.cardTitle || '', isAuto: true })
    ));

    // Card type text & era (auto from editor)
    secId.appendChild(_row(
      _field({ id:'gde-cardtype-text', label:'Type Text', tag:'auto',
        value: s.cardType || '', isAuto: true,
        hint:'The text printed in the type line (e.g. "Character").' }),
      _field({ id:'gde-era', label:'Era', tag:'auto',
        value: s.era || '', isAuto: true,
        hint:'e.g. 50 BME — leave blank for non-CH/DA/LO cards.' })
    ));

    // Unique number (auto)
    secId.appendChild(_row(
      _field({ id:'gde-uniquenum', label:'Unique Card #', tag:'auto',
        value: s.uniqueNumber || '', isAuto: true })
    ));

    body.appendChild(secId);

    /* ─── SECTION: Linking Tags ──────────────────────────────── */
    const secLink = _section('Linking Tags');
    secLink.appendChild(_row(
      _field({ id:'gde-chartag', label:'charTag', tag:'optional',
        placeholder:'e.g. 001-MCS-CH1',
        hint:'For CHS/CHSS/DA/DAS/DASS/DZ/LO/EV — the CH or DA card this belongs to. Leave blank for DZS/DZSS.' }),
    ));
    secLink.appendChild(_row(
      _field({ id:'gde-parenttag', label:'parentTag', tag:'optional',
        placeholder:'e.g. 007-MCS-DZ1',
        hint:'For DZS/DZSS only — the DZ (Dozer) card this skill belongs to.' })
    ));
    body.appendChild(secLink);

    /* ─── SECTION: Territory & Energy ───────────────────────── */
    const secTerr = _section('Territory & Energy');
    secTerr.appendChild(_row(
      _field({ id:'gde-territory', label:'Territory', tag:'auto',
        value: s.territory || '', isAuto: !!(s.territory),
        hint:'Matches TERRITORY_MAP key in data.js. Auto-fills zone & energy for CH/DA/LO.' })
    ));

    // Zone (readonly computed display)
    const zoneVal = s.zone || '';
    secTerr.appendChild(_row(
      _field({ id:'gde-zone', label:'Zone (from territory)', tag:'auto',
        value: zoneVal, isAuto: true, readonly: true })
    ));

    body.appendChild(secTerr);

    /* ─── SECTION: Stats ─────────────────────────────────────── */
    const secStats = _section('Combat Stats');
    secStats.appendChild(_row(
      _field({ id:'gde-atk', label:'ATK', tag:'auto',
        value: s.atk || '', isAuto: true, type:'number' }),
      _field({ id:'gde-def', label:'DEF', tag:'auto',
        value: s.def || '', isAuto: true, type:'number' }),
      _field({ id:'gde-hp', label:'HP', tag:'auto',
        value: s.hp || '', isAuto: true, type:'number' }),
      _field({ id:'gde-shd', label:'SHD', tag:'auto',
        value: s.shd || '', isAuto: true, type:'number' }),
    ));
    secStats.appendChild(_row(
      _field({ id:'gde-eg', label:'Energy Cost (eg)', tag:'auto',
        value: s.energy || '', isAuto: true, type:'number',
        hint:'1–4. Auto-filled from Energy Stat field.' })
    ));
    body.appendChild(secStats);

    /* ─── SECTION: Art & Portrait ────────────────────────────── */
    const secArt = _section('Art & Portrait');
    secArt.appendChild(_row(
      _field({ id:'gde-img', label:'Card Art Path (img)', tag:'required',
        placeholder:'assets/cards/your_card.png',
        hint:'Portrait image used on the game field and battle screens. Can be the same file for character & dazed portraits.' })
    ));

    // Character portrait fields (shown for CH / DA)
    const charPortraitWrap = document.createElement('div');
    charPortraitWrap.id = 'gde-char-portrait-wrap';

    charPortraitWrap.appendChild(_row(
      _field({ id:'gde-char-img', label:'Character Portrait (CHARACTERS[].img)', tag:'required',
        placeholder:'assets/chars/your_char.png',
        hint:'Shown in Battle Selection grid and Dream Ready screen (left portrait). Can reuse the card art path above.' })
    ));
    charPortraitWrap.appendChild(_row(
      _field({ id:'gde-dazed-img', label:'Dazed Portrait (CHARACTERS[].dazedImg)', tag:'required',
        placeholder:'assets/chars/your_char_dazed.png',
        hint:'Shown on Dream Ready right portrait and Second Chance overlay. Set separately; Dozers skip this.' })
    ));
    charPortraitWrap.appendChild(_row(
      _field({ id:'gde-dazed-name', label:'Dazed Name (CHARACTERS[].dazedName)', tag:'required',
        placeholder:'e.g. Dazed Sparrow',
        hint:'Display name for the Dazed version shown in Dream Ready.' })
    ));
    charPortraitWrap.appendChild(_row(
      _field({ id:'gde-dazed-card-id', label:'Dazed Card ID (CHARACTERS[].dazedCardId)', tag:'required',
        placeholder:'e.g. 003-MCS-DA1',
        hint:'The id of the DA card in CARDS[] for this character\'s Dazed version.' })
    ));
    secArt.appendChild(charPortraitWrap);
    body.appendChild(secArt);

    /* ─── SECTION: Special Letters ───────────────────────────── */
    const secLetters = _section('Crossword Letters');
    secLetters.appendChild(_row(
      _field({ id:'gde-special-letters', label:'Special Letters', tag:'optional',
        placeholder:"e.g. S (separate with spaces: S T)",
        hint:'Letters in the card name that can join crossword words. Usually the special letters marked with <X> in the card name.' }),
    ));
    body.appendChild(secLetters);

    /* ─── SECTION: Lore Description ─────────────────────────── */
    const secDesc = _section('Lore Description');
    secDesc.appendChild(_row(
      _textareaField({ id:'gde-description', label:'Description (lore text)', tag:'optional',
        placeholder:'Write the card\'s lore/flavour text here. This is separate from card effect text.',
        hint:'Background story, flavour text, lore. Not the rules text — that comes from the card effect.' })
    ));
    body.appendChild(secDesc);

    /* ─── SECTION: Flags ─────────────────────────────────────── */
    const secFlags = _section('Flags');

    secFlags.appendChild(_toggleField('gde-is-main-char', 'isMainChar — Can only go in the Main Character slot', false));
    secFlags.appendChild(_toggleField('gde-is-side-char', 'isSideChar — Can only go in the Side Character slot', false));
    secFlags.appendChild(_toggleField('gde-is-default', 'isDefault — Every player owns this from the start', false));

    // Event subtype (for EV cards)
    const evSubtypeRow = document.createElement('div');
    evSubtypeRow.id = 'gde-ev-subtype-row';
    evSubtypeRow.style.marginTop = '8px';
    evSubtypeRow.appendChild(
      _selectField({ id:'gde-ev-subtype', label:'Event Type (EV cards only)', tag:'optional',
        options: [
          { value:'', label:'— None —' },
          { value:'Lucid', label:'Lucid — Singular Buff for Characters' },
          { value:'Nightmare', label:'Nightmare — Weakens player, better rewards' },
          { value:'Liminal', label:'Liminal — Buff or Debuff to Dreamscape cards' },
          { value:'Recurring', label:'Recurring — Every turn effect' },
          { value:'Daydream', label:'Daydream — Adds cards to hand or deck' },
          { value:'Fever', label:'Fever — Random event on condition' },
        ],
        selected: s.eventSubtype || '',
        isAuto: !!(s.eventSubtype)
      })
    );
    secFlags.appendChild(evSubtypeRow);

    body.appendChild(secFlags);

    /* ─── SECTION: Dialogue (CH only) ───────────────────────── */
    const secDialogue = _section('Character Dialogue');
    secDialogue.id = 'gde-dialogue-section';
    secDialogue.appendChild(
      _textareaField({ id:'gde-dialogue', label:'Battle Start Dialogue', tag:'required',
        placeholder:'One line per dialogue bubble. Each types out letter-by-letter, pauses 5s, then next line.\n\ne.g.\nYou dare enter my dream?\nI will show you true darkness!',
        hint:'For CH cards. Put each line on a new line here — the exporter splits them into an array.' })
    );
    body.appendChild(secDialogue);

    /* ─── SECTION: Effects note ──────────────────────────────── */
    const secEffects = _section('Effects (add manually in data.js)');
    const effNote = document.createElement('div');
    effNote.style.cssText = 'font-size:10px;color:#555568;line-height:1.7;padding:4px 0;';
    effNote.innerHTML =
      'The <code style="color:#c8ff00">effects</code> array is not generated here — it requires the C2/C3 engine syntax ' +
      'and is too complex to form-fill. The exported snippet will include an empty <code style="color:#c8ff00">effects: []</code> ' +
      'placeholder. Fill it in after pasting into <code style="color:#c8ff00">data.js</code>.';
    secEffects.appendChild(effNote);
    body.appendChild(secEffects);

    /* ─── Show/hide CH-only sections based on type select ────── */
    const typeSelect = document.getElementById('gde-type');
    function _updateVisibility() {
      const t = typeSelect.value;
      const isChar = IS_CHARACTER.has(t);
      const isChOnly = t === 'CH';

      document.getElementById('gde-char-portrait-wrap').style.display = isChOnly ? '' : 'none';
      document.getElementById('gde-dialogue-section').style.display = isChOnly ? '' : 'none';
    }
    typeSelect.addEventListener('change', _updateVisibility);
    _updateVisibility();
  }

  /* ── Build the exported JS snippet ───────────────────────────── */
  function _buildSnippet() {
    const s = window.NullCorps.state;

    const id          = (document.getElementById('gde-id')?.value || '').trim();
    const type        = document.getElementById('gde-type')?.value || 'CH';
    const set         = document.getElementById('gde-set')?.value || '';
    const name        = (document.getElementById('gde-name')?.value || '').trim();
    const title       = (document.getElementById('gde-title')?.value || '').trim();
    const cardTypeText= (document.getElementById('gde-cardtype-text')?.value || '').trim();
    const era         = (document.getElementById('gde-era')?.value || '').trim();
    const uniqueNum   = (document.getElementById('gde-uniquenum')?.value || '').trim();
    const territory   = (document.getElementById('gde-territory')?.value || '').trim();
    const charTag     = (document.getElementById('gde-chartag')?.value || '').trim();
    const parentTag   = (document.getElementById('gde-parenttag')?.value || '').trim();
    const atk         = document.getElementById('gde-atk')?.value || '0';
    const def         = document.getElementById('gde-def')?.value || '0';
    const hp          = document.getElementById('gde-hp')?.value || '0';
    const shd         = document.getElementById('gde-shd')?.value || '0';
    const eg          = document.getElementById('gde-eg')?.value || '0';
    const img         = (document.getElementById('gde-img')?.value || '').trim();
    const description = (document.getElementById('gde-description')?.value || '').trim();
    const specialRaw  = (document.getElementById('gde-special-letters')?.value || '').trim();
    const isMainChar  = document.getElementById('gde-is-main-char')?.checked || false;
    const isSideChar  = document.getElementById('gde-is-side-char')?.checked || false;
    const isDefault   = document.getElementById('gde-is-default')?.checked || false;
    const evSubtype   = document.getElementById('gde-ev-subtype')?.value || '';
    const dialogueRaw = (document.getElementById('gde-dialogue')?.value || '').trim();

    // CH-only CHARACTERS[] fields
    const charImg      = (document.getElementById('gde-char-img')?.value || '').trim();
    const dazedImg     = (document.getElementById('gde-dazed-img')?.value || '').trim();
    const dazedName    = (document.getElementById('gde-dazed-name')?.value || '').trim();
    const dazedCardId  = (document.getElementById('gde-dazed-card-id')?.value || '').trim();

    // Special letters array
    const specialLetters = specialRaw
      ? specialRaw.split(/[\s,]+/).filter(Boolean).map(l => l.toUpperCase())
      : [];

    // Dialogue array
    const dialogueLines = dialogueRaw
      ? dialogueRaw.split('\n').map(l => l.trim()).filter(Boolean)
      : [];

    const HAS_STATS_T   = new Set(['CH','DA','DZ']);
    const HAS_TERR_T    = new Set(['CH','DA','LO']);
    const IS_CHAR_T     = new Set(['CH','DA']);

    // Build the lines
    const lines = [];

    // CHARACTERS[] snippet for CH cards
    if (type === 'CH') {
      lines.push('// ─────────────────────────────────────────────────────────────');
      lines.push('// Add this block to CHARACTERS[] in data.js');
      lines.push('// ─────────────────────────────────────────────────────────────');
      lines.push('{');
      lines.push(`  name:        '${name || 'FILL IN'}',`);
      lines.push(`  img:         '${charImg || 'FILL IN — assets/chars/your_char.png'}',`);
      lines.push(`  cardId:      '${id || 'FILL IN — card id below'}',`);
      lines.push(`  dazedImg:    '${dazedImg || 'FILL IN — assets/chars/your_char_dazed.png'}',`);
      lines.push(`  dazedName:   '${dazedName || 'FILL IN'}',`);
      lines.push(`  dazedCardId: '${dazedCardId || 'FILL IN — DA card id'}',`);
      lines.push(`  dialogue: [`);
      if (dialogueLines.length) {
        for (const dl of dialogueLines) lines.push(`    '${dl.replace(/'/g, "\\'")}',`);
      } else {
        lines.push(`    'FILL IN',`);
      }
      lines.push(`  ],`);
      lines.push('},');
      lines.push('');
      lines.push('');
    }

    // CARDS[] snippet
    lines.push('// ─────────────────────────────────────────────────────────────');
    lines.push('// Add this block to CARDS[] in data.js');
    lines.push('// ─────────────────────────────────────────────────────────────');
    lines.push('{');
    lines.push(`  id:             '${id || 'FILL IN'}',`);
    lines.push(`  name:           '${name || 'FILL IN'}',`);
    lines.push(`  title:          '${title}',`);
    lines.push(`  type:           '${type}',`);
    lines.push(`  set:            '${set || 'FILL IN'}',`);

    if (HAS_TERR_T.has(type)) {
      lines.push(`  era:            '${era}',`);
      lines.push(`  territory:      '${territory || 'FILL IN'}',`);
    }

    if (charTag) lines.push(`  charTag:        '${charTag}',`);
    if (parentTag) lines.push(`  parentTag:      '${parentTag}',`);

    if (HAS_STATS_T.has(type)) {
      lines.push(`  atk:            ${atk},`);
      lines.push(`  def:            ${def},`);
      lines.push(`  hp:             ${hp},`);
      lines.push(`  shd:            ${shd},`);
    }

    lines.push(`  eg:             ${eg},`);

    if (specialLetters.length) {
      lines.push(`  specialLetters: [${specialLetters.map(l => `'${l}'`).join(', ')}],`);
    } else {
      lines.push(`  specialLetters: [],`);
    }
    lines.push(`  mergedLetters:  [],`);

    lines.push(`  description:    '${description.replace(/'/g, "\\'")}',`);
    lines.push(`  img:            '${img || 'FILL IN — assets/cards/your_card.png'}',`);

    if (isDefault) lines.push(`  isDefault:      true,`);
    if (isMainChar) lines.push(`  isMainChar:     true,`);
    if (isSideChar) lines.push(`  isSideChar:     true,`);

    if (type === 'EV' && evSubtype) {
      lines.push(`  eventType:      '${evSubtype}',`);
    }

    lines.push(`  effects:        [], // ← FILL IN with C3 engine effect objects`);
    lines.push('},');

    return lines.join('\n');
  }

  /* ── Open modal ───────────────────────────────────────────────── */
  function openModal() {
    _populateForm();
    document.getElementById('gde-overlay').classList.add('open');
    document.getElementById('gde-export-status').textContent = '';
    // Scroll to top of overlay
    document.getElementById('gde-overlay').scrollTop = 0;
  }

  /* ── Close modal ─────────────────────────────────────────────── */
  function closeModal() {
    document.getElementById('gde-overlay').classList.remove('open');
  }

  /* ── Export ──────────────────────────────────────────────────── */
  function doExport() {
    const id = (document.getElementById('gde-id')?.value || '').trim();
    const snippet = _buildSnippet();

    const filename = id
      ? `gamedata_${id.replace(/[^a-zA-Z0-9\-_]/g, '_')}.js`
      : 'gamedata_export.js';

    const blob = new Blob([snippet], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('gde-export-status').textContent = `✓ Exported ${filename}`;
  }

  /* ── Wire the trigger button ─────────────────────────────────── */
  function _wireTrigger() {
    const btn = document.getElementById('btn-export-gamedata');
    if (btn) btn.addEventListener('click', openModal);
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    _injectCSS();
    _buildModal();
    _wireTrigger();

    // Expose on namespace for debugging
    window.NullCorps.gamedataExport = { open: openModal, close: closeModal };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
