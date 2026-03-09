/**
 * Terminal Engine for Root Access
 * A browser-based terminal emulator with typewriter effects,
 * command history, colored output, and mobile support.
 */
(function () {
    'use strict';

    var _output = null;
    var _input = null;
    var _prompt = null;
    var _cursor = null;
    var _inputLine = null;
    var _inputEnabled = true;
    var _commandQueue = [];
    var _busy = false;

    window.Terminal = {
        history: [],
        historyIndex: -1,
        onCommand: null,

        // ---------------------------------------------------------------
        // Initialization
        // ---------------------------------------------------------------
        init: function (outputEl, inputEl, promptEl, cursorEl) {
            _output = outputEl;
            _input = inputEl;
            _prompt = promptEl;
            _cursor = cursorEl;
            _inputLine = inputEl.parentElement;

            this._bindEvents();
            this.setInputEnabled(true);
            this.scrollToBottom();
        },

        // ---------------------------------------------------------------
        // Print a single line/block of text to the terminal output.
        //
        // options.color   – one of red, green, yellow, cyan, white, gray
        // options.delay   – ms to wait *before* printing
        // options.typing  – if true, use typewriter effect
        // options.class   – arbitrary CSS class to add to the wrapper span
        // options.html    – if true, treat text as raw HTML (use carefully)
        // options.speed   – characters per second for typing mode (default 30)
        // ---------------------------------------------------------------
        print: function (text, options) {
            options = options || {};
            var self = this;

            var doWork = function () {
                return new Promise(function (resolve) {
                    var delayMs = options.delay || 0;

                    setTimeout(function () {
                        if (options.typing) {
                            self.typePrint(text, options.speed || 30, options).then(resolve);
                        } else {
                            self._appendLine(text, options);
                            resolve();
                        }
                    }, delayMs);
                });
            };

            return doWork();
        },

        // ---------------------------------------------------------------
        // Print multiple lines, sequentially, with optional per-line delay.
        //
        // lines          – array of strings, or array of {text, ...options}
        // options.delay  – default delay between lines (ms), default 0
        // options.color  – default color for all lines
        // ---------------------------------------------------------------
        printLines: function (lines, options) {
            options = options || {};
            var self = this;
            var defaultDelay = options.delay || 0;
            var defaultColor = options.color || null;

            return lines.reduce(function (chain, line) {
                return chain.then(function () {
                    var text, lineOpts;
                    if (typeof line === 'string') {
                        text = line;
                        lineOpts = {};
                    } else {
                        text = line.text || '';
                        lineOpts = Object.assign({}, line);
                        delete lineOpts.text;
                    }
                    if (!lineOpts.color && defaultColor) lineOpts.color = defaultColor;
                    if (!lineOpts.delay && defaultDelay) lineOpts.delay = defaultDelay;
                    return self.print(text, lineOpts);
                });
            }, Promise.resolve());
        },

        // ---------------------------------------------------------------
        // Typewriter effect – resolve when done.
        //
        // speed  – ms between each character
        // opts   – optional color / class
        // ---------------------------------------------------------------
        typePrint: function (text, speed, opts) {
            speed = speed || 30;
            opts = opts || {};
            var self = this;

            return new Promise(function (resolve) {
                var span = document.createElement('div');
                span.className = 'output-line';
                if (opts.color) span.classList.add('color-' + opts.color);
                if (opts['class']) span.classList.add(opts['class']);
                _output.appendChild(span);

                var i = 0;
                var interval = setInterval(function () {
                    if (i < text.length) {
                        // Handle newlines inside the text
                        if (text[i] === '\n') {
                            span.appendChild(document.createElement('br'));
                        } else {
                            span.appendChild(document.createTextNode(text[i]));
                        }
                        i++;
                        self.scrollToBottom();
                    } else {
                        clearInterval(interval);
                        resolve();
                    }
                }, speed);
            });
        },

        // ---------------------------------------------------------------
        // Clear all output
        // ---------------------------------------------------------------
        clear: function () {
            _output.innerHTML = '';
        },

        // ---------------------------------------------------------------
        // Prompt
        // ---------------------------------------------------------------
        setPrompt: function (promptText) {
            _prompt.textContent = promptText;
        },

        // ---------------------------------------------------------------
        // Enable / disable user input
        // ---------------------------------------------------------------
        setInputEnabled: function (enabled) {
            _inputEnabled = enabled;
            _input.disabled = !enabled;
            if (_inputLine) {
                _inputLine.style.display = enabled ? '' : 'none';
            }
            if (enabled) {
                _input.focus();
            }
        },

        // ---------------------------------------------------------------
        // Scroll helpers
        // ---------------------------------------------------------------
        scrollToBottom: function () {
            var terminal = _output.parentElement;
            // Use requestAnimationFrame so the DOM has a chance to reflow
            requestAnimationFrame(function () {
                terminal.scrollTop = terminal.scrollHeight;
            });
        },

        // ---------------------------------------------------------------
        // Internal: append a finished line to output
        // ---------------------------------------------------------------
        _appendLine: function (text, opts) {
            opts = opts || {};
            var div = document.createElement('div');
            div.className = 'output-line';
            if (opts.color) div.classList.add('color-' + opts.color);
            if (opts['class']) div.classList.add(opts['class']);

            if (opts.html) {
                div.innerHTML = text;
            } else {
                // Preserve whitespace / newlines
                div.textContent = text;
            }

            _output.appendChild(div);
            this.scrollToBottom();
        },

        // ---------------------------------------------------------------
        // Echo the user's command back to the output (like a real terminal)
        // ---------------------------------------------------------------
        _echoCommand: function (command) {
            var line = document.createElement('div');
            line.className = 'output-line input-echo';

            var promptSpan = document.createElement('span');
            promptSpan.className = 'echo-prompt';
            promptSpan.textContent = _prompt.textContent;

            var cmdSpan = document.createElement('span');
            cmdSpan.className = 'echo-command';
            cmdSpan.textContent = command;

            line.appendChild(promptSpan);
            line.appendChild(cmdSpan);
            _output.appendChild(line);
            this.scrollToBottom();
        },

        // ---------------------------------------------------------------
        // Process a submitted command
        // ---------------------------------------------------------------
        _submit: function (raw) {
            var command = raw.trim();

            // Echo the command
            this._echoCommand(raw);
            _input.value = '';

            // Push to history (skip duplicates of last entry, skip blanks)
            if (command && (this.history.length === 0 || this.history[this.history.length - 1] !== command)) {
                this.history.push(command);
            }
            this.historyIndex = -1;

            // Dispatch
            if (this.onCommand && command) {
                this.onCommand(command);
            }
        },

        // ---------------------------------------------------------------
        // Event binding
        // ---------------------------------------------------------------
        _bindEvents: function () {
            var self = this;

            // ---- Keyboard on the input element ----
            _input.addEventListener('keydown', function (e) {
                if (!_inputEnabled) {
                    e.preventDefault();
                    return;
                }

                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        self._submit(_input.value);
                        break;

                    case 'ArrowUp':
                        e.preventDefault();
                        self._historyBack();
                        break;

                    case 'ArrowDown':
                        e.preventDefault();
                        self._historyForward();
                        break;

                    case 'Tab':
                        // Prevent focus from leaving the input
                        e.preventDefault();
                        break;

                    case 'c':
                        // Ctrl-C — clear current input
                        if (e.ctrlKey) {
                            e.preventDefault();
                            self._echoCommand(_input.value + '^C');
                            _input.value = '';
                            self.historyIndex = -1;
                        }
                        break;

                    case 'l':
                        // Ctrl-L — clear screen
                        if (e.ctrlKey) {
                            e.preventDefault();
                            self.clear();
                        }
                        break;
                }
            });

            // ---- Keep cursor position synced (for visual cursor) ----
            _input.addEventListener('input', function () {
                self._syncCursor();
            });

            // ---- Click anywhere on terminal to focus input (desktop only) ----
            var terminalEl = _output.parentElement;
            var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

            if (!isMobile) {
                terminalEl.addEventListener('click', function (e) {
                    var sel = window.getSelection();
                    if (sel && sel.toString().length > 0) return;
                    if (_inputEnabled) _input.focus();
                });
            }

            // ---- Mobile: only input-line taps bring up keyboard ----
            if (isMobile && _inputLine) {
                _inputLine.addEventListener('touchstart', function (e) {
                    if (_inputEnabled) {
                        _input.focus();
                    }
                });
            }

            // ---- Handle paste (for save codes etc.) ----
            _input.addEventListener('paste', function (e) {
                // Let the default paste behavior work, but strip newlines
                // and submit if multi-line
                setTimeout(function () {
                    var val = _input.value;
                    if (val.indexOf('\n') !== -1) {
                        // Take only the first line and submit it
                        var lines = val.split('\n');
                        _input.value = lines[0];
                        self._submit(lines[0]);
                    }
                }, 0);
            });

            // ---- Focus / blur visual feedback ----
            _input.addEventListener('focus', function () {
                if (_cursor) _cursor.classList.add('blink');
            });
            _input.addEventListener('blur', function () {
                if (_cursor) _cursor.classList.remove('blink');
            });

        },

        // ---------------------------------------------------------------
        // History navigation
        // ---------------------------------------------------------------
        _historyBack: function () {
            if (this.history.length === 0) return;

            if (this.historyIndex === -1) {
                // Save current input in case user wants to come back
                this._savedInput = _input.value;
                this.historyIndex = this.history.length - 1;
            } else if (this.historyIndex > 0) {
                this.historyIndex--;
            }

            _input.value = this.history[this.historyIndex];
            this._moveCursorToEnd();
        },

        _historyForward: function () {
            if (this.historyIndex === -1) return;

            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                _input.value = this.history[this.historyIndex];
            } else {
                // Back to the saved input
                this.historyIndex = -1;
                _input.value = this._savedInput || '';
            }

            this._moveCursorToEnd();
        },

        _savedInput: '',

        // ---------------------------------------------------------------
        // Cursor helpers
        // ---------------------------------------------------------------
        _moveCursorToEnd: function () {
            var len = _input.value.length;
            _input.setSelectionRange(len, len);
        },

        _syncCursor: function () {
            // The CSS cursor overlay sits after the input;
            // nothing dynamic needed unless we want per-character positioning.
        },
    };
})();
