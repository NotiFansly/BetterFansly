// src/plugins/userNotes.js

const UserNotes = {
    // --- 1. Registry Metadata ---
    id: 'user_notes',
    name: 'User Notes',
    description: 'Add private notes to any user. Visible on profiles, timeline, and messages.',
    defaultEnabled: false,

    // --- 2. State Variables ---
    isActive: false,
    observer: null,
    notes: {}, // { username: "note text" }

    // --- 3. UI Renderer ---
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
                    💡 Notes are stored locally. <br>
                    • <b>Profiles:</b> Click icon or preview text to edit.<br>
                    • <b>DM Sidebar:</b> Hover icon to peek.<br>
                    • <b>Timeline/Header:</b> Click icon to edit.
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

        this.loadNotes();
        this.injectStyles();
        this.startObserver();

        console.log("BetterFansly: User Notes Enabled 📝");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.observer) this.observer.disconnect();

        document.querySelectorAll('.bf-note-indicator, .bf-note-icon, .bf-note-display').forEach(el => el.remove());

        const style = document.getElementById('bf-user-notes-css');
        if (style) style.remove();

        console.log("BetterFansly: User Notes Disabled");
    },

    // --- Storage ---

    loadNotes() {
        try {
            const saved = localStorage.getItem('bf_user_notes');
            this.notes = saved ? JSON.parse(saved) : {};
        } catch (e) {
            this.notes = {};
        }
    },

    saveNotes() {
        try {
            localStorage.setItem('bf_user_notes', JSON.stringify(this.notes));
        } catch (e) {
            console.error('BF: Error saving notes', e);
        }
    },

    getNote(username) {
        return this.notes[username.toLowerCase()] || '';
    },

    setNote(username, note) {
        const key = username.toLowerCase();
        if (note.trim()) {
            this.notes[key] = note.trim();
        } else {
            delete this.notes[key];
        }
        this.saveNotes();
    },

    // --- Styles ---

    injectStyles() {
        if (document.getElementById('bf-user-notes-css')) return;

        const style = document.createElement('style');
        style.id = 'bf-user-notes-css';
        style.textContent = `
            /* --- ICONS --- */
            .bf-note-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-left: 5px;
                color: #fab387; /* Peach color */
                font-size: 0.9em;
                cursor: pointer;
                transition: transform 0.2s, color 0.2s;
                vertical-align: middle;
                z-index: 10;
            }
            .bf-note-icon:hover {
                transform: scale(1.2);
                color: #f9e2af;
            }

            /* --- BADGE (Exists) --- */
            .bf-note-indicator {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 14px;
                height: 14px;
                background: #fab387;
                border-radius: 50%;
                font-size: 9px;
                color: #1e1e2e;
                font-weight: bold;
                margin-left: 5px;
                cursor: pointer;
                transition: transform 0.2s;
                z-index: 10;
                vertical-align: middle;
            }
            .bf-note-indicator:hover {
                transform: scale(1.15);
            }

            /* --- PROFILE TEXT PREVIEW --- */
            .bf-note-display {
                display: block;
                font-size: 11px;
                color: #fab387;
                font-style: italic;
                margin-top: 4px;
                
                /* CHANGED: Allow 3 lines before cutoff */
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
                white-space: normal;
                
                cursor: pointer;
                line-height: 1.3;
                border-left: 2px solid #fab387;
                padding-left: 6px;
            }
            .bf-note-display:hover {
                color: #f9e2af;
                background: rgba(250, 179, 135, 0.1);
            }
            /* Adjust spacing in specific contexts */
            .profile-name .bf-note-display { margin-top: 6px; font-size: 12px; }

            /* --- CSS TOOLTIP (For Sidebar) --- */
            .bf-tooltip-container {
                position: relative;
            }
            .bf-tooltip-container:hover::after {
                content: attr(data-bf-note);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: var(--dark-3);
                border: 1px solid var(--bf-accent);
                color: var(--font-1);
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11px;
                white-space: pre-wrap;
                width: max-content;
                max-width: 200px;
                z-index: 99999;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                pointer-events: none;
                line-height: 1.4;
                margin-bottom: 6px;
            }

            /* --- MESSAGE HEADER FIXES --- */
            /* Force the name and icon to be inline-flex to sit side-by-side */
            .message-content-header-contact app-account-username,
            .message-content-header-contact .username-wrapper {
                display: inline-flex !important;
                align-items: center;
                flex-wrap: nowrap;
            }
            .message-content-header-contact .bf-note-display {
                display: none !important; /* Hide preview text in header */
            }

            /* --- MODAL --- */
            .bf-note-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                z-index: 100000; background: var(--bf-modal-bg, var(--dark-1));
                border: 1px solid var(--bf-border, var(--dark-4));
                border-radius: 12px; padding: 20px; width: 450px; max-width: 90vw;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                animation: modalIn 0.2s ease-out;
            }
            @keyframes modalIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
            .bf-note-modal-backdrop {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 99999;
            }
            .bf-note-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--bf-border); }
            .bf-note-modal-title { font-weight: bold; font-size: 16px; color: var(--bf-text); display: flex; align-items: center; gap: 8px; }
            .bf-note-modal-close { cursor: pointer; color: var(--bf-subtext); font-size: 18px; padding: 4px; }
            .bf-note-modal-close:hover { color: #f38ba8; }
            .bf-note-textarea { width: 100%; min-height: 120px; background: var(--bf-card-bg, var(--dark-3)); border: 1px solid var(--bf-border); color: var(--bf-text); padding: 10px; border-radius: 6px; font-family: inherit; font-size: 14px; resize: vertical; box-sizing: border-box; }
            .bf-note-textarea:focus { outline: none; border-color: var(--bf-accent); }
            .bf-note-modal-actions { display: flex; gap: 10px; margin-top: 15px; }
            .bf-note-btn { flex: 1; padding: 10px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
            .bf-note-btn:hover { opacity: 0.9; }
            .bf-note-btn-save { background: var(--bf-accent, #a855f7); color: var(--primary-bg, #fff); }
            .bf-note-btn-delete { background: #f38ba8; color: #1e1e2e; }
            .bf-note-btn-cancel { background: var(--bf-card-bg); color: var(--bf-text); border: 1px solid var(--bf-border); }
        `;
        document.head.appendChild(style);
    },

    // --- Observer ---

    startObserver() {
        let timeout;
        this.observer = new MutationObserver(() => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.scanPage();
            }, 500);
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
        this.scanPage();
    },

    scanPage() {
        if (!this.isActive) return;

        this.scanTimeline();
        this.scanProfileHeaders();
        this.scanMessages();
    },

    // --- 1. Timeline Posts ---
    scanTimeline() {
        const usernames = document.querySelectorAll('app-account-username:not(.bf-note-checked)');

        usernames.forEach(usernameEl => {
            usernameEl.classList.add('bf-note-checked');
            const link = usernameEl.querySelector('a[href^="/"]');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href || href.length < 2) return;
            const username = href.substring(1).split(/[?#]/)[0].split('/')[0];

            if (!username || ['settings', 'messages', 'notifications'].includes(username)) return;

            // Default: Click to open modal
            this.addNoteIcon(usernameEl, username);
        });
    },

    // --- 2. Profile Headers ---
    scanProfileHeaders() {
        const pathParts = window.location.pathname.split('/');
        const username = pathParts[1] ? pathParts[1].split(/[?#]/)[0] : null;

        if (!username || ['settings', 'messages', 'notifications', 'explore'].includes(username)) return;

        // .profile-name (Newer layout)
        const profileName = document.querySelector('.profile-name:not(.bf-note-checked)');
        if (profileName) {
            profileName.classList.add('bf-note-checked');
            const usernameEl = profileName.querySelector('app-account-username');
            if (usernameEl) this.addNoteIcon(usernameEl, username, { showPreview: true });
        }

        // .profile-username (Older/Alt layout)
        const profileHeaders = document.querySelectorAll('.profile-username:not(.bf-note-checked)');
        profileHeaders.forEach(header => {
            header.classList.add('bf-note-checked');
            this.addNoteIcon(header, username, { showPreview: true });
        });
    },

    // --- 3. Messages ---
    scanMessages() {
        // A. Sidebar Conversations (Read-only Tooltip)
        const conversations = document.querySelectorAll('app-group-message-item:not(.bf-note-checked)');
        conversations.forEach(conv => {
            conv.classList.add('bf-note-checked');

            const usernameEl = conv.querySelector('.username, .display-name');
            if (!usernameEl) return;

            const link = conv.querySelector('a[href^="/messages/"]');
            if (!link) return;

            const href = link.getAttribute('href');
            const match = href.match(/\/messages\/([^/?#]+)/);
            if (match && match[1]) {
                // Pass readOnly: true to create a tooltip instead of a clickable button
                this.addNoteIcon(usernameEl, match[1], { readOnly: true });
            }
        });

        // B. Active Thread Header (Inline next to name)
        const threadHeader = document.querySelector('.message-content-header-contact:not(.bf-note-checked)');
        if (threadHeader) {
            threadHeader.classList.add('bf-note-checked');

            const usernameEl = threadHeader.querySelector('app-account-username');
            if (usernameEl) {
                const link = usernameEl.querySelector('a[href^="/"]');
                if (link) {
                    const href = link.getAttribute('href');
                    const username = href.substring(1).split(/[?#]/)[0];
                    if (username) {
                        this.addNoteIcon(usernameEl, username, { forceInline: true });
                    }
                }
            }
        }
    },

    // --- Icon Injection Logic ---
    addNoteIcon(parentElement, username, options = {}) {
        // Options: { showPreview: bool, readOnly: bool, forceInline: bool }

        // Avoid duplicates
        if (parentElement.querySelector('.bf-note-icon, .bf-note-indicator')) return;

        const note = this.getNote(username);
        const hasNote = !!note;

        // Element Creation
        const el = document.createElement('span');
        el.className = hasNote ? 'bf-note-indicator' : 'bf-note-icon';
        el.innerHTML = hasNote ? '<i class="fas fa-sticky-note"></i>' : '<i class="far fa-sticky-note"></i>';

        // --- LOGIC FOR SIDEBAR (Read Only / Tooltip) ---
        if (options.readOnly) {
            if (hasNote) {
                // Add CSS tooltip classes
                el.classList.add('bf-tooltip-container');
                el.setAttribute('data-bf-note', note); // CSS uses this for content

                // Disable clicking so it doesn't fight with the <a> tag
                el.style.pointerEvents = 'none';
                parentElement.appendChild(el);
            }
            // If no note, we don't show the "Add" icon in sidebar to keep it clean
            return;
        }

        // --- LOGIC FOR STANDARD (Click to Edit) ---
        el.title = hasNote ? 'View/Edit note' : 'Add note';
        el.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openNoteModal(username);
        };

        parentElement.appendChild(el);

        // --- LOGIC FOR PROFILE (Text Preview) ---
        if (options.showPreview && hasNote) {
            const preview = document.createElement('div');
            preview.className = 'bf-note-display';
            preview.textContent = `📝 ${note}`;
            preview.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openNoteModal(username);
            };
            parentElement.appendChild(preview);
        }
    },

    // --- Modal Logic ---

    openNoteModal(username) {
        this.closeNoteModal(); // Close existing

        const backdrop = document.createElement('div');
        backdrop.className = 'bf-note-modal-backdrop';
        backdrop.id = 'bf-note-backdrop';

        const modal = document.createElement('div');
        modal.className = 'bf-note-modal';
        modal.onclick = (e) => e.stopPropagation();

        const currentNote = this.getNote(username);

        modal.innerHTML = `
            <div class="bf-note-modal-header">
                <div class="bf-note-modal-title">
                    <i class="fas fa-sticky-note"></i> Note for @${username}
                </div>
                <div class="bf-note-modal-close"><i class="fas fa-times"></i></div>
            </div>
            <textarea class="bf-note-textarea" placeholder="Add a private note...">${currentNote}</textarea>
            <div class="bf-note-modal-actions">
                <button class="bf-note-btn bf-note-btn-save"><i class="fas fa-save"></i> Save</button>
                ${currentNote ? '<button class="bf-note-btn bf-note-btn-delete"><i class="fas fa-trash"></i> Delete</button>' : ''}
                <button class="bf-note-btn bf-note-btn-cancel">Cancel</button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const textarea = modal.querySelector('.bf-note-textarea');
        const saveBtn = modal.querySelector('.bf-note-btn-save');
        const deleteBtn = modal.querySelector('.bf-note-btn-delete');
        const cancelBtn = modal.querySelector('.bf-note-btn-cancel');
        const closeIcon = modal.querySelector('.bf-note-modal-close');

        setTimeout(() => textarea.focus(), 100);

        saveBtn.onclick = () => {
            this.setNote(username, textarea.value);
            this.closeNoteModal();
            this.refreshPage();
        };

        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('Delete this note?')) {
                    this.setNote(username, '');
                    this.closeNoteModal();
                    this.refreshPage();
                }
            };
        }

        cancelBtn.onclick = () => this.closeNoteModal();
        closeIcon.onclick = () => this.closeNoteModal();
        backdrop.onclick = () => this.closeNoteModal();
    },

    closeNoteModal() {
        const backdrop = document.getElementById('bf-note-backdrop');
        if (backdrop) backdrop.remove();
    },

    refreshPage() {
        // Clear flags to force re-scan
        document.querySelectorAll('.bf-note-checked').forEach(el => el.classList.remove('bf-note-checked'));
        document.querySelectorAll('.bf-note-icon, .bf-note-indicator, .bf-note-display').forEach(el => el.remove());
        this.scanPage();
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(UserNotes);
} else {
    window.UserNotes = UserNotes;
}
