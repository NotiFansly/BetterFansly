const BossKey = {
    id: 'boss_key',
    name: 'Boss Key (Panic Button)',
    description: 'Instantly hide everything behind a fake spreadsheet.',
    defaultEnabled: false,

    active: false,
    overlay: null,
    boundHandler: null,

    // Default: Backtick (`)
    keybind: JSON.parse(localStorage.getItem('bf_boss_key_bind') || '{"key":"`","ctrl":false,"alt":false,"shift":false,"meta":false}'),

    // --- Settings UI ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';
        // Allow block display for vertical layout
        container.style.display = 'block';

        const readableKey = this.getReadableKeybind();
        const isEnabled = localStorage.getItem('bf_plugin_enabled_boss_key') === 'true';

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <div>
                    <div style="font-weight:bold;">${this.name}</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">
                        Protect your privacy instantly.
                    </div>
                </div>
                <input type="checkbox" class="bf-toggle" id="bk-toggle" ${isEnabled ? 'checked' : ''}>
            </div>

            <!-- Keybind Section -->
            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bf-surface-0); padding:8px; border-radius:6px; margin-bottom:10px;">
                <span style="font-size:12px; color:var(--bf-subtext);">Trigger Key:</span>
                <button id="bk-record-btn" class="bf-btn" style="padding:4px 10px; font-size:12px; min-width:80px;">
                    ${readableKey}
                </button>
            </div>

            <!-- Image Section -->
            <div>
                <label style="font-size:12px; display:block; margin-bottom:5px;">Decoy Image URL:</label>
                <input type="text" id="bk-url" class="bf-input" placeholder="https://..." 
                    value="${localStorage.getItem('bf_boss_key_url') || 'https://macabacus.com/assets/2024/05/paste-options-excel.png'}">
            </div>
            <div style="font-size:10px; color:var(--bf-subtext); margin-top:5px; font-style:italic;">
                Tip: Use a screenshot of your actual work desktop.
            </div>
        `;

        // Toggle Logic
        container.querySelector('#bk-toggle').onchange = (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('bf_plugin_enabled_boss_key', enabled);
            enabled ? this.enable() : this.disable();
        };

        // URL Logic
        container.querySelector('#bk-url').onchange = (e) => {
            localStorage.setItem('bf_boss_key_url', e.target.value);
        };

        // Recorder Logic
        const btn = container.querySelector('#bk-record-btn');
        btn.onclick = () => {
            btn.innerText = 'Press Key...';
            btn.style.background = 'var(--bf-accent)';
            btn.style.color = '#fff';

            const recorder = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Ignore modifier-only presses
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

                const newBind = {
                    key: e.key,
                    ctrl: e.ctrlKey,
                    alt: e.altKey,
                    shift: e.shiftKey,
                    meta: e.metaKey
                };

                this.keybind = newBind;
                localStorage.setItem('bf_boss_key_bind', JSON.stringify(newBind));

                // Re-bind
                this.disable();
                this.enable();

                btn.innerText = this.getReadableKeybind();
                btn.style.background = '';
                btn.style.color = '';

                document.removeEventListener('keydown', recorder);
            };

            document.addEventListener('keydown', recorder);
        };

        return container;
    },

    getReadableKeybind() {
        const k = this.keybind;
        let str = '';
        if (k.ctrl) str += 'Ctrl + ';
        if (k.alt) str += 'Alt + ';
        if (k.shift) str += 'Shift + ';
        if (k.meta) str += 'Cmd + ';

        // Handle Backtick display
        const keyDisplay = k.key === '`' ? 'Backtick (`)' : k.key.toUpperCase();
        return str + keyDisplay;
    },

    // --- Core Logic ---

    enable() {
        if (!this.boundHandler) {
            this.boundHandler = (e) => this.handleKey(e);
        }
        document.addEventListener('keydown', this.boundHandler);
        console.log('BetterFansly: Boss Key Enabled');
    },

    disable() {
        if (this.boundHandler) {
            document.removeEventListener('keydown', this.boundHandler);
        }
        this.removeOverlay();
        console.log('BetterFansly: Boss Key Disabled');
    },

    handleKey(e) {
        const k = this.keybind;

        // Check if key matches settings
        if (e.key.toLowerCase() === k.key.toLowerCase() &&
            e.ctrlKey === k.ctrl &&
            e.altKey === k.alt &&
            e.shiftKey === k.shift &&
            e.metaKey === k.meta) {

            e.preventDefault();
            e.stopPropagation();
            this.toggleOverlay();
        }

        // Legacy Support: Always allow ESC to close the overlay if it is open
        if (e.key === 'Escape' && this.overlay) {
            this.removeOverlay();
        }
    },

    toggleOverlay() {
        if (this.overlay) {
            this.removeOverlay();
        } else {
            this.showOverlay();
        }
    },

    showOverlay() {
        const url = localStorage.getItem('bf_boss_key_url') || 'https://macabacus.com/assets/2024/05/paste-options-excel.png';

        this.overlay = document.createElement('div');
        this.overlay.id = 'bf-boss-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: #fff url('${url}') no-repeat center center;
            background-size: cover;
            z-index: 2147483647; /* Max Z-Index */
            cursor: default;
        `;

        // Stop all videos
        document.querySelectorAll('video').forEach(v => {
            if (!v.paused) {
                v.pause();
                v.dataset.bfPausedByBoss = "true";
            }
        });

        document.body.appendChild(this.overlay);

        // Save old title
        this.originalTitle = document.title;
        document.title = "Quarterly Report.xlsx - Excel";

        // Remove on click? Optional. Usually safer to require key press.
        // But for UX we allow double click to close
        this.overlay.ondblclick = () => this.toggleOverlay();
    },

    removeOverlay() {
        if (!this.overlay) return;
        this.overlay.remove();
        this.overlay = null;

        if (this.originalTitle) document.title = this.originalTitle;

        // Resume videos that we paused
        document.querySelectorAll('video').forEach(v => {
            if (v.dataset.bfPausedByBoss === "true") {
                v.play();
                delete v.dataset.bfPausedByBoss;
            }
        });
    }
};

window.BF_Registry.registerPlugin(BossKey);
