const Omnibar = {
    id: 'omnibar',
    name: 'Quick Switcher',
    description: 'Jump to any creator or page instantly. Type @ for users, / for commands, or Tab into a chat to message from anywhere.',
    defaultEnabled: true,

    active: false,
    el: null,
    boundHandler: null,
    searchTimer: null, // Debounce timer
    pinnedItems: [],   // Loaded from the Pinned Conversations plugin's storage
    conversations: [],
    localUsers: [],

    // Chat-view state
    scope: null,           // { groupId, name, handle, img } of the chat currently open in the palette
    scopeMessages: [],
    replyTarget: null,     // message id to reply to (inReplyTo); null = plain send
    myAccountId: null,
    sending: false,
    deckHTML: '',

    // Default Keybind: Alt + K
    keybind: JSON.parse(localStorage.getItem('bf_omnibar_keybind') || '{"key":"k","ctrl":false,"alt":true,"shift":false,"meta":false}'),

    // Static Navigation Items
    staticItems: [
        { name: 'Home', url: '/home', icon: 'fa-home' },
        { name: 'Messages', url: '/messages', icon: 'fa-envelope' },
        { name: 'Notifications', url: '/notifications', icon: 'fa-bell' },
        { name: 'Bookmarks', url: '/bookmarks', icon: 'fa-bookmark' },
        { name: 'Settings', url: '/settings', icon: 'fa-cog' },
        { name: 'Payments', url: '/settings/payments', icon: 'fa-wallet' },
        { name: 'BetterFansly Settings', type: 'action', action: 'open_bf', icon: 'fa-rocket' }
    ],

    // --- Core Lifecycle ---

    enable() {
        if (!this.boundHandler) {
            this.boundHandler = (e) => this.handleGlobalKey(e);
        }
        document.addEventListener('keydown', this.boundHandler);
        console.log('BetterFansly: Omnibar Enabled ⚡');
    },

    disable() {
        if (this.boundHandler) {
            document.removeEventListener('keydown', this.boundHandler);
        }
        this.close();
        console.log('BetterFansly: Omnibar Disabled');
    },

    handleGlobalKey(e) {
        const k = this.keybind;
        if (e.key.toLowerCase() === k.key.toLowerCase() &&
            e.ctrlKey === k.ctrl &&
            e.altKey === k.alt &&
            e.shiftKey === k.shift &&
            e.metaKey === k.meta) {

            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        }
    },

    // --- UI Logic ---

    toggle() {
        this.el ? this.close() : this.open();
    },

    open() {
        if (document.getElementById('bf-omnibar-overlay')) return;

        // Scrape sidebar for local cache initially
        this.scrapeLocalUsers();
        this.scrapeConversations();
        this.loadPins();

        this.ensureChatStyles();

        this.el = document.createElement('div');
        this.el.id = 'bf-omnibar-overlay';
        this.el.className = 'bf-backdrop';
        this.el.style.cssText = 'align-items: flex-start; padding-top: 15vh; z-index: 100000;';

        this.el.innerHTML = `
            <div class="bf-omnibar-modal" style="width: 600px; background: var(--bf-card-bg); border: 1px solid var(--bf-border); border-radius: 8px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div style="padding: 12px 15px; border-bottom: 1px solid var(--bf-border); display: flex; align-items: center;">
                    <i class="fas fa-search" style="color: var(--bf-subtext); margin-right: 15px; font-size: 18px;"></i>
                    <input type="text" id="bf-omni-input" placeholder="Type a command or @user..." autocomplete="off"
                        style="width: 100%; background: transparent; border: none; outline: none; color: var(--bf-text); font-size: 18px; height: 30px;">
                    <span style="font-size: 10px; background: var(--bf-surface-0); padding: 4px 8px; border-radius: 4px; color: var(--bf-subtext); white-space:nowrap;">ESC to close</span>
                </div>
                <div id="bf-omni-results" style="max-height: 400px; overflow-y: auto;"></div>
                <div style="padding: 5px 10px; background: var(--bf-surface-0); border-top: 1px solid var(--bf-border); font-size: 10px; color: var(--bf-subtext); display:flex; justify-content:space-between;">
                    <span><span style="color:var(--bf-accent)">@</span> users · <span style="color:var(--bf-accent)">/</span> commands · <span style="color:var(--bf-accent)">Tab</span> on a chat = message</span>
                    <span>Use Arrows to Navigate</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.el);
        this.deckHTML = String(this.el.querySelector('.bf-omnibar-modal').innerHTML);

        const input = this.el.querySelector('#bf-omni-input');
        setTimeout(() => input.focus(), 10);

        this.el.onclick = (e) => {
            if (e.target === this.el) this.close();
        };

        input.oninput = (e) => this.handleInput(e.target.value);
        input.onkeydown = (e) => this.handleNav(e);

        // If we're already inside a DM, show the mini chat immediately for context
        const current = this.captureCurrentChat();
        if (current) this.openChat(current);
        else this.renderList(this.buildDefaultGroups()); // Show defaults + pinned chats
    },

    close() {
        this.scope = null;
        this.replyTarget = null;
        this.scopeMessages = [];
        if (this.el) this.el.remove();
        this.el = null;
    },

    // --- Search Logic ---

    handleInput(query) {
        const trimmed = String(query || '').trim();

        // 1. User Search Mode (@)
        if (trimmed.startsWith('@')) {
            const term = trimmed.substring(1);
            if (term.length === 0) {
                this.renderList([], 'Type to search users...');
                return;
            }

            // Debounce API calls (wait 300ms after typing stops)
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => this.searchApi(term), 300);
            return;
        }

        // 2. Command Mode (/)
        if (trimmed.startsWith('/')) {
            this.handleCommandInput(trimmed);
            return;
        }

        // 3. Local Navigation Mode
        const q = trimmed.toLowerCase();
        const navItems = [
            ...this.staticItems.filter(i => i.name.toLowerCase().includes(q)),
            ...this.localUsers.filter(i => i.name.toLowerCase().includes(q) || i.handle.toLowerCase().includes(q))
        ].slice(0, 10);

        const pinItems = this.searchPins(q).slice(0, 10);
        const chatItems = this.searchChats(q).slice(0, 10);

        const groups = [{ title: null, items: navItems }];
        if (pinItems.length) groups.push({ title: 'Pinned', items: pinItems });
        if (chatItems.length) groups.push({ title: 'Chats', items: chatItems });

        const total = navItems.length + pinItems.length + chatItems.length;
        this.renderList(groups, total === 0 ? 'No commands found.' : null);
    },

    // Load pinned conversations from the Pinned Conversations plugin's storage.
    // Pins persist in localStorage even when that plugin is disabled, so this
    // works standalone and needs no cross-plugin reference.
    loadPins() {
        this.pinnedItems = [];
        try {
            const pins = JSON.parse(localStorage.getItem('bf_pinned_conversations') || '[]');
            if (!Array.isArray(pins)) return;
            this.pinnedItems = pins
                .filter(p => p && p.groupId)
                .map(p => ({
                    groupId: String(p.groupId),
                    name: p.displayName || p.username || String(p.groupId),
                    handle: p.username || '',
                    url: `/messages/${p.groupId}`,
                    img: p.avatar || '',
                    icon: 'fa-thumbtack',
                    type: 'pinned',
                    preview: p.preview || '',
                    unread: p.unread || ''
                }));
        } catch (e) {
            this.pinnedItems = [];
        }
    },

    // Searches pinned chats by display name or @handle (never preview text).
    searchPins(q) {
        return this.pinnedItems.filter(i =>
            i.name.toLowerCase().includes(q) || (i.handle || '').toLowerCase().includes(q)
        );
    },

    // Sidebar conversations scraped from the messages list (used for search +
    // resolving /dm targets and Tab-into-chat).
    scrapeConversations() {
        this.conversations = [];
        const seen = new Set();
        document.querySelectorAll('.messages-list-wrapper .message-list a[href^="/messages/"]').forEach(a => {
            const mm = a.getAttribute('href').match(/\/messages\/([^\/?#]+)/);
            if (!mm) return;
            const gid = mm[1];
            if (seen.has(gid)) return;
            seen.add(gid);
            const link = a.querySelector('app-account-username a[href^="/"]');
            const username = link ? (link.getAttribute('href') || '').replace(/^\/+/, '').split(/[?#]/)[0].split('/')[0] : '';
            const name = (a.querySelector('.display-name') || {}).textContent?.trim() || username || gid;
            const img = a.querySelector('img.image.cover, .message-avatar img');
            const badge = a.querySelector('.badge-container .badge');
            this.conversations.push({
                groupId: gid,
                handle: username,
                name,
                img: img ? (img.src || img.getAttribute('src') || '') : '',
                preview: (a.querySelector('.eclipse') || {}).textContent?.trim() || '',
                unread: badge ? badge.textContent.trim() : '',
                url: `/messages/${gid}`,
                icon: 'fa-comment-dots',
                type: 'chat'
            });
        });
    },

    searchChats(q) {
        return this.conversations.filter(i =>
            i.name.toLowerCase().includes(q) || (i.handle || '').toLowerCase().includes(q)
        );
    },

    // If we're on /messages/<id>, describe the open conversation for the chat view.
    captureCurrentChat() {
        const m = (window.location.pathname || '').match(/\/messages\/(\d+)/);
        if (!m) return null;
        const gid = m[1];
        const header = document.querySelector('.message-content-header');
        let name = gid, handle = '', img = '';
        if (header) {
            const nameEl = header.querySelector('.message-content-header-contact .display-name');
            if (nameEl) name = nameEl.textContent.trim() || gid;
            const link = header.querySelector('app-account-username a[href^="/"]');
            if (link) handle = (link.getAttribute('href') || '').replace(/^\/+/, '').split(/[?#]/)[0].split('/')[0];
            const imgEl = header.querySelector('img.image.cover, img');
            if (imgEl) img = imgEl.src || imgEl.getAttribute('src') || '';
        }
        return { groupId: gid, name, handle, img };
    },

    // Default result groups: commands/users first, then a sectioned Pinned list.
    buildDefaultGroups() {
        const groups = [{ title: null, items: this.staticItems.slice(0, 10) }];
        if (this.pinnedItems && this.pinnedItems.length) {
            groups.push({ title: 'Pinned', items: this.pinnedItems.slice(0, 10) });
        }
        return groups;
    },

    // Scrape sidebar for instant access to followed users without API calls
    scrapeLocalUsers() {
        this.localUsers = [];
        const seen = new Set();
        document.querySelectorAll('a[href^="/"] .username-text, app-contact-card .username').forEach(el => {
            const name = el.innerText.trim();
            const link = el.closest('a')?.getAttribute('href');
            if (name && link && !seen.has(link) && link.length > 1) {
                seen.add(link);
                this.localUsers.push({
                    name: name,
                    handle: link.replace('/', ''),
                    url: link,
                    icon: 'fa-user-circle',
                    type: 'creator',
                    local: true
                });
            }
        });
    },

    // API Call for @search
    async searchApi(term) {
        this.renderList([], 'Searching Fansly...');

        try {
            const token = JSON.parse(localStorage.getItem('session_active_session') || '{}')?.token;
            if (!token) throw new Error("No token");

            const res = await fetch(`https://apiv3.fansly.com/api/v1/account/search?query=${encodeURIComponent(term)}&limit=10&offset=0&ngsw-bypass=true`, {
                headers: { "Authorization": token, "Content-Type": "application/json" }
            });

            const data = await res.json();

            if (data.success && data.response) {
                const results = data.response.map(user => {
                    // Try to find a small avatar variant
                    let avatarUrl = null;
                    if (user.avatar && user.avatar.variants) {
                        const variant = user.avatar.variants.find(v => v.width <= 480) || user.avatar.variants[0];
                        if (variant && variant.locations) avatarUrl = variant.locations[0].location;
                    }

                    return {
                        name: user.displayName || user.username,
                        handle: user.username,
                        url: `/${user.username}`,
                        img: avatarUrl,
                        icon: 'fa-user',
                        type: 'api_user'
                    };
                });
                this.renderList([{ title: null, items: results }], results.length === 0 ? 'No users found.' : null);
            }
        } catch (e) {
            console.error(e);
            this.renderList([], 'Search failed. Are you logged in?');
        }
    },

