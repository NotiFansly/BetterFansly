// src/plugins/oneko.js

const Oneko = {
    // --- 1. Metadata for Registry ---
    id: 'oneko',
    name: 'Oneko 🐈',
    description: 'Adds a retro desktop cat that chases your cursor.',
    defaultEnabled: false,

    // --- 2. State Variables ---
    isActive: false,
    nekoEl: null,
    interval: null,

    nekoPosX: 32,
    nekoPosY: 32,
    mousePosX: 0,
    mousePosY: 0,
    frameCount: 0,
    idleTime: 0,
    idleAnimation: null,
    idleAnimationFrame: 0,

    nekoSpeed: 7,
    spriteSets: {
        idle: [[-3, -3]],
        alert: [[-7, -3]],
        scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
        scratchWallN: [[0, 0], [0, -1]],
        scratchWallS: [[-7, -1], [-6, -2]],
        scratchWallE: [[-2, -2], [-2, -3]],
        scratchWallW: [[-4, 0], [-4, -1]],
        tired: [[-3, -2]],
        sleeping: [[-2, 0], [-2, -1]],
        N: [[-1, -2], [-1, -3]],
        NE: [[0, -2], [0, -3]],
        E: [[-3, 0], [-3, -1]],
        SE: [[-5, -1], [-5, -2]],
        S: [[-6, -3], [-7, -2]],
        SW: [[-5, -3], [-6, -1]],
        W: [[-4, -2], [-4, -3]],
        NW: [[-1, 0], [-1, -1]],
    },

    // --- 3. UI Renderer (Registry Pattern) ---
    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        // Check standardized storage key: bf_plugin_enabled_<id>
        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';

        container.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight:bold;">${this.name}</div>
                <div style="font-size:12px; color:var(--bf-subtext);">${this.description}</div>
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

        this.createCat();

        // Reset state
        this.nekoPosX = 32;
        this.nekoPosY = 32;
        this.frameCount = 0;
        this.idleTime = 0;
        this.mousePosX = this.nekoPosX; // Start mouse at cat so it doesn't jump immediately
        this.mousePosY = this.nekoPosY;

        document.addEventListener("mousemove", this.handleMouseMove);
        this.interval = window.requestAnimationFrame(this.onAnimationFrame.bind(this));

        console.log("BetterFansly: Oneko Enabled 🐈");
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this.nekoEl) {
            this.nekoEl.remove();
            this.nekoEl = null;
        }

        document.removeEventListener("mousemove", this.handleMouseMove);
        if (this.interval) {
            window.cancelAnimationFrame(this.interval);
            this.interval = null;
        }

        console.log("BetterFansly: Oneko Disabled");
    },

    createCat() {
        const neko = document.createElement("div");
        neko.id = "oneko";
        neko.style.width = "32px";
        neko.style.height = "32px";
        neko.style.position = "fixed";
        neko.style.pointerEvents = "none";
        neko.style.backgroundImage = "url('https://raw.githubusercontent.com/adryd325/oneko.js/14bab15a755d0e35cd4ae19c931d96d306f99f42/oneko.gif')";
        neko.style.imageRendering = "pixelated";
        neko.style.left = `${this.nekoPosX - 16}px`;
        neko.style.top = `${this.nekoPosY - 16}px`;
        neko.style.zIndex = "999999";

        document.body.appendChild(neko);
        this.nekoEl = neko;
    },

    handleMouseMove(e) {
        Oneko.mousePosX = e.clientX;
        Oneko.mousePosY = e.clientY;
    },

    onAnimationFrame() {
        if (!this.isActive) return;
        this.interval = window.requestAnimationFrame(this.onAnimationFrame.bind(this));

        // Logic from original: update based on time? 
        // Original logic just runs every frame, so we will too.

        const diffX = this.nekoPosX - this.mousePosX;
        const diffY = this.nekoPosY - this.mousePosY;
        const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

        // Stop if too close (10px)
        if (distance < this.nekoSpeed || distance < 48) {
            this.idle();
            return;
        }

        this.idleAnimation = null;
        this.idleAnimationFrame = 0;

        if (this.idleTime > 1) {
            this.setSprite("alert", 0);
            // wait
            this.idleTime = Math.min(this.idleTime, 7);
            this.idleTime -= 1;
            return;
        }

        // Move
        let direction = "";
        direction += diffY / distance > 0.5 ? "N" : "";
        direction += diffY / distance < -0.5 ? "S" : "";
        direction += diffX / distance > 0.5 ? "W" : "";
        direction += diffX / distance < -0.5 ? "E" : "";

        this.setSprite(direction, this.frameCount);

        this.nekoPosX -= (diffX / distance) * this.nekoSpeed;
        this.nekoPosY -= (diffY / distance) * this.nekoSpeed;

        this.nekoEl.style.left = `${this.nekoPosX - 16}px`;
        this.nekoEl.style.top = `${this.nekoPosY - 16}px`;
    },

    setSprite(name, frame) {
        const sprite = this.spriteSets[name][frame % this.spriteSets[name].length];
        this.nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
        this.frameCount += 1;
    },

    resetIdleAnimation() {
        this.idleAnimation = null;
        this.idleAnimationFrame = 0;
    },

    idle() {
        this.idleTime += 1;

        // every ~10 frames, update idle animation
        if (this.idleTime > 10 && Math.floor(this.idleTime / 5) % 2 === 0 && this.idleAnimation === null) {
            const availableIdleAnimations = ["sleeping", "scratchSelf"];
            if (this.nekoPosX < 32) availableIdleAnimations.push("scratchWallW");
            if (this.nekoPosY < 32) availableIdleAnimations.push("scratchWallN");
            if (this.nekoPosX > window.innerWidth - 32) availableIdleAnimations.push("scratchWallE");
            if (this.nekoPosY > window.innerHeight - 32) availableIdleAnimations.push("scratchWallS");

            this.idleAnimation = availableIdleAnimations[Math.floor(Math.random() * availableIdleAnimations.length)];
        }

        switch (this.idleAnimation) {
            case "sleeping":
                if (this.idleAnimationFrame < 8) {
                    this.setSprite("tired", 0);
                    break;
                }
                this.setSprite("sleeping", Math.floor(this.idleAnimationFrame / 4));
                if (this.idleAnimationFrame > 192) {
                    this.resetIdleAnimation();
                }
                break;
            case "scratchWallN":
            case "scratchWallS":
            case "scratchWallE":
            case "scratchWallW":
            case "scratchSelf":
                this.setSprite(this.idleAnimation, this.idleAnimationFrame);
                if (this.idleAnimationFrame > 9) {
                    this.resetIdleAnimation();
                }
                break;
            default:
                this.setSprite("idle", 0);
                return;
        }

        this.idleAnimationFrame += 1;
    }
};

// Register with Core
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(Oneko);
} else {
    window.Oneko = Oneko;
}
