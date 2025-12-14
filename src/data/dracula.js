// src/data/dracula.js

if (typeof window.BF_Themes === 'undefined') window.BF_Themes = {};

window.BF_Themes['dracula'] = {
    name: "Dracula",
    options: {
        // Dracula officially only has one dark mode, but we keep the structure consistent
        flavors: ['original'],
        accents: ['purple', 'pink', 'red', 'orange', 'yellow', 'green', 'cyan', 'white']
    },

    palettes: {
        original: {
            // Backgrounds
            base: "#282a36",       // Main Background
            mantle: "#21222c",     // Sidebar (Slightly darker than base)
            crust: "#191a21",      // Dropdowns (Darkest)

            // Surfaces (Used for cards/inputs)
            surface2: "#6272a4",   // Comment
            surface1: "#44475a",   // Current Line / Selection
            surface0: "#44475a",   // Borders

            // Text
            text: "#f8f8f2",       // Foreground
            subtext1: "#f8f8f2",
            subtext0: "#bfbfbf",

            // Overlays (Dimmed text)
            overlay2: "#6272a4",
            overlay1: "#4d5b80",
            overlay0: "#3d466b",

            // Accents
            purple: "#bd93f9",
            pink: "#ff79c6",
            red: "#ff5555",
            orange: "#ffb86c",
            yellow: "#f1fa8c",
            green: "#50fa7b",
            cyan: "#8be9fd",
            white: "#f8f8f2"
        }
    },

    shouldUseDarkText: function(flavorName, accentName) {
        // These bright pastel colors need dark text for readability
        const lightAccents = ['yellow', 'green', 'cyan', 'orange', 'pink'];
        return lightAccents.includes(accentName);
    },

    generateCSS: function(flavorName, accentName) {
        // Defaults
        if (!flavorName) flavorName = 'original';
        if (!accentName) accentName = 'purple';

        const C = this.palettes[flavorName];
        const accent = C[accentName];

        return `
            :root {
                /* --- Backgrounds --- */
                --primary-bg: ${C.base} !important;
                --secondary-bg: ${C.mantle} !important;
                --leaderboard-background: ${C.mantle} !important;
                --landing-bg-1: ${C.base} !important;
                --landing-bg-2: ${C.mantle} !important;
                --radial-bg-1: ${C.mantle} !important;
                --radial-bg-2: ${C.base} !important;
                --modal-bg: ${C.base} !important;
                --dropdown-bg-color: ${C.mantle} !important;
                --dropdown-bg-color-hover: ${C.surface1} !important;
                --selected-tab: ${C.surface1} !important;
                
                /* Fansly Specific Dark Variables */
                --dark-1: ${C.base} !important; 
                --dark-2: ${C.mantle} !important;
                --dark-3: ${C.crust} !important;
                --dark-4: ${C.surface1} !important;
                --white-2: ${C.surface1} !important; 

                /* --- Text & Fonts --- */
                --font-1: ${C.text} !important;
                --font-tint-1: ${C.subtext1} !important;
                --font-tint-2: ${C.subtext0} !important;
                --font-tint-3: ${C.overlay2} !important;
                --landing-font-1: ${C.text} !important;
                --pure-white: ${C.text} !important; 
                --grey-1: ${C.overlay2} !important;

                /* --- Accents & Borders --- */
                --accent-color: ${accent} !important;
                --border-color: ${C.surface1} !important;
                --icon-color: ${C.subtext0} !important;
                --sub-color-2: ${accent} !important;

                /* --- Blue Variable Overrides --- */
                --blue-1: ${accent} !important;       
                --dark-blue-1: ${accent} !important;  
                --dark-blue-1-outline: ${C.surface2} !important;
                --hover-dark-blue: ${C.surface2} !important;
                
                /* --- Scrollbars --- */
                --scroll-bar: ${C.surface2} !important;
                --scroll-bar-track: ${C.base} !important;
            }

            /* --- GLOBAL OVERRIDES --- */

            /* High Specificity Selectors to override Fansly .dark-theme !important */
            html, body, .page-content,
            html.dark-theme, .dark-theme body,
            html.bright-theme, .bright-theme body {
                background-color: ${C.base} !important;
                color: ${C.text} !important;
            }
            
            .app-nav-menu-side, .settings-sidebar {
                background-color: ${C.mantle} !important;
                border-right: 1px solid ${C.surface1} !important;
            }

            /* --- COMPONENT FIXES --- */

            .user-icon { color: ${accent} !important; }

            .btn.solid-blue, 
            .btn.solid-blue:hover, 
            .follow-button, 
            .subscribe-button {
                background-color: ${accent} !important;
                color: ${this.shouldUseDarkText(flavorName, accentName) ? C.base : C.text} !important; 
                border: none !important;
            }

            .btn.outline-blue {
                color: ${accent} !important;
                border-color: ${accent} !important;
            }
            .btn.outline-blue:hover {
                background-color: ${accent} !important;
                color: ${this.shouldUseDarkText(flavorName, accentName) ? C.base : C.text} !important;
            }

            .notification-badge, .badge {
                background-color: ${C.red} !important;
                color: ${C.text} !important;
            }
            
            .router-link-active, .active-link {
                color: ${accent} !important;
            }
            
            app-chat-room-goal .progress-overlay {
                background-color: ${accent} !important;
            }
            
            app-chat-room-goal {
                color: ${C.text} !important;
            }
        `;
    }
};
