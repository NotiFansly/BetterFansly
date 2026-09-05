// src/plugins/textReplace.js

const TextReplace = {
    // --- 1. Registry Metadata ---
    id: 'text_replace',
    name: 'Text Replacement',
    description: 'Replace text in your messages. Simple find & replace and regex rules, applied when you send.',
    defaultEnabled: false,

    // --- 2. State ---
    isActive: false,
    STORAGE_KEY: 'bf_text_replace_rules',
    state: null,
    _settingsRefs: null,
    _onKeydown: null,
    _onClick: null,

    // --- 3. Settings UI ---

    renderSettings() {
        const container = document.createElement('div');
        container.className = 'bf-plugin-card';

        const isEnabled = localStorage.getItem(`bf_plugin_enabled_${this.id}`) === 'true';
        this.loadRules();

        container.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${this.name}</div>
                    <div style="font-size:12px; color:var(--bf-subtext);">${this.description}</div>
                </div>
                <input type="checkbox" class="bf-toggle">
            </div>
            <div class="bf-tr-body">
                <div class="bf-tr-section">
                    <div class="bf-tr-title">Rule Tester</div>
                    <input class="bf-input bf-tr-test-in" placeholder="Type a message to test rules on" spellcheck="false">
                    <input class="bf-input bf-tr-test-out" readonly placeholder="Message with rules applied">
                </div>
                <div class="bf-tr-section">
                    <div class="bf-tr-title">Simple Replacements</div>
                    <div class="bf-tr-desc">Simple find and replace rules. For example, find 'brb' and replace it with 'be right back'</div>
                    <div class="bf-tr-list"></div>
                    <button class="bf-btn" type="button">Add Rule</button>
                </div>
                <div class="bf-tr-section">
                    <div class="bf-tr-title">Regex Replacements</div>
                    <div class="bf-tr-desc">More powerful replacements using Regular Expressions. Use /pattern/flags syntax (e.g. /\\bbrb\\b/gi). Invalid patterns are skipped.</div>
                    <div class="bf-tr-list"></div>
                    <button class="bf-btn" type="button">Add Rule</button>
                </div>
            </div>
        `;

        const toggle = container.querySelector('.bf-toggle');
        toggle.checked = isEnabled;
        toggle.onchange = (e) => {
            const active = e.target.checked;
            localStorage.setItem(`bf_plugin_enabled_${this.id}`, active);
            active ? this.enable() : this.disable();
        };

        const testIn = container.querySelector('.bf-tr-test-in');
        const testOut = container.querySelector('.bf-tr-test-out');
        testIn.oninput = () => { testOut.value = this.applyRules(testIn.value); };

        this._settingsRefs = { container, testIn, testOut };

        container.querySelectorAll('.bf-tr-section > .bf-btn').forEach((btn, i) => {
            btn.onclick = () => {
                const key = i === 0 ? 'simple' : 'regex';
                const rule = this.makeEmptyRule();
                this.state[key].push(rule);
                if (!this._expandedIds) this._expandedIds = new Set();
                this._expandedIds.add(rule.id);
                this.saveRules();
                this.renderRuleLists(container);
                this.refreshTester();
                testIn.focus();
            };
        });

        this.renderRuleLists(container);

        return container;
    },

    renderRuleLists(container) {
        if (!this._expandedIds) this._expandedIds = new Set();
        [...this.state.simple, ...this.state.regex].forEach(r => { if (!r.find) this._expandedIds.add(r.id); });
        const lists = container.querySelectorAll('.bf-tr-list');
        lists.forEach(list => { list.innerHTML = ''; });
        this.state.simple.forEach((rule, idx) => this.makeRuleRow('simple', rule, idx, lists[0]));
        this.state.regex.forEach((rule, idx) => this.makeRuleRow('regex', rule, idx, lists[1]));
    },

    makeRuleRow(key, rule, idx, listEl) {
        const row = document.createElement('div');
        row.className = 'bf-tr-rule';
        row._key = key;
        row._rule = rule;

        const head = document.createElement('div');
        head.className = 'bf-tr-head';
        const chev = document.createElement('span');
        chev.className = 'bf-tr-chev';
        chev.textContent = '▸';
        const sum = document.createElement('span');
        sum.className = 'bf-tr-summary';
        sum.textContent = this.summaryFor(key, rule);
        sum.title = sum.textContent;
        head.append(chev, sum);
        head.onclick = () => this.toggleRule(rule, row);

        const body = document.createElement('div');
        body.className = 'bf-tr-rule-body';

        const grid = document.createElement('div');
        grid.className = 'bf-tr-grid';
        const isRegex = key === 'regex';

        const addField = (label, val, placeholder, onChange) => {
            const wrap = document.createElement('div');
            const lb = document.createElement('label');
            lb.className = 'bf-tr-flabel';
            lb.textContent = label;
            const input = document.createElement('input');
            input.className = 'bf-input';
            input.value = val;
            input.placeholder = placeholder;
            input.spellcheck = false;
            input.oninput = (e) => onChange(e.target.value);
            wrap.append(lb, input);
            grid.appendChild(wrap);
            return input;
        };

        addField('Find', rule.find, isRegex ? 'The regex pattern' : 'The text to replace', v => {
            rule.find = v;
            this.onRuleEdit(key);
        });
        addField('Replace', rule.replace, 'The text to replace the found text with', v => {
            rule.replace = v;
            this.onRuleEdit(key);
        });
        addField('Only if includes', rule.onlyIfIncludes, 'This rule will only be applied if the message includes this text. This is optional', v => {
            rule.onlyIfIncludes = v;
            this.onRuleEdit(key);
        });

        const err = document.createElement('div');
        err.className = 'bf-tr-error';
        if (isRegex && rule.find) {
            try { this.stringToRegex(rule.find); } catch (e) { err.textContent = String(e); }
        }

        const actions = document.createElement('div');
        actions.className = 'bf-tr-actions';

        const up = document.createElement('button');
        up.type = 'button'; up.className = 'bf-btn'; up.textContent = '↑';
        up.onclick = () => {
            if (idx <= 0) return;
            const arr = this.state[key];
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            this.saveRules();
            this.renderRuleLists(this._settingsRefs.container);
            this.refreshTester();
        };

        const down = document.createElement('button');
        down.type = 'button'; down.className = 'bf-btn'; down.textContent = '↓';
        down.onclick = () => {
            const arr = this.state[key];
            if (idx >= arr.length - 1) return;
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            this.saveRules();
            this.renderRuleLists(this._settingsRefs.container);
            this.refreshTester();
        };

        const del = document.createElement('button');
        del.type = 'button'; del.className = 'bf-btn bf-tr-delete'; del.textContent = 'Delete Rule';
        del.onclick = () => {
            if (this._expandedIds) this._expandedIds.delete(rule.id);
            this.state[key].splice(idx, 1);
            this.saveRules();
            this.renderRuleLists(this._settingsRefs.container);
            this.refreshTester();
        };

        actions.append(up, down, del);
        body.append(grid, err, actions);
        row.append(head, body);
        if (this._expandedIds && this._expandedIds.has(rule.id)) row.classList.add('open');
        row._sumEl = sum;
        listEl.appendChild(row);
    },

    toggleRule(rule, row) {
        const open = row.classList.toggle('open');
        if (open) this._expandedIds.add(rule.id);
        else this._expandedIds.delete(rule.id);
    },

    summaryFor(key, rule) {
        const tag = key === 'regex' ? '[Regex] ' : '';
        const find = rule.find || 'New rule';
        const only = rule.onlyIfIncludes
            ? ` (only if includes "${rule.onlyIfIncludes}")`
            : '';
        return `${tag}${find} → ${rule.replace}${only}`;
    },

    renderRuleSummaries(container) {
        const rows = container.querySelectorAll ? container.querySelectorAll('.bf-tr-rule') : [];
        for (const row of rows) {
            if (!row._sumEl) continue;
            const text = this.summaryFor(row._key, row._rule);
            row._sumEl.textContent = text;
            row._sumEl.title = text;
        }
    },

    onRuleEdit(key) {
        const arr = this.state[key];
        let pruned = false;
        if (arr.length > 1) {
            for (let i = arr.length - 2; i >= 0; i--) {
                if (!arr[i].find && !arr[i].replace && !arr[i].onlyIfIncludes) {
                    arr.splice(i, 1);
                    pruned = true;
                }
            }
        }
        this.saveRules();
        if (pruned && this._settingsRefs) this.renderRuleLists(this._settingsRefs.container);
        if (this._settingsRefs) {
            this.renderRuleSummaries(this._settingsRefs.container);
            this.refreshTester();
        }
    },

    refreshTester() {
        if (!this._settingsRefs) return;
        this._settingsRefs.testOut.value = this.applyRules(this._settingsRefs.testIn.value);
    },

    // --- 4. Core Logic ---

    enable() {
        if (this.isActive) return;
        this.isActive = true;

        this.loadRules();
        this.injectStyles();

        const self = this;
        this._onKeydown = (e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
            const t = e.target;
            if (t && t.tagName === 'TEXTAREA' && self.isComposeTextarea(t)) {
                self.applyToTextarea(t);
            }
        };
        this._onClick = (e) => {
            const btn = e.target.closest && e.target.closest('.send-button, app-button.send-button, .btn.new-post-btn');
            if (!btn) return;
            const ta = self.findComposeTextarea(btn);
            if (ta) self.applyToTextarea(ta);
        };

        document.addEventListener('keydown', this._onKeydown, true);
        document.addEventListener('click', this._onClick, true);

        console.log('BetterFansly: Text Replacement Enabled');
    },

    disable() {
        if (!this.isActive) return;
        this.isActive = false;

        if (this._onKeydown) {
            document.removeEventListener('keydown', this._onKeydown, true);
            this._onKeydown = null;
        }
        if (this._onClick) {
            document.removeEventListener('click', this._onClick, true);
            this._onClick = null;
        }

        console.log('BetterFansly: Text Replacement Disabled');
    },

    injectStyles() {
        if (document.getElementById('bf-textreplace-css')) return;
        const style = document.createElement('style');
        style.id = 'bf-textreplace-css';
        style.textContent = `
            .bf-tr-body { margin-top: 10px; display: flex; flex-direction: column; gap: 14px; }
            .bf-tr-section { display: flex; flex-direction: column; gap: 6px; }
            .bf-tr-title { font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--bf-text); }
            .bf-tr-desc { font-size: 11px; color: var(--bf-subtext); }
            .bf-tr-test-out { opacity: .7; }
            .bf-tr-list { display: flex; flex-direction: column; gap: 10px; }
            .bf-tr-rule {
                border: 1px solid var(--bf-border); border-radius: 8px;
                padding: 10px; display: flex; flex-direction: column; gap: 8px;
                background: var(--bf-card-bg); overflow: hidden;
            }
            .bf-tr-head { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
            .bf-tr-chev { font-size: 11px; color: var(--bf-subtext); display: inline-block; transition: transform 0.15s; line-height: 1; flex-shrink: 0; }
            .bf-tr-rule.open .bf-tr-chev { transform: rotate(90deg); }
            .bf-tr-summary { font-size: 12px; color: var(--bf-text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
            .bf-tr-rule-body { display: none; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px solid var(--bf-border); }
            .bf-tr-rule.open .bf-tr-rule-body { display: flex; }
            .bf-tr-grid { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 6px 10px; align-items: center; }
            .bf-tr-grid > div { display: contents; }
            .bf-tr-flabel { font-size: 11px; color: var(--bf-subtext); align-self: start; padding-top: 6px; }
            .bf-tr-body .bf-input { width: 100%; min-width: 0; box-sizing: border-box; font-size: 12px; }
            .bf-tr-error { font-size: 11px; color: var(--bf-accent); word-break: break-word; }
            .bf-tr-actions { display: flex; gap: 6px; }
            .bf-tr-actions .bf-btn { padding: 2px 8px; font-size: 11px; }
            .bf-tr-delete { background: #d32f2f !important; color: #fff !important; }
            .bf-tr-delete:hover { background: #b91c1c !important; }
        `;
        document.head.appendChild(style);
    },

    // --- 5. Rule Engine (ported from Vencord's TextReplace) ---

    makeEmptyRule() {
        return { id: crypto.randomUUID(), find: '', replace: '', onlyIfIncludes: '' };
    },

    makeEmptyRuleArray() {
        return [this.makeEmptyRule()];
    },

    loadRules() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (saved && Array.isArray(saved.simple) && Array.isArray(saved.regex)) {
                this.state = saved;
                return;
            }
        } catch (e) { /* fall through to defaults */ }
        this.state = { simple: this.makeEmptyRuleArray(), regex: this.makeEmptyRuleArray() };
    },

    saveRules() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    },

    stringToRegex(str) {
        const match = str.match(/^(\/)?(.+?)(?:\/([gimsuv]*))?$/);
        return match
            ? new RegExp(
                match[2],
                match[3]
                    .split('')
                    .filter((c, i, arr) => arr.indexOf(c) === i)
                    .join('') || 'g'
            )
            : new RegExp(str);
    },

    applyRules(content) {
        if (!content) return content;

        for (const rule of this.state.simple) {
            if (!rule.find) continue;
            if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
            content = ` ${content} `.replaceAll(rule.find, rule.replace.replaceAll('\\n', '\n')).replace(/^\s|\s$/g, '');
        }

        for (const rule of this.state.regex) {
            if (!rule.find) continue;
            if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
            try {
                content = content.replace(this.stringToRegex(rule.find), rule.replace.replaceAll('\\n', '\n'));
            } catch (e) { /* invalid pattern: skip */ }
        }

        return content.trim();
    },

    // --- 6. Compose input detection & application ---

    isComposeTextarea(el) {
        if (el.readOnly || el.disabled) return false;
        if (el.classList.contains('bf-input')) return false;
        if (el.classList.contains('message-input')) return true;
        return !!el.closest('.material-input, app-post-creation, .chat-footer, app-group-message-input');
    },

    findComposeTextarea(fromEl) {
        const post = fromEl.closest('app-post-creation');
        if (post) {
            const ta = post.querySelector('.material-input textarea');
            if (ta) return ta;
        }
        const gmi = fromEl.closest('app-group-message-input');
        if (gmi) {
            const ta = gmi.querySelector('textarea');
            if (ta) return ta;
        }
        const cf = fromEl.closest('.chat-footer');
        if (cf) {
            const ta = cf.querySelector('textarea');
            if (ta) return ta;
        }
        const form = fromEl.closest('form');
        const ta = form && form.querySelector('textarea');
        return ta && this.isComposeTextarea(ta) ? ta : null;
    },

    applyToTextarea(ta) {
        const after = this.applyRules(ta.value);
        if (after !== ta.value) {
            ta.value = after;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
};

// Register
if (window.BF_Registry) {
    window.BF_Registry.registerPlugin(TextReplace);
} else {
    window.TextReplace = TextReplace;
}