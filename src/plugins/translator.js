// src/plugins/translator.js

const Translator = {
    // --- 1. Registry Metadata ---
    id: 'translator',
    name: 'Chat Translator',
    description: 'Native translation for DMs, Feed posts, and the Input bar.',
    defaultEnabled: false,

    // --- 2. State Variables ---
    isActive: false,
    targetLang: 'en', // Default
    observer: null,

    // --- 3. Language Configuration ---
    languages: {
        // European Languages
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'pt-BR': 'Portuguese (Brazil)',
        'nl': 'Dutch',
        'pl': 'Polish',
        'ru': 'Russian',
        'uk': 'Ukrainian',
        'cs': 'Czech',
        'sv': 'Swedish',
        'no': 'Norwegian',
        'da': 'Danish',
        'fi': 'Finnish',
        'ro': 'Romanian',
        'tr': 'Turkish',
        'el': 'Greek',
        'hu': 'Hungarian',
        'bg': 'Bulgarian',
        'hr': 'Croatian',
        'sk': 'Slovak',

        // Asian Languages
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'ja': 'Japanese',
        'ko': 'Korean',
        'th': 'Thai',
        'vi': 'Vietnamese',
        'id': 'Indonesian',
        'ms': 'Malay',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'ta': 'Tamil',
        'te': 'Telugu',
        'ur': 'Urdu',

        // Middle Eastern & African
        'ar': 'Arabic',
        'he': 'Hebrew',
        'fa': 'Persian',
        'sw': 'Swahili',

        // Other Languages
        'la': 'Latin',
        'eo': 'Esperanto'
    },

    // --- 4. UI Renderer (Registry Pattern) ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        // Load Saved State
        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';
        const savedLang = localStorage.getItem('bf_translator_lang') || 'en';
        this.targetLang = savedLang;

        // Generate language options grouped by region
        const generateOptions = () => {
            const groups = {
                'European': ['en', 'es', 'fr', 'de', 'it', 'pt', 'pt-BR', 'nl', 'pl', 'ru', 'uk', 'cs', 'sv', 'no', 'da', 'fi', 'ro', 'tr', 'el', 'hu', 'bg', 'hr', 'sk'],
                'Asian': ['zh-CN', 'zh-TW', 'ja', 'ko', 'th', 'vi', 'id', 'ms', 'hi', 'bn', 'ta', 'te', 'ur'],
                'Middle Eastern & African': ['ar', 'he', 'fa', 'sw'],
                'Other': ['la', 'eo']
            };

            let html = '';
            for (const [region, codes] of Object.entries(groups)) {
                html += `<optgroup label="${region}">`;
                codes.forEach(code => {
                    html += `<option value="${code}">${this.languages[code]}</option>`;
                });
                html += '</optgroup>';
            }
            return html;
        };

        container.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight:bold;">${this.name}</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom: 8px;">
                    ${this.description}
                </div>
                
                <!-- Language Selector -->
                <select id="translator-lang-select" class="bf-input" style="width: auto; font-size: 11px; padding: 4px;">
                    ${generateOptions()}
                </select>
            </div>
            <input type="checkbox" class="bf-toggle">
        `;

        // 1. Bind Language Select
        const langSelect = container.querySelector('#translator-lang-select');
        langSelect.value = savedLang;
        langSelect.onchange = (e) => {
            const val = e.target.value;
            localStorage.setItem('bf_translator_lang', val);
            this.setTargetLang(val);
        };

        // 2. Bind Toggle
        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;
        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            // Legacy key support
            localStorage.setItem('bf_translator_enabled', active);

            active ? this.enable() : this.disable();
        };

        return container;
    },

    // --- 5. Core Logic ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        // Load saved language preference
        this.targetLang = localStorage.getItem('bf_translator_lang') || 'en';

        this.injectStyles();
        this.startObserver();
        console.log(`BetterFansly: Translator Enabled (${this.languages[this.targetLang]})`);
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.observer) this.observer.disconnect();

        document.querySelectorAll('.bf-translate-btn, .bf-translator-result').forEach(el => el.remove());
        document.querySelectorAll('.bf-translated-input-btn').forEach(el => el.remove());
        console.log("BetterFansly: Translator Disabled");
    },

    // --- Handle Live Language Switching ---
    setTargetLang(newLang) {
        this.targetLang = newLang;

        // Update the Tooltip on the Input Bar
        const inputBtn = document.querySelector('.bf-translated-input-btn');
        if (inputBtn) {
            inputBtn.title = `Translate input to ${this.languages[this.targetLang]}`;
        }

        // Update all existing "Translate" buttons on the page
        document.querySelectorAll('.bf-translate-btn').forEach(btn => {
            btn.innerHTML = `<i class="fas fa-language"></i> Translate (${this.languages[this.targetLang]})`;
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
            const container = parent || msg;

            this.createTranslateButton(container, msg.innerText);
        });
    },

    // --- Helper: Create the Button ---
    createTranslateButton(container, textToTranslate) {
        const btn = document.createElement('div');
        btn.className = 'bf-translate-btn';
        btn.innerHTML = `<i class="fas fa-language"></i> Translate (${this.languages[this.targetLang]})`;

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
        container.title = `Translate input to ${this.languages[this.targetLang]}`;

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
        btnElement.style.display = 'none';

        const result = await this.fetchTranslation(text, this.targetLang);

        if (result) {
            const resultBox = document.createElement('div');
            resultBox.className = 'bf-translator-result';

            resultBox.innerHTML = `
                <div class="bf-result-header">
                    <span class="bf-lang-label">Translated (${this.languages[this.targetLang]})</span>
                    <span class="bf-close-btn"><i class="fas fa-times"></i></span>
                </div>
                <div>${result}</div>
            `;

            resultBox.querySelector('.bf-close-btn').onclick = (e) => {
                e.stopPropagation();
                resultBox.remove();
                btnElement.style.display = 'inline-block';
            };

            containerElement.appendChild(resultBox);
        } else {
            btnElement.style.display = 'inline-block';
            btnElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
            setTimeout(() => {
                btnElement.innerHTML = `<i class="fas fa-language"></i> Translate (${this.languages[this.targetLang]})`;
            }, 2000);
        }
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(Translator);
} else {
    window.Translator = Translator;
}
