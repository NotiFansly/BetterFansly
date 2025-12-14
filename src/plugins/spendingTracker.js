// src/plugins/spendingTracker.js

const SpendingTracker = {
    // --- UTILS ---
    getAuth() {
        try {
            const session = JSON.parse(localStorage.getItem('session_active_session'));
            return { accountId: session.accountId, token: session.token };
        } catch (e) { return null; }
    },

    async req(url) {
        const auth = this.getAuth();
        const res = await fetch(url, {
            headers: { "Authorization": auth.token, "Content-Type": "application/json" }
        });
        return await res.json();
    },

    formatMoney(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    },

    formatDate(ts) {
        return new Date(Number(ts)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // --- CORE LOGIC ---

    async analyzeSpending(onProgress) {
        const auth = this.getAuth();
        if (!auth) throw new Error("Not logged in");

        const transactions = [];
        let offset = 0;
        const limit = 100;
        let keepGoing = true;

        // 1. Fetch Ledger History
        onProgress("Scanning wallet ledger...");

        while (keepGoing) {
            const url = `https://apiv3.fansly.com/api/v1/account/wallets/transactions?limit=${limit}&offset=${offset}&ngsw-bypass=true`;
            try {
                const json = await this.req(url);
                const list = json.response?.data || [];

                if (json.success && list.length > 0) {
                    transactions.push(...list);
                    offset += list.length;
                    onProgress(`Found ${transactions.length} transactions...`);
                    await new Promise(r => setTimeout(r, 200));
                } else {
                    keepGoing = false;
                }
            } catch (e) {
                console.error(e);
                keepGoing = false;
            }
        }

        if (transactions.length === 0) return null;

        // 2. Filter & Attribute Transactions
        // We only want money leaving the user (senderId === me).
        // We exclude money entering the user (senderId === null or other).

        const spendingTx = [];

        for (const t of transactions) {
            // Must be sent BY me
            if (t.senderId !== auth.accountId) continue;

            // Determine who got the money
            let receiverId = t.receiverId;

            // Handle "Product/Bundle" purchases where receiverId is null
            if (!receiverId && t.productOrder && t.productOrder.items) {
                try {
                    // Look at the first item in the order to find the creator
                    const item = t.productOrder.items[0];
                    if (item && item.metadata) {
                        const meta = JSON.parse(item.metadata);
                        if (meta.accountId) {
                            receiverId = meta.accountId;
                        }
                    }
                } catch (e) {
                    // Metadata parse error
                }
            }

            // Valid Spending: 
            // 1. We found a receiver
            // 2. The receiver is NOT me (excludes self-transfers if any)
            if (receiverId && receiverId !== auth.accountId) {
                // Attach the resolved ID to the transaction object for later use
                t._resolvedReceiverId = receiverId;
                spendingTx.push(t);
            }
        }

        onProgress(`Identified ${spendingTx.length} spending transactions...`);

        // 3. Resolve Usernames
        const creatorIds = new Set(spendingTx.map(t => t._resolvedReceiverId));
        const accountMap = {};

        onProgress(`Fetching details for ${creatorIds.size} creators...`);

        const idsArray = Array.from(creatorIds);
        for (let i = 0; i < idsArray.length; i += 50) {
            const batch = idsArray.slice(i, i + 50).join(',');
            try {
                const json = await this.req(`https://apiv3.fansly.com/api/v1/account?ids=${batch}&ngsw-bypass=true`);
                if (json.success && json.response) {
                    json.response.forEach(acc => {
                        accountMap[acc.id] = acc.username || acc.displayName || "Unknown";
                    });
                }
            } catch (e) { }
            await new Promise(r => setTimeout(r, 200));
        }

        // 4. Calculate Stats
        const DIVISOR = 1000;
        spendingTx.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

        const totalDollars = spendingTx.reduce((sum, t) => sum + (t.amount || 0), 0) / DIVISOR;

        // Group By Account
        const byAccount = {};
        spendingTx.forEach(t => {
            const creatorId = t._resolvedReceiverId;
            const name = accountMap[creatorId] || creatorId;

            if (!byAccount[name]) byAccount[name] = 0;
            byAccount[name] += (t.amount || 0);
        });

        const sortedAccounts = Object.entries(byAccount)
            .map(([name, rawAmount]) => ({ name, total: rawAmount / DIVISOR }))
            .sort((a, b) => b.total - a.total);

        // Group By Year
        const byYear = {};
        spendingTx.forEach(t => {
            const year = new Date(Number(t.createdAt)).getFullYear();
            if (!byYear[year]) byYear[year] = 0;
            byYear[year] += (t.amount || 0);
        });

        const byYearDollars = {};
        Object.keys(byYear).forEach(y => {
            byYearDollars[y] = byYear[y] / DIVISOR;
        });

        return {
            total: totalDollars,
            count: spendingTx.length,
            firstDate: spendingTx.length > 0 ? spendingTx[0].createdAt : Date.now(),
            lastDate: spendingTx.length > 0 ? spendingTx[spendingTx.length - 1].createdAt : Date.now(),
            byAccount: sortedAccounts,
            byYear: byYearDollars
        };
    }
};