// --- Command mode (/ commands) ---

commandMatchers: [
        {
            cmd: 'theme',
            icon: 'fa-palette',
            hint: '/theme <mode> [flavor] [accent]  — switch theme',
            rows(args) {
                if (!args) {
                    const modes = window.BF_Themes ? Object.keys(window.BF_Themes) : ['custom'];
                    return modes.map(mode => ({
                        name: `/theme ${mode}`,
                        icon: 'fa-palette',
                        type: 'command',
                        run: () => this.applyThemeCommand(mode)
                    }));
                }
                const parts = args.split(/\s+/).filter(Boolean);
                return [{
                    name: `/theme ${args}`,
                    icon: 'fa-palette',
                    type: 'command',
                    run: () => this.applyThemeCommand(parts[0], parts[1], parts[2])
                }];
            }
        },
        {
            cmd: 'enable',
            icon: 'fa-toggle-on',
            hint: '/enable <plugin>',
            rows(args) { return this.pluginRows(args, true); }
        },
        {
            cmd: 'disable',
            icon: 'fa-toggle-off',
            hint: '/disable <plugin>',
            rows(args) { return this.pluginRows(args, false); }
        },
        {
            cmd: 'lang',
            icon: 'fa-language',
            hint: '/lang <code>  — set translator language',
            rows(args) {
                const tr = this.translatorPlugin();
                if (!tr || !tr.languages) {
                    return [{
                        name: '/lang — Chat Translator not loaded',
                        icon: 'fa-language',
                        type: 'command',
                        run: () => this.setInput('/')
                    }];
                }
                const langs = Object.keys(tr.languages);
                const q = (args || '').toLowerCase();
                const codes = q ? langs.filter(c => c.toLowerCase().includes(q) || tr.languages[c].toLowerCase().includes(q)) : langs;
                return codes.slice(0, 15).map(code => ({
                    name: `/lang ${code} — ${tr.languages[code]}`,
                    icon: 'fa-language',
                    type: 'command',
                    run: () => {
                        localStorage.setItem('bf_translator_lang', code);
                        if (tr.setTargetLang) tr.setTargetLang(code);
                    }
                }));
            }
        },
        {
            cmd: 'msg',
            icon: 'fa-paper-plane',
            hint: '/msg <text>  — send to the open chat',
            rows(args) {
                const inChat = (window.location.pathname || '').match(/\/messages\/(\d+)/);
                if (!args) {
                    return [{
                        name: `/msg <text> — ${inChat ? 'send to current chat' : 'open a chat first'}`,
                        icon: 'fa-paper-plane',
                        type: 'command',
                        run: () => this.setInput('/msg ')
                    }];
                }
                return [{
                    name: `/msg ${this.snippet(args)}`,
                    icon: 'fa-paper-plane',
                    type: 'command',
                    run: () => this.runCommandSend('msg', args)
                }];
            }
        },
        {
            cmd: 'reply',
            icon: 'fa-reply',
            hint: '/reply <text>  — reply to the latest incoming in the open chat',
            rows(args) {
                if (!args) {
                    return [{
                        name: '/reply <text> — reply to latest incoming message',
                        icon: 'fa-reply',
                        type: 'command',
                        run: () => this.setInput('/reply ')
                    }];
                }
                return [{
                    name: `/reply ${this.snippet(args)}`,
                    icon: 'fa-reply',
                    type: 'command',
                    run: () => this.runCommandSend('reply', args)
                }];
            }
        },
        {
            cmd: 'dm',
            icon: 'fa-envelope',
            hint: '/dm <@user> <text>  — send to an existing chat',
            rows(args) {
                if (!args) {
                    return [{
                        name: '/dm <@user> <text> — send to an existing chat',
                        icon: 'fa-envelope',
                        type: 'command',
                        run: () => this.setInput('/dm ')
                    }];
                }
                const i = args.indexOf(' ');
                const user = (i === -1 ? args : args.slice(0, i)).replace(/^@/, '');
                const text = (i === -1 ? '' : args.slice(i + 1)).trim();
                if (!text) {
                    return [{
                        name: `/dm — no message text after @${user}`,
                        icon: 'fa-envelope',
                        type: 'command',
                        run: () => this.setInput('/dm ')
                    }];
                }
                const gid = this.resolveChat(user);
                return [{
                    name: gid ? `/dm @${user}: "${this.snippet(text)}"` : `/dm — no existing chat with @${user}`,
                    icon: 'fa-envelope',
                    type: 'command',
                    run: () => this.runCommandSend('dm', args)
                }];
            }
        }
    ],

    handleCommandInput(trimmed) {
        const i = trimmed.indexOf(' ');
        const base = (i === -1 ? trimmed : trimmed.slice(0, i)).toLowerCase().replace(/^\/+/, '');
        const args = (i === -1 ? '' : trimmed.slice(i + 1)).trim();

        if (!base) {
            const rows = this.commandMatchers.map(m => ({
                name: m.hint,
                icon: m.icon,
                type: 'command',
                run: () => this.setInput('/' + m.cmd + ' ')
            }));
            this.renderList([{ title: null, items: rows }]);
            return;
        }

        const matched = this.commandMatchers.filter(m => m.cmd.startsWith(base));
        if (!matched.length) {
            this.renderList([], 'No command matches.');
            return;
        }

        const rows = [];
        matched.forEach(m => {
            const built = m.rows.call(this, args) || [];
            built.forEach(r => rows.push(r));
        });

        if (!rows.length) this.renderList([], 'Type more (e.g. /msg hello).');
        else this.renderList([{ title: null, items: rows.slice(0, 12) }]);
    },

    pluginRows(args, enable) {
        const list = (window.BF_Registry && window.BF_Registry.plugins) || [];
        const q = (args || '').toLowerCase();
        const rows = list
            .filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q))
            .filter(p => this.isPluginEnabled(p) === !enable)
            .map(p => ({
                name: `${enable ? '/enable' : '/disable'} ${p.name}`,
                icon: enable ? 'fa-toggle-on' : 'fa-toggle-off',
                type: 'command',
                run: () => {
                    localStorage.setItem(`bf_plugin_enabled_${p.id}`, String(enable));
                    try { enable ? p.enable() : p.disable(); } catch (e) { /* noop */ }
                }
            }));
        if (rows.length) return rows;
        if (q) {
            return [{
                name: q ? `No ${enable ? 'disabled' : 'enabled'} plugin matching "${q}"` : (enable ? 'All plugins enabled' : 'Nothing enabled'),
                icon: enable ? 'fa-toggle-on' : 'fa-toggle-off',
                type: 'command',
                run: () => this.setInput('/')
            }];
        }
        return [];
    },

    isPluginEnabled(p) {
        const v = localStorage.getItem(`bf_plugin_enabled_${p.id}`);
        return p.defaultEnabled ? v !== 'false' : v === 'true';
    },

    translatorPlugin() {
        return ((window.BF_Registry && window.BF_Registry.plugins) || []).find(p => p.id === 'translator');
    },

    applyThemeCommand(mode, flavor, accent) {
        if (!mode) return;
        localStorage.setItem('bf_theme_mode', mode);
        if (flavor) localStorage.setItem('bf_theme_flavor', flavor);
        if (accent) localStorage.setItem('bf_theme_accent', accent);
        if (window.UI) {
            window.UI.settings.themeMode = mode;
            if (flavor) window.UI.settings.themeFlavor = flavor;
            if (accent) window.UI.settings.themeAccent = accent;
            window.UI.applyTheme();
        }
    },

    setInput(text) {
        const input = this.el.querySelector('#bf-omni-input');
        if (!input) return;
        input.value = text;
        this.handleInput(text);
        input.focus();
    },

    snippet(s, n) {
        const t = String(s || '').replace(/\s+/g, ' ').trim();
        return t.length > (n || 40) ? t.slice(0, (n || 40)) + '…' : t;
    },

