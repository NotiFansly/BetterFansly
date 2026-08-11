// src/plugins/pinnedMessages.js

const PinnedMessages = {
    // --- 1. Registry Metadata ---
    id: 'pinned_messages',
    name: 'Pinned Conversations',
    description: 'Pin conversations to a section at the top of the messages list.',
    defaultEnabled: false,

    STORAGE_KEY: 'bf_pinned_conversations',
    REFRESH_INTERVAL_MS: 6 * 60 * 60 * 1000, // PFP URLs expire ~6 days; refresh every 6h
    PREVIEW_REFRESH_MS: 5 * 60 * 1000,       // latest-message preview refresh
    BATCH_SIZE: 50,

    // --- 2. State ---
    isActive: false,
    observer: null,
    lastSig: null,
    lastRefresh: 0,
    lastPreviewRefresh: 0,
    _refreshing: false,
    _refreshingPreview: false,

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
                    📌 Adds <b>Pin / Unpin Conversation</b> to the "..." menu on any conversation. <br>
                    Pinned chats are shown in a section at the top of the sidebar and stay out of the main list.
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

        this.injectStyles();
        this.startObserver();

        console.log("BetterFansly: Pinned Conversations Enabled 📌");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.observer) this.observer.disconnect();
        this.cleanup();

        console.log("BetterFansly: Pinned Conversations Disabled");
    },

    injectStyles() {
        const id = 'bf-pinned-css';
        if (document.getElementById(id)) return;

        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            .bf-pinned-section {
                padding: 2px 6px 10px;
                border-bottom: 1px solid var(--bf-border);
            }
            .bf-pinned-header {
                display: flex; align-items: center; gap: 6px;
                font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: .5px;
                color: var(--bf-subtext); padding: 10px 10px 6px;
            }
            .bf-pin-row {
                display: flex; align-items: center; gap: 10px;
                padding: 7px 10px; border-radius: 8px; cursor: pointer;
                text-decoration: none; color: inherit;
            }
            .bf-pin-row:hover { background: var(--bf-hover, rgba(255,255,255,0.05)); }
            .bf-pin-avatar {
                width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
                background: var(--bf-card-bg); display: flex; align-items: center; justify-content: center;
                font-weight: bold; color: var(--bf-accent); overflow: hidden;
            }
            .bf-pin-avatar img { width: 100%; height: 100%; object-fit: cover; }
            .bf-pin-info { flex: 1; min-width: 0; }
            .bf-pin-name { font-size: 14px; color: var(--bf-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .bf-pin-preview { font-size: 12px; color: var(--bf-subtext); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .bf-pin-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
            .bf-pin-time { font-size: 11px; color: var(--bf-subtext); }
            .bf-pin-unpin { font-size: 13px; color: var(--bf-subtext); cursor: pointer; opacity: 0; transition: opacity .15s; }
            .bf-pin-row:hover .bf-pin-unpin { opacity: 1; }
            .bf-pin-unpin:hover { color: var(--bf-accent); }
        `;
        document.head.appendChild(style);
    },

    // --- Observer ---

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

        this.injectMenuItems();
        this.renderPinnedSection();
        this.maybeRefreshPins();
        this.maybeRefreshPreviews();
    },

    maybeRefreshPins() {
        const now = Date.now();
        if (this._refreshing || now - this.lastRefresh < this.REFRESH_INTERVAL_MS) return;
        this.lastRefresh = now;
        this.refreshPinData();
    },

    maybeRefreshPreviews() {
        const now = Date.now();
        if (this._refreshingPreview || now - this.lastPreviewRefresh < this.PREVIEW_REFRESH_MS) return;
        this.lastPreviewRefresh = now;
        this.refreshPreviewData();
    },

    // --- 5. Menu item injection (Pin / Unpin) ---

    injectMenuItems() {
        const lists = document.querySelectorAll('.more-dropdown .dropdown-list');
        lists.forEach(list => {
            if (!list.querySelector('[data-menu-item]')) return;
            this.injectMenuItem(list);
        });
    },

    injectMenuItem(list) {
        const groupId = this.getGroupId(list);
        if (!groupId) return;

        const isPinned = this.isPinned(groupId);
        const iconCls = `fa-fw fal ${isPinned ? 'fa-thumbtack-slash' : 'fa-thumbtack'}`;
        const label = isPinned ? 'Unpin Conversation' : 'Pin Conversation';

        // Update existing item in place so the label stays in sync after toggling
        let item = list.querySelector('.bf-pin-chat-item');
        if (item) {
            const icon = item.querySelector('i');
            const span = item.querySelector('span');
            if (icon && icon.className !== iconCls) icon.className = iconCls;
            if (span && span.textContent !== label) span.textContent = label;
            return;
        }

        item = document.createElement('div');
        item.className = 'dropdown-item bf-pin-chat-item';
        item.style.cssText = 'cursor:pointer; display:flex; align-items:center; gap:8px;';
        item.innerHTML = `
            <i class="${iconCls}"></i>
            <span>${label}</span>
        `;

        item.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePin(groupId);
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

    // --- 6. Pin storage ---

    getPins() {
        try {
            const pins = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            return Array.isArray(pins) ? pins : [];
        } catch (e) {
            return [];
        }
    },

    savePins(pins) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pins));
    },

    isPinned(groupId) {
        return this.getPins().some(p => String(p.groupId) === String(groupId));
    },

    async togglePin(groupId) {
        groupId = String(groupId);
        let pins = this.getPins();
        const idx = pins.findIndex(p => String(p.groupId) === groupId);

        if (idx >= 0) {
            pins.splice(idx, 1);
        } else {
            const contact = await this.captureContact(groupId);
            pins.push({ groupId, ...contact });
        }

        this.savePins(pins);
        this.scanPage();
    },

    // Grab username, display name, and avatar for a conversation.
    // Pinning happens from the open chat's "..." menu, so the chat header is on screen.
    async captureContact(groupId) {
        const header = document.querySelector('.message-content-header');
        let username = '';
        let displayName = '';
        let avatar = '';

        if (header) {
            const link = header.querySelector('app-account-username a[href^="/"]');
            if (link) {
                const h = link.getAttribute('href') || '';
                username = h.replace(/^\/+/, '').split(/[?#]/)[0].split('/')[0];
            }
            const nameEl = header.querySelector('.message-content-header-contact .display-name');
            if (nameEl) displayName = nameEl.textContent.trim();
            const img = header.querySelector('.message-content-header-avatar img.image.cover, .message-content-header-avatar img');
            if (img) avatar = img.src || img.getAttribute('src') || '';
        }

        // Prefer the full display name from the sidebar row when available
        const row = document.querySelector(`.messages-list-wrapper .message-list a[href="/messages/${groupId}"]`);
        const rowName = row ? row.querySelector('.display-name') : null;
        if (rowName && rowName.textContent.trim()) displayName = rowName.textContent.trim();

        // Enrich with full account data (account id + complete display name + avatar URL)
        const enriched = await this.fetchAccount(username).catch(() => null);
        let accountId = '';
        if (enriched) {
            accountId = enriched.id || '';
            if (enriched.displayName) displayName = enriched.displayName;
            if (enriched.avatarUrl) avatar = enriched.avatarUrl;
        }

        // Persist the avatar as a data URL so it survives page reloads
        if (avatar && avatar.startsWith('blob:')) {
            avatar = await this.blobToDataUrl(avatar).catch(() => avatar);
        }

        // Grab the most recent message for an immediate API-based preview
        let preview = '';
        let previewAt = 0;
        const session = this.getSession();
        if (session) {
            const msg = await this.fetchLatestMessage(groupId, session).catch(() => null);
            if (msg) {
                preview = this.messagePreview(msg);
                previewAt = msg.createdAt ? msg.createdAt * 1000 : 0;
            }
        }

        return { accountId, username, displayName, avatar, preview, previewAt };
    },

    getSession() {
        try {
            const session = JSON.parse(localStorage.getItem('session_active_session'));
            return session && session.token ? session : null;
        } catch (e) {
            return null;
        }
    },

    async fetchAccount(username) {
        if (!username) return null;
        const session = this.getSession();
        if (!session) return null;
        const headers = { 'Content-Type': 'application/json', Authorization: session.token };

        const res = await fetch(`https://apiv3.fansly.com/api/v1/account?usernames=${encodeURIComponent(username)}&ngsw-bypass=true`, { headers });
        if (!res.ok) return null;
        const json = await res.json();
        const acc = json?.response?.[0];
        if (!acc) return null;

        const avatarUrl = this.bestAvatar(acc);
        return {
            id: acc.id || '',
            username: acc.username || username,
            displayName: acc.displayName || acc.username || '',
            avatarUrl: avatarUrl || ''
        };
    },

    // Batch fetch by account ids, returns [{ id, username, displayName, avatarUrl }]
    async fetchAccountsByIds(ids) {
        if (!ids || !ids.length) return [];
        const session = this.getSession();
        if (!session) return [];
        const headers = { 'Content-Type': 'application/json', Authorization: session.token };

        const results = [];
        for (let i = 0; i < ids.length; i += this.BATCH_SIZE) {
            const batch = ids.slice(i, i + this.BATCH_SIZE);
            const res = await fetch(
                `https://apiv3.fansly.com/api/v1/account?ids=${batch.map(encodeURIComponent).join(',')}&ngsw-bypass=true`,
                { headers }
            );
            if (!res.ok) continue;
            const json = await res.json();
            (json?.response || []).forEach(acc => {
                results.push({
                    id: String(acc.id),
                    username: acc.username || '',
                    displayName: acc.displayName || acc.username || '',
                    avatarUrl: this.bestAvatar(acc) || ''
                });
            });
        }
        return results;
    },

    // Fetch the most recent message in a conversation
    async fetchLatestMessage(groupId, session) {
        const res = await fetch(
            `https://apiv3.fansly.com/api/v1/message?groupId=${encodeURIComponent(groupId)}&limit=1&ngsw-bypass=true`,
            { headers: { Authorization: session.token } }
        );
        if (!res.ok) return null;
        const json = await res.json();
        return (json?.response?.messages || [])[0] || null;
    },

    // Human-readable preview for a message
    messagePreview(msg) {
        if (!msg) return '';
        const content = String(msg.content || '').trim();
        if (content) return content;
        const att = (msg.attachments || [])[0];
        if (att) {
            const mime = ((att.media && att.media.mimetype) || att.mimetype || '').toLowerCase();
            if (mime.startsWith('image/')) return '[Image]';
            if (mime.startsWith('video/')) return '[Video]';
            if (mime.startsWith('audio/')) return '[Voice message]';
            return '[Attachment]';
        }
        return '[Message]';
    },

    // Relative time label from epoch ms
    formatTime(ms) {
        if (!ms) return '';
        const diff = Date.now() - ms;
        if (diff < 60 * 1000) return 'now';
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        const weeks = Math.floor(days / 7);
        if (weeks < 5) return `${weeks}w`;
        return new Date(ms).toLocaleDateString();
    },

    // Refresh stored pin data (accountId resolution + fresh display name / PFP URL)
    async refreshPinData() {
        if (this._refreshing) return;
        this._refreshing = true;
        try {
            const pins = this.getPins();
            if (!pins.length) return;

            // Backfill accountId for pins stored before this revamp
            for (const pin of pins) {
                if (pin.accountId || !pin.username) continue;
                const acc = await this.fetchAccount(pin.username).catch(() => null);
                if (acc && acc.id) {
                    pin.accountId = acc.id;
                    if (acc.displayName) pin.displayName = acc.displayName;
                    if (acc.avatarUrl) pin.avatar = acc.avatarUrl;
                }
            }

            const ids = [...new Set(pins.map(p => p.accountId).filter(Boolean))];
            if (ids.length) {
                const accounts = await this.fetchAccountsByIds(ids).catch(() => []);
                const byId = new Map(accounts.map(a => [a.id, a]));
                pins.forEach(pin => {
                    const acc = byId.get(pin.accountId);
                    if (!acc) return;
                    pin.username = acc.username || pin.username;
                    pin.displayName = acc.displayName || pin.displayName;
                    if (acc.avatarUrl) pin.avatar = acc.avatarUrl;
                });
            }

            this.savePins(pins);
            this.lastSig = null;
            this.renderPinnedSection();
        } finally {
            this._refreshing = false;
        }
    },

    // Refresh the latest-message preview for each pinned conversation via the API
    async refreshPreviewData() {
        if (this._refreshingPreview) return;
        this._refreshingPreview = true;
        try {
            const pins = this.getPins();
            if (!pins.length) return;
            const session = this.getSession();
            if (!session) return;

            await Promise.all(pins.map(async pin => {
                const msg = await this.fetchLatestMessage(pin.groupId, session).catch(() => null);
                if (!msg) return;
                pin.preview = this.messagePreview(msg);
                pin.previewAt = msg.createdAt ? msg.createdAt * 1000 : Date.now();
            }));

            this.savePins(pins);
            this.lastSig = null;
            this.renderPinnedSection();
        } finally {
            this._refreshingPreview = false;
        }
    },

    // Pick the largest landscape avatar variant
    bestAvatar(acc) {
        const media = acc.avatar || {};
        const variants = (media.variants || []).filter(v => v.type === 1 && v.locations && v.locations.length);
        variants.sort((a, b) => (b.width || 0) - (a.width || 0));
        if (variants[0]) return variants[0].locations[0].location;
        if (media.locations && media.locations.length) return media.locations[0].location;
        return '';
    },

    blobToDataUrl(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = src;
        });
    },

    // --- 7. Pinned section rendering ---

    buildRowsMap() {
        const rows = new Map();
        document.querySelectorAll('.messages-list-wrapper .message-list a[href^="/messages/"]').forEach(a => {
            const m = a.getAttribute('href').match(/\/messages\/(\d+)/);
            if (!m) return;
            const gid = m[1];
            const img = a.querySelector('img.image.cover') || a.querySelector('.message-avatar img');
            const link = a.querySelector('app-account-username a[href^="/"]');
            rows.set(gid, {
                username: link ? (link.getAttribute('href') || '').replace(/^\/+/, '').split(/[?#]/)[0].split('/')[0] : '',
                displayName: (a.querySelector('.display-name') || {}).textContent?.trim() || '',
                avatar: img ? (img.src || img.getAttribute('src') || '') : '',
                preview: (a.querySelector('.eclipse') || {}).textContent?.trim() || '',
                time: (a.querySelector('.message-time') || {}).textContent?.trim() || ''
            });
        });
        return rows;
    },

    renderPinnedSection() {
        if (!location.pathname.startsWith('/messages')) return;

        const messageList = document.querySelector('.messages-list-wrapper .message-list');
        if (!messageList) return;
        const parent = messageList.parentNode;
        if (!parent) return;

        const pins = this.getPins();
        const rows = this.buildRowsMap();

        // Hide pinned conversations from the main list (or restore if unpinned)
        document.querySelectorAll('.messages-list-wrapper .message-list > a').forEach(a => {
            const m = a.getAttribute('href').match(/\/messages\/(\d+)/);
            if (m && this.isPinned(m[1])) {
                a.style.display = 'none';
            } else {
                a.style.display = '';
            }
        });

        // Remove section entirely when there are no pins
        let section = parent.querySelector('.bf-pinned-section');
        if (pins.length === 0) {
            if (section) section.remove();
            this.lastSig = null;
            return;
        }

        // Build signature; skip rebuild if nothing changed (avoids observer loops)
        const sig = pins.map(p => {
            const r = rows.get(String(p.groupId));
            const preview = (r && r.preview) || p.preview || '';
            const time = (r && r.time) || (p.previewAt ? this.formatTime(p.previewAt) : '');
            return `${p.groupId}|${(r && r.username) || p.username || ''}|${(r && r.displayName) || p.displayName || ''}|${preview}|${time}`;
        }).join(';');
        if (sig === this.lastSig && section) return;
        this.lastSig = sig;

        if (!section) {
            section = document.createElement('div');
            section.className = 'bf-pinned-section';
            parent.insertBefore(section, messageList);
        }

        section.innerHTML = `
            <div class="bf-pinned-header">
                <i class="fas fa-thumbtack"></i> Pinned
            </div>
        `;

        pins.forEach(pin => {
            const gid = String(pin.groupId);
            const r = rows.get(gid) || {};
            const username = r.username || pin.username || '';
            const displayName = r.displayName || pin.displayName || username || gid;
            const letter = displayName.charAt(0).toUpperCase() || '#';
            const avatar = (r.avatar || pin.avatar)
                ? `<img src="${this.escapeHtml(r.avatar || pin.avatar)}" alt="">`
                : `<span>${this.escapeHtml(letter)}</span>`;
            const preview = (r.preview || pin.preview || '').trim();
            const time = (r.time || (pin.previewAt ? this.formatTime(pin.previewAt) : '') || '').trim();

            const row = document.createElement('a');
            row.className = 'bf-pin-row';
            row.href = `/messages/${gid}`;
            row.innerHTML = `
                <div class="bf-pin-avatar">${avatar}</div>
                <div class="bf-pin-info">
                    <div class="bf-pin-name">${this.escapeHtml(displayName)}</div>
                    <div class="bf-pin-preview">${this.escapeHtml(preview)}</div>
                </div>
                <div class="bf-pin-meta">
                    <div class="bf-pin-time">${this.escapeHtml(time)}</div>
                    <div class="bf-pin-unpin" title="Unpin"><i class="fas fa-thumbtack"></i></div>
                </div>
            `;

            row.onclick = (e) => {
                if (e.target.closest('.bf-pin-unpin')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.togglePin(gid);
                    return;
                }
                e.preventDefault();
                this.softNavigate(`/messages/${gid}`);
            };

            section.appendChild(row);
        });
    },

    // --- 8. Soft navigation (same as omnibar) ---

    softNavigate(url) {
        if (window.location.pathname === url) return;
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    },

    escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    // --- 9. Cleanup on disable ---

    cleanup() {
        document.querySelectorAll('.bf-pinned-section').forEach(el => el.remove());
        document.querySelectorAll('.messages-list-wrapper .message-list > a').forEach(a => {
            a.style.display = '';
        });
        this.lastSig = null;
        this.lastRefresh = 0;
        this.lastPreviewRefresh = 0;
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(PinnedMessages);
} else {
    window.PinnedMessages = PinnedMessages;
}
