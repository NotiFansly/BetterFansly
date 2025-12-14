// src/data/catppuccin.js

if (typeof window.BF_Themes === 'undefined') window.BF_Themes = {};

window.BF_Themes['catppuccin'] = {
    name: "Catppuccin",
    options: {
        flavors: ['latte', 'frappe', 'macchiato', 'mocha'],
        accents: ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender']
    },

    palettes: {
        mocha: {
            base: "#1e1e2e", mantle: "#181825", crust: "#11111b",
            text: "#cdd6f4", subtext1: "#bac2de", subtext0: "#a6adc8",
            overlay2: "#9399b2", overlay1: "#7f849c", overlay0: "#6c7086",
            surface2: "#585b70", surface1: "#45475a", surface0: "#313244",
            lavender: "#b4befe", blue: "#89b4fa", sapphire: "#74c7ec", sky: "#89dceb",
            teal: "#94e2d5", green: "#a6e3a1", yellow: "#f9e2af", peach: "#fab387",
            maroon: "#eba0ac", red: "#f38ba8", mauve: "#cba6f7", pink: "#f5c2e7",
            flamingo: "#f2cdcd", rosewater: "#f5e0dc"
        },
        macchiato: {
            base: "#24273a", mantle: "#1e2030", crust: "#181926",
            text: "#cad3f5", subtext1: "#b8c0e0", subtext0: "#a5adcb",
            overlay2: "#9399b2", overlay1: "#8087a2", overlay0: "#6e738d",
            surface2: "#5b6078", surface1: "#494d64", surface0: "#363a4f",
            lavender: "#b7bdf8", blue: "#8aadf4", sapphire: "#7dc4e4", sky: "#91d7e3",
            teal: "#8bd5ca", green: "#a6da95", yellow: "#eed49f", peach: "#f5a97f",
            maroon: "#ee99a0", red: "#ed8796", mauve: "#c6a0f6", pink: "#f5bde6",
            flamingo: "#f0c6c6", rosewater: "#f4dbd6"
        },
        frappe: {
            base: "#303446", mantle: "#292c3c", crust: "#232634",
            text: "#c6d0f5", subtext1: "#b5bfe2", subtext0: "#a5adce",
            overlay2: "#949cbb", overlay1: "#838ba7", overlay0: "#737994",
            surface2: "#626880", surface1: "#51576d", surface0: "#414559",
            lavender: "#babbf1", blue: "#8caaee", sapphire: "#85c1dc", sky: "#99d1db",
            teal: "#81c8be", green: "#a6d189", yellow: "#e5c890", peach: "#ef9f76",
            maroon: "#ea999c", red: "#e78284", mauve: "#ca9ee6", pink: "#f4b8e4",
            flamingo: "#eebebe", rosewater: "#f2d5cf"
        },
        latte: {
            base: "#eff1f5", mantle: "#e6e9ef", crust: "#dce0e8",
            text: "#4c4f69", subtext1: "#5c5f77", subtext0: "#6c6f85",
            overlay2: "#7c7f93", overlay1: "#8c8fa1", overlay0: "#9ca0b0",
            surface2: "#acb0be", surface1: "#bcc0cc", surface0: "#ccd0da",
            lavender: "#7287fd", blue: "#1e66f5", sapphire: "#209fb5", sky: "#04a5e5",
            teal: "#179299", green: "#40a02b", yellow: "#df8e1d", peach: "#fe640b",
            maroon: "#e64553", red: "#d20f39", mauve: "#8839ef", pink: "#ea76cb",
            flamingo: "#dd7878", rosewater: "#dc8a78"
        }
    },

    shouldUseDarkText: function(flavorName, accentName) {
        // Light accents that need dark text
        const lightAccents = ['rosewater', 'flamingo', 'pink', 'yellow', 'peach', 'green', 'teal', 'sky'];

        // Latte (light mode) needs dark text on ALL accents
        if (flavorName === 'latte') return true;

        // Dark modes: only light accents need dark text
        return lightAccents.includes(accentName);
    },

    generateCSS: function(flavorName, accentName) {
        if (!flavorName) flavorName = 'mocha';
        if (!accentName) accentName = 'mauve';

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
                --dropdown-bg-color-hover: ${C.surface0} !important;
                --selected-tab: ${C.surface0} !important;
                
                /* Fansly Specific Dark Variables */
                --dark-1: ${C.base} !important; 
                --dark-2: ${C.mantle} !important;
                --dark-3: ${C.crust} !important;
                --dark-4: ${C.surface0} !important;
                --white-2: ${C.surface0} !important; 

                /* --- Text & Fonts --- */
                --font-1: ${C.text} !important;
                --font-tint-1: ${C.subtext1} !important;
                --font-tint-2: ${C.subtext0} !important;
                --font-tint-3: ${C.overlay2} !important;
                --landing-font-1: ${C.text} !important;
                --pure-white: ${C.text} !important; 
                --grey-1: ${C.overlay0} !important;

                /* --- Accents & Borders --- */
                --accent-color: ${accent} !important;
                --border-color: ${C.surface0} !important;
                --icon-color: ${C.subtext0} !important;
                --sub-color-2: ${accent} !important;

                /* --- The Missing Blue Variables! --- */
                --blue-1: ${accent} !important;       /* Checkmarks */
                --dark-blue-1: ${accent} !important;  /* Links/Buttons */
                --dark-blue-1-outline: ${C.surface1} !important;
                --hover-dark-blue: ${C.surface1} !important;
                
                /* --- Scrollbars --- */
                --scroll-bar: ${C.surface2} !important;
                --scroll-bar-track: ${C.base} !important;
            }

            /* --- GLOBAL OVERRIDES --- */

            /* Force Body Background */
            html, body, .page-content {
                background-color: ${C.base} !important;
                color: ${C.text} !important;
            }
            
            /* Sidebar tweaks */
            .app-nav-menu-side, .settings-sidebar {
                background-color: ${C.mantle} !important;
                border-right: 1px solid ${C.surface0} !important;
            }

            /* --- COMPONENT FIXES --- */

            /* 1. Verified Checkmarks (Uses .user-icon style) */
            .user-icon {
                color: ${accent} !important;
            }

            /* 2. Follow Buttons (.solid-blue) */
            .btn.solid-blue, 
            .btn.solid-blue:hover, 
            .follow-button,
            .subscribe-button {
                background-color: ${accent} !important;
                color: ${C.base} !important; /* Text color contrast */
                border: none !important;
            }

            /* 3. Outline Buttons */
            .btn.outline-blue {
                color: ${accent} !important;
                border-color: ${accent} !important;
            }
            .btn.outline-blue:hover {
                background-color: ${accent} !important;
                color: ${C.base} !important;
            }

            /* 4. Notification Badge */
            .notification-badge {
                background-color: ${C.red} !important; /* Keep badges red? or use ${accent} */
                color: ${C.base} !important;
            }
            
            /* 5. Active Tab/Link color */
            .router-link-active, .active-link {
                color: ${accent} !important;
            }
            
            app-chat-room-goal .progress-overlay {
                background-color: ${accent} !important;
            }
            
            /* Force dark text on light accents for readability */
            app-chat-room-goal {
                color: ${this.shouldUseDarkText(flavorName, accentName) ? C.base : C.text} !important;
            }
        `;
    }
};
