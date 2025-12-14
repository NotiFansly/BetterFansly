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
            // Force a full scan on enable
            this.forceRescan();
        }
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.observer) this.observer.disconnect();

        // Unhide everything immediately
        document.querySelectorAll('.bf-post-hidden').forEach(el => {
            el.classList.remove('bf-post-hidden');
        });

        console.log("BetterFansly: Keyword Muter Disabled");
    },

    updateKeywords(newKeywords) {
        this.keywords = newKeywords;
        localStorage.setItem('bf_muted_keywords', JSON.stringify(this.keywords));

        // KEY CHANGE: Force a re-scan of EVERYTHING when keywords change.
        // This ensures that if you delete a keyword, the posts reappear.
        this.forceRescan();
    },

    injectStyles() {
        if (document.getElementById('bf-muter-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-muter-css';
        style.textContent = `
            .bf-post-hidden {
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
        // Remove the "checked" flag from all posts so they get re-evaluated
        document.querySelectorAll('.bf-analyzed').forEach(el => {
            el.classList.remove('bf-analyzed');
        });
        this.scanPage();
    },

    scanPage() {
        if (!this.isActive) return;

        // Select all posts that haven't been analyzed since the last keyword update
        const posts = document.querySelectorAll('app-post:not(.bf-analyzed)');

        posts.forEach(post => {
            post.classList.add('bf-analyzed');

            // If no keywords, ensure we show the post and exit
            if (this.keywords.length === 0) {
                post.classList.remove('bf-post-hidden');
                return;
            }

            // Find the description text
            const descEl = post.querySelector('.feed-item-description');

            // If no text, we assume it's safe (or just media)
            if (!descEl) return;

            // CASE INSENSITIVITY: Convert everything to lowercase
            const text = descEl.textContent.toLowerCase();

            // Check if any keyword matches
            const shouldHide = this.keywords.some(word => text.includes(word.toLowerCase()));

            if (shouldHide) {
                post.classList.add('bf-post-hidden');
                // console.log("BetterFansly: Hiding post");
            } else {
                // IMPORTANT: Ensure it is visible if it doesn't match
                // (This handles the case where you removed a keyword)
                post.classList.remove('bf-post-hidden');
            }
        });
    }
};
