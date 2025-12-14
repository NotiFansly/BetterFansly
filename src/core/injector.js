// src/core/injector.js
//import { UI } from './ui.js';

// Initialize core systems (checks saved settings and turns on plugins)
UI.init();

function createSettingsButton(isSidebar) {
    const div = document.createElement('div');
    div.className = isSidebar ? 'dropdown-item' : 'settings-item';
    div.tabIndex = 0;
    div.id = isSidebar ? 'better-fansly-btn-sidebar' : 'better-fansly-btn';

    const iconClass = isSidebar ? 'fa-fw fal hover-effect fa-robot' : 'fa-fw margin-right-text fal fa-robot';

    div.innerHTML = `
        <i class="${iconClass}" style="color: #a855f7;"></i>
        <span>BetterFansly</span>
        ${!isSidebar ? '<div class="flex-1"></div><div class="flex-0 margin-right-1 margin-left-1"><i class="fa-light fa-chevron-right"></i></div>' : ''}
    `;

    div.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        UI.openMenu(); // Call the UI module
    };
    return div;
}

const observer = new MutationObserver(() => {
    // Inject into Main Settings List
    const settingsList = document.querySelector('.settings-list');
    if (settingsList && !document.getElementById('better-fansly-btn')) {
        settingsList.appendChild(createSettingsButton(false));
    }

    // Inject into Sidebar/Dropdown
    const desktopDropdown = document.querySelector('.user-account-dropdown .dropdown-list');
    if (desktopDropdown && !document.getElementById('better-fansly-btn-sidebar')) {
        const btn = createSettingsButton(true);
        const logoutBtn = desktopDropdown.querySelector('.fa-right-from-bracket')?.closest('.dropdown-item');
        if (logoutBtn) desktopDropdown.insertBefore(btn, logoutBtn);
        else desktopDropdown.appendChild(btn);
    }
});

observer.observe(document.body, { childList: true, subtree: true });
