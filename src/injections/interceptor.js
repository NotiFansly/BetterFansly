// src/injections/interceptor.js

(function() {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest.prototype.open;
    const originalXHRSend = window.XMLHttpRequest.prototype.send;

    console.log("BetterFansly: Network Interceptor Loaded");

    // Helper to check if a specific feature is enabled
    // We check the Master Switch (bf_ghost_mode) AND the specific sub-switch
    function shouldBlock(url) {
        // Master Switch
        if (localStorage.getItem('bf_ghost_mode') !== 'true') return false;
        if (typeof url !== 'string') return false;

        // 1. Read Receipts
        if (url.includes('/message/ack') && localStorage.getItem('bf_ghost_read') !== 'false') {
            console.log('BetterFansly: 👻 Blocked Read Receipt');
            return true;
        }

        // 2. Story Views
        if (url.includes('/mediastory/view') && localStorage.getItem('bf_ghost_story') !== 'false') {
            console.log('BetterFansly: 👻 Blocked Story View');
            return true;
        }

        // 3. Typing Indicators
        if (url.includes('/message/typing') && localStorage.getItem('bf_ghost_typing') !== 'false') {
            console.log('BetterFansly: 👻 Blocked Typing Indicator');
            return true;
        }

        // 4. Online Status
        if (url.includes('/api/v1/status') && localStorage.getItem('bf_ghost_status') !== 'false') {
            console.log('BetterFansly: 👻 Blocked Online Status Update');
            return true;
        }

        return false;
    }

    // 1. Override Fetch
    window.fetch = async function(input, init) {
        let url = input;
        if (typeof input === 'object' && input.url) url = input.url;

        if (shouldBlock(url)) {
            // Return a fake successful response
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return originalFetch.apply(this, arguments);
    };

    // 2. Override XMLHttpRequest
    window.XMLHttpRequest.prototype.open = function(method, url) {
        this._bf_url = url;
        return originalXHR.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function(body) {
        if (this._bf_url && shouldBlock(this._bf_url)) {
            // Fake success for XHR
            Object.defineProperty(this, 'readyState', { value: 4 });
            Object.defineProperty(this, 'status', { value: 200 });
            Object.defineProperty(this, 'responseText', { value: '{"success":true}' });

            setTimeout(() => {
                if (this.onreadystatechange) this.onreadystatechange();
                if (this.onload) this.onload();
            }, 10);
            return;
        }
        return originalXHRSend.apply(this, arguments);
    };
})();
