// src/core/ui.js


// --- 2. THE UI CORE ---
const UI = {
    editingPluginId: null,

    // Core Visual Settings (Themes are managed here as they are global)
    settings: {
        customCSS: localStorage.getItem('bf_custom_css') || '',
        remoteThemeUrl: localStorage.getItem('bf_theme_url') || '',
        themeMode: localStorage.getItem('bf_theme_mode') || 'custom',
        themeFlavor: localStorage.getItem('bf_theme_flavor') || 'mocha',
        themeAccent: localStorage.getItem('bf_theme_accent') || 'mauve',
    },

    // --- Initialization ---

    init() {
        console.log('BetterFansly: UI Core Initialized');

        // 1. Initialize Registry Plugins
        // We loop through registered plugins and auto-enable them if saved in localStorage
        window.BF_Registry.plugins.forEach(plugin => {
            const storageKey = `bf_plugin_enabled_${plugin.id}`;
            const isEnabled = localStorage.getItem(storageKey) === 'true' ||
                (localStorage.getItem(storageKey) === null && plugin.defaultEnabled);

            if (isEnabled && typeof plugin.enable === 'function') {
                plugin.enable();
            }
        });

        // 2. Initialize Core Features (Themes)
        this.applyTheme();
    },

    // --- Theme Engine (Kept in Core) ---

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
        } else {
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
        if (document.getElementById('bf-backdrop')) return;
        const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');

        const backdrop = document.createElement('div');
        backdrop.id = 'bf-backdrop';
        backdrop.className = 'bf-backdrop';

        backdrop.innerHTML = `
            <div class="bf-modal" onclick="event.stopPropagation()">
                <!-- SIDEBAR -->
                <div class="bf-sidebar">
                    <div class="bf-sidebar-header">
                        <img src="${logoUrl}" style="width: 32px; height: 32px; margin-right: 10px;">
                        <span>BetterFansly</span>
                    </div>

                    <button class="bf-tab-btn" id="bf-mobile-nav-toggle" style="display:none;">
                        <i class="fas fa-bars"></i> Menu
                    </button>
                    
                    <div class="bf-sidebar-label">General</div>
                    <button class="bf-tab-btn active" data-tab="plugins">Plugins</button>
                    <button class="bf-tab-btn" data-tab="themes">Themes</button>

                    <div class="bf-sidebar-label">Tools</div>
                    <div id="bf-sidebar-tools">
                        <!-- Tools injected here dynamically -->
                    </div>
                    
                    <div class="bf-sidebar-label">Advanced</div>
                    <button class="bf-tab-btn" data-tab="library">Script Library</button>

                    <div style="flex:1"></div>
                    <div style="border-top: 1px solid var(--bf-border); margin: 10px 0;"></div>
                    <button class="bf-tab-btn" data-tab="about"><i class="fas fa-info-circle"></i> About</button>
                    <button class="bf-tab-btn" id="bf-close-btn" style="color: var(--bf-subtext);">
                        <i class="fa-fw fas fa-times"></i> Close
                    </button>
                </div>

                <!-- CONTENT AREA -->
                <div class="bf-content" id="bf-tab-content"></div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Mobile nav toggle
        const toggleBtn = backdrop.querySelector('#bf-mobile-nav-toggle');
        const sidebar = backdrop.querySelector('.bf-sidebar');

        const setMobileMode = () => {
            const isMobile = window.matchMedia('(max-width: 480px)').matches;
            toggleBtn.style.display = isMobile ? 'block' : 'none';

            // On mobile, start collapsed (content first)
            if (isMobile) sidebar.classList.add('bf-collapsed');
            else sidebar.classList.remove('bf-collapsed');
        };

        toggleBtn.onclick = () => sidebar.classList.toggle('bf-collapsed');
        window.addEventListener('resize', setMobileMode);
        setMobileMode();

        // --- DYNAMIC SIDEBAR GENERATION ---
        const toolContainer = backdrop.querySelector('#bf-sidebar-tools');
        window.BF_Registry.tools.forEach(tool => {
            const btn = document.createElement('button');
            btn.className = 'bf-tab-btn';
            btn.dataset.tab = tool.id; // Use ID for routing
            btn.innerHTML = `<i class="fas ${tool.icon || 'fa-tools'}"></i> ${tool.name}`;
            toolContainer.appendChild(btn);
        });

        // --- EVENT LISTENERS ---
        const close = () => backdrop.remove();
        backdrop.onclick = close;
        document.getElementById('bf-close-btn').onclick = close;

        const tabs = backdrop.querySelectorAll('.bf-tab-btn[data-tab]');
        tabs.forEach(t => {
            t.onclick = () => {
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                this.renderTab(t.dataset.tab);
                if (window.matchMedia('(max-width: 480px)').matches) {
                    backdrop.querySelector('.bf-sidebar')?.classList.add('bf-collapsed');
                }
            };
        });

        // Default Tab
        this.renderTab('plugins');
    },

    renderTab(tabName) {
        const container = document.getElementById('bf-tab-content');
        container.innerHTML = ''; // Clear content

        // 1. Check Core Tabs
        if (tabName === 'plugins') return this.renderPluginsTab(container);
        if (tabName === 'themes') return this.renderThemesTab(container);
        if (tabName === 'library') return this.renderLibraryTab(container);
        if (tabName === 'about') return this.renderAboutTab(container);

        // 2. Check Registered Tools
        const tool = window.BF_Registry.tools.find(t => t.id === tabName);
        if (tool && typeof tool.renderToolView === 'function') {
            // The tool is responsible for returning its own DOM Element
            const toolView = tool.renderToolView();
            if (toolView instanceof HTMLElement) {
                container.appendChild(toolView);
            } else {
                container.innerHTML = `<div style="color:red">Error: Tool ${tool.name} returned invalid content.</div>`;
            }
            return;
        }

        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--bf-subtext)">Tab not found: ${tabName}</div>`;
    },

    // --- TAB: PLUGINS (Registry Driven) ---
    renderPluginsTab(container) {
        container.innerHTML = `
            <div class="bf-section-title">Core Plugins</div>
            <div class="bf-description">Essential features built into BetterFansly.</div>
            <div id="bf-plugin-list"></div>
        `;

        const list = container.querySelector('#bf-plugin-list');

        if (window.BF_Registry.plugins.length === 0) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--bf-subtext); font-style:italic;">
                No plugins registered.<br>Make sure your plugins are updated to use BF_Registry.
            </div>`;
            return;
        }

        window.BF_Registry.plugins.forEach(plugin => {
            if (typeof plugin.renderSettings === 'function') {
                const settingsCard = plugin.renderSettings();
                if (settingsCard instanceof HTMLElement) {
                    list.appendChild(settingsCard);
                }
            }
        });
    },

    // --- TAB: THEMES (Core Feature) ---
    renderThemesTab(container) {
        // (Kept largely the same as previous version, as it's complex logic specific to UI Core)
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

    // --- TAB: LIBRARY (UserScripts) ---
    async renderLibraryTab(container) {
        container.innerHTML = `
            <div class="bf-section-title"> Plugin Library </div>
            <div class="bf-description">
                <i class="fas fa-triangle-exclamation" style="color:#fab387"></i> 
                Warning: Only install scripts from sources you trust.
            </div>

            <!-- Editor Section -->
            <details id="cp-editor-details" style="margin-bottom: 20px; background: var(--bf-card-bg); padding: 10px; border-radius: 8px;">
                <summary style="cursor:pointer; font-weight:bold; outline:none;">+ Add / Edit Plugin</summary>
                <div style="margin-top: 10px;">
                    <input type="text" id="cp-name" class="bf-input" placeholder="Plugin Name">
                    <textarea id="cp-code" class="bf-input" rows="8" placeholder="// Paste JavaScript code here..." style="font-family:monospace; font-size:11px; white-space:pre; overflow-x:auto;"></textarea>
                    
                    <div style="display:flex; gap: 10px; margin-top: 10px;">
                        <button class="bf-btn" id="cp-save-btn" style="flex: 1;">Install Plugin</button>
                        <button class="bf-btn" id="cp-cancel-btn" style="background: var(--bf-surface-0); color: var(--bf-subtext); border: 1px solid var(--bf-border); display: none;">Cancel</button>
                    </div>
                </div>
            </details>

            <div class="bf-section-title" style="font-size:14px; margin-top:20px;">Installed Plugins</div>
            <div id="cp-list" style="display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; padding:20px; color:var(--bf-subtext);">Loading...</div>
            </div>
        `;

        // Editor Logic
        const resetEditor = () => {
            this.editingPluginId = null;
            document.getElementById('cp-name').value = '';
            document.getElementById('cp-code').value = '';
            const saveBtn = document.getElementById('cp-save-btn');
            saveBtn.innerText = 'Install Plugin';
            saveBtn.style.background = '';
            document.getElementById('cp-cancel-btn').style.display = 'none';
        };

        document.getElementById('cp-cancel-btn').onclick = resetEditor;

        document.getElementById('cp-save-btn').onclick = async () => {
            const name = document.getElementById('cp-name').value.trim();
            const code = document.getElementById('cp-code').value.trim();
            if (!name || !code) return alert("Name and Code are required.");

            const data = await chrome.storage.local.get('bf_plugins');
            const plugins = data.bf_plugins || [];

            if (this.editingPluginId) {
                const index = plugins.findIndex(p => p.id === this.editingPluginId);
                if (index > -1) { plugins[index].name = name; plugins[index].code = code; }
            } else {
                plugins.push({ id: 'plugin_' + Date.now(), name, code, enabled: true });
            }

            await chrome.storage.local.set({ bf_plugins: plugins });
            chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
            resetEditor();
            refreshList();
        };

        const refreshList = async () => {
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
                if (this.editingPluginId === p.id) {
                    card.style.border = '1px solid var(--bf-accent)';
                    card.style.background = 'rgba(168, 85, 247, 0.05)';
                }

                card.innerHTML = `
                    <div style="flex:1; padding-right:10px; overflow:hidden;">
                        <div style="font-weight:bold;">${p.name}</div>
                        <div style="font-size:10px; color:var(--bf-subtext);">${p.code.length} bytes</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="bf-toggle" id="toggle-${p.id}" ${p.enabled ? 'checked' : ''}>
                        <button class="bf-btn" id="edit-${p.id}" style="padding:5px 10px; font-size:12px;"><i class="fas fa-pencil-alt"></i></button>
                        <button class="bf-btn" id="del-${p.id}" style="background:#f38ba8; padding:5px 10px; font-size:12px;"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                listContainer.appendChild(card);

                card.querySelector(`#toggle-${p.id}`).onchange = async (e) => {
                    plugins[index].enabled = e.target.checked;
                    await chrome.storage.local.set({ bf_plugins: plugins });
                    chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
                };

                card.querySelector(`#edit-${p.id}`).onclick = () => {
                    this.editingPluginId = p.id;
                    document.getElementById('cp-name').value = p.name;
                    document.getElementById('cp-code').value = p.code;
                    document.getElementById('cp-editor-details').setAttribute('open', 'true');
                    document.getElementById('cp-save-btn').innerText = 'Save Changes';
                    document.getElementById('cp-cancel-btn').style.display = 'block';
                    refreshList();
                };

                card.querySelector(`#del-${p.id}`).onclick = async () => {
                    if (confirm(`Delete ${p.name}?`)) {
                        plugins.splice(index, 1);
                        await chrome.storage.local.set({ bf_plugins: plugins });
                        chrome.runtime.sendMessage({ type: 'REGISTER_PLUGINS' });
                        refreshList();
                    }
                };
            });
        };
        refreshList();
    },

    // --- TAB: ABOUT ---
    renderAboutTab(container) {
        const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');
        const manifest = chrome.runtime.getManifest();

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; text-align: center; padding: 20px;">
                
                <!-- Main Logo -->
                <img src="${logoUrl}" style="width: 80px; height: 80px; margin-bottom: 15px; filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.4));">
                
                <div style="font-size: 32px; font-weight: bold; background: linear-gradient(45deg, var(--bf-accent), #f5c2e7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    BetterFansly
                </div>
                
                <div style="color: var(--bf-subtext); margin-top: 5px; font-family: monospace; font-size: 12px;">
                    v${manifest.version} — <span style="color: var(--bf-accent);">A Notifansly Project</span>
                </div>

                <div style="margin-top: 25px; max-width: 420px; color: var(--bf-text); line-height: 1.5; font-size: 14px;">
                    Enhancing your Fansly experience with modular plugins, custom themes, and advanced privacy tools. 
                </div>

                <!-- Ecosystem Promotion Box -->
                <div style="margin-top: 25px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); padding: 15px; border-radius: 12px; max-width: 450px; width: 100%;">
                    <div style="font-weight: bold; color: #f5c2e7; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-robot"></i> Notifansly Discord Bot
                    </div>
                    <div style="font-size: 12px; color: var(--bf-subtext); margin-bottom: 10px;">
                        Are you a creator? Sync Discord roles with your followers/subscribers and get instant live notifications.
                    </div>
                    <a href="https://notifansly.xyz" target="_blank" style="color: var(--bf-accent); font-size: 12px; font-weight: bold; text-decoration: none; border-bottom: 1px dashed var(--bf-accent);">
                        Visit notifansly.xyz <i class="fas fa-external-link-alt" style="font-size: 10px;"></i>
                    </a>
                </div>

                <!-- Action Buttons -->
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    <a href="https://github.com/NotiFansly/BetterFansly" target="_blank" class="bf-btn" style="text-decoration: none; background: var(--bf-card-bg); border: 1px solid var(--bf-border); color: var(--bf-text); display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fab fa-github"></i> Source Code
                    </a>
                    <a href="https://discord.gg/WXr8Zd2Js7" class="bf-btn" style="text-decoration: none; background: #5865F2; border: none; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fab fa-discord"></i> Community
                    </a>
                </div>

                <!-- Donation Section -->
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--bf-border); width: 100%; max-width: 450px;">
                    <div style="font-size: 12px; font-weight: bold; color: var(--bf-subtext); text-transform: uppercase; margin-bottom: 15px;">
                        Support Development
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;">
                        <!-- Ko-fi Button -->
                        <a href="https://ko-fi.com/notifansly" target="_blank" style="text-decoration: none;">
                            <div style="background: #29abe0; color: white; padding: 8px 16px; border-radius: 4px; display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 14px; height: 38px; box-sizing: border-box; transition: transform 0.2s;">
                                <i class="fas fa-coffee"></i> <span>Support the Ecosystem</span>
                            </div>
                        </a>

                        <!-- OxaPay Button -->
                        <a href="https://pay.oxapay.com/11901671" target="_blank" style="transition: transform 0.2s; display: block;">
                            <img src="https://oxapay.com/donation-buttons/13.png" alt="OxaPay Donation Button" style="width: 160px; height: auto; display: block;" />
                        </a>
                    </div>
                </div>

                <div style="margin-top: auto; padding-top: 20px; font-size: 10px; color: var(--bf-subtext); letter-spacing: 0.5px;">
                    Not affiliated with Fansly. Use at your own risk.
                </div>
            </div>
        `;
    }
};

// Expose UI to global scope for injector.js
window.UI = UI;
