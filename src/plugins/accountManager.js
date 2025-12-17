const AccountManager = {
    id: 'account_manager',
    name: 'Account Switcher',

    accounts: [],
    currentAccountId: null,

    renderToolView() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="bf-section-title">Account Manager</div>
            <div class="bf-description">
                Switch between multiple Fansly accounts instantly. 
                <br><span style="color:var(--bf-subtext); font-size:11px;">Tokens are stored locally. Signed avatar URLs expire, so icons may break over time.</span>
            </div>

            <!-- Active Account -->
            <div id="am-current-status" style="margin-bottom: 20px; padding: 12px; border-radius: 8px; background: rgba(var(--bf-accent-rgb), 0.1); border: 1px solid var(--bf-accent); display:none; align-items:center; gap:10px;">
                <div style="flex:1;">
                    <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--bf-accent); font-weight:bold;">Active Session</div>
                    <div id="am-current-name" style="font-weight:bold; font-size:16px;">...</div>
                </div>
                <button id="am-logout-btn" class="bf-btn" style="background:#f38ba8; color:white; font-size:12px; padding:6px 12px;">Log Out</button>
            </div>

            <!-- Account List -->
            <div class="bf-section-title" style="font-size:14px; margin-top:20px;">Saved Accounts</div>
            <div id="am-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom: 20px;">
                <div style="text-align:center; padding:20px; color:var(--bf-subtext);">Loading accounts...</div>
            </div>

            <!-- Add Account Form -->
            <div class="bf-plugin-card" style="display:block; margin-top:20px;">
                <div style="font-weight:bold; margin-bottom:10px;">Add New Account</div>
                <div style="margin-bottom:10px;">
                    <label style="font-size:12px; font-weight:bold; color:var(--bf-subtext);">Auth Token</label>
                    <div style="display:flex; gap:10px; margin-top:5px;">
                        <input type="password" id="am-token-input" class="bf-input" placeholder="Paste token here..." style="flex:1;">
                        <button class="bf-btn" id="am-add-btn">Verify & Save</button>
                    </div>
                    <div style="font-size:10px; color:var(--bf-subtext); margin-top:8px; line-height:1.4;">
                        <b>How to get token:</b> Open DevTools (F12) &rarr; Application &rarr; Local Storage &rarr; session_active_session. Copy the "token" value.
                    </div>
                </div>
                <div id="am-add-status" style="font-size:12px; margin-top:5px; font-weight:bold;"></div>
            </div>
        `;

        this.loadAccounts().then(() => {
            this.checkCurrentSession(container);
            this.refreshList(container);
        });

        container.querySelector('#am-add-btn').onclick = () => this.handleAdd(container);
        container.querySelector('#am-logout-btn').onclick = () => this.logout();

        return container;
    },


    async loadAccounts() {
        const data = await chrome.storage.local.get('bf_accounts');
        this.accounts = data.bf_accounts || [];
    },

    async saveAccounts() {
        await chrome.storage.local.set({ bf_accounts: this.accounts });
    },

    checkCurrentSession(container) {
        try {
            const raw = localStorage.getItem('session_active_session');
            const statusBox = container.querySelector('#am-current-status');
            const nameDisplay = container.querySelector('#am-current-name');

            if (raw) {
                const session = JSON.parse(raw);
                this.currentAccountId = session.accountId;

                const known = this.accounts.find(a => String(a.id) === String(session.accountId));

                if (known) {
                    nameDisplay.innerHTML = `${known.displayName} <span style="opacity:0.6; font-weight:normal;">@${known.username}</span>`;
                } else {
                    nameDisplay.innerText = `Unknown User (ID: ${session.accountId.substring(0, 8)}...)`;
                }
                statusBox.style.display = 'flex';
            } else {
                statusBox.style.display = 'none';
            }
        } catch (e) { console.error(e); }
    },

    async handleAdd(container) {
        const input = container.querySelector('#am-token-input');
        const status = container.querySelector('#am-add-status');
        const btn = container.querySelector('#am-add-btn');
        const token = input.value.trim().replace(/"/g, '');

        if (!token) return;

        btn.disabled = true;
        btn.innerText = 'Verifying API...';
        status.innerHTML = '';

        try {
            const res = await fetch('https://apiv3.fansly.com/api/v1/account/me', {
                headers: { "Authorization": token, "Content-Type": "application/json" }
            });
            const data = await res.json();

            if (!data.success || !data.response || !data.response.account) {
                throw new Error("Invalid Token or Expired Session.");
            }

            const acc = data.response.account;

            const existingIndex = this.accounts.findIndex(a => a.id === acc.id);
            if (existingIndex > -1) {
                if (!confirm(`Account @${acc.username} is already saved. Update token?`)) {
                    throw new Error("Cancelled by user.");
                }
                this.accounts.splice(existingIndex, 1);
            }

            let avatarUrl = null;
            if (acc.avatar && acc.avatar.variants) {
                const idealVariant = acc.avatar.variants.find(v => v.width === 480 || v.width === 508)
                    || acc.avatar.variants.find(v => v.width < 800)
                    || acc.avatar.variants[0];

                if (idealVariant && idealVariant.locations && idealVariant.locations.length > 0) {
                    avatarUrl = idealVariant.locations[0].location;
                }
            }
            if (!avatarUrl && acc.avatar && acc.avatar.location) {
                avatarUrl = `https://cdn3.fansly.com${acc.avatar.location}`;
            }

            const newAccount = {
                id: acc.id,
                username: acc.username,
                displayName: acc.displayName || acc.username,
                avatar: avatarUrl,
                token: token,
                addedAt: Date.now()
            };

            this.accounts.push(newAccount);
            await this.saveAccounts();

            input.value = '';
            status.innerText = `✅ Added @${acc.username}`;
            status.style.color = 'var(--bf-accent)';

            this.checkCurrentSession(container);
            this.refreshList(container);

        } catch (e) {
            status.innerText = `❌ Error: ${e.message}`;
            status.style.color = '#f38ba8';
        } finally {
            btn.disabled = false;
            btn.innerText = 'Verify & Save';
        }
    },

    refreshList(container) {
        const list = container.querySelector('#am-list');
        list.innerHTML = '';

        if (this.accounts.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--bf-subtext); border:1px dashed var(--bf-border); border-radius:8px;">No accounts saved.</div>`;
            return;
        }

        this.accounts.forEach((acc, index) => {
            const isCurrent = String(acc.id) === String(this.currentAccountId);

            const card = document.createElement('div');
            card.className = 'bf-plugin-card';
            if (isCurrent) {
                card.style.borderLeft = '4px solid var(--bf-accent)';
                card.style.background = 'var(--bf-surface-0)';
            }

            let imgHTML = `<div style="width:36px; height:36px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center;"><i class="fas fa-user"></i></div>`;
            if (acc.avatar) {
                imgHTML = `<img src="${acc.avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; background:#222;" onerror="this.src='';this.style.display='none';this.nextElementSibling.style.display='flex'">
                           <div style="display:none; width:36px; height:36px; border-radius:50%; background:#333; align-items:center; justify-content:center;"><i class="fas fa-user"></i></div>`;
            }

            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; flex:1; overflow:hidden;">
                    ${imgHTML}
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-weight:bold; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${acc.displayName}
                        </div>
                        <div style="font-size:11px; color:var(--bf-subtext);">@${acc.username}</div>
                    </div>
                </div>
                
                <div style="display:flex; gap:8px; align-items:center;">
                    ${isCurrent
                    ? `<span style="font-size:10px; background:var(--bf-accent); color:var(--bf-bg); padding:4px 8px; border-radius:12px; font-weight:bold;">ACTIVE</span>`
                    : `<button class="bf-btn" id="login-${index}" style="padding:6px 12px; font-size:12px;">Login</button>`
                }
                    <button class="bf-btn" id="del-${index}" style="background:#f38ba8; color:#fff; width:30px; height:30px; padding:0; display:flex; align-items:center; justify-content:center;"><i class="fas fa-trash"></i></button>
                </div>
            `;

            const loginBtn = card.querySelector(`#login-${index}`);
            if (loginBtn) {
                loginBtn.onclick = () => this.switchAccount(acc);
            }

            card.querySelector(`#del-${index}`).onclick = async () => {
                if (confirm(`Remove @${acc.username} from Quick Switcher?`)) {
                    this.accounts.splice(index, 1);
                    await this.saveAccounts();
                    this.checkCurrentSession(container);
                    this.refreshList(container);
                }
            };

            list.appendChild(card);
        });
    },

    switchAccount(account) {
        if (!confirm(`Switch to @${account.username}?\nThis will refresh the page.`)) return;

        const sessionPayload = {
            id: "",
            accountId: account.id,
            deviceId: null,
            token: account.token,
            metadata: null
        };

        localStorage.setItem('session_active_session', JSON.stringify(sessionPayload));
        window.location.reload();
    },

    logout() {
        if (confirm("Log out of current session?")) {
            localStorage.removeItem('session_active_session');
            window.location.reload();
        }
    }
};

window.BF_Registry.registerTool(AccountManager);
