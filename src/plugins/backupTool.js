// src/plugins/backupTools.js

const BackupTools = {
    // Utilities
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

    // --- EXPORT LOGIC ---

    async exportFollowing(onProgress) {
        const auth = this.getAuth();
        if (!auth) { alert("Could not find account session."); return; }

        const allIds = new Set();
        const exportData = {
            exported_at: new Date().toISOString(),
            exported_by: auth.username,
            accounts: []
        };

        // 1. Fetch Followed Accounts (Pagination)
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
                    await this.delay(200); // Be nice to API
                } else {
                    keepGoing = false;
                }
            } catch (e) {
                console.error(e);
                keepGoing = false;
            }
        }

        // 2. Fetch Subscriptions (Paid)
        onProgress("Fetching subscriptions...");
        try {
            const url = `https://apiv3.fansly.com/api/v1/subscriptions?ngsw-bypass=true`;
            const { data } = await this.req(url);
            if (data.success && data.response && data.response.subscriptions) {
                data.response.subscriptions.forEach(sub => allIds.add(sub.accountId));
            }
        } catch (e) { console.error("Error fetching subs", e); }

        // 3. Hydrate Data (Get Usernames/Display Names)
        const idsArray = Array.from(allIds);
        onProgress(`Fetching details for ${idsArray.length} accounts...`);

        // Batch requests (50 at a time)
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

    // --- IMPORT LOGIC ---

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
                const { status, data } = await this.req(url, 'POST');

                if (data.success) {
                    results.success++;
                } else {
                    // Handle Fansly Error Codes
                    const code = data.error?.code;
                    let reason = data.error?.details || "Unknown error";

                    if (code === 5) reason = "Payment Method Required"; // Translated from Go code
                    if (code === 3) reason = "User disabled follows";   // Translated from Go code

                    results.failed++;
                    results.errors.push(`@${acc.username}: ${reason}`);
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`@${acc.username}: Network/Auth Error`);
            }

            // IMPORTANT: Rate limit protection
            // We sleep 1.5 seconds between follows to prevent 429s
            await this.delay(1500);
        }

        return results;
    }
};
