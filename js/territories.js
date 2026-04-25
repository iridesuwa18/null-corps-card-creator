/* ═══════════════════════════════════════════════════════════════
   NULL CORPS CARD EDITOR — js/territories.js
   Part 3: Territory & Energy Data + Presets
   ─────────────────────────────────────────────────────────────
   • 24 energy types with display names + PNG slugs
   • 83 territories grouped by zone (NW/N/NE/W/C/E/SW/S/SE)
   • Populates #territory-select and energy dropdowns on init
   • Selecting a territory auto-wires all state fields and
     triggers a full layers.js re-render
   • Energy override dropdowns update state independently
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     ENERGY TYPES  (E1–E24)
     slug: used in all PNG filenames
     name: display label in dropdowns
  ══════════════════════════════════════════════════════════════ */
  const ENERGIES = [
    { code: 'E1',  slug: 'quiescent',                   name: 'Quiescent'                   },
    { code: 'E2',  slug: 'thermal',                     name: 'Thermal'                     },
    { code: 'E3',  slug: 'calmness',                    name: 'Calmness'                    },
    { code: 'E4',  slug: 'elasticpotential',            name: 'Elastic Potential'           },
    { code: 'E5',  slug: 'darkness',                    name: 'Darkness'                    },
    { code: 'E6',  slug: 'magnetic',                    name: 'Magnetic'                    },
    { code: 'E7',  slug: 'tidal',                       name: 'Tidal'                       },
    { code: 'E8',  slug: 'vacuum',                      name: 'Vacuum'                      },
    { code: 'E9',  slug: 'radiantelectromagnetic',      name: 'Radiant / Electromagnetic'   },
    { code: 'E10', slug: 'electrical',                  name: 'Electrical'                  },
    { code: 'E11', slug: 'disconnect',                  name: 'Disconnect'                  },
    { code: 'E12', slug: 'durability',                  name: 'Durability'                  },
    { code: 'E13', slug: 'stillness',                   name: 'Stillness'                   },
    { code: 'E14', slug: 'nuclear',                     name: 'Nuclear'                     },
    { code: 'E15', slug: 'mechanicalpotentialkinetic',  name: 'Mechanical (Potential)/Kinetic' },
    { code: 'E16', slug: 'gravitational',               name: 'Gravitational'               },
    { code: 'E17', slug: 'frigid',                      name: 'Frigid'                      },
    { code: 'E18', slug: 'dormant',                     name: 'Dormant'                     },
    { code: 'E19', slug: 'inactive',                    name: 'Inactive'                    },
    { code: 'E20', slug: 'chemical',                    name: 'Chemical'                    },
    { code: 'E21', slug: 'stability',                   name: 'Stability'                   },
    { code: 'E22', slug: 'sound',                       name: 'Sound'                       },
    { code: 'E23', slug: 'wind',                        name: 'Wind'                        },
    { code: 'E24', slug: 'static',                      name: 'Static'                      },
  ];

  /** Look up an energy slug by display name (e.g. 'Calmness' → 'calmness'). */
  function _slugByName(name) {
    if (!name || name === 'None') return null;
    const found = ENERGIES.find(e => e.name === name);
    return found ? found.slug : null;
  }

  /* ══════════════════════════════════════════════════════════════
     TERRITORY DATA  (83 territories)
     zone:      short zone code shown on card (NW / N / NE / W / C / E / SW / S / SE)
     zoneLabel: full label used for <optgroup> headers
     main/secondary/third: energy display name, or null
  ══════════════════════════════════════════════════════════════ */
  const TERRITORIES = [

    /* ── Z1: Northwest (NW) — 7 territories ── */
    { name: 'Calmoria',    zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Calmness',  secondary: null,                        third: null    },
    { name: 'Quiescentia', zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Quiescent', secondary: null,                        third: null    },
    { name: 'Quiesmather', zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Quiescent', secondary: 'Thermal',                   third: null    },
    { name: 'Thermalia',   zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Thermal',   secondary: null,                        third: null    },
    { name: 'Thermalm',    zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Thermal',   secondary: 'Calmness',                  third: null    },
    { name: 'Thermunia',   zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Thermal',   secondary: 'Nuclear',                   third: null    },
    { name: 'Thermaval',   zone: 'NW', zoneLabel: 'Northwest (NW)', main: 'Thermal',   secondary: 'Gravitational',             third: null    },

    /* ── Z2: North (N) — 10 territories ── */
    { name: 'Serenelast',     zone: 'N', zoneLabel: 'North (N)', main: 'Calmness',             secondary: 'Elastic Potential',  third: null       },
    { name: 'Darkelastis',    zone: 'N', zoneLabel: 'North (N)', main: 'Darkness',             secondary: 'Elastic Potential',  third: null       },
    { name: 'Darklund',       zone: 'N', zoneLabel: 'North (N)', main: 'Darkness',             secondary: null,                 third: null       },
    { name: 'Elastoria',      zone: 'N', zoneLabel: 'North (N)', main: 'Elastic Potential',    secondary: null,                 third: null       },
    { name: 'Elastomagentia', zone: 'N', zoneLabel: 'North (N)', main: 'Elastic Potential',    secondary: 'Magnetic',           third: null       },
    { name: 'Gravelastia',    zone: 'N', zoneLabel: 'North (N)', main: 'Gravitational',        secondary: 'Elastic Potential',  third: 'Darkness' },
    { name: 'Magnitidal',     zone: 'N', zoneLabel: 'North (N)', main: 'Magnetic',             secondary: 'Tidal',              third: null       },
    { name: 'Magnethia',      zone: 'N', zoneLabel: 'North (N)', main: 'Magnetic',             secondary: null,                 third: null       },
    { name: 'Magnetidavac',   zone: 'N', zoneLabel: 'North (N)', main: 'Magnetic',             secondary: 'Tidal',              third: 'Vacuum'   },
    { name: 'Tidalia',        zone: 'N', zoneLabel: 'North (N)', main: 'Tidal',                secondary: null,                 third: null       },

    /* ── Z3: Northeast (NE) — 14 territories ── */
    { name: 'Disconnectia',  zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Disconnect',                secondary: null,                       third: null     },
    { name: 'Disquiecentia', zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Disconnect',                secondary: 'Quiescent',                third: null     },
    { name: 'Dormavacua',    zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Dormant',                   secondary: 'Vacuum',                   third: null     },
    { name: 'Dormantria',    zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Dormant',                   secondary: 'Radiant / Electromagnetic', third: null     },
    { name: 'Electridis',    zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Electrical',                secondary: 'Disconnect',               third: null     },
    { name: 'Electradiana',  zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Electrical',                secondary: 'Radiant / Electromagnetic', third: null     },
    { name: 'Electrionia',   zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Electrical',                secondary: null,                       third: null     },
    { name: 'Quieslectria',  zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Quiescent',                 secondary: 'Electrical',               third: null     },
    { name: 'Quiescinact',   zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Quiescent',                 secondary: 'Inactive',                 third: null     },
    { name: 'Radiantos',     zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Radiant / Electromagnetic', secondary: null,                       third: null     },
    { name: 'Radiantia',     zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Radiant / Electromagnetic', secondary: 'Disconnect',               third: null     },
    { name: 'Tidalvac',      zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Tidal',                     secondary: 'Magnetic',                 third: 'Dormant'},
    { name: 'Vacuorus',      zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Vacuum',                    secondary: null,                       third: null     },
    { name: 'Vacuradia',     zone: 'NE', zoneLabel: 'Northeast (NE)', main: 'Vacuum',                    secondary: 'Radiant / Electromagnetic', third: null     },

    /* ── Z4: West (W) — 15 territories ── */
    { name: 'Duriquies',        zone: 'W', zoneLabel: 'West (W)', main: 'Durability',                   secondary: 'Quiescent',                       third: null      },
    { name: 'Durabilis',        zone: 'W', zoneLabel: 'West (W)', main: 'Durability',                   secondary: null,                              third: null      },
    { name: 'Duracore',         zone: 'W', zoneLabel: 'West (W)', main: 'Durability',                   secondary: 'Nuclear',                         third: null      },
    { name: 'Mechanucropolis',  zone: 'W', zoneLabel: 'West (W)', main: 'Mechanical (Potential)/Kinetic', secondary: 'Nuclear',                       third: null      },
    { name: 'Mechanovia',       zone: 'W', zoneLabel: 'West (W)', main: 'Mechanical (Potential)/Kinetic', secondary: null,                            third: null      },
    { name: 'Nucleonovia',      zone: 'W', zoneLabel: 'West (W)', main: 'Nuclear',                      secondary: null,                              third: null      },
    { name: 'Nuclearis',        zone: 'W', zoneLabel: 'West (W)', main: 'Nuclear',                      secondary: 'Stillness',                       third: null      },
    { name: 'Nuclechros',       zone: 'W', zoneLabel: 'West (W)', main: 'Nuclear',                      secondary: 'Mechanical (Potential)/Kinetic',  third: 'Stability'},
    { name: 'Nuclestria',       zone: 'W', zoneLabel: 'West (W)', main: 'Nuclear',                      secondary: 'Stability',                       third: null      },
    { name: 'Quiescilla',       zone: 'W', zoneLabel: 'West (W)', main: 'Quiescent',                    secondary: 'Stillness',                       third: null      },
    { name: 'Quithermia',       zone: 'W', zoneLabel: 'West (W)', main: 'Quiescent',                    secondary: 'Stillness',                       third: 'Thermal' },
    { name: 'Stabilicore',      zone: 'W', zoneLabel: 'West (W)', main: 'Stability',                    secondary: 'Nuclear',                         third: 'Sound'   },
    { name: 'Stildura',         zone: 'W', zoneLabel: 'West (W)', main: 'Stillness',                    secondary: 'Durability',                      third: null      },
    { name: 'Stilla',           zone: 'W', zoneLabel: 'West (W)', main: 'Stillness',                    secondary: null,                              third: null      },
    { name: 'Thermalis',        zone: 'W', zoneLabel: 'West (W)', main: 'Thermal',                      secondary: 'Stillness',                       third: null      },

    /* ── Z5: Central (C) — 6 territories ── */
    { name: 'Gravitrona',    zone: 'C', zoneLabel: 'Central (C)', main: 'Gravitational', secondary: 'Nuclear',        third: null     },
    { name: 'Gravitalis',    zone: 'C', zoneLabel: 'Central (C)', main: 'Gravitational', secondary: null,             third: null     },
    { name: 'Soundgraviton', zone: 'C', zoneLabel: 'Central (C)', main: 'Sound',         secondary: 'Gravitational',  third: 'Nuclear'},
    { name: 'Sonograv',      zone: 'C', zoneLabel: 'Central (C)', main: 'Sound',         secondary: 'Gravitational',  third: null     },
    { name: 'Tidalgrav',     zone: 'C', zoneLabel: 'Central (C)', main: 'Tidal',         secondary: 'Gravitational',  third: null     },
    { name: 'Windtide',      zone: 'C', zoneLabel: 'Central (C)', main: 'Wind',          secondary: 'Tidal',          third: null     },

    /* ── Z6: East (E) — 12 territories ── */
    { name: 'Chemistadora',  zone: 'E', zoneLabel: 'East (E)', main: 'Chemical', secondary: 'Static',   third: 'Dormant'  },
    { name: 'Chemistria',    zone: 'E', zoneLabel: 'East (E)', main: 'Chemical', secondary: null,       third: null       },
    { name: 'Dormwindia',    zone: 'E', zoneLabel: 'East (E)', main: 'Dormant',  secondary: 'Wind',     third: null       },
    { name: 'Dormont',       zone: 'E', zoneLabel: 'East (E)', main: 'Dormant',  secondary: null,       third: null       },
    { name: 'Dormantystria', zone: 'E', zoneLabel: 'East (E)', main: 'Dormant',  secondary: 'Static',   third: 'Wind'     },
    { name: 'Dormantechia',  zone: 'E', zoneLabel: 'East (E)', main: 'Dormant',  secondary: 'Inactive', third: null       },
    { name: 'Frigida',       zone: 'E', zoneLabel: 'East (E)', main: 'Frigid',   secondary: null,       third: null       },
    { name: 'Frigisona',     zone: 'E', zoneLabel: 'East (E)', main: 'Frigid',   secondary: 'Sound',    third: null       },
    { name: 'Inactornica',   zone: 'E', zoneLabel: 'East (E)', main: 'Inactive', secondary: 'Electrical', third: null     },
    { name: 'Inactonia',     zone: 'E', zoneLabel: 'East (E)', main: 'Inactive', secondary: null,       third: null       },
    { name: 'Inachem',       zone: 'E', zoneLabel: 'East (E)', main: 'Inactive', secondary: 'Chemical', third: null       },
    { name: 'Windfrost',     zone: 'E', zoneLabel: 'East (E)', main: 'Wind',     secondary: 'Frigid',   third: null       },

    /* ── Z7: Southwest (SW) — 4 territories ── */
    { name: 'Duramech',     zone: 'SW', zoneLabel: 'Southwest (SW)', main: 'Durability',                   secondary: 'Mechanical (Potential)/Kinetic', third: null },
    { name: 'Mechanoquies', zone: 'SW', zoneLabel: 'Southwest (SW)', main: 'Mechanical (Potential)/Kinetic', secondary: 'Quiescent',                   third: null },
    { name: 'Mechcalmia',   zone: 'SW', zoneLabel: 'Southwest (SW)', main: 'Mechanical (Potential)/Kinetic', secondary: 'Calmness',                    third: null },
    { name: 'Stabletron',   zone: 'SW', zoneLabel: 'Southwest (SW)', main: 'Stability',                    secondary: 'Mechanical (Potential)/Kinetic', third: null },

    /* ── Z8: South (S) — 8 territories ── */
    { name: 'Serenomagnia', zone: 'S', zoneLabel: 'South (S)', main: 'Calmness',   secondary: 'Magnetic',  third: null   },
    { name: 'Magnawind',    zone: 'S', zoneLabel: 'South (S)', main: 'Magnetic',   secondary: 'Wind',      third: null   },
    { name: 'Soundara',     zone: 'S', zoneLabel: 'South (S)', main: 'Sound',      secondary: null,        third: null   },
    { name: 'Sonorica',     zone: 'S', zoneLabel: 'South (S)', main: 'Sound',      secondary: 'Wind',      third: null   },
    { name: 'Stabilis',     zone: 'S', zoneLabel: 'South (S)', main: 'Stability',  secondary: null,        third: null   },
    { name: 'Stabilitone',  zone: 'S', zoneLabel: 'South (S)', main: 'Stability',  secondary: 'Sound',     third: null   },
    { name: 'Windymagsta',  zone: 'S', zoneLabel: 'South (S)', main: 'Wind',       secondary: 'Magnetic',  third: 'Static'},
    { name: 'Windmere',     zone: 'S', zoneLabel: 'South (S)', main: 'Wind',       secondary: null,        third: null   },

    /* ── Z9: Southeast (SE) — 7 territories ── */
    { name: 'Chemistatia', zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Chemical',                secondary: 'Static',      third: null      },
    { name: 'Electriqia',  zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Electrical',              secondary: 'Quiescent',   third: 'Chemical'},
    { name: 'Radiastrix',  zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Radiant / Electromagnetic', secondary: 'Static',    third: null      },
    { name: 'Statica',     zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Static',                  secondary: 'Magnetic',    third: null      },
    { name: 'Stativia',    zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Static',                  secondary: null,          third: null      },
    { name: 'Staticonia',  zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Static',                  secondary: 'Disconnect',  third: null      },
    { name: 'Windastra',   zone: 'SE', zoneLabel: 'Southeast (SE)', main: 'Wind',                    secondary: 'Static',      third: null      },
  ];

  /* ══════════════════════════════════════════════════════════════
     VERIFY COUNT
  ══════════════════════════════════════════════════════════════ */
  // (7 + 10 + 14 + 15 + 6 + 12 + 4 + 8 + 7 = 83)
  if (TERRITORIES.length !== 83) {
    console.warn('[territories.js] Expected 83 territories, got', TERRITORIES.length);
  }

  /* ══════════════════════════════════════════════════════════════
     DROPDOWN POPULATION
  ══════════════════════════════════════════════════════════════ */

  /** Populate #territory-select with one <optgroup> per zone. */
  function _populateTerritorySelect() {
    const sel = document.getElementById('territory-select');
    if (!sel) return;

    // Group territories by zoneLabel (preserving insertion order = zone order)
    const groups = {};
    const groupOrder = [];
    for (const t of TERRITORIES) {
      if (!groups[t.zoneLabel]) {
        groups[t.zoneLabel] = [];
        groupOrder.push(t.zoneLabel);
      }
      groups[t.zoneLabel].push(t);
    }

    // Build and append optgroups
    for (const label of groupOrder) {
      const og = document.createElement('optgroup');
      og.label = label;
      for (const t of groups[label]) {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
  }

  /** Populate all three energy <select> elements with the 24 energy options. */
  function _populateEnergySelects() {
    const ids = ['energy-main', 'energy-secondary', 'energy-third'];
    for (const id of ids) {
      const sel = document.getElementById(id);
      if (!sel) continue;
      for (const e of ENERGIES) {
        const opt = document.createElement('option');
        opt.value = e.slug;
        opt.textContent = `${e.name} (${e.code})`;
        sel.appendChild(opt);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     STATE APPLICATION
     Writes territory/energy data into NullCorps.state and
     syncs UI controls, then triggers a layers re-render.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Apply a territory to state + UI.
   * Pass null / '' to reset to "No Territory".
   * Selecting a territory always switches card mode back to 'territory'.
   */
  function applyTerritory(territoryName) {
    const s = window.NullCorps.state;

    if (!territoryName) {
      // No Territory defaults
      s.territory      = null;
      s.zone           = '';
      s.energyMain     = null;
      s.energySecondary = null;
      s.energyThird    = null;
    } else {
      const t = TERRITORIES.find(t => t.name === territoryName);
      if (!t) {
        console.warn('[territories.js] Unknown territory:', territoryName);
        return;
      }
      s.territory       = t.name;
      s.zone            = t.zone;
      s.energyMain      = _slugByName(t.main);
      s.energySecondary = _slugByName(t.secondary);
      s.energyThird     = _slugByName(t.third);
    }

    // Selecting a territory snaps back to territory mode, unless already in char-skill
    if (territoryName) {
      const keepMode = s.cardMode === 'char-skill' ? 'char-skill' : 'territory';
      s.cardMode = keepMode;
      s.eventSubtype = '';
      _syncCardModeBtns(keepMode);
      _syncModeUI(keepMode);
    }

    // Sync UI text field for zone indicator
    const zoneInput = document.getElementById('zone-indicator');
    if (zoneInput) zoneInput.value = s.zone;

    // Sync energy override dropdowns
    _syncEnergySelect('energy-main',      s.energyMain);
    _syncEnergySelect('energy-secondary', s.energySecondary);
    _syncEnergySelect('energy-third',     s.energyThird);

    _triggerRender();
  }

  /** Set an energy override select to a given slug value (or '' for None). */
  function _syncEnergySelect(id, slug) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.value = slug || '';
  }

  /** Apply a manual energy override from the UI dropdowns. */
  function _applyEnergyOverride(field, slug) {
    window.NullCorps.state[field] = slug || null;
    _triggerRender();
  }

  /** Fire a re-render via layers.js if it's available, else queue for later. */
  function _triggerRender() {
    if (window.NullCorps.layers && typeof window.NullCorps.layers.render === 'function') {
      window.NullCorps.layers.render();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     EVENT WIRING
  ══════════════════════════════════════════════════════════════ */

  function _wireEvents() {
    // Territory dropdown
    const terrSel = document.getElementById('territory-select');
    if (terrSel) {
      terrSel.addEventListener('change', function () {
        applyTerritory(this.value);
      });
    }

    // Zone indicator — manual override writes directly to state
    const zoneInput = document.getElementById('zone-indicator');
    if (zoneInput) {
      zoneInput.addEventListener('input', function () {
        window.NullCorps.state.zone = this.value;
        _triggerRender();
      });
    }

    // Energy override dropdowns
    const energyFields = [
      { id: 'energy-main',      stateKey: 'energyMain'      },
      { id: 'energy-secondary', stateKey: 'energySecondary' },
      { id: 'energy-third',     stateKey: 'energyThird'     },
    ];
    for (const { id, stateKey } of energyFields) {
      const sel = document.getElementById(id);
      if (sel) {
        sel.addEventListener('change', function () {
          _applyEnergyOverride(stateKey, this.value);
        });
      }
    }

    // ── Card Mode buttons ──────────────────────────────────────
    const modeRow = document.getElementById('card-mode-row');
    if (modeRow) {
      modeRow.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-mode');
        if (!btn) return;
        const mode = btn.dataset.mode;
        if (!mode) return;

        // Update active state visually
        modeRow.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Write mode into state
        window.NullCorps.state.cardMode = mode;

        // When leaving char-skill mode, coerce HP/SHD back to numbers
        if (mode !== 'char-skill') {
          const s = window.NullCorps.state;
          if (typeof s.hp === 'string') {
            const n = Number(s.hp);
            s.hp = isNaN(n) ? 0 : n;
            const hpEl = document.getElementById('stat-hp');
            if (hpEl) hpEl.value = s.hp === 0 ? '' : String(s.hp);
          }
          if (typeof s.shd === 'string') {
            const n = Number(s.shd);
            s.shd = isNaN(n) ? 0 : n;
            const shdEl = document.getElementById('stat-shd');
            if (shdEl) shdEl.value = s.shd === 0 ? '' : String(s.shd);
          }
        }

        // Non-territory modes (except char-skill): clear territory-derived state so border/frame
        // layers fall back to their defaults (gray / white) correctly.
        // char-skill retains territory so the symbol can still be set.
        if (mode !== 'territory' && mode !== 'char-skill') {
          const s = window.NullCorps.state;
          s.territory       = null;
          s.zone            = '';
          s.energyMain      = null;
          s.energySecondary = null;
          s.energyThird     = null;
          // Sync UI controls to reflect the cleared state
          const zoneInput = document.getElementById('zone-indicator');
          if (zoneInput) zoneInput.value = '';
          ['energy-main', 'energy-secondary', 'energy-third'].forEach(id => {
            const sel = document.getElementById(id);
            if (sel) sel.value = '';
          });
          const terrSel = document.getElementById('territory-select');
          if (terrSel) terrSel.value = '';
        }

        // Show/hide territory select and event subtype group
        _syncModeUI(mode);

        _triggerRender();
      });
    }

    // ── Event Subtype select ───────────────────────────────────
    const subtypeSel = document.getElementById('event-subtype-select');
    if (subtypeSel) {
      subtypeSel.addEventListener('change', function () {
        window.NullCorps.state.eventSubtype = this.value;
        _triggerRender();
      });
    }
  }

  /**
   * Show/hide territory select & event subtype group depending on mode.
   * Also disables the territory select when not in territory mode.
   * In char-skill mode, HP and SHD inputs switch to text type.
   */
  function _syncModeUI(mode) {
    const terrSel        = document.getElementById('territory-select');
    const subtypeGroup   = document.getElementById('event-subtype-group');
    const terrGroup      = terrSel ? terrSel.closest('.field-group') : null;

    if (subtypeGroup) {
      subtypeGroup.style.display = (mode === 'event') ? '' : 'none';
    }
    if (terrSel) {
      terrSel.disabled = (mode !== 'territory' && mode !== 'char-skill');
      if (terrGroup) {
        terrGroup.style.opacity = (mode !== 'territory' && mode !== 'char-skill') ? '0.4' : '';
      }
    }

    // Char. Skill mode: HP and SHD become free-text inputs
    const hpInput  = document.getElementById('stat-hp');
    const shdInput = document.getElementById('stat-shd');
    const hpLabel  = document.getElementById('label-stat-hp');
    const shdLabel = document.getElementById('label-stat-shd');
    if (hpInput && shdInput) {
      if (mode === 'char-skill') {
        hpInput.type  = 'text';
        shdInput.type = 'text';
        hpInput.removeAttribute('min');
        shdInput.removeAttribute('min');
        hpInput.removeAttribute('inputmode');
        shdInput.removeAttribute('inputmode');
        hpInput.removeAttribute('pattern');
        shdInput.removeAttribute('pattern');
        if (hpLabel)  hpLabel.textContent  = 'Exchange Skill 1';
        if (shdLabel) shdLabel.textContent = 'Exchange Skill 2';
      } else {
        hpInput.type  = 'number';
        shdInput.type = 'number';
        hpInput.setAttribute('min', '0');
        shdInput.setAttribute('min', '0');
        hpInput.setAttribute('inputmode', 'numeric');
        shdInput.setAttribute('inputmode', 'numeric');
        hpInput.setAttribute('pattern', '[0-9]*');
        shdInput.setAttribute('pattern', '[0-9]*');
        if (hpLabel)  hpLabel.textContent  = 'HP';
        if (shdLabel) shdLabel.textContent = 'SHD';
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     PRESET HELPERS
     Expose territory + energy data so js/presets.js can
     serialise and restore full card state.
  ══════════════════════════════════════════════════════════════ */

  /**
   * Return a territory object by name, or null if not found.
   * Used by presets.js when loading a saved preset.
   */
  function getTerritoryByName(name) {
    return TERRITORIES.find(t => t.name === name) ?? null;
  }

  /**
   * Return an energy object by slug, or null.
   */
  function getEnergyBySlug(slug) {
    return ENERGIES.find(e => e.slug === slug) ?? null;
  }

  /**
   * Return an energy object by display name, or null.
   */
  function getEnergyByName(name) {
    return ENERGIES.find(e => e.name === name) ?? null;
  }

  /** Visually sync the card-mode buttons to a given mode string. */
  function _syncCardModeBtns(mode) {
    const modeRow = document.getElementById('card-mode-row');
    if (!modeRow) return;
    modeRow.querySelectorAll('.btn-mode').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */

  function init() {
    _populateTerritorySelect();
    _populateEnergySelects();
    _wireEvents();
    // Sync UI to initial state (default: territory mode)
    const initialMode = window.NullCorps.state.cardMode || 'territory';
    _syncModeUI(initialMode);
    _syncCardModeBtns(initialMode);
  }

  /* ── Expose public API on NullCorps namespace ── */
  window.NullCorps.territories = {
    init,
    applyTerritory,
    getTerritoryByName,
    getEnergyBySlug,
    getEnergyByName,
    syncCardModeBtns: _syncCardModeBtns,
    syncModeUI:       _syncModeUI,
    TERRITORIES,   // full data — exposed for presets.js and future use
    ENERGIES,
  };

  /* ── Auto-init when DOM is ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
