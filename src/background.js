// src/background.js

chrome.action.onClicked.addListener(async (tab) => {
    // Only work on Fansly pages
    if (tab.url && tab.url.includes('fansly.com')) {
        // Send message to content script to open menu
        try {
            await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MENU' });
        } catch (error) {
            console.error('Failed to open menu:', error);
        }
    }
});

// 1. Listen for updates from the UI (install/delete plugins)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'REGISTER_PLUGINS') {
        // In the scripting method, we don't need to "register" ahead of time.
        // We just ensure we reload the tabs so the new logic applies.
        console.log("Plugins updated. Settings saved to storage.");
    }
});

// 2. Watch for Page Navigation (The Scripting API approach)
chrome.webNavigation.onCommitted.addListener(async (details) => {
    // Only run on the main frame (not iframes) and only for Fansly
    if (details.frameId !== 0 || !details.url.includes("fansly.com")) return;

    injectUserScripts(details.tabId);
}, { url: [{ hostContains: 'fansly.com' }] });


async function injectUserScripts(tabId) {
    try {
        // Fetch plugins from storage
        const data = await chrome.storage.local.get('bf_plugins');
        const plugins = data.bf_plugins || [];
        const activePlugins = plugins.filter(p => p.enabled);

        if (activePlugins.length === 0) return;

        console.log(`Injecting ${activePlugins.length} custom plugins into tab ${tabId}`);

        // Combine all user code into one block
        // We wrap it in a try-catch so one bad script doesn't break the others
        const combinedCode = activePlugins.map(p => `
            try {
                // --- Plugin: ${p.name} ---
                ${p.code}
            } catch(e) {
                console.error("BetterFansly Plugin Error (${p.name}):", e);
            }
        `).join("\n");

        // Inject into the "MAIN" world (The actual page context, not the extension sandbox)
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: "MAIN",
            func: (codeToRun) => {
                // Create a script tag to run the code immediately
                const script = document.createElement('script');
                script.textContent = codeToRun;
                (document.head || document.documentElement).appendChild(script);
                script.remove(); // Clean up
            },
            args: [combinedCode]
        });

    } catch (err) {
        console.error("Failed to inject scripts:", err);
    }
}
