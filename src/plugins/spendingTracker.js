// src/plugins/spendingTracker.js

const SpendingTracker = {
    // --- 1. Registry Metadata ---
    id: 'spending_tracker',
    name: 'Spending Tracker',
    //icon: 'fa-chart-pie',

    // --- 2. UI Renderer (Registry Pattern) ---
    renderToolView() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="bf-section-title">Spending Tracker</div>
            <div class="bf-description">Analyze your purchase history across all creators.</div>

            <!-- SCAN CARD -->
            <div class="bf-plugin-card" style="display:block; text-align:center; padding: 40px;">
                <i class="fas fa-chart-pie" style="font-size: 40px; color: var(--bf-accent); margin-bottom: 20px;"></i>
                <div style="margin-bottom: 20px;">
                    Click below to scan your transaction history.<br>
                    <span style="font-size:12px; color:var(--bf-subtext);">(This scans local API data, nothing is sent to external servers)</span>
                </div>
                <button class="bf-btn" id="btn-scan-spending">Scan History</button>
                <div id="spending-status" style="margin-top:15px; color:var(--bf-accent); font-size:13px;"></div>
            </div>

            <!-- RESULTS AREA -->
            <div id="spending-results" style="display:none; animation: fadeIn 0.5s; margin-top: 20px;">
                <!-- KPIs -->
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

                <!-- Top Creators -->
                <div class="bf-section-title" style="font-size:14px;">Top Creators</div>
                <div id="top-creators-list" style="max-height: 300px; overflow-y: auto; background:var(--bf-card-bg); border:1px solid var(--bf-border); border-radius:8px; margin-bottom:20px;">
                </div>

                <!-- Yearly Breakdown -->
                <div class="bf-section-title" style="font-size:14px;">Yearly Breakdown</div>
                <div id="year-breakdown" style="display:flex; gap:10px; flex-wrap:wrap;"></div>
            </div>
        `;

        // --- Event Listeners ---
        const btn = container.querySelector('#btn-scan-spending');
        const status = container.querySelector('#spending-status');
        const results = container.querySelector('#spending-results');

        btn.onclick = async () => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            results.style.display = 'none';

            try {
                const data = await this.analyzeSpending((msg) => { status.innerText = msg; });

                if (!data) {
                    status.innerText = "No payment history found.";
                    return;
                }

                // Update KPIs
                container.querySelector('#kpi-total').innerText = this.formatMoney(data.total);
                container.querySelector('#kpi-count').innerText = data.count;
                container.querySelector('#kpi-timeline').innerText = `${this.formatDate(data.firstDate)} — ${this.formatDate(data.lastDate)}`;

                // Render Top Creators List
                const list = container.querySelector('#top-creators-list');
                list.innerHTML = '';

                data.byAccount.forEach((acc, index) => {
                    const row = document.createElement('div');
                    row.style.padding = '10px';
                    row.style.borderBottom = '1px solid var(--bf-border)';
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';

                    // Simple progress bar background
                    const percent = Math.min((acc.total / (data.byAccount[0].total || 1)) * 100, 100);
                    row.style.background = `linear-gradient(90deg, rgba(168, 85, 247, 0.1) ${percent}%, transparent ${percent}%)`;

                    row.innerHTML = `
                        <div>
                            <span style="color:var(--bf-subtext); font-size:11px; margin-right:8px;">#${index + 1}</span>
                            <span style="font-weight:bold;">@${acc.name}</span>
                        </div>
                        <div style="font-family:monospace;">${this.formatMoney(acc.total)}</div>
                    `;
                    list.appendChild(row);
                });

                // Render Yearly Breakdown
                const yearsContainer = container.querySelector('#year-breakdown');
                yearsContainer.innerHTML = '';

                Object.entries(data.byYear).forEach(([year, dollars]) => {
                    const tag = document.createElement('div');
                    tag.style.background = 'var(--bf-card-bg)';
                    tag.style.padding = '8px 12px';
                    tag.style.borderRadius = '6px';
                    tag.style.border = '1px solid var(--bf-border)';
                    tag.innerHTML = `
                        <div style="font-size:11px; color:var(--bf-subtext);">${year}</div>
                        <div style="font-weight:bold; color:var(--bf-accent);">${this.formatMoney(dollars)}</div>
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

        return container;
    },

    // --- 3. Utilities ---

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

    // --- 4. Core Logic ---

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
                } catch (e) { }
            }

            // Valid Spending: Receiver found and NOT me
            if (receiverId && receiverId !== auth.accountId) {
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

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerTool(SpendingTracker);
} else {
    window.SpendingTracker = SpendingTracker;
}
