// src/plugins/ghostMode.js

const GhostMode = {
    // --- 1. Registry Metadata ---
    id: 'ghost_mode',
    name: 'Ghost Mode 👻',
    description: 'Stealthily read, view, and type.',
    defaultEnabled: false,

    // --- 2. State ---
    isInjected: false,

    // --- 3. UI Renderer ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';
        // Override flex display to allow vertical stacking for the submenu
        container.style.display = 'block';
        container.style.transition = 'all 0.2s';

        // Load State
        const isEnabled = localStorage.getItem('bf_plugin_enabled_ghost_mode') === 'true';

        // Initialize defaults for sub-settings if they don't exist
        if (localStorage.getItem('bf_ghost_read') === null) localStorage.setItem('bf_ghost_read', 'true');
        if (localStorage.getItem('bf_ghost_story') === null) localStorage.setItem('bf_ghost_story', 'true');
        if (localStorage.getItem('bf_ghost_typing') === null) localStorage.setItem('bf_ghost_typing', 'true');
        if (localStorage.getItem('bf_ghost_status') === null) localStorage.setItem('bf_ghost_status', 'true');

        // Helper to generate checkbox HTML
        const createSubOption = (id, label, storageKey) => {
            const checked = localStorage.getItem(storageKey) !== 'false' ? 'checked' : '';
            return `
                <label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer;">
                    <input type="checkbox" class="bf-checkbox" id="${id}" ${checked}>
                    <span style="margin-left: 10px; font-size: 13px;">${label}</span>
                </label>
            `;
        };

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; gap: 10px; align-items: center;">
                    <div>
                        <div style="font-weight:bold;">${this.name}</div>
                        <div style="font-size:12px; color:var(--bf-subtext);">${this.description}</div>
                    </div>
                    <!-- Chevron for visual feedback -->
                    <div id="gm-chevron-btn" style="cursor:pointer; padding:5px; display:${isEnabled ? 'block' : 'none'}; color:var(--bf-accent);">
                        <i class="fas fa-chevron-down" id="gm-chevron" style="transition: transform 0.2s;"></i>
                    </div>
                </div>
                <input type="checkbox" class="bf-toggle" id="gm-master-toggle" ${isEnabled ? 'checked' : ''}>
            </div>

            <!-- Sub-Menu -->
            <div id="gm-submenu" style="display: none; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--bf-border);">
                <div style="font-size: 11px; font-weight: bold; color: var(--bf-subtext); margin-bottom: 10px; text-transform: uppercase;">
                    Active Protections
                </div>
                ${createSubOption('gm-sub-read', 'Block <b>Read Receipts</b> (Messages)', 'bf_ghost_read')}
                ${createSubOption('gm-sub-story', 'Block <b>Story Views</b> (Lurk)', 'bf_ghost_story')}
                ${createSubOption('gm-sub-typing', 'Block <b>Typing Indicator</b>', 'bf_ghost_typing')}
                ${createSubOption('gm-sub-status', 'Block <b>Online Status</b> (Appear Offline)', 'bf_ghost_status')}
            </div>
        `;

        // --- Event Listeners ---
        const masterToggle = container.querySelector('#gm-master-toggle');
        const chevronBtn = container.querySelector('#gm-chevron-btn');
        const chevronIcon = container.querySelector('#gm-chevron');
        const submenu = container.querySelector('#gm-submenu');

        // 1. Master Toggle Logic
        masterToggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem('bf_plugin_enabled_ghost_mode', active);
            // Legacy key for interceptor compatibility
            localStorage.setItem('bf_ghost_mode', active);

            if (active) {
                this.enable();
                chevronBtn.style.display = 'block';
                submenu.style.display = 'block'; // Auto-open on enable
                chevronIcon.style.transform = 'rotate(180deg)';
            } else {
                this.disable();
                chevronBtn.style.display = 'none';
                submenu.style.display = 'none';
                chevronIcon.style.transform = 'rotate(0deg)';
            }
        };

        // 2. Sub-menu Toggle Logic (Clicking the chevron)
        chevronBtn.onclick = () => {
            const isHidden = submenu.style.display === 'none';
            submenu.style.display = isHidden ? 'block' : 'none';
            chevronIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        // 3. Bind Sub-Checkboxes to LocalStorage
        const bindSub = (id, key) => {
            container.querySelector(`#${id}`).onchange = (e) => localStorage.setItem(key, e.target.checked);
        };
        bindSub('gm-sub-read', 'bf_ghost_read');
        bindSub('gm-sub-story', 'bf_ghost_story');
        bindSub('gm-sub-typing', 'bf_ghost_typing');
        bindSub('gm-sub-status', 'bf_ghost_status');

        return container;
    },

    // --- 4. Core Logic ---

    enable() {
        // Ensure legacy key is set for the interceptor script
        localStorage.setItem('bf_ghost_mode', 'true');
        this.injectInterceptor();
        console.log("BetterFansly: Ghost Mode Enabled 👻");
    },

    disable() {
        localStorage.setItem('bf_ghost_mode', 'false');
        console.log("BetterFansly: Ghost Mode Disabled");
    },

    injectInterceptor() {
        // Prevent double injection
        if (this.isInjected || document.getElementById('bf-ghost-script')) return;

        const script = document.createElement('script');
        script.id = 'bf-ghost-script';

        // Load from file to bypass CSP
        script.src = chrome.runtime.getURL('src/injections/interceptor.js');

        // Inject into <html> to ensure it runs as early as possible
        (document.head || document.documentElement).appendChild(script);
        this.isInjected = true;
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(GhostMode);
} else {
    window.GhostMode = GhostMode;
}
