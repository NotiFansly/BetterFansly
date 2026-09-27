// src/plugins/volumeBooster.js

// Volume-high glyph with a small plus, matching the FontAwesome style of the
// native overlay controls. Boosted state colors it via the .bf-boost-on class.
const VOL_BOOST_ICON = '<i class="fa-fw fas fa-volume-high"></i><i class="fas fa-plus bf-vol-plus"></i>';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const VolumeBooster = {
    // --- 1. Registry Metadata ---
    id: 'volumeBooster',
    name: 'Volume Booster',
    description: 'Boost audio above 100%, per-player toggle, and mouse-wheel volume control for posts and streams.',
    defaultEnabled: false,

    // --- 2. State ---
    isActive: false,
    observer: null,
    scanTimer: null,
    lastMoveScan: 0,        // throttle for pointer-move rescans
    ctx: null,               // single shared AudioContext, created lazily, page lifetime
    graphs: new WeakMap(),   // <video> -> { ctx, source, gain, engaged, btn } — survives enable/disable
                             // (a routed <video> can never have createMediaElementSource called again)
    tracked: new Set(),      // live references for gain cleanup/iteration
    booted: new WeakSet(),   // <video> -> default volume watcher attached
    wired: new WeakSet(),    // wheel target -> wheel listener attached
    touchWired: new WeakSet(), // volume element -> pointerdown/click "touched" guard attached
    handlers: new WeakMap(), // wheel target -> wheel handler (for cleanup)

    // --- 3. Config Accessors ---

    defaultVolume() { return clamp(this.getNum('bf_volbooster_default', 100), 0, 100) / 100; },
    boostMult() { return clamp(this.getNum('bf_volbooster_mult', 2), 1, 10); },
    autoBoost() { return this.getBool('bf_volbooster_auto'); },
    wheelEnabled() { return this.getBool('bf_volbooster_wheel'); },
    wheelRbmOnly() { return this.getBool('bf_volbooster_wheel_rbm'); },
    wheelStep() { return clamp(this.getNum('bf_volbooster_wheel_step', 5), 1, 50); },

    getBool(key) { return localStorage.getItem(key) === '1'; },
    getNum(key, fallback) {
        const v = parseFloat(localStorage.getItem(key));
        return isNaN(v) ? fallback : v;
    },

    // Fansly persists its own per-player volume in these keys and reads them at
    // init. We mirror our default into them (matching whatever numeric scale the
    // current value uses) so natives start from our value too; the volumechange
    // enforcement loop covers everything the cache doesn't.
    cachedKeys() { return ['fansly_live_cached_volume', 'video_cached_volume']; },

    writeCachedDefault() {
        if (!this.isActive) return;
        const dv = this.defaultVolume();
        this.cachedKeys().forEach(key => {
            const trimmed = String(localStorage.getItem(key) ?? '').trim();
            let val;
            if (/^\d{1,3}$/.test(trimmed)) val = Math.round(dv * 100);      // 0-100 int scale
            else if (/^0(\.\d+)?$/.test(trimmed)) val = dv;                  // 0-1 float scale
            else return;                                                     // unknown/absent: don't guess
            localStorage.setItem(key, String(val));
        });
    },

    // --- 4. UI Renderer ---

    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card bf-vb-card';
        this.injectStyles();

        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';
        const dv = Math.round(this.defaultVolume() * 100);
        const mult = this.boostMult();
        const step = this.wheelStep();

        container.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${this.name}</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">${this.description}</div>
                </div>
                <input type="checkbox" class="bf-toggle">
            </div>
            <div class="bf-vb-body">
                <details class="bf-vb-details">
                    <summary class="bf-vb-summary">
                        <i class="fas fa-volume-high"></i> Volume settings
                    </summary>
                    <div class="bf-vb-config">
                        <div class="bf-vb-field">
                            <label>Default volume level: <span class="bf-vb-val" data-val="default">${dv}%</span></label>
                            <input type="number" class="bf-input" id="vb-default" min="0" max="100" step="1" value="${dv}">
                        </div>
                        <div class="bf-vb-field">
                            <label>Volume booster level: <span class="bf-vb-val" data-val="mult">${mult}×</span></label>
                            <input type="number" class="bf-input" id="vb-mult" min="1" max="5" step="0.5" value="${mult}">
                        </div>
                        <label class="bf-vb-check"><input type="checkbox" id="vb-auto" ${this.autoBoost() ? 'checked' : ''}> Automatically boost the volume</label>
                        <label class="bf-vb-check"><input type="checkbox" id="vb-wheel" ${this.wheelEnabled() ? 'checked' : ''}> Control the volume level with the mouse wheel when hovering over the video player</label>
                        <label class="bf-vb-check"><input type="checkbox" id="vb-rbm" ${this.wheelRbmOnly() ? 'checked' : ''}> Only when the right mouse button is pressed</label>
                        <div class="bf-vb-field">
                            <label>Volume variation when rotating the mouse wheel: <span class="bf-vb-val" data-val="step">${step}</span></label>
                            <input type="number" class="bf-input" id="vb-step" min="1" max="50" step="1" value="${step}">
                        </div>
                    </div>
                </details>
            </div>
        `;

        const valEl = (name) => container.querySelector(`[data-val="${name}"]`);

        container.querySelector('#vb-default').oninput = (e) => {
            const v = clamp(parseInt(e.target.value, 10) || 0, 0, 100);
            localStorage.setItem('bf_volbooster_default', v);
            valEl('default').textContent = `${v}%`;
            this.writeCachedDefault();
        };

        container.querySelector('#vb-mult').oninput = (e) => {
            const v = clamp(parseFloat(e.target.value) || 1, 1, 10);
            localStorage.setItem('bf_volbooster_mult', v);
            valEl('mult').textContent = `${v}×`;
            this.reapplyGains();
        };

        container.querySelector('#vb-auto').onchange = (e) => {
            localStorage.setItem('bf_volbooster_auto', e.target.checked ? '1' : '');
            if (e.target.checked) this.engageAll(true);
        };

        container.querySelector('#vb-wheel').onchange = (e) => {
            localStorage.setItem('bf_volbooster_wheel', e.target.checked ? '1' : '');
        };

        container.querySelector('#vb-rbm').onchange = (e) => {
            localStorage.setItem('bf_volbooster_wheel_rbm', e.target.checked ? '1' : '');
        };

        container.querySelector('#vb-step').oninput = (e) => {
            const v = clamp(parseInt(e.target.value, 10) || 1, 1, 50);
            localStorage.setItem('bf_volbooster_wheel_step', v);
            valEl('step').textContent = `${v}`;
        };

        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;
        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            active ? this.enable() : this.disable();
        };

        return container;
    },

    injectStyles() {
        if (document.getElementById('bf-volumebooster-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-volumebooster-css';
        style.textContent = `
            .bf-vb-card { flex-direction: column; align-items: stretch; gap: 10px; }
            .bf-vb-card > div:first-child { flex: 0 0 auto; }
            .bf-vb-body { margin-top: 0; width: 100%; }
            .bf-vb-details { border: 1px solid var(--bf-border); border-radius: 8px; padding: 8px 10px; background: var(--bf-card-bg); }
            .bf-vb-summary { cursor: pointer; font-size: 12px; color: var(--bf-text); display: flex; align-items: center; gap: 8px; user-select: none; list-style: none; }
            .bf-vb-summary::-webkit-details-marker { display: none; }
            .bf-vb-config { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; font-size: 11px; color: var(--bf-text); }
            .bf-vb-config .bf-input { width: 100%; min-width: 0; box-sizing: border-box; font-size: 12px; margin-top: 0; }
            .bf-vb-field label { display: block; margin-bottom: 2px; }
            .bf-vb-val { color: var(--bf-accent); font-weight: 600; }
            .bf-vb-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }

            /* Player booster button, sits right after the native volume slider.
               Classes mirror the native overlay controls (control-btn/bue) so it
               matches sizing, colors and hover like Miniplayer's button. */
            .bf-vol-boost {
                position: relative;
                flex-shrink: 0;
                min-width: 30px; height: 30px;
                display: inline-flex; align-items: center; justify-content: center;
                color: var(--font-1, #fff);
                background: transparent; border: none; cursor: pointer;
                padding: 0;
            }
            .bf-vol-boost .bf-vol-plus {
                position: absolute; top: 1px; right: 3px;
                font-size: 8px; line-height: 1; font-weight: 700;
                color: currentColor;
            }
            .bf-vol-boost.bf-boost-on { color: var(--accent-color, #a855f7); }
        `;
        document.head.appendChild(style);
    },

    // --- 5. Lifecycle ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;
        this.injectStyles();
        this.writeCachedDefault();
        this.scan();
        this.observer = new MutationObserver(() => this.scheduleScan());
        this.observer.observe(document.body, { childList: true, subtree: true });
        console.log("BetterFansly: Volume Booster Enabled");
    },

    disable() {
        this.isActive = false;
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
        if (this.observer) { this.observer.disconnect(); this.observer = null; }

        // Settle every graph to unity gain and drop the buttons. The shared
        // context and routing stay alive: a created MediaElementSource can't
        // be un-routed, and closing the context would mute live-routed audio.
        this.tracked.forEach(video => {
            const data = this.graphs.get(video);
            if (!data) return;
            data.engaged = false;
            try { data.gain.gain.value = 1; } catch (e) {}
            if (data.btn && data.btn.isConnected) data.btn.remove();
            data.btn = null;
        });

        console.log("BetterFansly: Volume Booster Disabled");
    },

    scheduleScan() {
        if (this.scanTimer) return;
        this.scanTimer = setTimeout(() => { this.scanTimer = null; this.scan(); }, 150);
    },

    // --- 6. Player Hooking ---

    scan() {
        if (!this.isActive) return;
        const seen = new Set();
        const add = (video) => {
            if (video && !seen.has(video)) {
                seen.add(video);
                this.setupPlayer(video);
            }
        };
        // Feed players (video.js) and any video already inside an overlay.
        document.querySelectorAll('video.video-js, .video-overlay video, .video-controls video').forEach(add);
        // Live: the stream-player backdrop hosts <video class="width-100"> with
        // no video-js class and is a sibling of the controls overlay — hook it
        // via the component instead of a CSS relationship to the footer.
        document.querySelectorAll('app-stream-player').forEach(player => {
            const video = player.querySelector && (player.querySelector('video') || player.querySelector('video.video-js'));
            add(video);
        });
    },

    closestMatch(el, sel) {
        return (typeof el.closest === 'function') ? el.closest(sel) : null;
    },

    // Find where a given <video> lives so we can attach UI to the right place.
    // Feed players: app-videojs-player > .video-footer-controls. Live players:
    // the stream-player backdrop (holds the video) plus the controls overlay's
    // .overlay-footer, which may be a SIBLING in the DOM rather than an ancestor
    // — resolve it via document lookup instead of closest().
    resolveUI(video) {
        const stream = this.closestMatch(video, 'app-stream-player');
        const wrap = this.closestMatch(video, 'app-videojs-player');
        const overlay = stream
            ? (this.closestMatch(video, '.video-overlay') || document.querySelector('.video-overlay'))
            : null;

        let bar = null, ref = null, wheelTarget = null;

        if (overlay) {
            bar = (overlay.querySelector && overlay.querySelector('.overlay-footer')) || overlay;
            if (bar.querySelector) {
                const vol = bar.querySelector('.volume-control');
                ref = vol && vol.nextSibling ? vol.nextSibling : (bar.querySelector('.live-indicator'));
            }
            wheelTarget = stream || overlay;
        } else if (wrap) {
            const controls = wrap.querySelector && wrap.querySelector('.video-footer-controls');
            if (controls) {
                bar = controls;
                const vol = controls.querySelector && controls.querySelector('.volume-control');
                ref = vol && vol.nextSibling ? vol.nextSibling : null;
            }
            wheelTarget = wrap;
        }

        if (!wheelTarget) {
            const controls = this.closestMatch(video, '.video-controls');
            wheelTarget = controls || video.parentElement || video;
        }

        return { bar, ref, wheelTarget };
    },

    setupPlayer(video) {
        if (!video) return;

        const data = this.ensureGraph(video);
        // The controls overlay on /live/ is destroyed and re-created every time
        // it auto-hides/re-shows, so the UI footprint must be re-resolved on
        // every pass — cached references would point at a detached subtree.
        data.ui = this.resolveUI(video);

        this.ensureButton(video, data);
        this.wireWheel(video, data);
        this.watchDefaultVolume(video, data);

        // Auto-boost newly surfaced players.
        if (this.autoBoost() && !data.engaged) this.setEngaged(video, true);
    },

    // Applies the configured default volume every time Fansly sets one until
    // the user takes over via the native slider, mute toggle, or wheel. Fansly
    // reads its own cached-volume keys at player init, so one-time writes get
    // stomped — enforcing on volumechange until first user interaction is the
    // only way to reliably win.
    watchDefaultVolume(video, data) {
        if (!this.booted.has(video)) {
            const enforce = () => {
                if (this.isActive && !data.touched) {
                    const dv = this.defaultVolume();
                    if (Math.abs(video.volume - dv) > 0.0001) {
                        data.ui = this.resolveUI(video); // overlay may have been re-created
                        video.volume = dv;
                        this.syncVolumeUi(video, data);
                    }
                }
            };
            video.addEventListener('volumechange', enforce);
            this.booted.add(video);
        }

        // Mark "user is driving volume" on native slider interaction. The volume
        // element is re-created with each overlay rebuild, so guard per element.
        const vol = data.ui.bar && data.ui.bar.querySelector && data.ui.bar.querySelector('.volume-control');
        if (vol && !this.touchWired.has(vol)) {
            const markTouched = () => { data.touched = true; };
            vol.addEventListener('pointerdown', markTouched);
            vol.addEventListener('click', markTouched);
            this.touchWired.add(vol);
        }

        if (!data.touched && Math.abs(video.volume - this.defaultVolume()) > 0.0001) {
            video.volume = this.defaultVolume();
            this.syncVolumeUi(video, data);
        }
    },

    ensureGraph(video) {
        let data = this.graphs.get(video);
        if (data) return data;

        // WebAudio graph gives us gain above 1.0 (element volume is capped at
        // 1). createMediaElementSource re-routes the element's audio through
        // our graph, so it must only ever be called once per element.
        if (!this.ctx) this.ctx = new window.AudioContext();
        const source = this.ctx.createMediaElementSource(video);
        const gain = this.ctx.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(this.ctx.destination);

        const resume = () => { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); };
        video.addEventListener('play', resume);
        video.addEventListener('loadedmetadata', resume);

        data = { ctx: this.ctx, source, gain, engaged: false, touched: false, ui: null, btn: null, resume };
        this.graphs.set(video, data);
        this.tracked.add(video);
        return data;
    },

    ensureButton(video, data) {
        if (data.btn && data.btn.isConnected) return;
        const { bar, ref } = data.ui;
        if (!bar) return;

        const btn = document.createElement('button');
        btn.className = 'control-btn blue-1-hover-only bf-vol-boost';
        btn.type = 'button';
        btn.innerHTML = VOL_BOOST_ICON;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleBoost(video);
        });
        if (ref) bar.insertBefore(btn, ref);
        else bar.appendChild(btn);
        data.btn = btn;
        this.updateButton(data);
    },

    wireWheel(video, data) {
        const target = data.ui.wheelTarget;
        if (!target || this.wired.has(target)) return;
        this.wired.add(target);

        const handler = (e) => {
            if (!this.isActive || !this.wheelEnabled()) return;
            if (this.wheelRbmOnly() && !(e.buttons & 2)) return;
            e.preventDefault();
            data.touched = true;  // user is driving volume now
            const delta = e.deltaY < 0 ? 1 : -1;
            const next = clamp((video.volume || 1) + delta * (this.wheelStep() / 100), 0, 1);
            video.volume = next;
            this.syncVolumeUi(video, data);
        };
        target.addEventListener('wheel', handler, { passive: false });
        this.handlers.set(target, handler);

        // The live controls overlay re-creates its footer when it re-shows on
        // mouse move, so rescan (throttled) whenever the pointer is over the
        // player — the boost button reappears the moment the overlay does.
        const moveHandler = () => {
            if (!this.isActive) return;
            const now = Date.now();
            if (now - this.lastMoveScan > 250) {
                this.lastMoveScan = now;
                this.scan();
            }
        };
        target.addEventListener('pointermove', moveHandler, { passive: true });
    },

    // --- 7. Boost Core ---

    toggleBoost(video) {
        const data = this.graphs.get(video);
        if (!data) return;
        this.setEngaged(video, !data.engaged);
    },

    setEngaged(video, engaged) {
        const data = this.graphs.get(video);
        if (!data) return;
        data.engaged = engaged;
        try {
            const t = data.ctx.currentTime;
            data.gain.gain.cancelScheduledValues(t);
            data.gain.gain.setValueAtTime(data.gain.gain.value, t);
            data.gain.gain.linearRampToValueAtTime(engaged ? this.boostMult() : 1, t + 0.05);
        } catch (e) {
            data.gain.gain.value = engaged ? this.boostMult() : 1;
        }
        this.updateButton(data);
    },

    engageAll(engaged) {
        this.tracked.forEach(video => this.setEngaged(video, engaged));
    },

    reapplyGains() {
        this.tracked.forEach(video => {
            const data = this.graphs.get(video);
            if (!data) return;
            if (data.engaged) data.gain.gain.value = this.boostMult();
        });
    },

    updateButton(data) {
        if (!data.btn) return;
        data.btn.classList.toggle('bf-boost-on', data.engaged);
        data.btn.title = data.engaged ? 'Boost volume (on)' : 'Boost volume';
    },

    // --- 8. Native UI Sync ---

    syncVolumeUi(video, data) {
        if (!video.isConnected) return;
        data.ui = this.resolveUI(video);
        const bar = data.ui.bar;
        if (!bar || !bar.querySelector) return;
        const pct = Math.round(clamp(video.volume || 0, 0, 1) * 100);
        const fill = bar.querySelector('.volume-track-fill');
        const knob = bar.querySelector('.volume-knob');
        if (fill) fill.style.width = `${pct}%`;
        if (knob) knob.style.left = `${pct}%`;
    }
};

// --- 9. Register ---
window.BF_Registry.registerPlugin(VolumeBooster);