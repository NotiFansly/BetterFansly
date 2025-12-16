const Omnibar = {
    id: 'omnibar',
    name: 'Quick Switcher',
    description: 'Jump to any creator or page instantly. Type @ to search users.',
    defaultEnabled: true,

    active: false,
    el: null,
    boundHandler: null,
    searchTimer: null, // Debounce timer

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
                    <span><span style="color:var(--bf-accent)">@</span> to search users</span>
                    <span>Use Arrows to Navigate</span>
                </div>
            </div>
        `;

        document.body.appendChild(this.el);

        const input = this.el.querySelector('#bf-omni-input');
        setTimeout(() => input.focus(), 10);

        this.el.onclick = (e) => {
            if (e.target === this.el) this.close();
        };

        input.oninput = (e) => this.handleInput(e.target.value);
        input.onkeydown = (e) => this.handleNav(e);

        this.renderList(this.staticItems); // Show defaults
    },

    close() {
        if (this.el) this.el.remove();
        this.el = null;
    },

    // --- Search Logic ---

    handleInput(query) {
        // 1. User Search Mode (@)
        if (query.startsWith('@')) {
            const term = query.substring(1);
            if (term.length === 0) {
                this.renderList([], 'Type to search users...');
                return;
            }

            // Debounce API calls (wait 300ms after typing stops)
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => this.searchApi(term), 300);
            return;
        }

        // 2. Local Navigation Mode
        const q = query.toLowerCase();
        const matches = [
            ...this.staticItems.filter(i => i.name.toLowerCase().includes(q)),
            ...this.localUsers.filter(i => i.name.toLowerCase().includes(q) || i.handle.toLowerCase().includes(q))
        ];

        this.renderList(matches.slice(0, 10), matches.length === 0 ? 'No commands found.' : null);
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
                this.renderList(results, results.length === 0 ? 'No users found.' : null);
            }
        } catch (e) {
            console.error(e);
            this.renderList([], 'Search failed. Are you logged in?');
        }
    },

    // --- Rendering ---

    renderList(items, message = null) {
        const list = this.el.querySelector('#bf-omni-results');
        list.innerHTML = '';

        if (message) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--bf-subtext); font-style:italic;">${message}</div>`;
            return;
        }

        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'bf-omni-item';
            row.style.cssText = `
                padding: 12px 15px; cursor: pointer; display: flex; align-items: center; 
                border-left: 3px solid transparent; color: var(--bf-text);
            `;

            // Avatar / Icon Logic
            let iconHtml = '';
            if (item.img) {
                iconHtml = `<img src="${item.img}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 15px; object-fit: cover;">`;
            } else {
                iconHtml = `<i class="fas ${item.icon}" style="width: 24px; margin-right: 15px; text-align:center; color: var(--bf-subtext);"></i>`;
            }

            // Sub-label logic
            let metaHtml = '';
            if (item.type === 'creator' || item.type === 'api_user') {
                metaHtml = `<span style="margin-left:auto; font-size:11px; opacity:0.5; background:var(--bf-surface-0); padding:2px 6px; border-radius:4px;">@${item.handle}</span>`;
            } else if (item.type === 'action') {
                metaHtml = `<span style="margin-left:auto; font-size:10px; color:var(--bf-accent);">COMMAND</span>`;
            }

            row.innerHTML = `
                ${iconHtml}
                <span style="font-weight:500;">${item.name}</span>
                ${metaHtml}
            `;

            row.onmouseover = () => {
                this.clearSelection(list);
                this.selectRow(row);
            };

            row.onclick = () => this.execute(item);

            list.appendChild(row);

            if (index === 0) this.selectRow(row);
        });
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
        const selected = list.querySelector('[data-selected="true"]');

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!selected) return;

            let next;
            if (e.key === 'ArrowDown') next = selected.nextElementSibling || list.firstElementChild;
            else next = selected.previousElementSibling || list.lastElementChild;

            this.clearSelection(list);
            this.selectRow(next);
            next.scrollIntoView({ block: 'nearest' });
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selected) selected.click();
        }

        if (e.key === 'Escape') this.close();
    },

    // --- Soft Navigation Logic ---

    execute(item) {
        this.close();
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
                        Type <span style="background:var(--bf-surface-0); padding:0 4px; border-radius:3px;">@</span> to search users via API.
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
