// src/plugins/chatExporter.js

const ChatExporter = {
    // --- 1. Registry Metadata ---
    id: 'chat_exporter',
    name: 'Chat Exporter',
    description: 'Export a DM conversation to JSON or CSV from the conversation menu.',
    defaultEnabled: false,

    // --- 2. State ---
    isActive: false,
    observer: null,
    cancelFlag: false,

    // --- 3. UI Renderer ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';

        container.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight:bold;">${this.name}</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom: 8px;">
                    ${this.description}
                </div>
                <div style="font-size:11px; color:var(--bf-subtext); margin-top: 8px;">
                    💡 Adds <b>Export Chat History</b> to the "..." menu on any conversation. <br>
                    Downloads the full history as JSON (complete) or CSV (flat table).
                </div>
            </div>
            <input type="checkbox" class="bf-toggle">
        `;

        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;

        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            active ? this.enable() : this.disable();
        };

        return container;
    },

    // --- 4. Core Lifecycle ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.startObserver();

        console.log("BetterFansly: Chat Exporter Enabled 📤");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.observer) this.observer.disconnect();
        this.closeModal();
        this.cancelFlag = true;

        console.log("BetterFansly: Chat Exporter Disabled");
    },

    // --- Observer: inject menu item into conversation dropdowns ---

    startObserver() {
        let timeout;
        this.observer = new MutationObserver(() => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => this.scanPage(), 500);
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
        this.scanPage();
    },

    scanPage() {
        if (!this.isActive) return;
        if (!location.pathname.startsWith('/messages')) return;

        const lists = document.querySelectorAll('.more-dropdown .dropdown-list:not([data-bf-export-injected])');
        lists.forEach(list => {
            // Only conversation menus (they carry data-menu-item entries like hide-conversation / mute / block)
            if (!list.querySelector('[data-menu-item]')) return;

            list.setAttribute('data-bf-export-injected', '1');
            this.injectMenuItem(list);
        });
    },

    injectMenuItem(list) {
        const item = document.createElement('div');
        item.className = 'dropdown-item bf-export-chat-item';
        item.style.cssText = 'cursor:pointer; display:flex; align-items:center; gap:8px;';
        item.innerHTML = `
            <i class="fa-fw fal fa-file-export"></i>
            <span>Export Chat History</span>
        `;

        item.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openModal(list);
        };

        list.appendChild(item);
    },

    // --- groupId resolution ---

    getGroupId(dropdownList) {
        const m = location.pathname.match(/\/messages\/(\d+)/);
        if (m) return m[1];

        const container = dropdownList.closest('.more-dropdown');
        const link = container ? container.querySelector('a[href*="/messages/"]') : null;
        if (link) {
            const mm = link.getAttribute('href').match(/\/messages\/([^\/?#]+)/);
            if (mm) return mm[1];
        }
        return null;
    },

    // --- Modal ---

    openModal(dropdownList) {
        this.closeModal();

        const groupId = this.getGroupId(dropdownList);
        if (!groupId) {
            this.showError("Couldn't determine this conversation. Open it first, then try again.");
            return;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'bf-backdrop bf-export-backdrop';
        backdrop.style.zIndex = '100000';

        const modal = document.createElement('div');
        modal.className = 'bf-modal bf-export-modal';
        modal.style.cssText = 'width:min(480px, calc(100vw - 24px)); height:auto; flex-direction:column; padding:0;';
        modal.onclick = (e) => e.stopPropagation();

        modal.innerHTML = `
            <div class="bf-export-header" style="padding:18px 20px; border-bottom:1px solid var(--bf-border); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:bold; font-size:16px; color:var(--bf-text); display:flex; align-items:center; gap:8px;">
                    <i class="fal fa-file-export"></i> Export Chat History
                </div>
                <div class="bf-export-close" style="cursor:pointer; color:var(--bf-subtext); font-size:18px; padding:4px;"><i class="fas fa-times"></i></div>
            </div>
            <div class="bf-export-body" style="padding:20px;">
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom:15px;">
                    Downloads every message in this conversation.
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="bf-btn bf-export-json" style="flex:1; margin-top:0; display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i class="fal fa-file-code"></i> Export JSON
                    </button>
                    <button class="bf-btn bf-export-csv" style="flex:1; margin-top:0; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--bf-card-bg); color:var(--bf-text); border:1px solid var(--bf-border);">
                        <i class="fal fa-file-csv"></i> Export CSV
                    </button>
                </div>
                <div class="bf-export-status" style="margin-top:15px; font-size:12px; color:var(--bf-accent); min-height:18px; word-break:break-word; white-space:pre-line;"></div>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const status = modal.querySelector('.bf-export-status');

        const close = () => {
            this.cancelFlag = true;
            backdrop.remove();
        };

        modal.querySelector('.bf-export-close').onclick = close;
        backdrop.onclick = close;

        const jsonBtn = modal.querySelector('.bf-export-json');
        const csvBtn = modal.querySelector('.bf-export-csv');

        jsonBtn.onclick = () => this.runExport(groupId, 'json', status, jsonBtn, csvBtn);
        csvBtn.onclick = () => this.runExport(groupId, 'csv', status, jsonBtn, csvBtn);
    },

    closeModal() {
        document.querySelectorAll('.bf-export-backdrop').forEach(el => el.remove());
    },

    showError(message) {
        const backdrop = document.createElement('div');
        backdrop.className = 'bf-backdrop bf-export-backdrop';
        backdrop.style.zIndex = '100000';

        const modal = document.createElement('div');
        modal.className = 'bf-modal bf-export-modal';
        modal.style.cssText = 'width:min(420px, calc(100vw - 24px)); height:auto; flex-direction:column; padding:20px;';
        modal.onclick = (e) => e.stopPropagation();
        modal.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; color:var(--bf-text);">
                <i class="fas fa-triangle-exclamation" style="color:#f38ba8;"></i>
                <span>${message}</span>
            </div>
            <button class="bf-btn bf-export-close" style="margin-top:15px; background:var(--bf-card-bg); color:var(--bf-text); border:1px solid var(--bf-border);">Close</button>
        `;

        const close = () => backdrop.remove();
        modal.querySelector('.bf-export-close').onclick = close;
        backdrop.onclick = close;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    },

    // --- Export ---

    async runExport(groupId, format, statusEl, jsonBtn, csvBtn) {
        if (jsonBtn.disabled) return;

        jsonBtn.disabled = true;
        csvBtn.disabled = true;
        this.cancelFlag = false;

        try {
            const auth = this.getAuth();
            if (!auth) throw new Error("Not logged in.");

            statusEl.innerText = "Fetching messages...";

            const messages = await this.fetchAllMessages(groupId, auth, (msg) => {
                statusEl.innerText = msg;
            });

            if (this.cancelFlag) return;

            if (messages.length === 0) {
                statusEl.innerText = "No messages found in this conversation.";
                return;
            }

            statusEl.innerText = "Resolving participants...";
            const me = await this.resolveMe(auth);
            const participants = await this.resolveParticipants(messages, auth);

            if (this.cancelFlag) return;

            // Authoritative account from /account/me — the session username can be stale
            participants[me.id] = me.username;

            const otherId = Object.keys(participants).find(id => id !== me.id);
            const other = otherId ? participants[otherId] : me.username;
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const base = `fansly_chat_${other}_${stamp}`;

            if (format === 'json') {
                const data = this.toJSON(groupId, auth, participants, messages);
                this.download(`${base}.json`, JSON.stringify(data, null, 2), 'application/json');
            } else {
                const data = this.toCSV(messages, participants);
                this.download(`${base}.csv`, data, 'text/csv');
            }

            statusEl.innerText = `✅ Exported ${messages.length} messages to ${format.toUpperCase()}.`;
        } catch (e) {
            statusEl.innerText = "❌ " + (e.message || e);
        } finally {
            jsonBtn.disabled = false;
            csvBtn.disabled = false;
        }
    },

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

    delay(ms) { return new Promise(r => setTimeout(r, ms)); },

    async resolveMe(auth) {
        try {
            const res = await fetch('https://apiv3.fansly.com/api/v1/account/me?ngsw-bypass=true', {
                headers: { Authorization: auth.token }
            });
            if (res.ok) {
                const json = await res.json();
                const acc = json?.response?.account;
                if (acc && acc.id) {
                    return { id: String(acc.id), username: acc.username || auth.username };
                }
            }
        } catch (e) { /* fall through to session */ }
        return { id: auth.accountId, username: auth.username };
    },

    async fetchAllMessages(groupId, auth, onProgress) {
        const seen = new Set();
        const messages = [];
        let before = null;
        const pageSize = 25;
        let failures = 0;

        while (true) {
            if (this.cancelFlag) throw { message: "Cancelled." };

            let url = `https://apiv3.fansly.com/api/v1/message?groupId=${groupId}&limit=${pageSize}&ngsw-bypass=true`;
            if (before) url += `&before=${before}`;

            let res;
            try {
                res = await fetch(url, { headers: { Authorization: auth.token } });
            } catch (e) {
                if (++failures > 3) throw new Error("Network error while fetching messages.");
                await this.delay(2000);
                continue;
            }

            if (res.status === 429) { await this.delay(5000); continue; }
            if (res.status === 401 || res.status === 403) throw new Error("Session expired. Re-login and try again.");
            if (!res.ok) throw new Error(`API error ${res.status}.`);

            const json = await res.json();
            if (!json.success || !json.response) throw new Error("API returned a failure.");

            const payload = json.response;
            const pageMessages = payload.messages || [];
            if (pageMessages.length === 0) break;

            this.resolveAttachments(pageMessages, payload);

            const fresh = pageMessages.filter(m => !seen.has(m.id));
            fresh.forEach(m => seen.add(m.id));
            messages.push(...fresh);

            onProgress(`Fetched ${messages.length} messages...`);

            if (fresh.length === 0) break;

            const oldest = pageMessages.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
            if (before === oldest.id) break;
            before = oldest.id;

            await this.delay(400);
        }

        return messages;
    },

    resolveAttachments(messages, payload) {
        const mediaById = {};
        (payload.accountMedia || []).forEach(m => { mediaById[m.id] = m; });
        const bundleById = {};
        (payload.accountMediaBundles || []).forEach(b => { bundleById[b.id] = b; });

        const bestUrl = (item) => {
            const med = (item && item.media) || {};
            const variants = (med.variants || []).filter(v => v.type === 1 && v.locations && v.locations.length);
            variants.sort((a, b) => (b.width || 0) - (a.width || 0));
            if (variants[0]) return { url: variants[0].locations[0].location, width: variants[0].width, height: variants[0].height };
            if (med.locations && med.locations.length) return { url: med.locations[0].location, width: med.width, height: med.height };
            return null;
        };

        messages.forEach(msg => {
            const resolved = (msg.attachments || []).map(att => {
                const item = att.contentType === 1 ? mediaById[att.contentId] : null;
                const bundle = att.contentType === 2 ? bundleById[att.contentId] : null;
                const out = {
                    contentType: att.contentType,
                    contentId: att.contentId,
                    unlocked: false,
                    urls: []
                };

                if (item) {
                    const med = item.media || {};
                    out.unlocked = !!item.access;
                    out.mime = med.mimetype;
                    const best = bestUrl(item);
                    if (item.access && best) out.urls.push(best);
                } else if (bundle) {
                    out.unlocked = !!bundle.access;
                    out.mime = 'bundle';
                    out.count = (bundle.bundleContent || []).length;
                    if (bundle.access) {
                        (bundle.bundleContent || []).forEach(c => {
                            const sub = mediaById[c.accountMediaId];
                            if (!sub || !sub.access) return;
                            const best = bestUrl(sub);
                            if (best) out.urls.push(best);
                        });
                    }
                }
                return out;
            });
            msg._attachments = resolved;
        });
    },

    async resolveParticipants(messages, auth) {
        const ids = new Set();
        messages.forEach(m => {
            if (m.senderId) ids.add(String(m.senderId));
        });
        if (auth.accountId) ids.add(String(auth.accountId));

        const participants = {};
        participants[auth.accountId] = auth.username;

        const idList = Array.from(ids);
        for (let i = 0; i < idList.length; i += 50) {
            const batch = idList.slice(i, i + 50);
            const url = `https://apiv3.fansly.com/api/v1/account?ids=${batch.join(',')}&ngsw-bypass=true`;
            const res = await fetch(url, { headers: { Authorization: auth.token } });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.response) {
                    json.response.forEach(acc => {
                        participants[String(acc.id)] = acc.username || String(acc.id);
                    });
                }
            }
            await this.delay(300);
        }

        return participants;
    },

    formatTimestamp(createdAt) {
        if (!createdAt) return null;
        const ms = createdAt > 1e12 ? createdAt : createdAt * 1000;
        return new Date(ms).toISOString();
    },

    // --- Output formats ---

    toJSON(groupId, auth, participants, messages) {
        return {
            exportedAt: new Date().toISOString(),
            exportedBy: auth.username,
            groupId,
            participants,
            messageCount: messages.length,
            messages: messages.map(m => {
                const copy = Object.assign({}, m);
                delete copy._attachments;
                copy.senderUsername = participants[String(m.senderId)] || null;
                copy.createdAtISO = this.formatTimestamp(m.createdAt);
                copy.attachments = m._attachments || [];
                return copy;
            })
        };
    },

    toCSV(messages, participants) {
        const header = [
            'timestamp_utc', 'sender_id', 'sender_username', 'message_id',
            'type', 'content', 'in_reply_to_id', 'tip_amount', 'attachments'
        ];
        const rows = messages.map(m => {
            const attachments = (m._attachments || []).map(a => {
                const state = a.unlocked ? 'unlocked' : 'locked';
                const meta = a.mime ? ` ${a.mime}` : '';
                const count = a.count ? ` x${a.count}` : '';
                return `[${state}${meta}${count}]`;
            }).join(' ');
            return [
                this.formatTimestamp(m.createdAt) || '',
                m.senderId || '',
                participants[String(m.senderId)] || '',
                m.id || '',
                m.type || '',
                m.content || '',
                m.inReplyTo || '',
                m.totalTipAmount || 0,
                attachments
            ].map(this.csvEscape).join(',');
        });
        return [header.join(','), ...rows].join('\r\n');
    },

    csvEscape(v) {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    },

    download(filename, content, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(ChatExporter);
} else {
    window.ChatExporter = ChatExporter;
}
