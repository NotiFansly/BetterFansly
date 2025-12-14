// src/plugins/keywordMuter.js

const KeywordMuter = {
    isActive: false,
    observer: null,
    keywords: [],

    enable() {
        if (this.isActive) return;
        this.isActive = true;
        this.injectStyles();

        // Load saved keywords
        const saved = localStorage.getItem('bf_muted_keywords');
        this.keywords = saved ? JSON.parse(saved) : [];

        if (this.keywords.length > 0) {
            this.startObserver();
            console.log("BetterFansly: Keyword Muter Enabled", this.keywords);
            this.forceRescan();
        }
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.observer) this.observer.disconnect();

        // Unhide everything
        document.querySelectorAll('.bf-muted').forEach(el => {
            el.classList.remove('bf-muted');
        });

        console.log("BetterFansly: Keyword Muter Disabled");
    },

    updateKeywords(newKeywords) {
        this.keywords = newKeywords;
        localStorage.setItem('bf_muted_keywords', JSON.stringify(this.keywords));
        this.forceRescan();
    },

    injectStyles() {
        if (document.getElementById('bf-muter-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-muter-css';
        style.textContent = `
            .bf-muted {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    },

    startObserver() {
        this.observer = new MutationObserver(() => {
            if (this.scanTimeout) clearTimeout(this.scanTimeout);
            this.scanTimeout = setTimeout(() => this.scanPage(), 300);
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    },

    forceRescan() {
        // Remove analyzed flags
        document.querySelectorAll('.bf-analyzed').forEach(el => {
            el.classList.remove('bf-analyzed');
        });
        this.scanPage();
    },

    scanPage() {
        if (!this.isActive) return;

        // FEED POSTS: app-post elements
        const posts = document.querySelectorAll('app-post:not(.bf-analyzed)');
        posts.forEach(post => {
            post.classList.add('bf-analyzed');

            if (this.keywords.length === 0) {
                post.classList.remove('bf-muted');
                return;
            }

            const descEl = post.querySelector('.feed-item-description');
            if (!descEl) return;

            const text = descEl.textContent.toLowerCase();
            const shouldHide = this.keywords.some(word => text.includes(word.toLowerCase()));

            if (shouldHide) {
                post.classList.add('bf-muted');
            } else {
                post.classList.remove('bf-muted');
            }
        });

        // DM MESSAGES: app-group-message-collection elements
        const messages = document.querySelectorAll('app-group-message-collection:not(.bf-analyzed)');
        messages.forEach(message => {
            message.classList.add('bf-analyzed');

            if (this.keywords.length === 0) {
                message.classList.remove('bf-muted');
                return;
            }

            // Check message text content
            const textEl = message.querySelector('.message-text');
            if (!textEl) {
                // No text content, don't hide
                return;
            }

            const text = textEl.textContent.toLowerCase();
            const shouldHide = this.keywords.some(word => text.includes(word.toLowerCase()));

            if (shouldHide) {
                message.classList.add('bf-muted');
            } else {
                message.classList.remove('bf-muted');
            }
        });
    }
};
