// src/core/ui.js

//import { Miniplayer } from '../plugins/miniplayer.js';

const UI = {
    // Local State for Synchronous Settings (Visuals/Toggles)
    settings: {
        miniplayerEnabled: localStorage.getItem('bf_miniplayer_enabled') === 'true',
        customCSS: localStorage.getItem('bf_custom_css') || '',
        remoteThemeUrl: localStorage.getItem('bf_theme_url') || '',

        themeMode: localStorage.getItem('bf_theme_mode') || 'custom',
        themeFlavor: localStorage.getItem('bf_theme_flavor') || 'mocha',
        themeAccent: localStorage.getItem('bf_theme_accent') || 'mauve',
    },

    // --- Initialization ---

    init() {
        console.log('BetterFansly: UI Initialized');

        // 1. Load Built-in Plugins
        if (this.settings.miniplayerEnabled && typeof Miniplayer !== 'undefined') {
            Miniplayer.enable();
        }

        if (localStorage.getItem('bf_mutual_enabled') === 'true' && typeof MutualIndicator !== 'undefined') {
            MutualIndicator.enable();
        }

        if (typeof KeywordMuter !== 'undefined') {
            KeywordMuter.enable();
        }

        if (typeof GhostMode !== 'undefined') {
            // We inject it once, the script internally checks the toggle status
            GhostMode.injectInterceptor();
        }

        this.applyTheme();
    },

    // --- Theme Engine ---

    applyTheme() {
        // cleanup old tags
        document.getElementById('bf-custom-css-tag')?.remove();
        document.getElementById('bf-remote-theme-tag')?.remove();
        document.getElementById('bf-preset-theme-tag')?.remove();

        if (this.settings.themeMode !== 'custom' && window.BF_Themes && window.BF_Themes[this.settings.themeMode]) {
            const theme = window.BF_Themes[this.settings.themeMode];
            const css = theme.generateCSS(this.settings.themeFlavor, this.settings.themeAccent);

            const style = document.createElement('style');
            style.id = 'bf-preset-theme-tag';
            style.textContent = css;
            document.head.appendChild(style);
        }

        // Inject Custom CSS
        else {
            if (this.settings.customCSS) {
                const style = document.createElement('style');
                style.id = 'bf-custom-css-tag';
                style.textContent = this.settings.customCSS;
                document.head.appendChild(style);
            }
            if (this.settings.remoteThemeUrl) {
                const link = document.createElement('link');
                link.id = 'bf-remote-theme-tag';
                link.rel = 'stylesheet';
                link.href = this.settings.remoteThemeUrl;
                document.head.appendChild(link);
            }
        }
    },

    // --- Main UI Renderer ---

    openMenu() {
        const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');
        if (document.getElementById('bf-backdrop')) return;

        // 1. Create Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'bf-backdrop';
        backdrop.className = 'bf-backdrop';

        // 2. Modal HTML Structure
        backdrop.innerHTML = `
            <div class="bf-modal" onclick="event.stopPropagation()">
                <!-- SIDEBAR -->
                <div class="bf-sidebar">
                    <div class="bf-sidebar-header">
                        <img src="${logoUrl}" style="width: 32px; height: 32px; margin-right: 10px;">
                        <span>BetterFansly</span>
                    </div>
                    
                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:10px 0 5px 10px; text-transform:uppercase;">User</div>
                    <button class="bf-tab-btn active" data-tab="plugins">Plugins</button>
                    <button class="bf-tab-btn" data-tab="themes">Themes</button>

                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:15px 0 5px 10px; text-transform:uppercase;">Tools</div>
                    <button class="bf-tab-btn" data-tab="data">Backup & Migration</button>
                    <button class="bf-tab-btn" data-tab="spending">Spending Tracker</button>
                    <button class="bf-tab-btn" data-tab="filters">Filters</button>
                    
                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:15px 0 5px 10px; text-transform:uppercase;">Advanced</div>
                    <button class="bf-tab-btn" data-tab="library">Library</button>

                    <div style="margin-top: 10px; border-top: 1px solid #313244; margin-bottom: 10px;"></div>
                    <button class="bf-tab-btn" data-tab="about"><i class="fas fa-info-circle"></i> About</button>
                    
                    <div style="flex:1"></div>
                    <button class="bf-tab-btn" id="bf-close-btn" style="color: #f38ba8;">
                        <i class="fa-fw fas fa-times"></i> Close
                    </button>
                </div>

                <!-- CONTENT AREA -->
                <div class="bf-content" id="bf-tab-content">
                    <!-- Loaded via JS -->
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // 3. Event Listeners
        const close = () => backdrop.remove();
        backdrop.onclick = close; // Click outside
        document.getElementById('bf-close-btn').onclick = close;

        // Tab Switching Logic
        const tabs = backdrop.querySelectorAll('.bf-tab-btn[data-tab]');
        tabs.forEach(t => {
            t.onclick = () => {
                // Update Sidebar UI
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');

                // Render Content
                this.renderTab(t.dataset.tab);
            };
        });

        // Initial Render
        this.renderTab('plugins');
    },

    // --- Tab Router ---

    renderTab(tabName) {
        const container = document.getElementById('bf-tab-content');
        container.innerHTML = ''; // Clear current content

        switch (tabName) {
            case 'plugins':
                this.renderPluginsTab(container);
                break;
            case 'themes':
                this.renderThemesTab(container);
                break;
            case 'library':
                this.renderLibraryTab(container);
                break;
            case 'data':
                this.renderDataTab(container);
                break;
            case 'spending':
                this.renderSpendingTab(container);
                break;
            case 'filters':
                this.renderFiltersTab(container);
                break;
            case 'about':
                this.renderAboutTab(container);
                break;
            default:
                container.innerHTML = '<div>Tab not found</div>';
        }
    },

    // --- Tab: Plugins (Built-in) ---

    renderPluginsTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Core Plugins</div>
            <div class="bf-description">Essential features built into BetterFansly.</div>
            
            <!-- Miniplayer -->
            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Stream Miniplayer</div>
                    <div style="font-size:12px; color:#aaa;">PiP mode, draggable player, auto-quality selector.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-miniplayer" ${this.settings.miniplayerEnabled ? 'checked' : ''}>
            </div>

            <!-- Mutual Indicator -->
            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Mutual Indicator</div>
                    <div style="font-size:12px; color:#aaa;">Shows a "Follows You" badge next to usernames.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-mutual" ${localStorage.getItem('bf_mutual_enabled') === 'true' ? 'checked' : ''}>
            </div>

            <!-- Ghost Mode (NEW) -->
            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Ghost Mode 👻</div>
                    <div style="font-size:12px; color:#aaa;">Read messages and view stories without sending receipts.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-ghost" ${localStorage.getItem('bf_ghost_mode') === 'true' ? 'checked' : ''}>
            </div>
        `;

        // Bind Toggle
        document.getElementById('toggle-miniplayer').onchange = (e) => {
            this.settings.miniplayerEnabled = e.target.checked;
            localStorage.setItem('bf_miniplayer_enabled', e.target.checked);

            if (typeof Miniplayer !== 'undefined') {
                e.target.checked ? Miniplayer.enable() : Miniplayer.disable();
            }
        };

        // Bind Mutual Toggle
        document.getElementById('toggle-mutual').onchange = (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('bf_mutual_enabled', enabled);
            if (typeof MutualIndicator !== 'undefined') {
                enabled ? MutualIndicator.enable() : MutualIndicator.disable();
            }
        };

        document.getElementById('toggle-ghost').onchange = (e) => {
            if (e.target.checked) {
                GhostMode.enable();
            } else {
                GhostMode.disable();
            }
        };
    },

    // --- Tab: Themes ---

    renderThemesTab(container) {
        // Get Registered Themes
        const themes = window.BF_Themes || {};
        const themeOptions = Object.keys(themes).map(key =>
            `<option value="${key}">${themes[key].name}</option>`
        ).join('');

        container.innerHTML = `
            <div class="bf-section-title">Appearance</div>
            
            <div class="bf-plugin-card" style="display:block;">
                <label style="font-weight:bold;">Theme Mode</label>
                <select id="theme-mode-select" class="bf-input" style="margin-top:5px;">
                    <option value="custom">Custom (CSS / URL)</option>
                    ${themeOptions}
                </select>
            </div>

            <!-- PRESET CONTROLS (Dynamic) -->
            <div id="preset-controls" style="display:none; margin-top:20px;">
                <div class="bf-plugin-card" style="display:block;">
                    <div style="margin-bottom:15px;">
                        <label style="font-weight:bold; font-size:12px;">Flavor / Variant</label>
                        <select id="theme-flavor" class="bf-input"></select>
                    </div>
                    <div>
                        <label style="font-weight:bold; font-size:12px;">Accent Color</label>
                        <select id="theme-accent" class="bf-input"></select>
                    </div>
                </div>
            </div>

            <!-- CUSTOM CONTROLS -->
            <div id="custom-controls" style="display:none; margin-top:20px;">
                <div style="margin-bottom: 20px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Remote Theme URL</label>
                    <input type="text" class="bf-input" id="theme-url-input" placeholder="https://..." value="${this.settings.remoteThemeUrl}">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="font-weight:bold; display:block; margin-bottom:5px;">Custom CSS</label>
                    <textarea class="bf-input" id="custom-css-input" rows="10">${this.settings.customCSS}</textarea>
                </div>
            </div>

            <button class="bf-btn" id="save-theme-btn" style="margin-top:20px; width:100%;">Save & Apply</button>
        `;

        const modeSelect = document.getElementById('theme-mode-select');
        const presetControls = document.getElementById('preset-controls');
        const customControls = document.getElementById('custom-controls');
        const flavorSelect = document.getElementById('theme-flavor');
        const accentSelect = document.getElementById('theme-accent');

        modeSelect.value = this.settings.themeMode;

        // Function to populate dropdowns based on selected theme
        const updateDropdowns = () => {
            const selectedTheme = themes[modeSelect.value];
            if (selectedTheme) {
                // Populate Flavors
                flavorSelect.innerHTML = selectedTheme.options.flavors.map(f =>
                    `<option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>`
                ).join('');
                flavorSelect.value = this.settings.themeFlavor; // Restore saved selection if valid

                // Populate Accents
                accentSelect.innerHTML = selectedTheme.options.accents.map(a =>
                    `<option value="${a}">${a.charAt(0).toUpperCase() + a.slice(1)}</option>`
                ).join('');
                accentSelect.value = this.settings.themeAccent;

                presetControls.style.display = 'block';
                customControls.style.display = 'none';
            } else {
                presetControls.style.display = 'none';
                customControls.style.display = 'block';
            }
        };

        modeSelect.onchange = updateDropdowns;
        updateDropdowns(); // Init

        // Save Handler
        document.getElementById('save-theme-btn').onclick = () => {
            this.settings.themeMode = modeSelect.value;

            if (this.settings.themeMode === 'custom') {
                this.settings.remoteThemeUrl = document.getElementById('theme-url-input').value;
                this.settings.customCSS = document.getElementById('custom-css-input').value;
                localStorage.setItem('bf_theme_url', this.settings.remoteThemeUrl);
                localStorage.setItem('bf_custom_css', this.settings.customCSS);
            } else {
                this.settings.themeFlavor = flavorSelect.value;
                this.settings.themeAccent = accentSelect.value;
                localStorage.setItem('bf_theme_flavor', this.settings.themeFlavor);
                localStorage.setItem('bf_theme_accent', this.settings.themeAccent);
            }

            localStorage.setItem('bf_theme_mode', this.settings.themeMode);
            this.applyTheme();

            const btn = document.getElementById('save-theme-btn');
            btn.innerText = 'Saved!';
            setTimeout(() => btn.innerText = 'Save & Apply', 2000);
        };
    },

    renderDataTab(container) {
        container.innerHTML = `
            <div class="bf-section-title"> Account Backup & Migration </div >
            <div class="bf-description">Export your followed creators to a file, or import them to a new account.</div>

            <!-- EXPORT SECTION -->
            <div class="bf-plugin-card" style="display:block;">
                <div style="font-weight:bold; margin-bottom:5px;">Export Following List</div>
                <div style="font-size:12px; color:#aaa; margin-bottom:15px;">
                    Scrapes your "Following" list and "Subscriptions", grabs their usernames, and saves as JSON.
                </div>
                <button class="bf-btn" id="btn-export">
                    <i class="fas fa-download"></i> Start Export
                </button>
                <div id="export-status" style="margin-top:10px; font-size:12px; color:#a855f7;"></div>
            </div>

            <!-- IMPORT SECTION -->
            <div class="bf-plugin-card" style="display:block; margin-top:20px;">
                <div style="font-weight:bold; margin-bottom:5px;">Import Following List</div>
                <div style="font-size:12px; color:#aaa; margin-bottom:15px;">
                    Restores follows from a JSON file. <br>
                        <span style="color:#f38ba8;">Warning: This takes time (approx 1.5s per user) to avoid account bans.</span>
                </div>

                <input type="file" id="import-file" accept=".json" style="background:#111; color:#fff; padding:5px; border-radius:4px; border:1px solid #444; width:100%;">

                    <button class="bf-btn" id="btn-import" style="margin-top:10px; background:#45475a; cursor:not-allowed;" disabled>
                        <i class="fas fa-upload"></i> Start Import
                    </button>

                    <div id="import-progress" style="margin-top:10px; font-size:12px; color:#a855f7;"></div>

                    <!-- Results Log -->
                    <textarea id="import-log" class="bf-input" rows="5" style="display:none; margin-top:10px; font-family:monospace; font-size:11px;" readonly></textarea>
            </div>
        `;

        // --- EXPORT HANDLER ---
        document.getElementById('btn-export').onclick = async () => {
            const status = document.getElementById('export-status');
            const btn = document.getElementById('btn-export');

            btn.disabled = true;
            btn.style.opacity = '0.5';

            try {
                const data = await BackupTools.exportFollowing((msg) => {
                    status.innerText = msg;
                });

                // Download File
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fansly_backup_${data.exported_by}_${Date.now()}.json`;
                a.click();

                status.innerText = `✅ Export Complete!(${data.accounts.length
                    } accounts)`;
            } catch (e) {
                status.innerText = "❌ Error: " + e.message;
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        };

        // --- FILE SELECTION HANDLER ---
        const fileInput = document.getElementById('import-file');
        const importBtn = document.getElementById('btn-import');

        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                importBtn.disabled = false;
                importBtn.style.background = '#a855f7';
                importBtn.style.cursor = 'pointer';
            }
        };

        // --- IMPORT HANDLER ---
        importBtn.onclick = async () => {
            const file = fileInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!json.accounts || !Array.isArray(json.accounts)) throw new Error("Invalid Backup File");

                    if (!confirm(`Ready to import ${json.accounts.length} accounts ?\nThis will take about ${(json.accounts.length * 1.5 / 60).toFixed(1)} minutes.`)) return;

                    // UI Setup
                    importBtn.disabled = true;
                    importBtn.style.opacity = '0.5';
                    const prog = document.getElementById('import-progress');
                    const log = document.getElementById('import-log');
                    log.style.display = 'block';
                    log.value = "Starting import process...\n";

                    // Run Import
                    const result = await BackupTools.importFollowing(json.accounts, (msg) => {
                        prog.innerText = msg;
                    });

                    // Final Report
                    prog.innerText = `✅ Done! Success: ${result.success} | Failed: ${result.failed} `;

                    log.value += `\n-- - REPORT-- -\n`;
                    log.value += `Total: ${result.total} \nSuccess: ${result.success} \nFailed: ${result.failed} \n`;
                    if (result.errors.length > 0) {
                        log.value += "\nFailures:\n" + result.errors.join('\n');
                    }

                } catch (err) {
                    alert("Error reading file: " + err.message);
                } finally {
                    importBtn.disabled = false;
                    importBtn.style.opacity = '1';
                }
            };
            reader.readAsText(file);
        };
    },

    renderSpendingTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Spending Tracker</div>
            <div class="bf-description">Analyze your purchase history across all creators.</div>

            <div class="bf-plugin-card" style="display:block; text-align:center; padding: 40px;">
                <i class="fas fa-chart-pie" style="font-size: 40px; color: #a855f7; margin-bottom: 20px;"></i>
                <div style="margin-bottom: 20px;">
                    Click below to scan your transaction history.<br>
                    <span style="font-size:12px; color:#aaa;">(This scans local API data, nothing is sent to external servers)</span>
                </div>
                <button class="bf-btn" id="btn-scan-spending">Scan History</button>
                <div id="spending-status" style="margin-top:15px; color:#a855f7; font-size:13px;"></div>
            </div>

            <!-- Results Container (Hidden initially) -->
            <div id="spending-results" style="display:none; animation: fadeIn 0.5s;">
                
                <!-- KPI Cards -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                    <div style="background:#111; padding:15px; border-radius:8px; border:1px solid #333; text-align:center;">
                        <div style="font-size:12px; color:#aaa;">Total Spent</div>
                        <div id="kpi-total" style="font-size:24px; font-weight:bold; color:#a855f7;">$0.00</div>
                    </div>
                    <div style="background:#111; padding:15px; border-radius:8px; border:1px solid #333; text-align:center;">
                        <div style="font-size:12px; color:#aaa;">Transactions</div>
                        <div id="kpi-count" style="font-size:24px; font-weight:bold; color:#fff;">0</div>
                    </div>
                </div>

                <div style="background:#111; padding:10px; border-radius:8px; border:1px solid #333; margin-bottom:20px; text-align:center; font-size:12px; color:#ccc;">
                    Timeline: <span id="kpi-timeline" style="color:#fff; font-weight:bold;">-</span>
                </div>

                <!-- Top Creators List -->
                <div class="bf-section-title" style="font-size:14px;">Top Creators</div>
                <div id="top-creators-list" style="max-height: 300px; overflow-y: auto; background:#111; border:1px solid #333; border-radius:8px; margin-bottom:20px;">
                    <!-- List items injected here -->
                </div>

                <!-- Yearly Breakdown -->
                <div class="bf-section-title" style="font-size:14px;">Yearly Breakdown</div>
                <div id="year-breakdown" style="display:flex; gap:10px; flex-wrap:wrap;"></div>
            </div>
        `;

        document.getElementById('btn-scan-spending').onclick = async () => {
            const btn = document.getElementById('btn-scan-spending');
            const status = document.getElementById('spending-status');
            const results = document.getElementById('spending-results');

            btn.disabled = true;
            btn.style.opacity = '0.5';
            results.style.display = 'none';

            try {
                const data = await SpendingTracker.analyzeSpending((msg) => {
                    status.innerText = msg;
                });

                if (!data) {
                    status.innerText = "No payment history found.";
                    return;
                }

                // Render Results
                document.getElementById('kpi-total').innerText = SpendingTracker.formatMoney(data.total);
                document.getElementById('kpi-count').innerText = data.count;
                document.getElementById('kpi-timeline').innerText = `${SpendingTracker.formatDate(data.firstDate)} — ${SpendingTracker.formatDate(data.lastDate)}`;

                // Render Top Creators
                const list = document.getElementById('top-creators-list');
                list.innerHTML = '';
                data.byAccount.forEach((acc, index) => {
                    const row = document.createElement('div');
                    row.style.padding = '10px';
                    row.style.borderBottom = '1px solid #222';
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';

                    // Simple "Bar Chart" background effect
                    const percent = (acc.total / data.total) * 100;
                    row.style.background = `linear-gradient(90deg, rgba(168, 85, 247, 0.1) ${percent}%, transparent ${percent}%)`;

                    row.innerHTML = `
                        <div>
                            <span style="color:#aaa; font-size:11px; margin-right:8px;">#${index + 1}</span>
                            <span style="font-weight:bold;">@${acc.name}</span>
                        </div>
                        <div style="font-family:monospace;">${SpendingTracker.formatMoney(acc.total)}</div>
                    `;
                    list.appendChild(row);
                });

                // Render Years
                const yearsContainer = document.getElementById('year-breakdown');
                yearsContainer.innerHTML = '';
                Object.entries(data.byYear).forEach(([year, cents]) => {
                    const tag = document.createElement('div');
                    tag.style.background = '#1e1e2e';
                    tag.style.padding = '8px 12px';
                    tag.style.borderRadius = '6px';
                    tag.style.border = '1px solid #444';
                    tag.innerHTML = `
                        <div style="font-size:11px; color:#aaa;">${year}</div>
                        <div style="font-weight:bold; color:#a855f7;">${SpendingTracker.formatMoney(cents / 100)}</div>
                    `;
                    yearsContainer.appendChild(tag);
                });

                status.innerText = "";
                results.style.display = 'block';

            } catch (e) {
                status.innerText = "Error: " + e.message;
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.innerText = "Re-Scan";
            }
        };
    },

    renderFiltersTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Keyword Muter</div>
            <div class="bf-description">Hide posts that contain specific words or phrases.</div>

            <div class="bf-plugin-card" style="display:block;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <input type="text" id="mute-input" class="bf-input" placeholder="Enter keyword (e.g. 'anal')" style="margin:0;">
                    <button class="bf-btn" id="mute-add-btn" style="margin:0;">Add</button>
                </div>
                
                <div style="font-size:12px; font-weight:bold; margin-bottom:10px;">Active Muted Words:</div>
                
                <div id="mute-list" style="display:flex; flex-wrap:wrap; gap:8px; min-height:50px; background:#111; padding:10px; border-radius:6px; align-items: flex-start;"></div>
            </div>
        `;

        const renderList = () => {
            const list = document.getElementById('mute-list');
            list.innerHTML = '';
            const keywords = KeywordMuter.keywords || [];

            if (keywords.length === 0) {
                list.innerHTML = '<span style="color:#555; font-style:italic; padding: 5px;">No keywords added.</span>';
                return;
            }

            keywords.forEach((word, idx) => {
                const tag = document.createElement('div');

                Object.assign(tag.style, {
                    background: '#f38ba8', // Red/Pink
                    color: '#1e1e2e',      // Dark Text
                    padding: '6px 12px',   // More horizontal padding
                    borderRadius: '20px',  // Fully rounded pill
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',       // Align text and X icon
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'transform 0.1s',
                    userSelect: 'none'
                });

                tag.title = 'Click to remove';
                tag.innerHTML = `
                    <span>${word}</span>
                    <i class="fas fa-times" style="font-size: 11px; opacity: 0.7;"></i>
                `;

                // Hover effect
                tag.onmouseover = () => tag.style.opacity = '0.9';
                tag.onmouseout = () => tag.style.opacity = '1';

                tag.onclick = () => {
                    keywords.splice(idx, 1);
                    KeywordMuter.updateKeywords(keywords);
                    renderList();
                };
                list.appendChild(tag);
            });
        };

        document.getElementById('mute-add-btn').onclick = () => {
            const input = document.getElementById('mute-input');
            const word = input.value.trim();
            if (word) {
                const current = KeywordMuter.keywords || [];
                // Prevent empty or duplicate words
                if (!current.some(w => w.toLowerCase() === word.toLowerCase())) {
                    current.push(word);
                    KeywordMuter.updateKeywords(current);
                    if (!KeywordMuter.isActive) KeywordMuter.enable();
                }
                input.value = '';
                renderList();
            }
        };

        // Allow pressing "Enter" to add
        document.getElementById('mute-input').onkeypress = (e) => {
            if (e.key === 'Enter') document.getElementById('mute-add-btn').click();
        };

        renderList();
    },

    // --- Tab: Library (Custom Plugins) ---

    async renderLibraryTab(container) {
        container.innerHTML = `
    <div class="bf-section-title"> Plugin Library </div>
            <div class="bf-description">
                <i class="fas fa-triangle-exclamation" style="color:#fab387"></i> 
                Warning: Only install scripts from sources you trust. Malicious scripts can steal your account.
            </div>

            <!-- Add New Plugin Area -->
            <details style="margin-bottom: 20px; background: #11111b; padding: 10px; border-radius: 8px;">
                <summary style="cursor:pointer; font-weight:bold;">+ Add New Plugin</summary>
                <div style="margin-top: 10px;">
                    <input type="text" id="cp-name" class="bf-input" placeholder="Plugin Name (e.g. Media Downloader)">
                    <textarea id="cp-code" class="bf-input" rows="8" placeholder="// Paste JavaScript code here..."></textarea>
                    <button class="bf-btn" id="cp-install-btn">Install Plugin</button>
                </div>
            </details>

            <!--List -->
            <div class="bf-section-title" style="font-size:14px; margin-top:20px;">Installed Plugins</div>
            <div id="cp-list" style="display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; padding:20px; color:#aaa;">Loading...</div>
            </div>
`;

        // 1. Install Handler
        document.getElementById('cp-install-btn').onclick = async () => {
            const name = document.getElementById('cp-name').value.trim();
            const code = document.getElementById('cp-code').value.trim();
            if (!name || !code) return alert("Name and Code are required.");

            const newPlugin = { id: 'plugin_' + Date.now(), name, code, enabled: true };

            // Save to chrome.storage
            const data = await chrome.storage.local.get('bf_plugins');
            const plugins = data.bf_plugins || [];
            plugins.push(newPlugin);
            await chrome.storage.local.set({ bf_plugins: plugins });

            // Notify Background to Register
            chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });

            // Reset Form & Refresh List
            document.getElementById('cp-name').value = '';
            document.getElementById('cp-code').value = '';
            this.refreshLibraryList();
        };

        // 2. Initial List Load
        this.refreshLibraryList();
    },

    async refreshLibraryList() {
        const listContainer = document.getElementById('cp-list');
        const data = await chrome.storage.local.get('bf_plugins');
        const plugins = data.bf_plugins || [];

        if (plugins.length === 0) {
            listContainer.innerHTML = '<div style="color:#6c7086; font-style:italic;">No custom plugins installed.</div>';
            return;
        }

        listContainer.innerHTML = '';

        plugins.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = 'bf-plugin-card';
            card.innerHTML = `
    < div style = "flex:1; padding-right:10px;" >
                    <div style="font-weight:bold;">${p.name}</div>
                    <div style="font-size:10px; color:#6c7086; font-family:monospace;">ID: ${p.id}</div>
                </div >
    <div style="display:flex; align-items:center; gap:10px;">
        <input type="checkbox" class="bf-toggle" id="toggle-${p.id}" ${p.enabled ? 'checked' : ''}>
            <button class="bf-btn" id="del-${p.id}" style="background:#f38ba8; padding:5px 10px; font-size:12px;">
                <i class="fas fa-trash"></i>
            </button>
    </div>
`;
            listContainer.appendChild(card);

            // Toggle Logic
            card.querySelector(`#toggle - ${p.id} `).onchange = async (e) => {
                plugins[index].enabled = e.target.checked;
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
            };

            // Delete Logic
            card.querySelector(`#del - ${p.id} `).onclick = async () => {
                if (!confirm(`Delete plugin "${p.name}" ? `)) return;
                plugins.splice(index, 1); // remove from array
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
                this.refreshLibraryList(); // refresh UI
            };
        });
    },

    renderAboutTab(container) {
        const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');
        const manifest = chrome.runtime.getManifest();

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
                
                <img src="${logoUrl}" style="width: 80px; height: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5));">
                
                <div style="font-size: 32px; font-weight: bold; background: linear-gradient(45deg, #a855f7, #f5c2e7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    BetterFansly
                </div>
                
                <div style="color: #6c7086; margin-top: 5px; font-family: monospace;">v${manifest.version}</div>

                <div style="margin-top: 30px; max-width: 400px; color: #cdd6f4; line-height: 1.6;">
                    A power-user client modification for Fansly. <br>
                    Enhancing the experience with themes, utilities, and privacy tools.
                </div>

                <div style="margin-top: 40px; display: flex; gap: 15px;">
                    <a href="https://github.com/BetterFansly" target="_blank" class="bf-btn" style="text-decoration: none; background: #181825; border: 1px solid #313244;">
                        <i class="fab fa-github"></i> GitHub
                    </a>
                    <a href="#" class="bf-btn" style="text-decoration: none; background: #181825; border: 1px solid #313244;" onclick="alert('Join the Discord (Placeholder)'); return false;">
                        <i class="fab fa-discord"></i> Discord
                    </a>
                </div>

                <div style="margin-top: auto; padding-bottom: 10px; font-size: 11px; color: #45475a;">
                    Not affiliated with Fansly. Use at your own risk.
                </div>
            </div>
        `;
    }
};
