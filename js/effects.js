/**
 * Visual Effects Engine for Root Access
 * Handles horror/glitch effects, screen corruption, fake crashes, and ambient creep.
 */
(function () {
    'use strict';

    var _terminal = null;
    var _output = null;
    var _input = null;

    // Track active effects for cleanup
    var _activeEffects = {};
    var _activeTimers = [];
    var _ambientTimer = null;

    // Corruption character palette
    var CORRUPT_CHARS = [
        '\u2588', '\u2593', '\u2592', '\u2591', '\u2573', '\u2571', '\u2572',
        '\u0337', '\u0336', '\u0335', '\u0334', '\u0333', '\u0332',
        '\u0489', '\u0488',
        '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305',
        '\u0306', '\u0307', '\u0308', '\u0309', '\u030A', '\u030B',
        '\u030C', '\u030D', '\u030E', '\u030F',
        '\u0310', '\u0311', '\u0312', '\u0313', '\u0314', '\u0315',
        '\u031A', '\u031B',
        '\u0321', '\u0322', '\u0327', '\u0328',
        '#', '@', '!', '?', '%', '&', '*'
    ];

    // Combining diacritical marks (pile on for "zalgo" effect)
    var COMBINING_MARKS = [
        '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305',
        '\u0306', '\u0307', '\u0308', '\u030A', '\u030B', '\u030C',
        '\u030D', '\u030E', '\u030F', '\u0310', '\u0311', '\u0312',
        '\u0313', '\u0314', '\u0315', '\u031A', '\u031B', '\u0321',
        '\u0322', '\u0327', '\u0328', '\u0330', '\u0331', '\u0332',
        '\u0333', '\u0334', '\u0335', '\u0336', '\u0337', '\u0338'
    ];

    // Fake kernel panic messages
    var PANIC_MESSAGES = [
        'KERNEL PANIC: Fatal exception in process [sshd]',
        'CPU 0: Machine Check Exception: 0000000000000004',
        'RIP: 0010:[<ffffffff813245a7>] [<ffffffff813245a7>] corrupt_page+0x37/0x90',
        'Call Trace:',
        '  [<ffffffff81324612>] ? __free_pages_ok+0x22/0x260',
        '  [<ffffffff81324901>] ? free_hot_cold_page+0x1b1/0x220',
        '  [<ffffffff8134f26c>] ? __put_page+0x1c/0x50',
        'Kernel panic - not syncing: Fatal exception',
        'drm_kms_helper: panic occurred, switching back to text console',
        '---[ end Kernel panic - not syncing: Fatal exception ]---',
        '',
        'MEMORY CORRUPTION DETECTED AT 0xDEAD0000',
        'STACK SMASHING DETECTED',
        'Segmentation fault (core dumped)',
        '*** SYSTEM HALTED ***'
    ];

    function _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function _randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function _sleep(ms) {
        return new Promise(function (resolve) {
            var id = setTimeout(resolve, ms);
            _activeTimers.push(id);
        });
    }

    // Ensure overlay elements exist
    function _ensureOverlays() {
        if (!document.getElementById('flash-overlay')) {
            var flash = document.createElement('div');
            flash.id = 'flash-overlay';
            document.body.appendChild(flash);
        }
        if (!document.getElementById('crash-overlay')) {
            var crash = document.createElement('div');
            crash.id = 'crash-overlay';
            document.body.appendChild(crash);
        }
    }

    window.Effects = {

        // ---------------------------------------------------------------
        // Initialize — store references to terminal elements
        // ---------------------------------------------------------------
        init: function (terminalEl, outputEl, inputEl) {
            _terminal = terminalEl;
            _output = outputEl;
            _input = inputEl;
            _ensureOverlays();
        },

        // ---------------------------------------------------------------
        // Apply a CSS-class based effect to the terminal container.
        // Returns a Promise that resolves when the effect ends.
        //
        // effect: 'flicker'|'shake'|'corrupt'|'redshift'|'scanlines'|'static'|'glitch'
        // duration: ms (0 = indefinite, must be removed manually)
        // ---------------------------------------------------------------
        apply: function (effect, duration) {
            if (duration === undefined) duration = 2000;

            return new Promise(function (resolve) {
                _terminal.classList.add(effect);
                _activeEffects[effect] = true;

                if (duration > 0) {
                    var id = setTimeout(function () {
                        _terminal.classList.remove(effect);
                        delete _activeEffects[effect];
                        resolve();
                    }, duration);
                    _activeTimers.push(id);
                } else {
                    resolve();
                }
            });
        },

        // ---------------------------------------------------------------
        // Remove an active effect immediately
        // ---------------------------------------------------------------
        remove: function (effect) {
            _terminal.classList.remove(effect);
            delete _activeEffects[effect];
        },

        // ---------------------------------------------------------------
        // Remove all active effects and cancel pending timers
        // ---------------------------------------------------------------
        cleanup: function () {
            var self = this;
            Object.keys(_activeEffects).forEach(function (eff) {
                _terminal.classList.remove(eff);
            });
            _activeEffects = {};
            _activeTimers.forEach(function (id) { clearTimeout(id); });
            _activeTimers = [];
            // Remove overlays
            var flash = document.getElementById('flash-overlay');
            if (flash) flash.style.opacity = '0';
            var crash = document.getElementById('crash-overlay');
            if (crash) crash.style.display = 'none';
        },

        // ---------------------------------------------------------------
        // Corrupt text — randomly replace characters with glitch chars
        // intensity: 0.0 to 1.0 (fraction of characters to corrupt)
        // ---------------------------------------------------------------
        corruptText: function (text, intensity) {
            if (intensity === undefined) intensity = 0.1;
            var result = '';
            for (var i = 0; i < text.length; i++) {
                if (Math.random() < intensity && text[i] !== ' ' && text[i] !== '\n') {
                    // Replace with a corrupt char, optionally add combining marks
                    result += _randomChoice(CORRUPT_CHARS);
                    // Add 1-3 combining marks for zalgo effect at higher intensity
                    var markCount = Math.floor(intensity * 4);
                    for (var m = 0; m < markCount; m++) {
                        result += _randomChoice(COMBINING_MARKS);
                    }
                } else {
                    result += text[i];
                }
            }
            return result;
        },

        // ---------------------------------------------------------------
        // Glitch a specific output line element
        // ---------------------------------------------------------------
        glitchLine: function (element, duration) {
            if (duration === undefined) duration = 1000;
            if (!element) return Promise.resolve();

            return new Promise(function (resolve) {
                element.classList.add('glitch');

                var origText = element.textContent;
                var interval = setInterval(function () {
                    if (Math.random() > 0.5) {
                        element.textContent = window.Effects.corruptText(origText, 0.15);
                    } else {
                        element.textContent = origText;
                    }
                }, 80);

                var id = setTimeout(function () {
                    clearInterval(interval);
                    element.classList.remove('glitch');
                    element.textContent = origText;
                    resolve();
                }, duration);
                _activeTimers.push(id);
            });
        },

        // ---------------------------------------------------------------
        // Screen flash (white or red)
        // ---------------------------------------------------------------
        flash: function (color, duration) {
            if (color === undefined) color = 'white';
            if (duration === undefined) duration = 100;

            return new Promise(function (resolve) {
                var overlay = document.getElementById('flash-overlay');
                overlay.style.background = color;
                overlay.style.opacity = '0.8';

                var id = setTimeout(function () {
                    overlay.style.opacity = '0';
                    resolve();
                }, duration);
                _activeTimers.push(id);
            });
        },

        // ---------------------------------------------------------------
        // Progressively corrupt the entire screen
        // ---------------------------------------------------------------
        corruptScreen: function (duration) {
            if (duration === undefined) duration = 3000;
            var self = this;

            return new Promise(function (resolve) {
                var lines = _output.querySelectorAll('.output-line');
                if (lines.length === 0) { resolve(); return; }

                var originals = [];
                for (var i = 0; i < lines.length; i++) {
                    originals.push(lines[i].textContent);
                }

                var steps = 10;
                var stepTime = duration / steps;
                var step = 0;

                var interval = setInterval(function () {
                    step++;
                    var intensity = step / steps;

                    for (var i = 0; i < lines.length; i++) {
                        if (Math.random() < intensity) {
                            lines[i].textContent = self.corruptText(originals[i], intensity * 0.5);
                        }
                    }

                    if (step >= steps) {
                        clearInterval(interval);
                        // Restore after a beat
                        var id2 = setTimeout(function () {
                            for (var i = 0; i < lines.length; i++) {
                                if (originals[i] !== undefined) {
                                    lines[i].textContent = originals[i];
                                }
                            }
                            resolve();
                        }, 500);
                        _activeTimers.push(id2);
                    }
                }, stepTime);
            });
        },

        // ---------------------------------------------------------------
        // Fake "system crash" sequence
        // ---------------------------------------------------------------
        crashSequence: function () {
            var self = this;

            return new Promise(function (resolve) {
                // Disable input during crash
                Terminal.setInputEnabled(false);

                var chain = Promise.resolve();

                // 1. Apply effects
                chain = chain.then(function () {
                    return self.apply('shake', 500);
                });

                // 2. Flash red
                chain = chain.then(function () {
                    return self.flash('red', 200);
                });

                // 3. Rapid kernel panic messages
                chain = chain.then(function () {
                    return new Promise(function (innerResolve) {
                        var msgIndex = 0;
                        var interval = setInterval(function () {
                            if (msgIndex < PANIC_MESSAGES.length) {
                                Terminal.print(PANIC_MESSAGES[msgIndex], { color: 'red' });
                                msgIndex++;
                            } else {
                                clearInterval(interval);
                                innerResolve();
                            }
                        }, 120);
                    });
                });

                // 4. Screen goes black
                chain = chain.then(function () {
                    return _sleep(300);
                });
                chain = chain.then(function () {
                    var crash = document.getElementById('crash-overlay');
                    crash.style.display = 'block';
                    return _sleep(2000);
                });

                // 5. Screen comes back
                chain = chain.then(function () {
                    var crash = document.getElementById('crash-overlay');
                    crash.style.display = 'none';
                    Terminal.clear();
                    Terminal.setInputEnabled(true);
                    resolve();
                });
            });
        },

        // ---------------------------------------------------------------
        // Fake "reboot" sequence
        // ---------------------------------------------------------------
        rebootSequence: function () {
            var self = this;

            var bootMessages = [
                'BIOS POST... OK',
                'Memory test... 65536K OK',
                'Detecting drives... sda: 256GB SSD',
                'Loading kernel...',
                'Initializing subsystems...',
                '[  0.000000] Linux version 5.15.0-root (root@void)',
                '[  0.012445] Command line: BOOT_IMAGE=/vmlinuz-5.15.0',
                '[  0.134521] Initializing cgroup subsys cpu',
                '[  0.256001] CPU: Intel(R) Xeon(R) @ 3.50GHz',
                '[  0.389201] Memory: 65536k/65536k available',
                '[  0.512044] Mount-cache hash table entries: 4096',
                '[  0.678332] NET: Registered protocol family 2',
                '[  0.834561] sshd: starting OpenSSH server',
                '[  1.001200] System ready.',
                ''
            ];

            return new Promise(function (resolve) {
                Terminal.setInputEnabled(false);

                // Black screen
                var crash = document.getElementById('crash-overlay');
                crash.style.display = 'block';

                _sleep(1500).then(function () {
                    crash.style.display = 'none';
                    Terminal.clear();

                    // Print boot messages
                    var idx = 0;
                    var interval = setInterval(function () {
                        if (idx < bootMessages.length) {
                            Terminal.print(bootMessages[idx], { color: 'gray' });
                            idx++;
                        } else {
                            clearInterval(interval);
                            _sleep(500).then(function () {
                                Terminal.setInputEnabled(true);
                                resolve();
                            });
                        }
                    }, 200);
                });
            });
        },

        // ---------------------------------------------------------------
        // Ghost type — text appears in the input as if typed by someone else
        // Temporarily disables player input
        // ---------------------------------------------------------------
        ghostType: function (text, speed) {
            if (speed === undefined) speed = 50;

            return new Promise(function (resolve) {
                // Save state and disable
                var wasEnabled = !_input.disabled;
                _input.disabled = true;
                _input.classList.add('ghost-typing');
                _input.value = '';

                var i = 0;
                var interval = setInterval(function () {
                    if (i < text.length) {
                        _input.value += text[i];
                        i++;
                    } else {
                        clearInterval(interval);
                        // Pause to let the player read it
                        var id = setTimeout(function () {
                            _input.classList.remove('ghost-typing');
                            _input.value = '';
                            _input.disabled = !wasEnabled;
                            if (wasEnabled) _input.focus();
                            resolve();
                        }, 1000);
                        _activeTimers.push(id);
                    }
                }, speed);
            });
        },

        // ---------------------------------------------------------------
        // Glitch reveal — text appears character by character with artifacts
        // ---------------------------------------------------------------
        glitchReveal: function (text, element) {
            var self = this;

            return new Promise(function (resolve) {
                if (!element) {
                    element = document.createElement('div');
                    element.className = 'output-line';
                    _output.appendChild(element);
                }

                element.textContent = '';
                var i = 0;

                var interval = setInterval(function () {
                    if (i < text.length) {
                        // Show a random corrupt char first, then correct it
                        var span = document.createElement('span');
                        span.className = 'glitch-char';
                        span.textContent = _randomChoice(CORRUPT_CHARS);
                        element.appendChild(span);

                        // Replace with correct character after a short delay
                        (function (s, ch) {
                            var id = setTimeout(function () {
                                s.textContent = ch;
                            }, 60 + Math.random() * 40);
                            _activeTimers.push(id);
                        })(span, text[i]);

                        i++;
                        Terminal.scrollToBottom();
                    } else {
                        clearInterval(interval);
                        // Small settle delay
                        var id2 = setTimeout(resolve, 200);
                        _activeTimers.push(id2);
                    }
                }, 40);
            });
        },

        // ---------------------------------------------------------------
        // Ambient creep — subtle background interference
        // Called periodically; intensity scales with act progression
        // ---------------------------------------------------------------
        ambientCreep: function (intensity) {
            if (intensity === undefined) intensity = 1;
            var self = this;

            // Roll the dice — only trigger sometimes
            var roll = Math.random();

            if (roll < 0.25 * intensity) {
                // Brief flicker
                self.apply('flicker', 150 + Math.random() * 200);
            } else if (roll < 0.35 * intensity) {
                // Single character corruption in a random output line
                var lines = _output.querySelectorAll('.output-line');
                if (lines.length > 0) {
                    var line = lines[_randomInt(0, lines.length - 1)];
                    var orig = line.textContent;
                    if (orig.length > 0) {
                        line.textContent = self.corruptText(orig, 0.05);
                        var id = setTimeout(function () {
                            line.textContent = orig;
                        }, 800 + Math.random() * 1200);
                        _activeTimers.push(id);
                    }
                }
            } else if (roll < 0.4 * intensity) {
                // Momentary color shift
                self.apply('redshift', 300 + Math.random() * 400);
            } else if (roll < 0.45 * intensity && intensity >= 2) {
                // Scanlines for a moment (only at higher intensity)
                self.apply('scanlines', 2000 + Math.random() * 2000);
            } else if (roll < 0.48 * intensity && intensity >= 3) {
                // Static burst (only at highest intensity)
                self.apply('static', 500 + Math.random() * 1000);
            }
            // Otherwise: nothing happens (keeps it unpredictable)
        }
    };
})();
