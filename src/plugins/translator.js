const Translator = {
    isActive: false,
    targetLang: 'en', // Default
    observer: null,

    enable() {
        if (this.isActive) return;
        this.isActive = true;
        this.injectStyles();
        this.startObserver();
        console.log("BetterFansly: Translator Enabled");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.observer) this.observer.disconnect();

        document.querySelectorAll('.bf-translate-btn, .bf-translator-result').forEach(el => el.remove());
        document.querySelectorAll('.bf-translated-input-btn').forEach(el => el.remove());
    },

    // --- NEW: Handle Live Language Switching ---
    setTargetLang(newLang) {
        this.targetLang = newLang;

        // Update the Tooltip on the Input Bar
        const inputBtn = document.querySelector('.bf-translated-input-btn');
        if (inputBtn) {
            inputBtn.title = `Translate input to ${this.targetLang.toUpperCase()}`;
        }

        // Update all existing "Translate" buttons on the page
        document.querySelectorAll('.bf-translate-btn').forEach(btn => {
            btn.innerHTML = `<i class="fas fa-language"></i> Translate (${this.targetLang.toUpperCase()})`;
        });
    },

    // --- Core Translation Engine ---
    async fetchTranslation(text, targetLang) {
        try {
            const destination = targetLang || this.targetLang;
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${destination}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const json = await res.json();

            if (json && json[0]) {
                return json[0].map(x => x[0]).join('');
            }
            return null;
        } catch (e) {
            console.error("Translation failed", e);
            return null;
        }
    },

    // --- UI Logic ---

    startObserver() {
        let timeout;
        this.observer = new MutationObserver(() => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.scanFeed();
                this.scanMessages();
                this.injectInputButton();
            }, 500);
        });

        this.observer.observe(document.body, { childList: true, subtree: true });

        this.scanFeed();
        this.scanMessages();
        this.injectInputButton();
    },

    injectStyles() {
        if (document.getElementById('bf-translator-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-translator-css';
        style.textContent = `
            .bf-translate-btn {
                font-size: 11px;
                color: var(--font-tint-2);
                cursor: pointer;
                margin-top: 5px;
                display: inline-block;
                opacity: 0.7;
                transition: 0.2s;
            }
            .bf-translate-btn:hover {
                color: var(--blue-1);
                opacity: 1;
                text-decoration: underline;
            }
            /* Compact Result Box */
            .bf-translator-result {
                margin-top: 6px;
                padding: 6px 8px;
                background: var(--dark-2);
                border-left: 3px solid var(--blue-1);
                border-radius: 4px;
                font-size: 0.95em;
                color: var(--font-1);
                animation: fadeIn 0.2s;
                user-select: text;
                white-space: pre-wrap;
                position: relative;
            }
            /* Header for Close Button */
            .bf-result-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                padding-bottom: 2px;
            }
            .bf-lang-label {
                font-size: 9px; 
                color: var(--font-tint-2); 
                text-transform: uppercase;
                font-weight: bold;
            }
            .bf-close-btn {
                cursor: pointer;
                color: var(--font-tint-2);
                font-size: 10px;
                padding: 0 4px;
            }
            .bf-close-btn:hover {
                color: #f38ba8; /* Red hover */
            }
            .bf-spinner {
                display: inline-block;
                animation: spin 1s linear infinite;
            }
            .bf-translated-input-btn svg {
                fill: currentColor;
                width: 18px;
                height: 18px;
                vertical-align: middle;
            }
            @keyframes spin { 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    },

    // --- 1. Feed Posts ---
    scanFeed() {
        const descriptions = document.querySelectorAll('app-post .feed-item-description:not(.bf-tr-checked)');

        descriptions.forEach(desc => {
            desc.classList.add('bf-tr-checked');
            if (!desc.innerText.trim()) return;

            this.createTranslateButton(desc, desc.innerText);
        });
    },

    // --- 2. Chat Messages ---
    scanMessages() {
        const messages = document.querySelectorAll('app-group-message .message-text:not(.bf-tr-checked)');

        messages.forEach(msg => {
            msg.classList.add('bf-tr-checked');
            if (!msg.innerText.trim()) return;

            const parent = msg.closest('.message');
            // If the message is inside a bubble, we append the button to the parent wrapper
            // otherwise we append to the text div itself
            const container = parent || msg;

            this.createTranslateButton(container, msg.innerText);
        });
    },

    // --- Helper: Create the Button ---
    createTranslateButton(container, textToTranslate) {
        const btn = document.createElement('div');
        btn.className = 'bf-translate-btn';
        btn.innerHTML = `<i class="fas fa-language"></i> Translate (${this.targetLang.toUpperCase()})`;

        btn.onclick = (e) => {
            e.stopPropagation();
            this.performTranslation(container, btn, textToTranslate);
        };

        container.appendChild(btn);
    },

    // --- 3. Chat Input ---
    injectInputButton() {
        const toolbar = document.querySelector('app-group-message-input .actions');
        if (!toolbar || toolbar.querySelector('.bf-translated-input-btn')) return;

        const container = document.createElement('div');
        container.className = 'input-addon dark-blue-1 blue-1-hover-only pointer margin-right-2 bf-translated-input-btn';
        container.title = `Translate input to ${this.targetLang.toUpperCase()}`;

        container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="hover-effect">
                <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
        `;

        container.onclick = async () => {
            const textarea = document.querySelector('app-group-message-input textarea');
            if (!textarea || !textarea.value.trim()) return;

            container.innerHTML = `<i class="fa-fw fas fa-spinner bf-spinner"></i>`;

            const originalText = textarea.value;
            const translated = await this.fetchTranslation(originalText, this.targetLang);

            if (translated) {
                textarea.value = translated;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }

            container.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="hover-effect">
                    <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                </svg>
            `;
        };

        toolbar.insertBefore(container, toolbar.firstChild);
    },

    // --- Helper: Execute Translation UI ---
    async performTranslation(containerElement, btnElement, text) {
        // 1. Hide the original button while loading
        btnElement.style.display = 'none';

        const result = await this.fetchTranslation(text, this.targetLang);

        if (result) {
            // 2. Create the result box
            const resultBox = document.createElement('div');
            resultBox.className = 'bf-translator-result';

            // 3. Add Close Button Logic
            resultBox.innerHTML = `
                <div class="bf-result-header">
                    <span class="bf-lang-label">Translated (${this.targetLang})</span>
                    <span class="bf-close-btn"><i class="fas fa-times"></i></span>
                </div>
                <div>${result}</div>
            `;

            // 4. Handle Close Click
            resultBox.querySelector('.bf-close-btn').onclick = (e) => {
                e.stopPropagation();
                resultBox.remove();
                btnElement.style.display = 'inline-block'; // Show the button again
            };

            containerElement.appendChild(resultBox);
        } else {
            // Error state: Show button again and alert
            btnElement.style.display = 'inline-block';
            btnElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
            setTimeout(() => {
                btnElement.innerHTML = `<i class="fas fa-language"></i> Translate (${this.targetLang.toUpperCase()})`;
            }, 2000);
        }
    }
};

window.Translator = Translator;
