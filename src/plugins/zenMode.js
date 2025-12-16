// src/plugins/zenMode.js

const ZenMode = {
    // --- 1. Registry Metadata ---
    id: 'zen_mode',
    name: 'Zen Mode 🧘',
    description: 'Distraction-free browsing: hides sidebars, suggestions, and online bars.',
    defaultEnabled: false,

    // --- 2. State Variables ---
    isActive: false,
    toggleButton: null,

    // --- 3. UI Renderer (Registry Pattern) ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';

        container.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight:bold;">${this.name}</div>
                <div style="font-size:12px; color:var(--bf-subtext); margin-bottom: 8px;">
                    ${this.description}
                </div>
                <div style="font-size:11px; color:var(--bf-subtext); margin-top: 8px;">
                    💡 Tip: Use Ctrl+Shift+Z (Cmd+Shift+Z on Mac) to quickly toggle Zen Mode.
                </div>
            </div>
            <input type="checkbox" class="bf-toggle">
        `;

        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;

        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            active ? this.enable() : this.disable();
        };

        return container;
    },

    // --- 4. Core Logic ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.injectStyles();
        this.setupKeyboardShortcut();

        // Check if Zen Mode was active in previous session
        const wasActive = localStorage.getItem('bf_zen_mode_active') === 'true';
        if (wasActive) {
            this.activateZenMode();
        }

        console.log("BetterFansly: Zen Mode Enabled 🧘 (Ctrl+Shift+Z to toggle)");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        this.deactivateZenMode();
        this.removeKeyboardShortcut();

        const style = document.getElementById('bf-zen-mode-css');
        if (style) style.remove();

        localStorage.removeItem('bf_zen_mode_active');
        console.log("BetterFansly: Zen Mode Disabled");
    },

    // --- Keyboard Shortcut ---

    setupKeyboardShortcut() {
        this.keyboardHandler = (e) => {
            // Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                const isCurrentlyActive = document.body.classList.contains('bf-zen-active');
                if (isCurrentlyActive) {
                    this.deactivateZenMode();
                } else {
                    this.activateZenMode();
                }
            }
        };
        document.addEventListener('keydown', this.keyboardHandler);
    },

    removeKeyboardShortcut() {
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
    },

    // --- Styles ---

    injectStyles() {
        if (document.getElementById('bf-zen-mode-css')) return;

        const style = document.createElement('style');
        style.id = 'bf-zen-mode-css';
        style.textContent = `
            /* --- Zen Mode Active State --- */
            body.bf-zen-active {
                /* Hide Right Sidebar */
                app-side-bar-right,
                .side-bar-wrapper {
                    display: none !important;
                }

                /* Hide Left Sidebar Menu Text (Keep Icons) */
                .app-nav-menu-side .menu-text {
                    display: none !important;
                }

                /* Hide Suggestions & FYP Gallery */
                app-media-offer-suggestions-timeline-post,
                .fyp-gallery-wrapper {
                    display: none !important;
                }

                /* Hide Stories Scroll */
                app-following-media-stories,
                .stories-scroll-container {
                    display: none !important;
                }

                /* Hide Online Streams Bar */
                app-online-following-streams,
                .feed-suggestions-wrapper {
                    display: none !important;
                }

                /* Hide Suggestion Sidebars in Explore */
                app-suggestions-side-bar-new {
                    display: none !important;
                }

                /* Hide Tag Clouds */
                .tags.flex-row.flex-wrap {
                    display: none !important;
                }

                /* --- Expand Main Content --- */

                /* Timeline Feed Container */
                app-timeline,
                .feed-content {
                    max-width: 100% !important;
                    width: 100% !important;
                }

                /* Homepage Feed Wrapper */
                .feed-content-wrapper {
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                    padding: 0 20px !important;
                }

                /* Profile Pages */
                .profile-content-wrapper {
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                    padding: 0 20px !important;
                }

                /* FULL WIDTH POSTS - Expand to fill timeline */
                app-post.feed-item {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    align-self: stretch !important;
                }

                /* Post Content - Also Full Width */
                .feed-item-content {
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 20px !important;
                    box-sizing: border-box !important;
                }

                /* Media Containers - Respect Content Width */
                app-post .feed-item-preview,
                app-post .feed-item-preview.single-preview,
                app-post .feed-item-preview-media-list {
                    max-width: 100% !important;
                    width: 100% !important;
                }

                /* Collapse Left Sidebar to Icon-Only */
                .app-nav-menu-side {
                    width: 60px !important;
                    min-width: 60px !important;
                }

                .app-nav-menu-side .nav-item {
                    justify-content: center !important;
                    padding: 0 !important;
                }

                .app-nav-menu-side .nav-item i {
                    margin: 0 !important;
                }
            }

            /* --- Smooth Transitions --- */
            .feed-content-wrapper,
            .profile-content-wrapper,
            app-post,
            .feed-item,
            .app-nav-menu-side {
                transition: all 0.3s ease !important;
            }

            /* --- Zen Mode Toast Notification --- */
            .bf-zen-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                background: var(--accent-color, #a855f7);
                color: var(--primary-bg, #fff);
                padding: 12px 24px;
                border-radius: 30px;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                animation: zenToastIn 0.3s ease-out;
                pointer-events: none;
            }

            @keyframes zenToastIn {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }

            .bf-zen-toast.fade-out {
                animation: zenToastOut 0.3s ease-out forwards;
            }

            @keyframes zenToastOut {
                from {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(-50%) translateY(20px);
                }
            }
        `;
        document.head.appendChild(style);
    },

    // --- Zen Mode Toggle Logic ---

    activateZenMode() {
        document.body.classList.add('bf-zen-active');
        localStorage.setItem('bf_zen_mode_active', 'true');
        this.showToast('🧘 Zen Mode Activated');
        console.log("BetterFansly: Zen Mode Activated 🧘");
    },

    deactivateZenMode() {
        document.body.classList.remove('bf-zen-active');
        localStorage.setItem('bf_zen_mode_active', 'false');
        this.showToast('👁️ Zen Mode Deactivated');
        console.log("BetterFansly: Zen Mode Deactivated");
    },

    // --- Toast Notification ---

    showToast(message) {
        // Remove existing toast if present
        const existingToast = document.querySelector('.bf-zen-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'bf-zen-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto-remove after 2 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(ZenMode);
} else {
    window.ZenMode = ZenMode;
}
