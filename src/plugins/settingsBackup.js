// src/plugins/settingsBackup.js

const SettingsBackup = {
    // --- 1. Registry Metadata ---
    id: 'settings_backup',
    name: 'Settings Backup',
    icon: 'fa-database',

    // localStorage keys that are transient / never exported
    EXCLUDED_KEYS: ['bf_followers_cache'],

    // --- 2. Tool UI Renderer ---
    renderToolView() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="bf-section-title">BetterFansly Settings Backup</div>
            <div class="bf-description">
                Export/restore BetterFansly configuration — plugin settings, enabled plugins, and themes — as JSON.
                This is separate from <b>Backup &amp; Migration</b> (Fansly follows/subs) and never touches your Fansly session.
            </div>

            <!-- EXPORT SECTION -->
            <div class="bf-plugin-card" style="display:block;">
                <div style="font-weight:bold; margin-bottom:5px;">Export Settings</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom:15px;">
                    Saves all <code style="background:var(--bf-surface-0); padding:0 4px; border-radius:3px;">bf_*</code> settings,
                    custom plugins, and theme configuration. Fansly session keys and the transient follower cache are skipped.
                </div>
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; margin-bottom:15px;">
                    <input type="checkbox" id="sb-include-accounts">
                    Include Account Switcher tokens (<span style="color:#f38ba8;">sensitive — stored login tokens</span>)
                </label>
                <br>
                <button class="bf-btn" id="sb-export">
                    <i class="fas fa-download"></i> Export Settings
                </button>
                <div id="sb-export-status" style="margin-top:10px; font-size:12px; color:var(--bf-accent);"></div>
            </div>

            <!-- IMPORT SECTION -->
            <div class="bf-plugin-card" style="display:block; margin-top:20px;">
                <div style="font-weight:bold; margin-bottom:5px;">Restore Settings</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom:15px;">
                    Replaces current BetterFansly settings with the file's values, then reloads the page to apply.
                    Your Fansly session is preserved.
                </div>
                <input type="file" id="sb-file" accept=".json" class="bf-input">
                <button class="bf-btn" id="sb-import" style="margin-top:10px; opacity:0.5; cursor:not-allowed;" disabled>
                    <i class="fas fa-upload"></i> Restore from File
                </button>
                <div id="sb-import-status" style="margin-top:10px; font-size:12px; color:var(--bf-accent);"></div>
            </div>
        `;

        const exportBtn = container.querySelector('#sb-export');
        const exportStatus = container.querySelector('#sb-export-status');
        const includeAccounts = container.querySelector('#sb-include-accounts');

        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.5';
            try {
                const includeAccountsData = includeAccounts.checked;
                const data = await this.gatherSettings(includeAccountsData);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.filename();
                a.click();
                exportStatus.innerText = `✅ Export complete! (${Object.keys(data.settings.localStorage).length} settings, ${data.settings.plugins.length} custom plugins${data.settings.accounts ? `, ${data.settings.accounts.length} saved accounts` : ''})`;
            } catch (e) {
                exportStatus.innerText = "❌ Error: " + e.message;
            } finally {
                exportBtn.disabled = false;
                exportBtn.style.opacity = '1';
            }
        };

        const fileInput = container.querySelector('#sb-file');
        const importBtn = container.querySelector('#sb-import');
        const importStatus = container.querySelector('#sb-import-status');

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
                    const plan = await this.prepareRestore(json);
                    if (!plan.valid) throw new Error(plan.reason || "Invalid backup file");

                    const msg = `Restore ${plan.settings} BetterFansly settings and ${plan.plugins} custom plugin(s)?\nThis replaces current settings, then reloads the page. Your Fansly session is preserved.`;
                    if (!confirm(msg)) return;

                    importBtn.disabled = true;
                    importBtn.style.opacity = '0.5';
                    this.applySettings(json);
                    importStatus.innerText = "✅ Restore complete — reloading…";
                    await this.delay(800);
                    location.reload();
                } catch (err) {
                    importStatus.innerText = "❌ Error reading file: " + err.message;
                } finally {
                    importBtn.disabled = false;
                    importBtn.style.opacity = '1';
                }
            };
            reader.readAsText(file);
        };

        return container;
    },

    // --- 3. Export Logic ---
    gatherSettings(includeAccounts) {
        const localStorageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (!key.startsWith('bf_')) continue;
            if (this.EXCLUDED_KEYS.includes(key)) continue;
            localStorageData[key] = localStorage.getItem(key);
        }
        return chrome.storage.local.get(['bf_plugins', 'bf_accounts']).then((data) => {
            const payload = {
                app: 'betterfansly',
                schema: 1,
                version: (chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version) || 'unknown',
                exported_at: new Date().toISOString(),
                settings: {
                    localStorage: localStorageData,
                    plugins: data.bf_plugins || []
                }
            };
            if (includeAccounts) payload.settings.accounts = data.bf_accounts || [];
            return payload;
        });
    },

    filename() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `betterfansly_settings_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    },

    // --- 4. Restore Logic ---
    prepareRestore(json) {
        if (!json || json.app !== 'betterfansly' || !json.settings || typeof json.settings.localStorage !== 'object') {
            return Promise.resolve({ valid: false, reason: "Not a BetterFansly settings backup" });
        }
        const ls = json.settings.localStorage || {};
        const forbidden = Object.keys(ls).filter(k => !k.startsWith('bf_') || k.startsWith('session_'));
        if (forbidden.length > 0) {
            return Promise.resolve({ valid: false, reason: "Backup contains non-bf_/session keys — refusing" });
        }
        return Promise.resolve({
            valid: true,
            settings: Object.keys(ls).length,
            plugins: (json.settings.plugins || []).length
        });
    },

    applySettings(json) {
        const ls = json.settings.localStorage || {};
        // Replace mode: clear existing bf_* keys (never session_*), then write file values
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith('bf_')) localStorage.removeItem(key);
        }
        Object.keys(ls).forEach(key => {
            if (!key.startsWith('bf_') || key.startsWith('session_')) return;
            localStorage.setItem(key, ls[key]);
        });
        return chrome.storage.local.set({
            bf_plugins: json.settings.plugins || [],
            ...(json.settings.accounts ? { bf_accounts: json.settings.accounts } : {})
        });
    },

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
};

// Register as a Tool
if (window.BF_Registry) {
    window.BF_Registry.registerTool(SettingsBackup);
} else {
    window.SettingsBackup = SettingsBackup;
}