// --- DM API helpers ---

getSession() {
        try {
            const s = JSON.parse(localStorage.getItem('session_active_session'));
            return s && s.token ? s : null;
        } catch (e) {
            return null;
        }
    },

    async fetchMyId() {
        if (this.myAccountId) return this.myAccountId;
        const session = this.getSession();
        if (!session) return null;
        try {
            const res = await fetch('https://apiv3.fansly.com/api/v1/account/me?ngsw-bypass=true', {
                headers: { "Authorization": session.token, "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (data.success && data.response && data.response.account) {
                this.myAccountId = String(data.response.account.id);
            }
        } catch (e) { /* noop */ }
        return this.myAccountId;
    },

    async fetchRecentMessages(groupId, limit) {
        const session = this.getSession();
        if (!session) return [];
        try {
            const res = await fetch(`https://apiv3.fansly.com/api/v1/message?groupId=${encodeURIComponent(groupId)}&limit=${limit || 20}&ngsw-bypass=true`, {
                headers: { "Authorization": session.token }
            });
            const data = await res.json();
            return (data && data.response && data.response.messages) || [];
        } catch (e) {
            return [];
        }
    },

    async sendMessage(groupId, content, inReplyTo) {
        const session = this.getSession();
        if (!session) return { ok: false, error: 'Not logged in' };
        try {
            const res = await fetch('https://apiv3.fansly.com/api/v1/message?ngsw-bypass=true', {
                method: 'POST',
                headers: { "Authorization": session.token, "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: 1,
                    attachments: [],
                    likes: [],
                    content: content,
                    groupId: groupId,
                    scheduledFor: 0,
                    inReplyTo: inReplyTo || null,
                    createdAt: Math.floor(Date.now() / 1000)
                })
            });
            const data = await res.json();
            const ok = !!res.ok && !!data && data.success;
            return ok ? { ok: true, data } : { ok: false, error: `HTTP ${res.status}` };
        } catch (e) {
            return { ok: false, error: 'Network error' };
        }
    },

    // Resolve a @user (pins first, then sidebar conversations) to a groupId.
    resolveChat(user) {
        const u = String(user || '').toLowerCase().replace(/^@/, '');
        const found = [...this.pinnedItems, ...this.conversations].find(c =>
            c.groupId && (
                String(c.handle || '').toLowerCase() === u ||
                String(c.name || '').toLowerCase() === u
            )
        );
        return found ? found.groupId : null;
    },

    // Fast-path text commands: /msg, /reply, /dm. Returns error string or null.
    async commandSend(mode, args) {
        const session = this.getSession();
        if (!session) return 'Not logged in';

        let groupId = null;
        let text = '';
        let inReplyTo = null;

        if (mode === 'dm') {
            const i = args.indexOf(' ');
            const userRaw = (i === -1 ? args : args.slice(0, i)).replace(/^@/, '');
            text = (i === -1 ? '' : args.slice(i + 1)).trim();
            if (!text) return 'No message text';
            groupId = this.resolveChat(userRaw);
            if (!groupId) return `No existing chat with @${userRaw} (open it or pin it first)`;
        } else {
            const m = (window.location.pathname || '').match(/\/messages\/(\d+)/);
            if (!m) return 'Open a chat to use /msg or /reply';
            groupId = m[1];
            text = String(args || '').trim();
            if (!text) return 'No message text';
            if (mode === 'reply') {
                await this.fetchMyId();
                const msgs = await this.fetchRecentMessages(groupId, 15);
                const incoming = msgs.filter(x => String(x.senderId) !== String(this.myAccountId || ''));
                const last = incoming[incoming.length - 1];
                if (!last) return 'No incoming message to reply to';
                inReplyTo = String(last.id);
            }
        }

        const res = await this.sendMessage(groupId, text, inReplyTo);
        return res.ok ? null : `Send failed: ${res.error}`;
    },

    async runCommandSend(mode, args) {
        const err = await this.commandSend(mode, args);
        if (err) this.renderList([], err);
        else this.close();
    },

// --- Mini chat view ---

ensureChatStyles() {
        if (document.getElementById('bf-omni-chat-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-omni-chat-css';
        style.textContent = `
            .bf-omni-chat { display: flex; flex-direction: column; min-height: 400px; }
            .bf-omni-chat-head {
                display: flex; align-items: center; gap: 10px;
                padding: 10px 14px; border-bottom: 1px solid var(--bf-border);
            }
            .bf-omni-chat-head i.pointer { color: var(--bf-subtext); cursor: pointer; font-size: 15px; }
            .bf-omni-chat-head i.pointer:hover { color: var(--bf-accent); }
            .bf-omni-chat-avatar {
                width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%;
                background: var(--bf-surface-0); display: flex; align-items: center; justify-content: center;
                font-weight: bold; color: var(--bf-accent); overflow: hidden;
            }
            .bf-omni-chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
            .bf-omni-chat-who { min-width: 0; }
            .bf-omni-chat-name { font-size: 14px; font-weight: 600; color: var(--bf-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .bf-omni-chat-handle { font-size: 11px; color: var(--bf-subtext); }
            .bf-omni-msgs {
                flex: 1; max-height: 360px; overflow-y: auto;
                padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
            }
            .bf-bubble {
                max-width: 80%; padding: 8px 12px; border-radius: 12px;
                font-size: 13px; line-height: 1.35; user-select: text;
            }
            .bf-bubble.mine {
                align-self: flex-end; background: var(--bf-accent); color: #fff;
                border-bottom-right-radius: 4px;
            }
            .bf-bubble.theirs {
                align-self: flex-start; background: var(--bf-surface-0); color: var(--bf-text);
                border-bottom-left-radius: 4px; cursor: pointer;
            }
            .bf-bubble.theirs.selected { outline: 2px solid var(--bf-accent); }
            .bf-bubble-meta { font-size: 9px; opacity: 0.55; margin-bottom: 2px; text-align: right; }
            .bf-bubble.theirs .bf-bubble-meta { text-align: left; }
            .bf-bubble-body { white-space: pre-wrap; word-break: break-word; }
            .bf-omni-replychip { padding: 6px 14px 0; }
            .bf-omni-chip-reply {
                font-size: 11px; color: var(--bf-text); background: var(--bf-surface-0);
                padding: 4px 8px; border-radius: 6px; border-left: 2px solid var(--bf-accent);
                display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
            }
            .bf-omni-chip-reply .bf-omni-chip-x { cursor: pointer; color: var(--bf-subtext); }
            .bf-omni-chip-reply .bf-omni-chip-x:hover { color: #f38ba8; }
            .bf-omni-composer {
                display: flex; align-items: center; gap: 8px; padding: 10px 14px;
                border-top: 1px solid var(--bf-border);
            }
            .bf-omni-composer input {
                flex: 1; background: var(--bf-surface-0); border: none; outline: none;
                color: var(--bf-text); padding: 9px 12px; border-radius: 8px; font-size: 14px;
            }
            .bf-omni-composer .bf-omni-send {
                background: var(--bf-accent); color: #fff; border: none; border-radius: 8px;
                padding: 8px 13px; cursor: pointer; font-size: 14px;
            }
            .bf-omni-hint { font-size: 10px; color: var(--bf-subtext); padding: 5px 14px; border-top: 1px solid var(--bf-border); }
            .bf-omni-system {
                text-align: center; color: var(--bf-subtext); font-style: italic;
                font-size: 12px; padding: 16px;
            }
        `;
        document.head.appendChild(style);
    },

    openChat(scope) {
        if (!scope || !scope.groupId) return;
        this.scope = {
            groupId: String(scope.groupId),
            name: scope.name || scope.handle || String(scope.groupId),
            handle: scope.handle || '',
            img: scope.img || ''
        };
        this.scopeMessages = [];
        this.replyTarget = null;
        this.sending = false;

        const modal = this.el.querySelector('.bf-omnibar-modal');
        modal.innerHTML = this.chatShellHTML();

        const back = modal.querySelector('#bf-omni-back');
        if (back) back.onclick = (e) => { e.stopPropagation(); this.exitChatToDeck(); };
        const closeBtn = modal.querySelector('#bf-omni-chat-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };
        const sendBtn = modal.querySelector('#bf-omni-send');
        if (sendBtn) sendBtn.onclick = () => this.sendCurrentChat();

        const input = modal.querySelector('#bf-omni-input');
        setTimeout(() => input.focus(), 10);
        input.onkeydown = (e) => this.handleChatKey(e);
        input.oninput = () => { /* no result filtering inside chat */ };

        this.appendSystem('Loading messages…');
        this.loadChat();
    },

    chatShellHTML() {
        const { name, handle, img } = this.scope;
        const letter = (name || '#').charAt(0).toUpperCase();
        const avatar = img
            ? `<img src="${this.escapeHtml(img)}">`
            : `<span>${this.escapeHtml(letter)}</span>`;
        const who = handle ? `@${this.escapeHtml(handle)}` : '';
        return `
            <div class="bf-omni-chat">
                <div class="bf-omni-chat-head">
                    <i class="fas fa-arrow-left pointer" id="bf-omni-back" title="Back to switcher"></i>
                    <div class="bf-omni-chat-avatar">${avatar}</div>
                    <div class="bf-omni-chat-who">
                        <div class="bf-omni-chat-name">${this.escapeHtml(name)}</div>
                        <div class="bf-omni-chat-handle">${who}</div>
                    </div>
                    <div style="flex:1;"></div>
                    <i class="fas fa-times pointer" id="bf-omni-chat-close" title="Close"></i>
                </div>
                <div id="bf-omni-msgs" class="bf-omni-msgs"></div>
                <div id="bf-omni-replychip" class="bf-omni-replychip"></div>
                <div class="bf-omni-composer">
                    <input type="text" id="bf-omni-input" placeholder="Message ${who || 'this chat'}…" autocomplete="off">
                    <button class="bf-omni-send" id="bf-omni-send" title="Send"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div class="bf-omni-hint">Enter = send · click a bubble to reply · Esc = back</div>
            </div>
        `;
    },

    exitChatToDeck() {
        this.scope = null;
        this.replyTarget = null;
        this.scopeMessages = [];
        const modal = this.el.querySelector('.bf-omnibar-modal');
        modal.innerHTML = this.deckHTML;
        const input = modal.querySelector('#bf-omni-input');
        if (input) {
            input.oninput = (e) => this.handleInput(e.target.value);
            input.onkeydown = (e) => this.handleNav(e);
            setTimeout(() => input.focus(), 10);
        }
        this.renderList(this.buildDefaultGroups());
    },

    async loadChat() {
        try {
            await this.fetchMyId();
            const msgs = (await this.fetchRecentMessages(this.scope.groupId, 20)) || [];
            const list = this.el.querySelector('#bf-omni-msgs');
            if (!list) return;
            list.innerHTML = '';
            this.scopeMessages = msgs;
            if (!msgs.length) {
                this.appendSystem('No messages in this chat yet.');
                return;
            }
            msgs.forEach(m => this.appendBubbleEl(list, m));
            this.scrollMsgsBottom();
        } catch (e) {
            this.appendSystem("Couldn't load messages.");
        }
    },

    appendBubbleEl(list, m) {
        const id = String(m.id);
        const mine = String(m.senderId || '') === String(this.myAccountId || '');
        let text = String(m.content || '').trim();
        let chip = null;
        if (!text && (m.attachments || []).length) {
            const att = m.attachments[0];
            const type = ((att.media && att.media.mimetype) || att.mimetype || '').toLowerCase();
            chip = type.startsWith('image/') ? '[Image]'
                : type.startsWith('video/') ? '[Video]'
                : type.startsWith('audio/') ? '[Voice message]'
                : '[Attachment]';
        }

        const row = document.createElement('div');
        row.className = `bf-bubble ${mine ? 'mine' : 'theirs'}`;
        row.dataset.mid = id;
        row.innerHTML = `
            <div class="bf-bubble-meta">${this.escapeHtml(this.formatMsgTime(m.createdAt))}</div>
            <div class="bf-bubble-body">${chip ? chip : this.escapeHtml(text)}</div>
        `;

        if (!mine) {
            row.onclick = (e) => {
                e.preventDefault();
                this.toggleReply(id, row);
            };
        }

        list.appendChild(row);
    },

    toggleReply(id, row) {
        if (this.replyTarget === id) this.replyTarget = null;
        else this.replyTarget = id;
        this.styleSelectedRows();
        this.updateReplyChip();
    },

    styleSelectedRows() {
        const list = this.el.querySelector('#bf-omni-msgs');
        if (!list) return;
        list.querySelectorAll('.bf-bubble').forEach(b => {
            b.classList.toggle('selected', b.dataset.mid === this.replyTarget);
        });
    },

    updateReplyChip() {
        const chip = this.el.querySelector('#bf-omni-replychip');
        if (!chip) return;
        if (!this.replyTarget) { chip.innerHTML = ''; return; }
        const m = this.scopeMessages.find(x => String(x.id) === String(this.replyTarget));
        const snippet = m ? this.snippet(String(m.content || '').trim() || '[Media]', 60) : 'message';
        chip.innerHTML = `
            <span class="bf-omni-chip-reply">
                ↪ Reply to "${this.escapeHtml(snippet)}"
                <i class="fas fa-times bf-omni-chip-x" title="Cancel reply"></i>
            </span>
        `;
        chip.querySelector('.bf-omni-chip-x').onclick = (e) => {
            e.stopPropagation();
            this.replyTarget = null;
            this.styleSelectedRows();
            this.updateReplyChip();
            this.el.querySelector('#bf-omni-input').focus();
        };
    },

    handleChatKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.sendCurrentChat();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (this.replyTarget) {
                this.replyTarget = null;
                this.styleSelectedRows();
                this.updateReplyChip();
            } else {
                this.exitChatToDeck();
            }
        }
    },

    async sendCurrentChat() {
        const input = this.el.querySelector('#bf-omni-input');
        if (!input) return;
        const content = input.value.trim();
        if (!content || this.sending || !this.scope) return;
        this.sending = true;

        const res = await this.sendMessage(this.scope.groupId, content, this.replyTarget);
        this.sending = false;

        if (res.ok) {
            input.value = '';
            const mine = {
                id: 'local-' + Date.now(),
                senderId: this.myAccountId,
                content: content,
                createdAt: Math.floor(Date.now() / 1000)
            };
            this.scopeMessages.push(mine);
            this.replyTarget = null;
            this.styleSelectedRows();
            this.updateReplyChip();
            const list = this.el.querySelector('#bf-omni-msgs');
            if (list) {
                this.appendBubbleEl(list, mine);
                this.scrollMsgsBottom();
            }
        } else {
            this.appendSystem(`✗ ${res.error}`);
        }
    },

    appendSystem(text) {
        const list = this.el.querySelector('#bf-omni-msgs');
        if (!list) return;
        const row = document.createElement('div');
        row.className = 'bf-omni-system';
        row.textContent = text;
        list.appendChild(row);
        this.scrollMsgsBottom();
    },

    scrollMsgsBottom() {
        const list = this.el.querySelector('#bf-omni-msgs');
        if (list) list.scrollTop = list.scrollHeight;
    },

    formatMsgTime(ts) {
        const sec = Number(ts);
        if (!Number.isFinite(sec) || sec <= 0) return '';
        const d = new Date(sec * 1000);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },

// --- Rendering ---

renderList(groups, message = null) {
        const list = this.el.querySelector('#bf-omni-results');
        list.innerHTML = '';

        if (message) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--bf-subtext); font-style:italic;">${message}</div>`;
            return;
        }

        let firstSelectable = null;

        groups.forEach(group => {
            const items = (group && group.items) || [];
            if (!items.length) return;

            // Section header (e.g. "Pinned") is NOT a .bf-omni-item, so it's
            // excluded from selection/highlighting and keyboard navigation.
            if (group.title) {
                const header = document.createElement('div');
                header.className = 'bf-omni-header';
                header.style.cssText = 'padding: 10px 15px 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; color: var(--bf-subtext); display: flex; align-items: center; gap: 6px;';
                header.innerHTML = `<i class="fas fa-thumbtack" style="font-size: 9px; color: var(--bf-accent);"></i> ${this.escapeHtml(group.title)}`;
                list.appendChild(header);
            }

            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'bf-omni-item';
                row._item = item;
                row.style.cssText = `
                    padding: 12px 15px; cursor: pointer; display: flex; align-items: center; 
                    border-left: 3px solid transparent; color: var(--bf-text);
                `;

                // Avatar / Icon Logic
                let iconHtml = '';
                if (item.img) {
                    iconHtml = `<img src="${this.escapeHtml(item.img)}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 15px; object-fit: cover;">`;
                } else {
                    iconHtml = `<i class="fas ${item.icon}" style="width: 24px; margin-right: 15px; text-align:center; color: var(--bf-subtext);"></i>`;
                }

                // Sub-label logic
                let metaHtml = '';
                if (item.type === 'creator' || item.type === 'api_user') {
                    metaHtml = `<span style="margin-left:auto; font-size:11px; opacity:0.5; background:var(--bf-surface-0); padding:2px 6px; border-radius:4px;">@${this.escapeHtml(item.handle)}</span>`;
                } else if (item.type === 'action') {
                    metaHtml = `<span style="margin-left:auto; font-size:10px; color:var(--bf-accent);">COMMAND</span>`;
                } else if (item.type === 'pinned') {
                    const preview = item.preview
                        ? `<span style="max-width:160px; font-size:11px; opacity:0.5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(item.preview)}</span>`
                        : '';
                    metaHtml = `<span style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                        <span style="font-size:10px; color:var(--bf-accent); font-weight:bold;">PINNED</span>
                        ${preview}
                    </span>`;
                } else if (item.type === 'chat') {
                    const preview = item.preview
                        ? `<span style="max-width:160px; font-size:11px; opacity:0.5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(item.preview)}</span>`
                        : '';
                    const badge = item.unread
                        ? `<span style="min-width:16px; height:16px; line-height:16px; padding:0 5px; border-radius:8px; background:var(--bf-accent); color:#fff; font-size:10px; font-weight:bold; text-align:center;">${this.escapeHtml(item.unread)}</span>`
                        : '';
                    metaHtml = `<span style="margin-left:auto; display:flex; align-items:center; gap:8px;">${preview}${badge}<span style="font-size:9px; color:var(--bf-subtext); border:1px solid var(--bf-border); padding:1px 5px; border-radius:4px;">MSG</span></span>`;
                }

                row.innerHTML = `
                    ${iconHtml}
                    <span style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(item.name)}</span>
                    ${metaHtml}
                `;

                row.onmouseover = () => {
                    this.clearSelection(list);
                    this.selectRow(row);
                };

                row.onclick = () => this.execute(item);

                list.appendChild(row);

                if (!firstSelectable) firstSelectable = row;
            });
        });

        // Auto-highlight the first selectable row
        if (firstSelectable) this.selectRow(firstSelectable);
    },

    selectRow(row) {
        row.style.background = 'var(--bf-surface-0)';
        row.style.borderLeftColor = 'var(--bf-accent)';
        row.dataset.selected = "true";
    },

    clearSelection(list) {
        list.querySelectorAll('.bf-omni-item').forEach(r => {
            r.style.background = 'transparent';
            r.style.borderLeftColor = 'transparent';
            delete r.dataset.selected;
        });
    },

    handleNav(e) {
        const list = this.el.querySelector('#bf-omni-results');
        const items = Array.from(list.querySelectorAll('.bf-omni-item'));
        if (!items.length) return;

        const selectedIdx = items.findIndex(r => r.dataset.selected === 'true');

        if (e.key === 'Tab') {
            e.preventDefault();
            const item = selectedIdx >= 0 ? items[selectedIdx]._item : null;
            if (item && item.groupId) this.openChat(item);
            return;
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            let next;
            if (selectedIdx < 0) {
                next = e.key === 'ArrowDown' ? 0 : items.length - 1;
            } else {
                const dir = e.key === 'ArrowDown' ? 1 : -1;
                next = (selectedIdx + dir + items.length) % items.length;
            }

            this.clearSelection(list);
            this.selectRow(items[next]);
            items[next].scrollIntoView({ block: 'nearest' });
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIdx >= 0) items[selectedIdx].click();
        }

        if (e.key === 'Escape') this.close();
    },

    // --- Soft Navigation Logic ---

    execute(item) {
        this.close();
        if (item.run) {
            try { item.run(); } catch (e) { console.error(e); }
            return;
        }
        if (item.type === 'action' && item.action === 'open_bf') {
            window.UI.openMenu();
        } else {
            this.softNavigate(item.url);
        }
    },

    // This performs a "Soft Navigate" (Client-Side Routing)
    // It pushes the new URL to history and dispatches an event that Angular listens for.
    softNavigate(url) {
        if (window.location.pathname === url) return; // Prevent duplicate navigation

        // 1. Push new state
        history.pushState(null, '', url);

        // 2. Dispatch 'popstate' event to trick Angular into updating the view
        // Angular's PlatformLocation listens for this event.
        window.dispatchEvent(new PopStateEvent('popstate'));
    },

    escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    // --- Settings UI with Recorder ---

    renderSettings() {
        const div = document.createElement('div');
        div.className = 'bf-plugin-card';
        div.style.display = 'block';

        const readableKey = this.getReadableKeybind();

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div>
                    <b>${this.name}</b>
                    <div style="font-size:12px; color:var(--bf-subtext);">
                        Type <span style="background:var(--bf-surface-0); padding:0 4px; border-radius:3px;">@</span> for users,
                        <span style="background:var(--bf-surface-0); padding:0 4px; border-radius:3px;">/</span> for commands, or
                        <span style="background:var(--bf-surface-0); padding:0 4px; border-radius:3px;">Tab</span> on a chat to message from anywhere.
                    </div>
                </div>
                <input type="checkbox" class="bf-toggle" id="omni-toggle" 
                    ${localStorage.getItem('bf_plugin_enabled_omnibar') !== 'false' ? 'checked' : ''}>
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bf-surface-0); padding:8px; border-radius:6px;">
                <span style="font-size:12px; color:var(--bf-subtext);">Shortcut:</span>
                <button id="omni-record-btn" class="bf-btn" style="padding:4px 10px; font-size:12px; min-width:80px;">
                    ${readableKey}
                </button>
            </div>
            <div style="font-size:10px; color:var(--bf-subtext); margin-top:5px;">
                Click the button to record a new hotkey.
            </div>
        `;

        div.querySelector('#omni-toggle').onchange = (e) => {
            localStorage.setItem('bf_plugin_enabled_omnibar', e.target.checked);
            e.target.checked ? this.enable() : this.disable();
        };

        const btn = div.querySelector('#omni-record-btn');
        btn.onclick = () => {
            btn.innerText = 'Press Keys...';
            btn.style.background = 'var(--bf-accent)';
            btn.style.color = '#fff';

            const recorder = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                const newBind = {
                    key: e.key,
                    ctrl: e.ctrlKey,
                    alt: e.altKey,
                    shift: e.shiftKey,
                    meta: e.metaKey
                };

                this.keybind = newBind;
                localStorage.setItem('bf_omnibar_keybind', JSON.stringify(newBind));

                // Re-bind listener immediately
                this.disable();
                this.enable();

                btn.innerText = this.getReadableKeybind();
                btn.style.background = '';
                btn.style.color = '';

                document.removeEventListener('keydown', recorder);
            };

            document.addEventListener('keydown', recorder);
        };

        return div;
    },

    getReadableKeybind() {
        const k = this.keybind;
        let str = '';
        if (k.ctrl) str += 'Ctrl + ';
        if (k.meta) str += 'Cmd + ';
        if (k.alt) str += 'Alt + ';
        if (k.shift) str += 'Shift + ';
        return str + k.key.toUpperCase();
    }
};

window.BF_Registry.registerPlugin(Omnibar);