// src/injections/interceptor.js

(function() {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest.prototype.open;
    const originalXHRSend = window.XMLHttpRequest.prototype.send;

    console.log("BetterFansly: Network Interceptor Loaded");

    // 1. Override Fetch
    window.fetch = async function(input, init) {
        let url = input;
        if (typeof input === 'object' && input.url) url = input.url;

        // Check if Ghost Mode is active in LocalStorage
        if (localStorage.getItem('bf_ghost_mode') === 'true' &&
            typeof url === 'string' &&
            (url.includes('/message/ack') || url.includes('/mediastory/view') || url.includes('/message/typing'))) {

            console.log('BetterFansly: 👻 Blocked Receipt/Indicator (Fetch)');
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
        if (localStorage.getItem('bf_ghost_mode') === 'true' &&
            this._bf_url &&
            (this._bf_url.includes('/message/ack') || this._bf_url.includes('/mediastory/view') || this._bf_url.includes('/message/typing'))) {

            console.log('BetterFansly: 👻 Blocked Receipt/Indicator (XHR)');

            // Fake success
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
