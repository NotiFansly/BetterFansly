// src/background.js

// Listen for updates from the UI
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'REGISTER_PLUGINS') {
        updateUserScripts();
    }
});

// Run on extension load
chrome.runtime.onStartup.addListener(updateUserScripts);
chrome.runtime.onInstalled.addListener(updateUserScripts);

async function updateUserScripts() {
    // 1. Get all plugins from storage
    const data = await chrome.storage.local.get('bf_plugins');
    const plugins = data.bf_plugins || [];

    // 2. Unregister everything first (to clean up deleted/disabled ones)
    try {
        await chrome.userScripts.unregister();
    } catch (e) { /* Ignore if none exist */ }

    // 3. Filter only enabled plugins
    const activePlugins = plugins.filter(p => p.enabled);
    if (activePlugins.length === 0) return;

    // 4. Transform into Chrome's format
    const scriptsToRegister = activePlugins.map(plugin => ({
        id: plugin.id,
        matches: ["https://fansly.com/*"],
        js: [{ code: plugin.code }],
        world: "USER_SCRIPT" // Runs in a special privileged user-mode
    }));

    // 5. Register them
    await chrome.userScripts.register(scriptsToRegister);
    console.log(`Registered ${activePlugins.length} custom plugins.`);
}
