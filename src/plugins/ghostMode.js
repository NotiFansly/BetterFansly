// src/plugins/ghostMode.js

const GhostMode = {
    isInjected: false,

    enable() {
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

        // FIX: Load from file instead of inline text to bypass CSP
        script.src = chrome.runtime.getURL('src/injections/interceptor.js');

        // Inject into <html> to ensure it runs as early as possible
        (document.head || document.documentElement).appendChild(script);
        this.isInjected = true;
    }
};
