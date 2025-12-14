// src/core/ui.js

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
            GhostMode.injectInterceptor();
        }

        if (localStorage.getItem('bf_translator_enabled') === 'true' && typeof Translator !== 'undefined') {
            Translator.targetLang = localStorage.getItem('bf_translator_lang') || 'en';
            Translator.enable();
        }

        if (localStorage.getItem('bf_oneko_enabled') === 'true' && typeof Oneko !== 'undefined') {
            Oneko.enable();
        }

        this.applyTheme();
    },

    // --- Theme Engine ---

    applyTheme() {
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

        const backdrop = document.createElement('div');
        backdrop.id = 'bf-backdrop';
        backdrop.className = 'bf-backdrop';

        // Removed hardcoded colors from HTML, relying on CSS classes
        backdrop.innerHTML = `
            <div class="bf-modal" onclick="event.stopPropagation()">
                <!-- SIDEBAR -->
                <div class="bf-sidebar">
                    <div class="bf-sidebar-header">
                        <img src="${logoUrl}" style="width: 32px; height: 32px; margin-right: 10px;">
                        <span>BetterFansly</span>
                    </div>
                    
                    <div class="bf-sidebar-label">User</div>
                    <button class="bf-tab-btn active" data-tab="plugins">Plugins</button>
                    <button class="bf-tab-btn" data-tab="themes">Themes</button>

                    <div class="bf-sidebar-label">Tools</div>
                    <button class="bf-tab-btn" data-tab="data">Backup & Migration</button>
                    <button class="bf-tab-btn" data-tab="spending">Spending Tracker</button>
                    <button class="bf-tab-btn" data-tab="filters">Filters</button>
                    
                    <div class="bf-sidebar-label">Advanced</div>
                    <button class="bf-tab-btn" data-tab="library">Library</button>

                    <div style="margin-top: 10px; border-top: 1px solid var(--bf-border); margin-bottom: 10px;"></div>
                    <button class="bf-tab-btn" data-tab="about"><i class="fas fa-info-circle"></i> About</button>
                    
                    <div style="flex:1"></div>
                    <button class="bf-tab-btn" id="bf-close-btn" style="color: var(--bf-subtext);">
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

        const close = () => backdrop.remove();
        backdrop.onclick = close;
        document.getElementById('bf-close-btn').onclick = close;

        const tabs = backdrop.querySelectorAll('.bf-tab-btn[data-tab]');
        tabs.forEach(t => {
            t.onclick = () => {
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                this.renderTab(t.dataset.tab);
            };
        });

        this.renderTab('plugins');
    },

    renderTab(tabName) {
        const container = document.getElementById('bf-tab-content');
        container.innerHTML = '';

        switch (tabName) {
            case 'plugins': this.renderPluginsTab(container); break;
            case 'themes': this.renderThemesTab(container); break;
            case 'library': this.renderLibraryTab(container); break;
            case 'data': this.renderDataTab(container); break;
            case 'spending': this.renderSpendingTab(container); break;
            case 'filters': this.renderFiltersTab(container); break;
            case 'about': this.renderAboutTab(container); break;
            default: container.innerHTML = '<div>Tab not found</div>';
        }
    },

    // --- Tab: Plugins ---

    renderPluginsTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Core Plugins</div>
            <div class="bf-description">Essential features built into BetterFansly.</div>
            
            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Stream Miniplayer</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">PiP mode, draggable player, auto-quality selector.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-miniplayer" ${this.settings.miniplayerEnabled ? 'checked' : ''}>
            </div>

            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Mutual Indicator</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">Shows a "Follows You" badge next to usernames.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-mutual" ${localStorage.getItem('bf_mutual_enabled') === 'true' ? 'checked' : ''}>
            </div>

            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Ghost Mode 👻</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">Stealthily read messages, view stories, and type without sending receipts.</div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-ghost" ${localStorage.getItem('bf_ghost_mode') === 'true' ? 'checked' : ''}>
            </div>

            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Chat Translator</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">
                        Native translation for DMs, Feed posts, and Input bar.
                    </div>
                    <select id="translator-lang-select" class="bf-input" style="width: auto; margin-top: 5px; font-size: 11px; padding: 2px;">
                        <option value="en">To English</option>
                        <option value="es">To Spanish</option>
                        <option value="fr">To French</option>
                        <option value="de">To German</option>
                        <option value="ru">To Russian</option>
                        <option value="zh-CN">To Chinese (Simplified)</option>
                        <option value="ja">To Japanese</option>
                        <option value="ko">To Korean</option>
                    </select>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-translator" ${localStorage.getItem('bf_translator_enabled') === 'true' ? 'checked' : ''}>
            </div>

            <div class="bf-plugin-card">
                <div>
                    <div style="font-weight:bold;">Oneko 🐈</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">
                        Adds a retro desktop cat that chases your cursor.
                    </div>
                </div>
                <input type="checkbox" class="bf-toggle" id="toggle-oneko" ${localStorage.getItem('bf_oneko_enabled') === 'true' ? 'checked' : ''}>
            </div>
        `;

        // Toggles Logic
        document.getElementById('toggle-miniplayer').onchange = (e) => {
            this.settings.miniplayerEnabled = e.target.checked;
            localStorage.setItem('bf_miniplayer_enabled', e.target.checked);
            if (typeof Miniplayer !== 'undefined') e.target.checked ? Miniplayer.enable() : Miniplayer.disable();
        };
        document.getElementById('toggle-mutual').onchange = (e) => {
            localStorage.setItem('bf_mutual_enabled', e.target.checked);
            if (typeof MutualIndicator !== 'undefined') e.target.checked ? MutualIndicator.enable() : MutualIndicator.disable();
        };
        document.getElementById('toggle-ghost').onchange = (e) => {
            e.target.checked ? GhostMode.enable() : GhostMode.disable();
        };
        document.getElementById('toggle-oneko').onchange = (e) => {
            localStorage.setItem('bf_oneko_enabled', e.target.checked);
            if (typeof Oneko !== 'undefined') e.target.checked ? Oneko.enable() : Oneko.disable();
        };

        // Translator Logic
        const transToggle = document.getElementById('toggle-translator');
        const transSelect = document.getElementById('translator-lang-select');
        const savedLang = localStorage.getItem('bf_translator_lang') || 'en';
        transSelect.value = savedLang;
        if (typeof Translator !== 'undefined') Translator.targetLang = savedLang;

        transToggle.onchange = (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('bf_translator_enabled', enabled);
            if (typeof Translator !== 'undefined') enabled ? Translator.enable() : Translator.disable();
        };
        transSelect.onchange = (e) => {
            const val = e.target.value;
            localStorage.setItem('bf_translator_lang', val);
            if (typeof Translator !== 'undefined') Translator.setTargetLang(val);
        };
    },

    // --- Tab: Themes ---

    renderThemesTab(container) {
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

        const updateDropdowns = () => {
            const selectedTheme = themes[modeSelect.value];
            if (selectedTheme) {
                flavorSelect.innerHTML = selectedTheme.options.flavors.map(f =>
                    `<option value="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</option>`
                ).join('');
                flavorSelect.value = this.settings.themeFlavor;

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
        updateDropdowns();

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

            <div class="bf-plugin-card" style="display:block;">
                <div style="font-weight:bold; margin-bottom:5px;">Export Following List</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom:15px;">
                    Scrapes your "Following" list and "Subscriptions", grabs their usernames, and saves as JSON.
                </div>
                <button class="bf-btn" id="btn-export">
                    <i class="fas fa-download"></i> Start Export
                </button>
                <div id="export-status" style="margin-top:10px; font-size:12px; color:var(--bf-accent);"></div>
            </div>

            <div class="bf-plugin-card" style="display:block; margin-top:20px;">
                <div style="font-weight:bold; margin-bottom:5px;">Import Following List</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom:15px;">
                    Restores follows from a JSON file. <br>
                    <span style="color:#f38ba8;">Warning: This takes time (approx 1.5s per user) to avoid account bans.</span>
                </div>

                <input type="file" id="import-file" accept=".json" class="bf-input">

                <button class="bf-btn" id="btn-import" style="margin-top:10px; opacity:0.5; cursor:not-allowed;" disabled>
                    <i class="fas fa-upload"></i> Start Import
                </button>

                <div id="import-progress" style="margin-top:10px; font-size:12px; color:var(--bf-accent);"></div>
                <textarea id="import-log" class="bf-input" rows="5" style="display:none; margin-top:10px; font-family:monospace; font-size:11px;" readonly></textarea>
            </div>
        `;

        // (Events for Backup tool remain same...)
        // --- EXPORT HANDLER ---
        document.getElementById('btn-export').onclick = async () => {
            const status = document.getElementById('export-status');
            const btn = document.getElementById('btn-export');
            btn.disabled = true;
            btn.style.opacity = '0.5';
            try {
                const data = await BackupTools.exportFollowing((msg) => { status.innerText = msg; });
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fansly_backup_${data.exported_by}_${Date.now()}.json`;
                a.click();
                status.innerText = `✅ Export Complete! (${data.accounts.length} accounts)`;
            } catch (e) {
                status.innerText = "❌ Error: " + e.message;
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        };

        // --- IMPORT HANDLER ---
        const fileInput = document.getElementById('import-file');
        const importBtn = document.getElementById('btn-import');
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                importBtn.disabled = false;
                importBtn.style.opacity = '1';
                importBtn.style.cursor = 'pointer';
            }
        };
        importBtn.onclick = async () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!json.accounts || !Array.isArray(json.accounts)) throw new Error("Invalid Backup File");
                    if (!confirm(`Ready to import ${json.accounts.length} accounts ?\nThis will take about ${(json.accounts.length * 1.5 / 60).toFixed(1)} minutes.`)) return;

                    importBtn.disabled = true;
                    importBtn.style.opacity = '0.5';
                    const prog = document.getElementById('import-progress');
                    const log = document.getElementById('import-log');
                    log.style.display = 'block';
                    log.value = "Starting import process...\n";

                    const result = await BackupTools.importFollowing(json.accounts, (msg) => { prog.innerText = msg; });
                    prog.innerText = `✅ Done! Success: ${result.success} | Failed: ${result.failed} `;
                    log.value += `\n--- REPORT ---\nTotal: ${result.total}\nSuccess: ${result.success}\nFailed: ${result.failed}\n`;
                    if (result.errors.length > 0) log.value += "\nFailures:\n" + result.errors.join('\n');
                } catch (err) { alert("Error reading file: " + err.message); }
                finally { importBtn.disabled = false; importBtn.style.opacity = '1'; }
            };
            reader.readAsText(file);
        };
    },

    renderSpendingTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Spending Tracker</div>
            <div class="bf-description">Analyze your purchase history across all creators.</div>

            <div class="bf-plugin-card" style="display:block; text-align:center; padding: 40px;">
                <i class="fas fa-chart-pie" style="font-size: 40px; color: var(--bf-accent); margin-bottom: 20px;"></i>
                <div style="margin-bottom: 20px;">
                    Click below to scan your transaction history.<br>
                    <span style="font-size:12px; color:var(--bf-subtext);">(This scans local API data, nothing is sent to external servers)</span>
                </div>
                <button class="bf-btn" id="btn-scan-spending">Scan History</button>
                <div id="spending-status" style="margin-top:15px; color:var(--bf-accent); font-size:13px;"></div>
            </div>

            <div id="spending-results" style="display:none; animation: fadeIn 0.5s;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                    <div style="background:var(--bf-card-bg); padding:15px; border-radius:8px; border:1px solid var(--bf-border); text-align:center;">
                        <div style="font-size:12px; color:var(--bf-subtext);">Total Spent</div>
                        <div id="kpi-total" style="font-size:24px; font-weight:bold; color:var(--bf-accent);">$0.00</div>
                    </div>
                    <div style="background:var(--bf-card-bg); padding:15px; border-radius:8px; border:1px solid var(--bf-border); text-align:center;">
                        <div style="font-size:12px; color:var(--bf-subtext);">Transactions</div>
                        <div id="kpi-count" style="font-size:24px; font-weight:bold; color:var(--bf-text);">0</div>
                    </div>
                </div>

                <div style="background:var(--bf-card-bg); padding:10px; border-radius:8px; border:1px solid var(--bf-border); margin-bottom:20px; text-align:center; font-size:12px; color:var(--bf-subtext);">
                    Timeline: <span id="kpi-timeline" style="color:var(--bf-text); font-weight:bold;">-</span>
                </div>

                <div class="bf-section-title" style="font-size:14px;">Top Creators</div>
                <div id="top-creators-list" style="max-height: 300px; overflow-y: auto; background:var(--bf-card-bg); border:1px solid var(--bf-border); border-radius:8px; margin-bottom:20px;">
                </div>

                <div class="bf-section-title" style="font-size:14px;">Yearly Breakdown</div>
                <div id="year-breakdown" style="display:flex; gap:10px; flex-wrap:wrap;"></div>
            </div>
        `;

        // (Spending logic from previous code...)
        document.getElementById('btn-scan-spending').onclick = async () => {
            const btn = document.getElementById('btn-scan-spending');
            const status = document.getElementById('spending-status');
            const results = document.getElementById('spending-results');
            btn.disabled = true; btn.style.opacity = '0.5'; results.style.display = 'none';

            try {
                const data = await SpendingTracker.analyzeSpending((msg) => { status.innerText = msg; });
                if (!data) { status.innerText = "No payment history found."; return; }

                document.getElementById('kpi-total').innerText = SpendingTracker.formatMoney(data.total);
                document.getElementById('kpi-count').innerText = data.count;
                document.getElementById('kpi-timeline').innerText = `${SpendingTracker.formatDate(data.firstDate)} — ${SpendingTracker.formatDate(data.lastDate)}`;

                const list = document.getElementById('top-creators-list');
                list.innerHTML = '';
                data.byAccount.forEach((acc, index) => {
                    const row = document.createElement('div');
                    row.style.padding = '10px';
                    row.style.borderBottom = '1px solid var(--bf-border)';
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    const percent = (acc.total / data.total) * 100;
                    row.style.background = `linear-gradient(90deg, rgba(168, 85, 247, 0.1) ${percent}%, transparent ${percent}%)`;
                    row.innerHTML = `<div><span style="color:var(--bf-subtext); font-size:11px; margin-right:8px;">#${index + 1}</span><span style="font-weight:bold;">@${acc.name}</span></div><div style="font-family:monospace;">${SpendingTracker.formatMoney(acc.total)}</div>`;
                    list.appendChild(row);
                });

                const yearsContainer = document.getElementById('year-breakdown');
                yearsContainer.innerHTML = '';
                Object.entries(data.byYear).forEach(([year, cents]) => {
                    const tag = document.createElement('div');
                    tag.style.background = 'var(--bf-card-bg)';
                    tag.style.padding = '8px 12px';
                    tag.style.borderRadius = '6px';
                    tag.style.border = '1px solid var(--bf-border)';
                    tag.innerHTML = `<div style="font-size:11px; color:var(--bf-subtext);">${year}</div><div style="font-weight:bold; color:var(--bf-accent);">${SpendingTracker.formatMoney(cents / 100)}</div>`;
                    yearsContainer.appendChild(tag);
                });
                status.innerText = "";
                results.style.display = 'block';
            } catch (e) { status.innerText = "Error: " + e.message; }
            finally { btn.disabled = false; btn.style.opacity = '1'; btn.innerText = "Re-Scan"; }
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
                <div id="mute-list" style="display:flex; flex-wrap:wrap; gap:8px; min-height:50px; background:var(--bf-card-bg); padding:10px; border-radius:6px; align-items: flex-start;"></div>
            </div>
        `;

        const renderList = () => {
            const list = document.getElementById('mute-list');
            list.innerHTML = '';
            const keywords = KeywordMuter.keywords || [];
            if (keywords.length === 0) {
                list.innerHTML = '<span style="color:var(--bf-subtext); font-style:italic; padding: 5px;">No keywords added.</span>';
                return;
            }
            keywords.forEach((word, idx) => {
                const tag = document.createElement('div');
                Object.assign(tag.style, {
                    background: '#f38ba8', color: '#1e1e2e',
                    padding: '6px 12px', borderRadius: '20px',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none'
                });
                tag.innerHTML = `<span>${word}</span><i class="fas fa-times" style="font-size: 11px; opacity: 0.7;"></i>`;
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
                if (!current.some(w => w.toLowerCase() === word.toLowerCase())) {
                    current.push(word);
                    KeywordMuter.updateKeywords(current);
                    if (!KeywordMuter.isActive) KeywordMuter.enable();
                }
                input.value = '';
                renderList();
            }
        };
        document.getElementById('mute-input').onkeypress = (e) => {
            if (e.key === 'Enter') document.getElementById('mute-add-btn').click();
        };
        renderList();
    },

    async renderLibraryTab(container) {
        container.innerHTML = `
            <div class="bf-section-title"> Plugin Library </div>
            <div class="bf-description">
                <i class="fas fa-triangle-exclamation" style="color:#fab387"></i> 
                Warning: Only install scripts from sources you trust. Malicious scripts can steal your account.
            </div>

            <details style="margin-bottom: 20px; background: var(--bf-card-bg); padding: 10px; border-radius: 8px;">
                <summary style="cursor:pointer; font-weight:bold;">+ Add New Plugin</summary>
                <div style="margin-top: 10px;">
                    <input type="text" id="cp-name" class="bf-input" placeholder="Plugin Name">
                    <textarea id="cp-code" class="bf-input" rows="8" placeholder="// Paste JavaScript code here..."></textarea>
                    <button class="bf-btn" id="cp-install-btn">Install Plugin</button>
                </div>
            </details>

            <div class="bf-section-title" style="font-size:14px; margin-top:20px;">Installed Plugins</div>
            <div id="cp-list" style="display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; padding:20px; color:var(--bf-subtext);">Loading...</div>
            </div>
        `;

        document.getElementById('cp-install-btn').onclick = async () => {
            const name = document.getElementById('cp-name').value.trim();
            const code = document.getElementById('cp-code').value.trim();
            if (!name || !code) return alert("Name and Code are required.");
            const newPlugin = { id: 'plugin_' + Date.now(), name, code, enabled: true };
            const data = await chrome.storage.local.get('bf_plugins');
            const plugins = data.bf_plugins || [];
            plugins.push(newPlugin);
            await chrome.storage.local.set({ bf_plugins: plugins });
            chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
            document.getElementById('cp-name').value = '';
            document.getElementById('cp-code').value = '';
            this.refreshLibraryList();
        };
        this.refreshLibraryList();
    },

    async refreshLibraryList() {
        const listContainer = document.getElementById('cp-list');
        const data = await chrome.storage.local.get('bf_plugins');
        const plugins = data.bf_plugins || [];

        if (plugins.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--bf-subtext); font-style:italic;">No custom plugins installed.</div>';
            return;
        }

        listContainer.innerHTML = '';
        plugins.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = 'bf-plugin-card';
            card.innerHTML = `
                <div style="flex:1; padding-right:10px;">
                    <div style="font-weight:bold;">${p.name}</div>
                    <div style="font-size:10px; color:var(--bf-subtext); font-family:monospace;">ID: ${p.id}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="bf-toggle" id="toggle-${p.id}" ${p.enabled ? 'checked' : ''}>
                    <button class="bf-btn" id="del-${p.id}" style="background:#f38ba8; padding:5px 10px; font-size:12px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(card);
            card.querySelector(`#toggle-${p.id}`).onchange = async (e) => {
                plugins[index].enabled = e.target.checked;
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
            };
            card.querySelector(`#del-${p.id}`).onclick = async () => {
                if (!confirm(`Delete plugin "${p.name}"?`)) return;
                plugins.splice(index, 1);
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
                this.refreshLibraryList();
            };
        });
    },

    renderAboutTab(container) {
        const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');
        const manifest = chrome.runtime.getManifest();

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 20px;">
                <img src="${logoUrl}" style="width: 80px; height: 80px; margin-bottom: 15px; filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.4));">
                <div style="font-size: 32px; font-weight: bold; background: linear-gradient(45deg, #a855f7, #f5c2e7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    BetterFansly
                </div>
                <div style="color: var(--bf-subtext); margin-top: 5px; font-family: monospace; font-size: 12px;">
                    v${manifest.version} — <span style="color: #a855f7;">A Notifansly Project</span>
                </div>
                <div style="margin-top: 25px; max-width: 420px; color: var(--bf-text); line-height: 1.5; font-size: 14px;">
                    Enhancing your Fansly experience with modular plugins, custom themes, and advanced privacy tools. 
                </div>
                <div style="margin-top: 30px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 15px; border-radius: 12px; max-width: 450px;">
                    <div style="font-weight: bold; color: #f5c2e7; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-robot"></i> Notifansly Discord Bot
                    </div>
                    <div style="font-size: 12px; color: #bac2de; margin-bottom: 10px;">
                        Are you a creator? Sync Discord roles with your followers/subscribers and get instant live notifications.
                    </div>
                    <a href="https://notifansly.xyz" target="_blank" style="color: #a855f7; font-size: 12px; font-weight: bold; text-decoration: none; border-bottom: 1px dashed #a855f7;">
                        Visit notifansly.xyz <i class="fas fa-external-link-alt" style="font-size: 10px;"></i>
                    </a>
                </div>
                <div style="margin-top: 30px; display: flex; gap: 12px;">
                    <a href="https://github.com/NotiFansly/BetterFansly" target="_blank" class="bf-btn" style="text-decoration: none; background: var(--bf-card-bg); border: 1px solid var(--bf-border); display: flex; align-items: center; gap: 8px;">
                        <i class="fab fa-github"></i> Source Code
                    </a>
                    <a href="https://discord.gg/WXr8Zd2Js7" class="bf-btn" style="text-decoration: none; background: #5865F2; border: none; display: flex; align-items: center; gap: 8px;" onclick="alert('Join the Discord (Placeholder)'); return false;">
                        <i class="fab fa-discord"></i> Community
                    </a>
                </div>
                <div style="margin-top: auto; padding-top: 20px; font-size: 10px; color: var(--bf-subtext); letter-spacing: 0.5px;">
                    Not affiliated with Fansly. Use at your own risk.
                </div>
            </div>
        `;
    }
};
