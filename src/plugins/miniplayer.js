// src/plugins/miniplayer.js

const Miniplayer = {
    isActive: false,
    container: null,
    hls: null,
    isTransparent: false,
    urlObserver: null,

    // Default state: Bottom-Right corner
    state: {
        top: 'auto',
        left: 'auto',
        bottom: '80px',
        right: '20px',
        width: '480px',
        height: '270px',
        volume: 0.5
    },

    // --- Main Public Methods ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.loadState();
        this.injectStyles();

        // Start watching the URL to only show button on /live/ pages
        this.startUrlWatcher();

        console.log("BetterFansly: Miniplayer Enabled");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        this.removeStartButton();
        this.stopUrlWatcher();

        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        console.log("BetterFansly: Miniplayer Disabled");
    },

    // --- State Management ---

    loadState() {
        try {
            const saved = localStorage.getItem('bf_miniplayer_state');
            if (saved) {
                this.state = { ...this.state, ...JSON.parse(saved) };
            }
        } catch (e) { console.error('BF: Error loading state', e); }
    },

    saveState() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        const video = document.getElementById('fansly-miniplayer-video')

        const newState = {
            top: rect.top + 'px',
            left: rect.left + 'px',
            bottom: 'auto',
            right: 'auto',
            width: rect.width + 'px',
            height: rect.height + 'px',
            volume: video ? video.volume : this.state.volume
        };
        this.state = newState;
        localStorage.setItem('bf_miniplayer_state', JSON.stringify(newState));
    },

    // --- Visuals & Routing ---

    injectStyles() {
        if (document.getElementById('bf-miniplayer-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-miniplayer-css';
        style.textContent = `
            /* Start Button */
            #fansly-miniplayer-btn {
                position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                
                /* THEME INTEGRATION FIX */
                background: var(--accent-color, #a855f7); /* Use Theme Accent */
                color: var(--primary-bg, #000);           /* Use Dark Background for Text Contrast */
                
                border: 1px solid var(--border-color, transparent);
                padding: 12px 18px; border-radius: 30px;
                cursor: pointer; font-weight: bold; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                transition: transform 0.2s, opacity 0.2s;
                font-family: inherit;
            }
            #fansly-miniplayer-btn:hover { transform: translateY(-2px); opacity: 0.9; }

            /* Player Container */
            #fansly-miniplayer-container {
                position: fixed; z-index: 10000; background: #000; 
                border: 1px solid #444; border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                resize: both; overflow: hidden; display: flex; flex-direction: column;
                min-width: 250px; min-height: 140px;
            }

            /* Header */
            #fansly-miniplayer-header {
                position: absolute; top: 0; left: 0; width: 100%; height: 40px;
                background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px);
                display: flex; align-items: center; justify-content: space-between;
                padding: 0 8px 0 12px;
                box-sizing: border-box;
                opacity: 0; transition: opacity 0.2s; cursor: move; z-index: 2;
                border-radius: 8px 8px 0 0;
            }
            #fansly-miniplayer-container:hover #fansly-miniplayer-header { opacity: 1; }

            .fmp-title {
                color: #fff; font-size: 13px; font-weight: 600;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                margin-right: 10px; pointer-events: none;
            }
            .fmp-controls { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
            .fmp-btn { 
                background: #333; color: #ccc; border: 1px solid #555; 
                border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; white-space: nowrap;
            }
            .fmp-btn:hover { background: #555; color: white; }
            .fmp-close { background: #d32f2f; color: white; border: none; }
            .fmp-close:hover { background: #b91c1c; }
            .fmp-select { 
                background: #222; color: white; border: 1px solid #444; 
                border-radius: 4px; padding: 3px; font-size: 11px; 
            }
            #fansly-miniplayer-video { width: 100%; height: 100%; object-fit: contain; background: black; }
        `;
        document.head.appendChild(style);
    },

    startUrlWatcher() {
        // Initial Check
        this.checkRoute();

        // Fansly is an SPA, so we observe the body for changes.
        // If the URL changes, check if we need the button.
        this.urlObserver = new MutationObserver(() => {
            this.checkRoute();
        });

        this.urlObserver.observe(document.body, { childList: true, subtree: true });
    },

    stopUrlWatcher() {
        if (this.urlObserver) {
            this.urlObserver.disconnect();
            this.urlObserver = null;
        }
    },

    checkRoute() {
        // Only show on /live/ pages
        const isLivePage = window.location.pathname.includes('/live/');

        if (isLivePage) {
            this.addStartButton();
        } else {
            this.removeStartButton();
        }
    },

    addStartButton() {
        if (document.getElementById('fansly-miniplayer-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'fansly-miniplayer-btn';
        btn.innerHTML = '<i class="fa-fw fas fa-tv"></i> Start Miniplayer';
        btn.onclick = () => this.startPlayer();
        document.body.appendChild(btn);
    },

    removeStartButton() {
        const btn = document.getElementById('fansly-miniplayer-btn');
        if (btn) btn.remove();
    },

    // --- API Logic ---

    getAuthToken() {
        try {
            const sessionData = localStorage.getItem('session_active_session');
            if (sessionData) return JSON.parse(sessionData)?.token;
        } catch (e) { console.error('BF: Auth Error', e); }
        return null;
    },

    async fetchApi(url) {
        const token = this.getAuthToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = token;
        const response = await fetch(url, { method: "GET", headers });
        return await response.json();
    },

    // --- Player Core ---

    async startPlayer() {
        const pathParts = window.location.pathname.split('/');
        let username = null;
        if (pathParts.includes('live') && pathParts.length > 2) {
            username = pathParts[pathParts.indexOf('live') + 1];
        }

        if (!username) {
            alert('BetterFansly: Could not detect username. Are you on a live page?');
            return;
        }

        const btn = document.getElementById('fansly-miniplayer-btn');
        if (btn) btn.innerHTML = '⌛ Loading...';

        try {
            const accRes = await this.fetchApi(`https://apiv3.fansly.com/api/v1/account?usernames=${username}`);
            if (!accRes.response || !accRes.response.length) { throw new Error('User not found'); }
            const accountId = accRes.response[0].id;

            const streamRes = await this.fetchApi(`https://apiv3.fansly.com/api/v1/streaming/channel/${accountId}?ngsw-bypass=true`);

            if (!streamRes.success || !streamRes.response || !streamRes.response.stream) {
                alert(`BetterFansly: ${username} is currently offline.`);
                if (btn) btn.innerHTML = '<i class="fa-fw fas fa-tv"></i> Start Miniplayer';
                return;
            }

            const playbackUrl = streamRes.response.stream.playbackUrl;
            this.buildPlayerUI(playbackUrl, username);

            // Optional: Hide the button once playing to reduce clutter?
            // For now, reset text
            if (btn) btn.innerHTML = '<i class="fa-fw fas fa-tv"></i> Start Miniplayer';

        } catch (e) {
            console.error(e);
            alert('Error fetching stream info.');
            if (btn) btn.innerHTML = '<i class="fa-fw fas fa-tv"></i> Start Miniplayer';
        }
    },

    buildPlayerUI(url, username) {
        if (this.container) {
            if (this.hls) this.hls.destroy();
            this.container.remove();
        }

        this.container = document.createElement('div');
        this.container.id = 'fansly-miniplayer-container';

        // Apply State
        this.container.style.width = this.state.width;
        this.container.style.height = this.state.height;
        this.container.style.top = this.state.top;
        this.container.style.left = this.state.left;
        this.container.style.bottom = this.state.bottom;
        this.container.style.right = this.state.right;

        // Header
        const header = document.createElement('div');
        header.id = 'fansly-miniplayer-header';

        const title = document.createElement('span');
        title.className = 'fmp-title';
        title.innerText = username;

        const controls = document.createElement('div');
        controls.className = 'fmp-controls';

        // Quality Select
        const qualitySelect = document.createElement('select');
        qualitySelect.className = 'fmp-select';
        qualitySelect.innerHTML = '<option value="-1">Auto</option>';
        qualitySelect.onchange = (e) => {
            if (this.hls) this.hls.currentLevel = parseInt(e.target.value);
        };

        // Opacity
        const opacityBtn = document.createElement('button');
        opacityBtn.className = 'fmp-btn';
        opacityBtn.innerText = '👻';
        opacityBtn.onclick = () => {
            this.isTransparent = !this.isTransparent;
            this.container.style.opacity = this.isTransparent ? '0.6' : '1';
        };

        // PiP
        const pipBtn = document.createElement('button');
        pipBtn.className = 'fmp-btn';
        pipBtn.innerText = 'PopOut';
        pipBtn.onclick = async () => {
            const v = document.getElementById('fansly-miniplayer-video');
            if (document.pictureInPictureElement) await document.exitPictureInPicture();
            else await v.requestPictureInPicture();
        };

        // Close
        const closeBtn = document.createElement('button');
        closeBtn.className = 'fmp-btn fmp-close';
        closeBtn.innerText = '✕';
        closeBtn.onclick = () => {
            if (this.hls) this.hls.destroy();
            this.container.remove();
            this.container = null;
        };

        controls.append(qualitySelect, opacityBtn, pipBtn, closeBtn);
        header.append(title, controls);

        const video = document.createElement('video');
        video.id = 'fansly-miniplayer-video';
        video.controls = true;
        video.autoplay = true;
        video.volume = this.state.volume;

        video.addEventListener('volumechange', () => {
            this.state.volume = video.volume;
            this.saveState();
        });

        this.container.append(header, video);
        document.body.appendChild(this.container);

        this.makeDraggable(this.container, header);
        this.container.addEventListener('mouseup', () => this.saveState());

        if (window.Hls && Hls.isSupported()) {
            this.hls = new Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(video);
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => { });
                if (this.hls.levels.length > 0) {
                    qualitySelect.innerHTML = '<option value="-1">Auto</option>';
                    this.hls.levels.forEach((level, index) => {
                        const opt = document.createElement('option');
                        opt.value = index;
                        opt.text = level.height + 'p';
                        qualitySelect.appendChild(opt);
                    });
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => video.play());
            qualitySelect.style.display = 'none';
        }
    },

    makeDraggable(elmnt, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;
        const self = this;

        function dragMouseDown(e) {
            if (['BUTTON', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            elmnt.style.bottom = 'auto';
            elmnt.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            self.saveState();
        }
    }
};
