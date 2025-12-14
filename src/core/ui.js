// src/core/ui.js

//import { Miniplayer } from '../plugins/miniplayer.js';

const UI = {
    // Local State for Synchronous Settings (Visuals/Toggles)
    settings: {
        miniplayerEnabled: localStorage.getItem('bf_miniplayer_enabled') === 'true',
        customCSS: localStorage.getItem('bf_custom_css') || '',
        remoteThemeUrl: localStorage.getItem('bf_theme_url') || ''
    },

    // --- Initialization ---

    init() {
        console.log('BetterFansly: UI Initialized');

        // 1. Load Built-in Plugins
        if (this.settings.miniplayerEnabled && typeof Miniplayer !== 'undefined') {
            Miniplayer.enable();
        }

        // 2. Apply Visual Themes
        this.applyTheme();
    },

    // --- Theme Engine ---

    applyTheme() {
        // cleanup old tags
        document.getElementById('bf-custom-css-tag')?.remove();
        document.getElementById('bf-remote-theme-tag')?.remove();

        // Inject Custom CSS
        if (this.settings.customCSS) {
            const style = document.createElement('style');
            style.id = 'bf-custom-css-tag';
            style.textContent = this.settings.customCSS;
            document.head.appendChild(style);
        }

        // Inject Remote Theme
        if (this.settings.remoteThemeUrl) {
            const link = document.createElement('link');
            link.id = 'bf-remote-theme-tag';
            link.rel = 'stylesheet';
            link.href = this.settings.remoteThemeUrl;
            document.head.appendChild(link);
        }
    },

    // --- Main UI Renderer ---

    openMenu() {
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
                        <i class="fa-fw fas fa-robot" style="color: #a855f7;"></i>
                        <span>BetterFansly</span>
                    </div>
                    
                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:10px 0 5px 10px; text-transform:uppercase;">User</div>
                    <button class="bf-tab-btn active" data-tab="plugins">Plugins</button>
                    <button class="bf-tab-btn" data-tab="themes">Themes</button>

                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:15px 0 5px 10px; text-transform:uppercase;">Tools</div>
                    <button class="bf-tab-btn" data-tab="data">Backup & Migration</button>
                    
                    <div class="bf-sidebar-label" style="color:#6c7086; font-size:11px; font-weight:bold; margin:15px 0 5px 10px; text-transform:uppercase;">Advanced</div>
                    <button class="bf-tab-btn" data-tab="library">Library</button>
                    
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
        `;

        // Bind Toggle
        document.getElementById('toggle-miniplayer').onchange = (e) => {
            this.settings.miniplayerEnabled = e.target.checked;
            localStorage.setItem('bf_miniplayer_enabled', e.target.checked);

            if (typeof Miniplayer !== 'undefined') {
                e.target.checked ? Miniplayer.enable() : Miniplayer.disable();
            }
        };
    },

    // --- Tab: Themes ---

    renderThemesTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Appearance</div>
            <div class="bf-description">Customize the look and feel using CSS.</div>

            <div style="margin-bottom: 20px;">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">Remote Theme URL</label>
                <div style="font-size:11px; color:#aaa; margin-bottom:5px;">Link to a raw CSS file (GitHub/Pastebin).</div>
                <input type="text" class="bf-input" id="theme-url-input" placeholder="https://..." value="${this.settings.remoteThemeUrl}">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="font-weight:bold; display:block; margin-bottom:5px;">Custom CSS</label>
                <textarea class="bf-input" id="custom-css-input" rows="10" placeholder="/* Put your custom CSS here */\nbody { font-family: 'Comic Sans MS'; }">${this.settings.customCSS}</textarea>
            </div>

            <button class="bf-btn" id="save-theme-btn">Save & Apply</button>
        `;

        document.getElementById('save-theme-btn').onclick = () => {
            const url = document.getElementById('theme-url-input').value;
            const css = document.getElementById('custom-css-input').value;

            this.settings.remoteThemeUrl = url;
            this.settings.customCSS = css;

            localStorage.setItem('bf_theme_url', url);
            localStorage.setItem('bf_custom_css', css);

            this.applyTheme();

            // Visual feedback
            const btn = document.getElementById('save-theme-btn');
            btn.innerText = 'Saved!';
            setTimeout(() => btn.innerText = 'Save & Apply', 2000);
        };
    },

    renderDataTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Account Backup & Migration</div>
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

                status.innerText = `✅ Export Complete! (${data.accounts.length} accounts)`;
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

                    if (!confirm(`Ready to import ${json.accounts.length} accounts?\nThis will take about ${(json.accounts.length * 1.5 / 60).toFixed(1)} minutes.`)) return;

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
                    prog.innerText = `✅ Done! Success: ${result.success} | Failed: ${result.failed}`;

                    log.value += `\n--- REPORT ---\n`;
                    log.value += `Total: ${result.total}\nSuccess: ${result.success}\nFailed: ${result.failed}\n`;
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

    // --- Tab: Library (Custom Plugins) ---

    async renderLibraryTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Plugin Library</div>
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

            <!-- List -->
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
                <div style="flex:1; padding-right:10px;">
                    <div style="font-weight:bold;">${p.name}</div>
                    <div style="font-size:10px; color:#6c7086; font-family:monospace;">ID: ${p.id}</div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="bf-toggle" id="toggle-${p.id}" ${p.enabled ? 'checked' : ''}>
                    <button class="bf-btn" id="del-${p.id}" style="background:#f38ba8; padding:5px 10px; font-size:12px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(card);

            // Toggle Logic
            card.querySelector(`#toggle-${p.id}`).onchange = async (e) => {
                plugins[index].enabled = e.target.checked;
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
            };

            // Delete Logic
            card.querySelector(`#del-${p.id}`).onclick = async () => {
                if (!confirm(`Delete plugin "${p.name}"?`)) return;
                plugins.splice(index, 1); // remove from array
                await chrome.storage.local.set({ bf_plugins: plugins });
                chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
                this.refreshLibraryList(); // refresh UI
            };
        });
    }
};
