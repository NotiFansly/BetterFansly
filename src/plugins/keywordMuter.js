// src/plugins/keywordMuter.js

const KeywordMuter = {
    // --- 1. Registry Metadata ---
    id: 'keyword_muter',
    name: 'Keyword Muter',
    //icon: 'fa-filter',

    // --- 2. State Variables ---
    isActive: false,
    observer: null,
    keywords: [],

    // --- 3. UI Renderer (Registry Pattern) ---
    renderToolView() {
        const container = document.createElement('div');

        container.innerHTML = `
            <div class="bf-section-title">Keyword Muter</div>
            <div class="bf-description">Hide posts or messages that contain specific words or phrases.</div>

            <div class="bf-plugin-card" style="display:block;">
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <input type="text" id="mute-input" class="bf-input" placeholder="Enter keyword (e.g. 'anal')" style="margin:0;">
                    <button class="bf-btn" id="mute-add-btn" style="margin:0;">Add</button>
                </div>
                <div style="font-size:12px; font-weight:bold; margin-bottom:10px;">Active Muted Words:</div>
                <div id="mute-list" style="display:flex; flex-wrap:wrap; gap:8px; min-height:50px; background:var(--bf-card-bg); padding:10px; border-radius:6px; align-items: flex-start;"></div>
            </div>
        `;

        // Helper to render the tags
        const renderList = () => {
            const list = container.querySelector('#mute-list');
            list.innerHTML = '';

            if (this.keywords.length === 0) {
                list.innerHTML = '<span style="color:var(--bf-subtext); font-style:italic; padding: 5px;">No keywords added.</span>';
                return;
            }

            this.keywords.forEach((word, idx) => {
                const tag = document.createElement('div');
                Object.assign(tag.style, {
                    background: '#f38ba8',
                    color: '#1e1e2e',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    userSelect: 'none',
                    transition: 'transform 0.1s'
                });

                tag.onmouseover = () => tag.style.transform = 'scale(1.05)';
                tag.onmouseout = () => tag.style.transform = 'scale(1)';

                tag.innerHTML = `<span>${word}</span><i class="fas fa-times" style="font-size: 11px; opacity: 0.7;"></i>`;

                // Remove Handler
                tag.onclick = () => {
                    this.keywords.splice(idx, 1);
                    this.updateKeywords(this.keywords);
                    renderList();
                };
                list.appendChild(tag);
            });
        };

        // Add Button Handler
        const input = container.querySelector('#mute-input');
        const addBtn = container.querySelector('#mute-add-btn');

        const addKeyword = () => {
            const word = input.value.trim();
            if (word) {
                if (!this.keywords.some(w => w.toLowerCase() === word.toLowerCase())) {
                    this.keywords.push(word);
                    this.updateKeywords(this.keywords);
                    if (!this.isActive) this.enable();
                }
                input.value = '';
                renderList();
            }
        };

        addBtn.onclick = addKeyword;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') addKeyword();
        };

        // Initial Render
        renderList();

        return container;
    },

    // --- 4. Core Logic ---

    init() {
        // Load saved keywords
        const saved = localStorage.getItem('bf_muted_keywords');
        this.keywords = saved ? JSON.parse(saved) : [];

        // Auto-enable if keywords exist
        if (this.keywords.length > 0) {
            this.enable();
        }
    },

    enable() {
        if (this.isActive) return;
        this.isActive = true;
        this.injectStyles();
        this.startObserver();
        console.log("BetterFansly: Keyword Muter Enabled", this.keywords);
        this.forceRescan();
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
        // Remove analyzed flags to force re-evaluation
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
            if (!textEl) return; // No text content

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

// --- Registration & Initialization ---

// 1. Register as a Tool (for the UI Tab)
if (window.BF_Registry) {
    window.BF_Registry.registerTool(KeywordMuter);
} else {
    window.KeywordMuter = KeywordMuter;
}

// 2. Initialize Logic (Auto-start if keywords exist)
KeywordMuter.init();
