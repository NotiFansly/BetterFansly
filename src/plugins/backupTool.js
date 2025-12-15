// src/plugins/backupTool.js

const BackupTools = {
    // --- 1. Registry Metadata ---
    id: 'backup_tool',
    name: 'Backup & Migration',
    //icon: 'fa-file-import',

    // --- 2. UI Renderer (Registry Pattern) ---
    renderToolView() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="bf-section-title">Account Backup & Migration</div>
            <div class="bf-description">Export your followed creators to a file, or import them to a new account.</div>

            <!-- EXPORT SECTION -->
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

            <!-- IMPORT SECTION -->
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

        // --- Event Listeners ---

        // 1. Export Handler
        const exportBtn = container.querySelector('#btn-export');
        const exportStatus = container.querySelector('#export-status');

        exportBtn.onclick = async () => {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.5';

            try {
                const data = await this.exportFollowing((msg) => { exportStatus.innerText = msg; });

                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `fansly_backup_${data.exported_by}_${Date.now()}.json`;
                a.click();

                exportStatus.innerText = `✅ Export Complete! (${data.accounts.length} accounts)`;
            } catch (e) {
                exportStatus.innerText = "❌ Error: " + e.message;
            } finally {
                exportBtn.disabled = false;
                exportBtn.style.opacity = '1';
            }
        };

        // 2. Import Handler
        const fileInput = container.querySelector('#import-file');
        const importBtn = container.querySelector('#btn-import');
        const importProgress = container.querySelector('#import-progress');
        const importLog = container.querySelector('#import-log');

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
                    importLog.style.display = 'block';
                    importLog.value = "Starting import process...\n";

                    const result = await this.importFollowing(json.accounts, (msg) => { importProgress.innerText = msg; });

                    importProgress.innerText = `✅ Done! Success: ${result.success} | Failed: ${result.failed} `;
                    importLog.value += `\n--- REPORT ---\nTotal: ${result.total}\nSuccess: ${result.success}\nFailed: ${result.failed}\n`;

                    if (result.errors.length > 0) importLog.value += "\nFailures:\n" + result.errors.join('\n');

                } catch (err) {
                    alert("Error reading file: " + err.message);
                } finally {
                    importBtn.disabled = false;
                    importBtn.style.opacity = '1';
                }
            };
            reader.readAsText(file);
        };

        return container;
    },

    // --- 3. Utilities ---

    getAuth() {
        try {
            const session = JSON.parse(localStorage.getItem('session_active_session'));
            return {
                token: session.token,
                accountId: session.accountId,
                username: session.username
            };
        } catch (e) { return null; }
    },

    async req(url, method = 'GET', body = null) {
        const auth = this.getAuth();
        if (!auth) throw new Error("Not logged in");

        const headers = {
            "Authorization": auth.token,
            "Content-Type": "application/json"
        };

        const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
        const json = await res.json();
        return { status: res.status, data: json };
    },

    delay(ms) { return new Promise(r => setTimeout(r, ms)); },

    // --- 4. Core Logic ---

    async exportFollowing(onProgress) {
        const auth = this.getAuth();
        if (!auth) throw new Error("Could not find account session.");

        const allIds = new Set();
        const exportData = {
            exported_at: new Date().toISOString(),
            exported_by: auth.username,
            accounts: []
        };

        // 1. Fetch Followed Accounts
        let offset = 0;
        let limit = 100;
        let keepGoing = true;

        onProgress("Fetching following list...");

        while (keepGoing) {
            const url = `https://apiv3.fansly.com/api/v1/account/${auth.accountId}/following?limit=${limit}&offset=${offset}&ngsw-bypass=true`;
            try {
                const { data } = await this.req(url);
                if (data.success && data.response && data.response.length > 0) {
                    data.response.forEach(acc => allIds.add(acc.accountId));
                    offset += data.response.length;
                    onProgress(`Found ${allIds.size} followed accounts...`);
                    await this.delay(200);
                } else {
                    keepGoing = false;
                }
            } catch (e) {
                console.error(e);
                keepGoing = false;
            }
        }

        // 2. Fetch Subscriptions
        onProgress("Fetching subscriptions...");
        try {
            const url = `https://apiv3.fansly.com/api/v1/subscriptions?ngsw-bypass=true`;
            const { data } = await this.req(url);
            if (data.success && data.response && data.response.subscriptions) {
                data.response.subscriptions.forEach(sub => allIds.add(sub.accountId));
            }
        } catch (e) { console.error("Error fetching subs", e); }

        // 3. Hydrate Data
        const idsArray = Array.from(allIds);
        onProgress(`Fetching details for ${idsArray.length} accounts...`);

        const batchSize = 50;
        for (let i = 0; i < idsArray.length; i += batchSize) {
            const batch = idsArray.slice(i, i + batchSize);
            const query = batch.join(',');

            try {
                const { data } = await this.req(`https://apiv3.fansly.com/api/v1/account?ids=${query}&ngsw-bypass=true`);
                if (data.success && data.response) {
                    data.response.forEach(acc => {
                        exportData.accounts.push({
                            id: acc.id,
                            username: acc.username,
                            displayName: acc.displayName || acc.username,
                            avatar: acc.avatar ? acc.avatar.location : null
                        });
                    });
                }
                onProgress(`Hydrated ${Math.min(i + batchSize, idsArray.length)} / ${idsArray.length} profiles...`);
                await this.delay(500);
            } catch (e) { console.error(e); }
        }

        return exportData;
    },

    async importFollowing(accounts, onProgress) {
        const results = {
            total: accounts.length,
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < accounts.length; i++) {
            const acc = accounts[i];
            const percent = Math.round(((i + 1) / accounts.length) * 100);

            onProgress(`Importing ${i + 1}/${accounts.length} (${percent}%): @${acc.username}`);

            try {
                const url = `https://apiv3.fansly.com/api/v1/account/${acc.id}/followers?ngsw-bypass=true`;
                const { data } = await this.req(url, 'POST');

                if (data.success) {
                    results.success++;
                } else {
                    const code = data.error?.code;
                    let reason = data.error?.details || "Unknown error";
                    if (code === 5) reason = "Payment Method Required";
                    if (code === 3) reason = "User disabled follows";
                    results.failed++;
                    results.errors.push(`@${acc.username}: ${reason}`);
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`@${acc.username}: Network/Auth Error`);
            }

            await this.delay(1500); // Rate limit protection
        }

        return results;
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerTool(BackupTools);
} else {
    window.BackupTools = BackupTools;
}
