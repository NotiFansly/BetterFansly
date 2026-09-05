// src/core/injector.js
//import { UI } from './ui.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_MENU') {
        if (typeof UI !== 'undefined') {
            UI.openMenu();
        }
    }
});

// Initialize core systems
if (typeof UI !== 'undefined') {
    UI.init();
}

function createSettingsButton(locationType) {
    // locationType: 'settings-page' | 'sidebar'

    const div = document.createElement('div');
    div.tabIndex = 0;

    // ID distinguishes where the button is so we don't duplicate it
    div.id = locationType === 'sidebar' ? 'better-fansly-btn-sidebar' : 'better-fansly-btn';

    // Classes based on location — mirror the native rows so Fansly's own CSS
    // drives layout, spacing, hover, and cursor (no inline style overrides).
    if (locationType === 'sidebar') {
        div.className = 'nav-dropdown-item dropdown-item';
        div.dataset.menuItem = 'better-fansly';
    } else {
        div.className = 'settings-item';
    }

    const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');
    const logo = `<img class="bf-settings-logo" src="${logoUrl}" alt="BF">`;

    // HTML Structure — matches native markup:
    //   Nav/sidebar: [Logo] Text
    //   Settings page: [Icon slot] Label [Chevron slot]
    div.innerHTML = locationType === 'sidebar'
        ? `${logo}<span>BetterFansly</span>`
        : `
        <app-icon class="settings-item-icon">${logo}</app-icon>
        <div class="settings-item-label"><span>BetterFansly</span></div>
        <app-icon class="settings-item-chevron"><i class="fa-chevron-right fa-fw fasl"></i></app-icon>
    `;

    div.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        UI.openMenu();
    };
    return div;
}

const observer = new MutationObserver(() => {
    // 1. Main Settings Page List
    const settingsList = document.querySelector('.settings-list');
    if (settingsList && !document.getElementById('better-fansly-btn')) {
        settingsList.appendChild(createSettingsButton('settings-page'));
    }

    // 2. Desktop Top-Right Dropdown
    const desktopDropdown = document.querySelector('.user-account-dropdown .dropdown-list');
    if (desktopDropdown && !document.getElementById('better-fansly-btn-sidebar')) {
        injectSidebarButton(desktopDropdown);
    }

    // 3. Mobile/Tablet Left Sidebar (The HTML you provided)
    const mobileSidebar = document.querySelector('app-nav-menu-side .list');
    if (mobileSidebar && !mobileSidebar.querySelector('#better-fansly-btn-sidebar')) {
        injectSidebarButton(mobileSidebar);
    }
});

// Helper to insert before "Logout" or at the bottom
function injectSidebarButton(container) {
    const btn = createSettingsButton('sidebar');

    // Find Logout button to insert before it (looks for the exit icon)
    const logoutBtn = container.querySelector('.fa-right-from-bracket')?.closest('.dropdown-item');

    // Also try to find the separator line before logout to stay cleaner
    const separator = logoutBtn?.previousElementSibling;

    if (separator && separator.classList.contains('seperator')) {
        container.insertBefore(btn, separator);
    } else if (logoutBtn) {
        container.insertBefore(btn, logoutBtn);
    } else {
        container.appendChild(btn);
    }
}

observer.observe(document.body, { childList: true, subtree: true });
