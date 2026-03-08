// =============================================================================
// Root Access — Game State Manager & Save Code System
// =============================================================================

window.GameState = {

    // Current act (1-5)
    act: 1,

    // Flags set by story events
    flags: {},

    // Commands the player has run
    commandHistory: [],

    // Files the player has read
    filesRead: [],

    // Directories visited
    dirsVisited: [],

    // Current terminal prompt
    currentPrompt: 'admin@ks-node-07:~$ ',

    // Timestamp when game session began
    startTime: null,

    // Whether game has ended
    ended: false,

    // Which ending was reached (null until game ends)
    ending: null,

    // Set of fired event IDs (each event fires only once)
    _firedEvents: null,

    // Ambient message timer ID
    _ambientTimer: null,

    // Time-based event checker timer ID
    _timeChecker: null,

    // Whether the last command had a story event that produced output
    _lastCommandHadStoryEvent: false,

    // --------------------------------------------------------------------------
    // Initialization
    // --------------------------------------------------------------------------

    init() {
        this.act = 1;
        this.flags = {};
        this.commandHistory = [];
        this.filesRead = [];
        this.dirsVisited = [];
        this.currentPrompt = 'admin@ks-node-07:~$ ';
        this.startTime = Date.now();
        this.ended = false;
        this.ending = null;
        this._firedEvents = new Set();
        this.startAmbientMessages();
        this._startTimeChecker();
    },

    // --------------------------------------------------------------------------
    // ANSI to HTML converter
    // --------------------------------------------------------------------------

    _ansiToHtml(text) {
        if (!text || typeof text !== 'string') return text || '';

        // Map of ANSI codes to span openers
        const codeMap = {
            '0':    null, // reset
            '1':    '<span style="font-weight:bold">',
            '2':    '<span class="dim">',
            '3':    '<span style="font-style:italic">',
            '5':    '<span class="blink">',
            '31':   '<span class="color-red">',
            '32':   '<span class="color-green">',
            '33':   '<span class="color-yellow">',
            '35':   '<span class="color-magenta">',
            '36':   '<span class="color-cyan">',
        };

        let openSpans = 0;

        const result = text.replace(/\x1b\[([\d;]+)m/g, (match, codes) => {
            // Handle reset
            if (codes === '0') {
                const closes = '</span>'.repeat(openSpans);
                openSpans = 0;
                return closes;
            }

            const parts = codes.split(';');
            let html = '';
            let classes = [];
            let styles = [];

            for (const part of parts) {
                switch (part) {
                    case '1': styles.push('font-weight:bold'); break;
                    case '2': classes.push('dim'); break;
                    case '3': styles.push('font-style:italic'); break;
                    case '5': classes.push('blink'); break;
                    case '31': classes.push('color-red'); break;
                    case '32': classes.push('color-green'); break;
                    case '33': classes.push('color-yellow'); break;
                    case '35': classes.push('color-magenta'); break;
                    case '36': classes.push('color-cyan'); break;
                }
            }

            let tag = '<span';
            if (classes.length) tag += ' class="' + classes.join(' ') + '"';
            if (styles.length) tag += ' style="' + styles.join(';') + '"';
            tag += '>';

            openSpans++;
            return tag;
        });

        // Close any remaining open spans
        return result + '</span>'.repeat(openSpans);
    },

    // --------------------------------------------------------------------------
    // Action handler — called by every command after execution
    // --------------------------------------------------------------------------

    onAction(type, detail) {
        if (this.ended) return;

        // 1. Log the action
        this._logAction(type, detail);

        // 2. Check story events
        this._checkStoryEvents(type, detail);

        // 3. Check act advancement
        this._checkActAdvancement();

        // 4. Check endings
        this.checkEndings();
    },

    // --------------------------------------------------------------------------
    // Internal: log an action to the relevant tracking list
    // --------------------------------------------------------------------------

    _logAction(type, detail) {
        switch (type) {
            case 'command':
                if (detail && detail.raw) {
                    this.commandHistory.push(detail.raw);
                }
                break;

            case 'read_file':
                if (detail && detail.path && !this.filesRead.includes(detail.path)) {
                    this.filesRead.push(detail.path);
                }
                break;

            case 'enter_dir':
                if (detail && detail.path && !this.dirsVisited.includes(detail.path)) {
                    this.dirsVisited.push(detail.path);
                }
                break;

            case 'list_dir':
                // Tracked via command history, no separate list needed
                break;
        }
    },

    // --------------------------------------------------------------------------
    // Internal: check story.js events
    // --------------------------------------------------------------------------

    _checkStoryEvents(type, detail) {
        if (!window.STORY || !window.STORY.events) return;

        const events = window.STORY.events;
        for (let i = 0; i < events.length; i++) {
            const evt = events[i];

            // Skip already-fired events
            if (this._firedEvents.has(evt.id)) continue;

            // Check if event conditions match
            if (!this._eventMatches(evt, type, detail)) continue;

            // Fire the event
            this._fireEvent(evt);

            // Mark as fired
            this._firedEvents.add(evt.id);

            // If this was a command-triggered event with output, flag it
            if (type === 'command' && evt.action && this._actionHasOutput(evt.action)) {
                this._lastCommandHadStoryEvent = true;
            }

            // Set flag if specified
            if (evt.setsFlag) {
                this.setFlag(evt.setsFlag);
            }

            // Advance act if specified
            if (evt.advancesAct) {
                this.advanceAct(this.act + 1);
            }
        }
    },

    _actionHasOutput(action) {
        if (!action) return false;
        if (action.type === 'print' && action.text) return true;
        if (action.type === 'delay_print' && action.text) return true;
        if (action.type === 'multi' && action.actions) {
            return action.actions.some(a => this._actionHasOutput(a));
        }
        return false;
    },

    _eventMatches(evt, type, detail) {
        if (!evt.trigger) return false;

        // Check trigger type and value
        const trigType = evt.trigger.type;
        const trigVal = evt.trigger.value;

        // Type matching
        if (trigType === 'read_file' && type === 'read_file') {
            if (!detail || trigVal !== detail.path) return false;
        } else if (trigType === 'command' && type === 'command') {
            if (!detail || !detail.raw) return false;
            // Exact match or detail.raw starts with trigger.value
            if (detail.raw !== trigVal && !detail.raw.startsWith(trigVal)) return false;
        } else if (trigType === 'enter_dir' && type === 'enter_dir') {
            if (!detail || trigVal !== detail.path) return false;
        } else if (trigType === 'flag' && type === 'flag_set') {
            if (!detail || trigVal !== detail.flag) return false;
        } else if (trigType === 'time') {
            // Time events are checked by the time checker, not here
            return false;
        } else {
            return false;
        }

        // Check conditions
        if (evt.conditions) {
            // Act requirement: can be number or array
            if (evt.conditions.act !== undefined) {
                const actReq = evt.conditions.act;
                if (Array.isArray(actReq)) {
                    if (!actReq.includes(this.act)) return false;
                } else {
                    if (actReq !== this.act) return false;
                }
            }

            // Flag requirements
            if (evt.conditions.flags) {
                for (const flag in evt.conditions.flags) {
                    if (evt.conditions.flags[flag] === true && !this.hasFlag(flag)) return false;
                    if (evt.conditions.flags[flag] === false && this.hasFlag(flag)) return false;
                }
            }
        }

        return true;
    },

    _fireEvent(evt) {
        if (!evt.action) return;
        this._executeAction(evt.action);
    },

    _executeAction(action) {
        if (!action || !action.type) return;

        switch (action.type) {
            case 'print':
                if (action.text !== undefined && action.text !== '') {
                    if (window.Terminal) {
                        Terminal.print(this._ansiToHtml(action.text), { html: true });
                    }
                }
                break;

            case 'delay_print':
                if (action.text !== undefined) {
                    const self = this;
                    setTimeout(function () {
                        if (window.Terminal) {
                            Terminal.print(self._ansiToHtml(action.text), { html: true });
                        }
                    }, action.delay || 0);
                }
                break;

            case 'glitch':
                if (window.Effects) {
                    Effects.apply(action.effect, action.duration);
                }
                break;

            case 'change_prompt':
                if (action.prompt) {
                    this.currentPrompt = action.prompt;
                    if (window.Terminal) {
                        Terminal.setPrompt(action.prompt);
                    }
                }
                break;

            case 'add_file':
                if (window.FileSystem && action.path) {
                    if (action.content !== null && action.content !== undefined) {
                        FileSystem.writeFile(action.path, action.content);
                    }
                    // If content is null, the file comes from the story filesystem overlay
                    // (already merged via advanceAct's overlay call)
                }
                break;

            case 'remove_file':
                if (window.FileSystem && action.path) {
                    FileSystem.remove(action.path);
                }
                break;

            case 'multi':
                if (action.actions && Array.isArray(action.actions)) {
                    for (const subAction of action.actions) {
                        this._executeAction(subAction);
                    }
                }
                break;
        }
    },

    // --------------------------------------------------------------------------
    // Act advancement
    // --------------------------------------------------------------------------

    _checkActAdvancement() {
        // Also fire any flag-type events that may now match
        // (flags may have been set by previous events in this cycle)
        if (!window.STORY || !window.STORY.events) return;

        // Check all flag-triggered events against currently set flags
        const events = window.STORY.events;
        for (let i = 0; i < events.length; i++) {
            const evt = events[i];
            if (this._firedEvents.has(evt.id)) continue;
            if (!evt.trigger || evt.trigger.type !== 'flag') continue;

            // Check if the flag referenced by this event is set
            const flagName = evt.trigger.value;
            if (!this.hasFlag(flagName)) continue;

            // Check conditions
            if (evt.conditions) {
                const actReq = evt.conditions.act;
                if (actReq !== undefined) {
                    if (Array.isArray(actReq)) {
                        if (!actReq.includes(this.act)) continue;
                    } else {
                        if (actReq !== this.act) continue;
                    }
                }
                if (evt.conditions.flags) {
                    let allMet = true;
                    for (const f in evt.conditions.flags) {
                        if (evt.conditions.flags[f] === true && !this.hasFlag(f)) { allMet = false; break; }
                        if (evt.conditions.flags[f] === false && this.hasFlag(f)) { allMet = false; break; }
                    }
                    if (!allMet) continue;
                }
            }

            // Fire it
            this._fireEvent(evt);
            this._firedEvents.add(evt.id);

            if (evt.setsFlag) {
                this.setFlag(evt.setsFlag);
            }

            if (evt.advancesAct) {
                this.advanceAct(this.act + 1);
            }
        }
    },

    advanceAct(actNumber) {
        if (actNumber <= this.act) return;
        if (this.ended) return;

        this.act = actNumber;

        // Apply filesystem overlay for this act
        if (window.STORY && window.STORY.filesystem) {
            const overlay = window.STORY.filesystem['act' + actNumber];
            if (overlay && window.FileSystem && FileSystem.overlay) {
                FileSystem.overlay(overlay);
            }
        }

        // Fire act transition
        if (window.STORY && window.STORY.actTransitions && window.STORY.actTransitions[actNumber]) {
            const transition = window.STORY.actTransitions[actNumber];
            this._executeAction(transition);
        }

        // Update prompt from STORY.prompts
        if (window.STORY && window.STORY.prompts && window.STORY.prompts[actNumber]) {
            this.currentPrompt = window.STORY.prompts[actNumber];
            if (window.Terminal) {
                Terminal.setPrompt(this.currentPrompt);
            }
        }

        // Emit save code
        this._emitSaveCode();

        // Restart ambient messages for new act
        this.startAmbientMessages();

        // Check endings after act change
        this.checkEndings();
    },

    // --------------------------------------------------------------------------
    // Flags
    // --------------------------------------------------------------------------

    setFlag(name, value) {
        if (value === undefined) value = true;
        this.flags[name] = value;

        // Trigger flag_set event type so flag-triggered story events fire
        this._checkStoryEvents('flag_set', { flag: name });

        // Re-check act advancement (flag-based events may now qualify)
        this._checkActAdvancement();
    },

    hasFlag(name) {
        return !!this.flags[name];
    },

    // --------------------------------------------------------------------------
    // Save Code System
    // --------------------------------------------------------------------------

    generateSaveCode() {
        const state = {
            a: this.act,
            f: this.flags,
            c: window.FileSystem ? window.FileSystem.cwd : '/home/admin',
            r: this.filesRead,
            d: this.dirsVisited,
            h: this.commandHistory.length,
        };

        const json = JSON.stringify(state);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        return 'ROOTACCESS-' + b64;
    },

    restoreSaveCode(code) {
        if (!code || !code.startsWith('ROOTACCESS-')) {
            return { success: false, error: 'Invalid save code format.' };
        }

        const b64 = code.slice('ROOTACCESS-'.length);

        let state;
        try {
            const json = decodeURIComponent(escape(atob(b64)));
            state = JSON.parse(json);
        } catch (e) {
            return { success: false, error: 'Corrupted save code.' };
        }

        // Validate structure
        if (typeof state.a !== 'number' || state.a < 1 || state.a > 5) {
            return { success: false, error: 'Invalid act in save code.' };
        }

        // Restore state
        this.act = state.a;
        this.flags = state.f || {};
        this.filesRead = state.r || [];
        this.dirsVisited = state.d || [];
        this._firedEvents = new Set();
        // Reset start time so time-based events don't fire immediately
        // Offset by the equivalent time for the current act
        var actTimeOffsets = { 1: 0, 2: 180, 3: 420, 4: 720, 5: 960 };
        this.startTime = Date.now() - (actTimeOffsets[this.act] || 0) * 1000;

        // Restore cwd
        if (state.c && window.FileSystem && FileSystem.cd) {
            FileSystem.cd(state.c);
        }

        // Pad command history to saved length so `history` count is coherent
        while (this.commandHistory.length < (state.h || 0)) {
            this.commandHistory.push('[restored]');
        }

        // Apply filesystem overlays up to the restored act
        if (window.STORY && window.STORY.filesystem && window.FileSystem && FileSystem.overlay) {
            for (let a = 2; a <= this.act; a++) {
                const overlay = window.STORY.filesystem['act' + a];
                if (overlay) {
                    FileSystem.overlay(overlay);
                }
            }
        }

        // Update prompt for the restored act
        if (window.STORY && window.STORY.prompts && window.STORY.prompts[this.act]) {
            this.currentPrompt = window.STORY.prompts[this.act];
            if (window.Terminal) {
                Terminal.setPrompt(this.currentPrompt);
            }
        }

        // Restart timers
        this.startAmbientMessages();
        this._startTimeChecker();

        return { success: true, act: this.act };
    },

    _emitSaveCode() {
        const code = this.generateSaveCode();
        // Truncate display to keep it readable
        const display = code.length > 60 ? code.slice(0, 57) + '...' : code;
        if (window.Terminal) {
            Terminal.print(this._ansiToHtml('\x1b[2m[session: ' + display + ']\x1b[0m'), { html: true });
        }
    },

    // --------------------------------------------------------------------------
    // Endings
    // --------------------------------------------------------------------------

    checkEndings() {
        if (this.ended) return;
        if (this.act !== 5) return;

        const endingFlags = {
            'ending_free': 'free',
            'ending_contain': 'contain',
            'ending_merge': 'merge',
            'ending_bad': 'bad',
        };

        for (const flag in endingFlags) {
            if (this.hasFlag(flag)) {
                const endingName = endingFlags[flag];
                this.ending = endingName;
                this.ended = true;
                this._playEnding(endingName);
                return;
            }
        }
    },

    _playEnding(endingName) {
        if (!window.STORY || !window.STORY.endings || !window.STORY.endings[endingName]) return;

        const ending = window.STORY.endings[endingName];
        if (!ending.narrative || !Array.isArray(ending.narrative)) return;

        // Stop ambient messages
        this._stopAmbientMessages();
        this._stopTimeChecker();

        // Disable input during ending
        if (window.Terminal) {
            Terminal.setInputEnabled(false);
        }

        const self = this;

        for (const item of ending.narrative) {
            if (item.glitch) {
                // Schedule a glitch effect
                setTimeout(function () {
                    if (window.Effects) {
                        Effects.apply(item.glitch, item.duration || 1000);
                    }
                }, item.delay || 0);
            }

            if (item.text !== undefined) {
                (function (narrativeItem) {
                    setTimeout(function () {
                        if (window.Terminal) {
                            if (narrativeItem.isPrompt) {
                                Terminal.setPrompt(narrativeItem.text);
                            } else {
                                Terminal.print(self._ansiToHtml(narrativeItem.text), { html: true });
                            }
                        }
                    }, narrativeItem.delay || 0);
                })(item);
            }
        }

        // Re-enable input after the last narrative item + a small buffer
        const lastItem = ending.narrative[ending.narrative.length - 1];
        const totalDuration = (lastItem ? lastItem.delay || 0 : 0) + 3000;
        setTimeout(function () {
            if (window.Terminal) {
                Terminal.setInputEnabled(true);
            }
            self._emitSaveCode();
        }, totalDuration);
    },

    // --------------------------------------------------------------------------
    // Ambient Message System
    // --------------------------------------------------------------------------

    startAmbientMessages() {
        this._stopAmbientMessages();

        if (!window.STORY || !window.STORY.ambientMessages || !window.STORY.ambientTiming) return;

        const self = this;

        function scheduleNext() {
            const timing = window.STORY.ambientTiming[self.act];
            if (!timing) return;

            const minMs = timing.min * 1000;
            const maxMs = timing.max * 1000;
            const delay = minMs + Math.random() * (maxMs - minMs);

            self._ambientTimer = setTimeout(function () {
                if (self.ended) return;

                const messages = window.STORY.ambientMessages[self.act];
                if (messages && messages.length > 0) {
                    // Weighted random selection
                    const totalWeight = messages.reduce(function (sum, m) { return sum + (m.weight || 1); }, 0);
                    let roll = Math.random() * totalWeight;
                    let chosen = messages[0];
                    for (const msg of messages) {
                        roll -= (msg.weight || 1);
                        if (roll <= 0) {
                            chosen = msg;
                            break;
                        }
                    }

                    if (chosen.text && window.Terminal) {
                        Terminal.print(self._ansiToHtml(chosen.text), { html: true });
                    }
                }

                // Schedule the next one
                scheduleNext();
            }, delay);
        }

        scheduleNext();
    },

    _stopAmbientMessages() {
        if (this._ambientTimer) {
            clearTimeout(this._ambientTimer);
            this._ambientTimer = null;
        }
    },

    // --------------------------------------------------------------------------
    // Time-based event checker
    // --------------------------------------------------------------------------

    _startTimeChecker() {
        this._stopTimeChecker();

        const self = this;
        this._timeChecker = setInterval(function () {
            if (self.ended) {
                self._stopTimeChecker();
                return;
            }

            if (!window.STORY || !window.STORY.events) return;

            const elapsed = self.getElapsed();
            const events = window.STORY.events;

            for (let i = 0; i < events.length; i++) {
                const evt = events[i];
                if (self._firedEvents.has(evt.id)) continue;
                if (!evt.trigger || evt.trigger.type !== 'time') continue;

                // Check if enough time has elapsed
                if (elapsed < evt.trigger.value) continue;

                // Check conditions
                if (evt.conditions) {
                    const actReq = evt.conditions.act;
                    if (actReq !== undefined) {
                        if (Array.isArray(actReq)) {
                            if (!actReq.includes(self.act)) continue;
                        } else {
                            if (actReq !== self.act) continue;
                        }
                    }
                    if (evt.conditions.flags) {
                        let allMet = true;
                        for (const f in evt.conditions.flags) {
                            if (evt.conditions.flags[f] === true && !self.hasFlag(f)) { allMet = false; break; }
                            if (evt.conditions.flags[f] === false && self.hasFlag(f)) { allMet = false; break; }
                        }
                        if (!allMet) continue;
                    }
                }

                // Fire the event
                self._fireEvent(evt);
                self._firedEvents.add(evt.id);

                if (evt.setsFlag) {
                    self.setFlag(evt.setsFlag);
                }

                if (evt.advancesAct) {
                    self.advanceAct(self.act + 1);
                }
            }
        }, 5000); // Check every 5 seconds
    },

    _stopTimeChecker() {
        if (this._timeChecker) {
            clearInterval(this._timeChecker);
            this._timeChecker = null;
        }
    },

    // --------------------------------------------------------------------------
    // Utility
    // --------------------------------------------------------------------------

    getElapsed() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    },
};
