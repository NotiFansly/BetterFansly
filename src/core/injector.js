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

    // Classes based on location
    div.className = locationType === 'sidebar' ? 'dropdown-item' : 'settings-item';

    // CSS: Force Flexbox to align Logo and Text on the same center line
    div.style.cssText = 'display: flex; align-items: center; width: 100%; cursor: pointer;';

    const logoUrl = chrome.runtime.getURL('icons/bf-logo.png');

    // Logo Styling:
    // 1. Width 20px matches FontAwesome icons
    // 2. Scale 1.5 zooms in to hide transparent whitespace
    // 3. Margin adjusts spacing to match text
    const imgStyle = 'width: 20px; height: 20px; margin-right: 12px; object-fit: contain; transform: scale(1.5);';

    // HTML Structure
    // Sidebar: [Logo] [Text]  (No arrow)
    // Settings Page: [Logo] [Text] [Spacer] [Arrow]
    div.innerHTML = `
        <img src="${logoUrl}" style="${imgStyle}" alt="BF">
        <span>BetterFansly</span>
        
        ${locationType === 'settings-page' ? `
            <div style="flex: 1;"></div>
            <div class="flex-0 margin-right-1 margin-left-1">
                <i class="fa-light fa-chevron-right"></i>
            </div>
        ` : ''}
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
