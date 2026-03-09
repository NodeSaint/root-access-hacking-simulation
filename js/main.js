/**
 * Root Access — Bootstrap / Main Entry Point
 * Wires together all subsystems and handles initialization.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------
    // Detect mobile vs desktop
    // ---------------------------------------------------------------
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

    // ---------------------------------------------------------------
    // Wait for DOM
    // ---------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {

        // ---- Grab DOM elements ----
        var terminal    = document.getElementById('terminal');
        var output      = document.getElementById('output');
        var input       = document.getElementById('command-input');
        var prompt      = document.getElementById('prompt');
        var cursor      = document.getElementById('cursor');
        // Bail out with an error if critical elements are missing
        if (!terminal || !output || !input || !prompt) {
            console.error('Root Access: missing required DOM elements.');
            return;
        }

        // ---- Initialize subsystems in dependency order ----
        // Terminal engine (no deps)
        Terminal.init(output, input, prompt, cursor);

        // Effects engine (needs terminal DOM refs)
        Effects.init(terminal, output, input);

        // Filesystem (needs story data)
        var storyData = window.STORY || {};
        var baseFS = (storyData.filesystem && storyData.filesystem.base) || {};
        FileSystem.init(baseFS);

        // Commands (may depend on Terminal, FileSystem, GameState)
        Commands.init();

        // Game state (orchestrator — depends on everything above)
        GameState.init();

        // ---- Wire up command handling ----
        Terminal.onCommand = function (cmd) {
            // Execute and print result (game.js handles history via onAction)
            var result = Commands.execute(cmd);

            // Handle both sync and async command results
            if (result && typeof result.then === 'function') {
                result.then(function (output) {
                    if (output !== null && output !== undefined && output !== '') {
                        Terminal.print(output);
                    }
                }).catch(function (err) {
                    Terminal.print('Error: ' + (err.message || err), { color: 'red' });
                });
            } else if (result !== null && result !== undefined && result !== '') {
                Terminal.print(result);
            }
        };

        // ---- Show MOTD ----
        if (storyData.motd) {
            // Convert ANSI codes in motd if GameState has the converter
            if (GameState._ansiToHtml) {
                Terminal.print(GameState._ansiToHtml(storyData.motd), { html: true });
            } else {
                // Strip ANSI codes as fallback
                Terminal.print(storyData.motd.replace(/\x1b\[[0-9;]*m/g, ''), { color: 'cyan' });
            }
            Terminal.print('');
        }
        Terminal.print('Type "help" to see available commands.', { color: 'gray' });

        // Set initial prompt from story
        if (storyData.prompts && storyData.prompts[1]) {
            Terminal.setPrompt(storyData.prompts[1]);
        }

        // ---- Focus handling ----
        if (isMobile) {
            document.body.classList.add('is-mobile');
        } else {
            // Desktop: auto-focus input
            input.focus();

            // Click anywhere to focus input (avoid stealing text selection)
            terminal.addEventListener('click', function (e) {
                if (!window.getSelection().toString()) {
                    input.focus();
                }
            });
        }

        // ---- Save code restoration from URL hash ----
        var hash = window.location.hash.slice(1);
        if (hash && hash.indexOf('ROOTACCESS-') === 0) {
            try {
                if (typeof GameState.restoreSaveCode === 'function') {
                    var restored = GameState.restoreSaveCode(hash);
                    if (restored) {
                        Terminal.print('Session restored from save code.', { color: 'cyan' });
                    }
                }
            } catch (e) {
                Terminal.print('Failed to restore save: ' + e.message, { color: 'red' });
            }
        }

        // ---- Ambient creep timer (scales with act progression) ----
        var ambientInterval = null;

        function startAmbientCreep() {
            if (ambientInterval) clearInterval(ambientInterval);

            ambientInterval = setInterval(function () {
                var act = (GameState && GameState.act) ? GameState.act : 1;
                if (act >= 3) {
                    Effects.ambientCreep(act - 2);
                }
            }, 15000 + Math.floor(Math.random() * 10000));
        }

        startAmbientCreep();

        // ---- Visibility change handling ----
        // Pause ambient effects when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (ambientInterval) {
                    clearInterval(ambientInterval);
                    ambientInterval = null;
                }
            } else {
                startAmbientCreep();
                // Re-focus input on desktop when tab becomes visible
                if (!isMobile) {
                    input.focus();
                }
            }
        });

        // ---- Prevent accidental navigation away during gameplay ----
        window.addEventListener('beforeunload', function (e) {
            var act = (GameState && GameState.act) ? GameState.act : 1;
            if (act > 1) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // ---- Handle window resize (mobile keyboard open/close) ----
        if (isMobile) {
            var lastHeight = window.innerHeight;

            window.addEventListener('resize', function () {
                // When mobile keyboard opens, the viewport shrinks.
                // Scroll to bottom so the input stays visible.
                var currentHeight = window.innerHeight;
                if (currentHeight < lastHeight) {
                    // Keyboard likely opened
                    Terminal.scrollToBottom();
                }
                lastHeight = currentHeight;
            });
        }

        // ---- Expose a global debug/save helper (non-enumerable) ----
        Object.defineProperty(window, '__rootAccess', {
            value: {
                version: '1.0.0',
                getSaveCode: function () {
                    return typeof GameState.generateSaveCode === 'function'
                        ? GameState.generateSaveCode()
                        : null;
                }
            },
            writable: false,
            enumerable: false,
            configurable: false
        });

    }); // end DOMContentLoaded
})();
