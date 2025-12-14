// src/plugins/mutualIndicator.js

const MutualIndicator = {
    isActive: false,
    observer: null,
    followersCache: new Set(),
    isFetching: false,

    async enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.injectStyles();
        this.loadCache();
        this.startObserver();
        await this.updateFollowersList();

        console.log("BetterFansly: Mutual Indicator Enabled");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.observer) this.observer.disconnect();
        document.querySelectorAll('.bf-mutual-badge').forEach(el => el.remove());
    },

    async updateFollowersList() {
        if (this.isFetching) return;
        this.isFetching = true;

        const auth = this.getAuth();
        if (!auth) return;

        let offset = 0;
        const limit = 100;
        let keepGoing = true;
        const tempSet = new Set();

        try {
            while (keepGoing) {
                const url = `https://apiv3.fansly.com/api/v1/account/${auth.accountId}/followersnew?limit=${limit}&offset=${offset}&ngsw-bypass=true`;
                const response = await this.req(url);

                if (response.success && response.response) {
                    const data = response.response;
                    const accounts = data.aggregationData?.accounts || [];

                    if (accounts.length === 0) break;

                    accounts.forEach(acc => {
                        if (acc.username) tempSet.add(acc.username.toLowerCase());
                    });

                    offset += accounts.length;
                    if (accounts.length < limit) keepGoing = false;
                    await new Promise(r => setTimeout(r, 100));
                } else {
                    keepGoing = false;
                }
            }

            this.followersCache = tempSet;
            this.saveCache();
            this.scanPage();

        } catch (e) {
            console.error("BetterFansly: Error fetching followers", e);
        } finally {
            this.isFetching = false;
        }
    },

    startObserver() {
        this.observer = new MutationObserver(() => {
            if (this.scanTimeout) clearTimeout(this.scanTimeout);
            this.scanTimeout = setTimeout(() => this.scanPage(), 500);
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
        this.scanPage();
    },

    scanPage() {
        if (!this.isActive) return;

        // --- 1. Identify Current Page Profile ---
        const pathParts = window.location.pathname.split('/');
        // e.g. fansly.com/username -> "username"
        const currentUrlUser = pathParts[1] ? pathParts[1].split(/[?#]/)[0].toLowerCase() : null;
        const isSystemPage = ['settings', 'messages', 'notifications', 'subscriptions'].includes(currentUrlUser);

        // --- 2. CLEANUP (Remove invalid badges) ---
        const existingBadges = document.querySelectorAll('.bf-mutual-badge');
        existingBadges.forEach(badge => {
            const parent = badge.parentElement;
            const wrapper = parent.closest('a');

            let username = null;

            if (wrapper && wrapper.getAttribute('href')) {
                // It's a link
                username = wrapper.getAttribute('href').substring(1).split(/[?#]/)[0].split('/')[0].toLowerCase();
            } else {
                // It's likely the Profile Header (no href), so we check the URL
                if (currentUrlUser && !isSystemPage) {
                    username = currentUrlUser;
                }
            }

            // If we couldn't identify the user, OR the user isn't in our cache, delete the badge.
            if (!username || !this.followersCache.has(username)) {
                badge.remove();
                if (wrapper) wrapper.classList.remove('bf-checked');
                parent.classList.remove('bf-checked');
            }
        });

        // --- 3. SCAN: Standard Links (Feed, Lists, Comments) ---
        const links = document.querySelectorAll('a[href^="/"]:not(.bf-checked):not(.dropdown-item a)');

        links.forEach(link => {
            const href = link.getAttribute('href');
            const username = href.substring(1).split(/[?#]/)[0].split('/')[0].toLowerCase();

            if (['settings', 'messages', 'notifications'].includes(username)) return;

            link.classList.add('bf-checked');

            // Skip Avatars/Images
            if (link.querySelector('.avatar') ||
                link.querySelector('app-account-avatar') ||
                link.classList.contains('avatar') ||
                link.querySelector('img')) {
                return;
            }

            if (this.followersCache.has(username)) {
                this.addBadge(link);
            }
        });

        // --- 4. SCAN: Profile Header (Special Case) ---
        // If the current URL belongs to a follower, find their name header and badge it.
        if (currentUrlUser && !isSystemPage && this.followersCache.has(currentUrlUser)) {

            // Fansly uses <app-account-username> for the header.
            // We look for the span.user-name inside it that DOES NOT have a badge yet.
            const headerSpans = document.querySelectorAll('app-account-username span.user-name');

            headerSpans.forEach(span => {
                // Ensure we don't double badge
                if (span.querySelector('.bf-mutual-badge')) return;

                // Double check: Does the text actually match the URL user?
                // (Prevents badging "Suggested Users" in the sidebar if selectors get messy)
                if (span.textContent.toLowerCase().includes(currentUrlUser)) {
                    this.addBadge(span);
                }
            });
        }
    },

    addBadge(element) {
        // Target the inner text span if 'element' is a container
        const target = element.classList.contains('user-name') ? element : element.querySelector('.user-name') || element;

        if (target.querySelector('.bf-mutual-badge')) return;

        const badge = document.createElement('span');
        badge.className = 'bf-mutual-badge';
        badge.innerHTML = '<i class="fa-fw fas fa-user-check"></i>';
        badge.title = "Follows You";

        target.appendChild(badge);
    },

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

    injectStyles() {
        if (document.getElementById('bf-mutual-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-mutual-css';
        style.textContent = `
            .bf-mutual-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-left: 4px;
                color: #a855f7;
                background: rgba(168, 85, 247, 0.15);
                border-radius: 4px;
                padding: 1px 4px;
                font-size: 0.8em;
                height: 16px;
                vertical-align: middle;
                white-space: nowrap;
                line-height: 1;
            }
            
            /* Target span inside links AND the profile header */
            a.username-wrapper span.user-name, 
            app-account-username span.user-name {
                display: inline-flex !important;
                align-items: center;
            }
        `;
        document.head.appendChild(style);
    },

    saveCache() {
        localStorage.setItem('bf_followers_cache', JSON.stringify(Array.from(this.followersCache)));
    },

    loadCache() {
        try {
            const stored = localStorage.getItem('bf_followers_cache');
            if (stored) this.followersCache = new Set(JSON.parse(stored));
        } catch (e) { }
    }
};
