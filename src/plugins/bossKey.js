const BossKey = {
    id: 'boss_key',
    name: 'Boss Key (Panic Button)',
    description: 'Press ESC to instantly hide everything behind a fake spreadsheet.',
    defaultEnabled: false,

    active: false,
    overlay: null,

    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold;">${this.name}</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">
                        Triggers on <kbd style="background:#333; padding:2px 4px; border-radius:3px;">ESC</kbd> key.
                    </div>
                </div>
                <input type="checkbox" class="bf-toggle" id="bk-toggle" 
                    ${localStorage.getItem('bf_plugin_enabled_boss_key') === 'true' ? 'checked' : ''}>
            </div>
            <div style="margin-top:10px;">
                <label style="font-size:12px; display:block; margin-bottom:5px;">Decoy Image URL:</label>
                <input type="text" id="bk-url" class="bf-input" placeholder="https://..." 
                    value="${localStorage.getItem('bf_boss_key_url') || 'https://macabacus.com/assets/2024/05/paste-options-excel.png'}">
            </div>
        `;

        container.querySelector('#bk-toggle').onchange = (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('bf_plugin_enabled_boss_key', enabled);
            enabled ? this.enable() : this.disable();
        };

        container.querySelector('#bk-url').onchange = (e) => {
            localStorage.setItem('bf_boss_key_url', e.target.value);
        };

        return container;
    },

    enable() {
        if (this.active) return;
        this.active = true;
        document.addEventListener('keydown', this.handleKey);
        console.log('BF: Boss Key Enabled');
    },

    disable() {
        this.active = false;
        document.removeEventListener('keydown', this.handleKey);
        this.removeOverlay();
    },

    handleKey: (e) => {
        // Allow user to close it with ESC as well
        if (e.key === 'Escape') {
            const instance = window.BF_Registry.plugins.find(p => p.id === 'boss_key');
            if (instance) instance.toggleOverlay();
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
        const url = localStorage.getItem('bf_boss_key_url') || 'https://i.imgur.com/QpZ19gS.png'; // Generic Spreadsheet screenshot

        this.overlay = document.createElement('div');
        this.overlay.id = 'bf-boss-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: #fff url('${url}') no-repeat center center;
            background-size: cover;
            z-index: 9999999;
            cursor: pointer;
        `;

        // Stop video playback when panic is triggered
        document.querySelectorAll('video').forEach(v => {
            if (!v.paused) {
                v.pause();
                v.dataset.bfPausedByBoss = "true";
            }
        });

        // Mute audio
        this.prevMuteState = false; // logic to restore volume could go here

        document.body.appendChild(this.overlay);
        document.title = "Quarterly Report - Excel"; // Change tab title

        // Remove on click
        this.overlay.onclick = () => this.toggleOverlay();
    },

    removeOverlay() {
        if (!this.overlay) return;
        this.overlay.remove();
        this.overlay = null;
        document.title = "Fansly"; // Restore title (ideally store original title)

        // Resume videos
        document.querySelectorAll('video').forEach(v => {
            if (v.dataset.bfPausedByBoss === "true") {
                v.play();
                delete v.dataset.bfPausedByBoss;
            }
        });
    }
};

window.BF_Registry.registerPlugin(BossKey);
