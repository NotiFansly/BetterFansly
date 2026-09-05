// src/plugins/linkTrust.js

const LinkTrust = {
    // --- 1. Registry Metadata ---
    id: 'linkTrust',
    name: 'Trusted Links',
    description: 'Skip the Fansly /redirect/external wait for external links in posts, DMs and bios — always, or for trusted domains.',
    defaultEnabled: false,

    // --- 2. State ---
    isActive: false,
    observer: null,
    scanTimer: null,

    // Domains seeded on first enable; editable via settings (comma/newline list)
    defaultTrusted: [
        'allmylinks.com', 'linktr.ee', 'beacons.ai', 'msgsndr.com', 'ko-fi.com',
        'x.com', 'twitter.com', 'instagram.com', 'discord.gg', 'youtube.com',
        'reddit.com', 'tiktok.com', 'onlyfans.com'
    ],

    // --- 3. UI Renderer ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';
        const alwaysTrust = this.alwaysEnabled();
        const domains = this.domains().join('\n');

        container.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight:bold;">${this.name}</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom: 8px;">
                    ${this.description}
                </div>
                <div style="font-size:11px; color:var(--bf-subtext); margin-top: 4px;">
                    <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="checkbox" id="lt-always" ${alwaysTrust ? 'checked' : ''}> Always trust every external link
                    </label>
                </div>
                <div style="font-size:11px; margin-top: 8px;">
                    <div style="color:var(--bf-subtext); margin-bottom: 3px;">Trusted domains (one per line, subdomains match)</div>
                    <textarea id="lt-domains" class="bf-input" rows="4" spellcheck="false"
                        style="font-family:monospace; font-size:11px; width:100%; box-sizing:border-box; resize:vertical;">${this.escapeHtml(domains)}</textarea>
                </div>
            </div>
            <input type="checkbox" class="bf-toggle">
        `;

        container.querySelector('#lt-always').onchange = (e) => {
            localStorage.setItem('bf_linktrust_always', e.target.checked ? '1' : '');
            this.reapply();
        };

        container.querySelector('#lt-domains').onchange = (e) => {
            localStorage.setItem('bf_linktrust_domains', e.target.value);
            this.reapply();
        };

        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;
        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            active ? this.enable() : this.disable();
        };

        return container;
    },

    escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    // --- 4. Config Accessors ---
    alwaysEnabled() {
        return localStorage.getItem('bf_linktrust_always') === '1';
    },

    domains() {
        const raw = localStorage.getItem('bf_linktrust_domains');
        const list = raw === null ? this.defaultTrusted : raw.split(/[\n,]+/);
        return list.map(s => s.trim().toLowerCase().replace(/^w{3}\./, '')).filter(Boolean);
    },

    isTrusted(url) {
        try {
            const u = new URL(url, location.origin);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
            if (this.alwaysEnabled()) return true;
            const host = u.hostname.toLowerCase().replace(/^w{3}\./, '');
            return this.domains().some(d => host === d || host.endsWith('.' + d));
        } catch (e) {
            return false;
        }
    },

    // --- 5. Core Logic ---
    unwrap(raw) {
        if (!raw) return null;
        let href = String(raw);
        for (let i = 0; i < 6; i++) {
            let u;
            try {
                u = new URL(href, location.origin);
            } catch (e) {
                return null;
            }
            const isRedirect = u.pathname.replace(/\/+$/, '').toLowerCase() === '/redirect/external';
            if (!isRedirect) break;
            const target = u.searchParams.get('url');
            if (!target) return null;
            let decoded = target;
            try { decoded = decodeURIComponent(target); } catch (e) { /* keep single decode */ }
            try {
                const t = new URL(decoded, location.origin);
                if (t.protocol !== 'http:' && t.protocol !== 'https:') return null;
            } catch (e) {
                return null;
            }
            href = decoded;
        }
        return /^https?:\/\//i.test(href) ? href : null;
    },

    rewriteIfTrusted(a) {
        if (a.dataset.bfTrust) return;
        const target = this.unwrap(a.getAttribute('href'));
        if (!target || !this.isTrusted(target)) return;
        if (!a.dataset.bfOgHref) a.dataset.bfOgHref = a.getAttribute('href');
        a.setAttribute('href', target);
        a.dataset.bfTrust = '1';
    },

    scanLinks(root) {
        const scope = root || document;
        scope.querySelectorAll('a[href*="/redirect/external"]:not([data-bf-trust])').forEach(a => {
            try { this.rewriteIfTrusted(a); } catch (e) { /* keep going */ }
        });
    },

    maybeRedirectPage() {
        try {
            if (location.pathname.replace(/\/+$/, '').toLowerCase() !== '/redirect/external') return;
            const target = this.unwrap(location.href);
            if (!target || !this.isTrusted(target)) return;
            location.replace(target);
        } catch (e) { /* noop */ }
    },

    reapply() {
        if (!this.isActive) return;
        this.restoreAnchors();
        this.scanLinks();
        this.maybeRedirectPage();
    },

    restoreAnchors() {
        document.querySelectorAll('a[data-bf-trust]').forEach(a => {
            const og = a.dataset.bfOgHref;
            if (og) a.setAttribute('href', og);
            delete a.dataset.bfTrust;
            delete a.dataset.bfOgHref;
        });
    },

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.observer = new MutationObserver(() => {
            if (this.scanTimer) clearTimeout(this.scanTimer);
            this.scanTimer = setTimeout(() => {
                this.scanTimer = null;
                this.scanLinks();
            }, 500);
        });
        this.observer.observe(document.body, { childList: true, subtree: true });

        this.scanLinks();
        this.maybeRedirectPage();
        console.log("BetterFansly: Trusted Links Enabled");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.observer) { this.observer.disconnect(); this.observer = null; }
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
        this.restoreAnchors();
        console.log("BetterFansly: Trusted Links Disabled");
    }
};

window.BF_Registry.registerPlugin(LinkTrust);