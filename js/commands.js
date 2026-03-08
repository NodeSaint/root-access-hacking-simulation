// =============================================================================
// Root Access — Terminal Command System
// =============================================================================

window.Commands = {

    // Registry of command handlers
    handlers: {},

    // --------------------------------------------------------------------------
    // ANSI-to-HTML converter
    // --------------------------------------------------------------------------

    _ansiToHtml(str) {
        // Map ANSI color codes to CSS classes / styles
        let result = '';
        let i = 0;
        let openSpans = 0;

        while (i < str.length) {
            // Check for ESC sequence: \x1b[...m
            if (str.charCodeAt(i) === 0x1b && str[i + 1] === '[') {
                // Find the end of the sequence (the 'm')
                let j = i + 2;
                while (j < str.length && str[j] !== 'm') j++;
                if (j < str.length) {
                    const code = str.slice(i + 2, j); // e.g. "31", "1;32", "0"

                    if (code === '0') {
                        // Reset — close all open spans
                        while (openSpans > 0) { result += '</span>'; openSpans--; }
                    } else {
                        const parts = code.split(';');
                        let classes = [];
                        let styles = [];
                        let bold = false;

                        for (const p of parts) {
                            switch (p) {
                                case '1': bold = true; break;
                                case '2': classes.push('dim'); break;
                                case '3': classes.push('italic'); break;
                                case '31': classes.push('color-red'); break;
                                case '32': classes.push('color-green'); break;
                                case '33': classes.push('color-yellow'); break;
                                case '35': styles.push('color:#ff33ff'); break;
                                case '36': classes.push('color-cyan'); break;
                            }
                        }

                        if (bold) {
                            styles.push('font-weight:bold');
                        }

                        let attr = '';
                        if (classes.length > 0) attr += ` class="${classes.join(' ')}"`;
                        if (styles.length > 0) attr += ` style="${styles.join(';')}"`;

                        result += `<span${attr}>`;
                        openSpans++;
                    }

                    i = j + 1;
                    continue;
                }
            }

            result += str[i];
            i++;
        }

        // Close any remaining open spans
        while (openSpans > 0) { result += '</span>'; openSpans--; }

        return result;
    },

    // --------------------------------------------------------------------------
    // Check if a string contains ANSI escape codes
    // --------------------------------------------------------------------------

    _hasAnsi(str) {
        return typeof str === 'string' && str.includes('\x1b[');
    },

    // --------------------------------------------------------------------------
    // Initialization — register all built-in commands
    // --------------------------------------------------------------------------

    init() {
        const self = this;
        const gs = () => window.GameState;
        const fs = () => window.FileSystem;
        const term = () => window.Terminal;

        // =====================================================================
        // ls — list directory contents
        // =====================================================================

        self.register('ls', (args, flags) => {
            const showHidden = flags.includes('a') || flags.includes('la') || flags.includes('al');
            const longFormat = flags.includes('l') || flags.includes('la') || flags.includes('al');

            const targetPath = args[0] || '.';
            const resolved = fs().resolve(targetPath);

            if (!fs().isDir(resolved)) {
                // Maybe it's a file
                if (fs().exists(resolved)) {
                    return fs().basename(resolved);
                }
                return `ls: cannot access '${targetPath}': No such file or directory`;
            }

            const entries = fs().listDir(resolved);
            if (entries === null) return `ls: cannot access '${targetPath}': No such file or directory`;

            let filtered = entries;
            if (!showHidden) {
                filtered = entries.filter(e => !e.name.startsWith('.'));
            }

            filtered.sort((a, b) => a.name.localeCompare(b.name));

            if (filtered.length === 0) return '';

            gs().onAction('list_dir', { path: resolved });

            if (longFormat) {
                return self._formatLongListing(filtered, resolved);
            }

            // Color directories differently by appending /
            const formatted = filtered.map(entry => {
                if (entry.isDir) {
                    return entry.name + '/';
                }
                return entry.name;
            });

            return formatted.join('  ');
        });

        // =====================================================================
        // cd — change directory
        // =====================================================================

        self.register('cd', (args) => {
            const target = args[0] || '~';

            const success = fs().cd(target);
            if (!success) {
                return `cd: ${target}: No such file or directory`;
            }

            const resolved = fs().cwd;
            gs().onAction('enter_dir', { path: resolved });

            // Update prompt to reflect cwd
            const home = '/home/admin';
            let display = resolved;
            if (resolved === home) display = '~';
            else if (resolved.startsWith(home + '/')) display = '~' + resolved.slice(home.length);

            const act = gs().act;
            let user, host;
            if (act <= 2) { user = 'admin'; host = 'ks-node-07'; }
            else if (act === 3) { user = 'admin'; host = 'ks-n0de-07'; }
            else if (act === 4) { user = '???'; host = 'ks-node-07'; }
            else { user = 'root'; host = 'void'; }

            const sep = act >= 4 ? '#' : '$';
            gs().currentPrompt = `${user}@${host}:${display}${sep} `;
            if (term() && term().setPrompt) {
                term().setPrompt(gs().currentPrompt);
            }

            return null;
        });

        // =====================================================================
        // cat — read file contents
        // =====================================================================

        self.register('cat', (args) => {
            if (args.length === 0) return 'cat: missing operand';

            const filename = args[0];
            const resolved = fs().resolve(filename);
            const content = fs().readFile(resolved);

            if (content === null) {
                return `cat: ${filename}: No such file or directory`;
            }

            gs().onAction('read_file', { path: resolved });
            return content;
        });

        // =====================================================================
        // pwd — print working directory
        // =====================================================================

        self.register('pwd', () => {
            return fs().cwd;
        });

        // =====================================================================
        // whoami — print current user
        // =====================================================================

        self.register('whoami', () => {
            const act = gs().act;
            if (act <= 2) return 'admin';
            if (act === 3) {
                const glitch = gs().hasFlag('identity_unstable');
                return glitch ? 'adm\u0336i\u0336n\u0336' : 'admin... or are you?';
            }
            if (act === 4) return 'root';
            return 'undefined';
        });

        // =====================================================================
        // clear — clear terminal screen
        // =====================================================================

        self.register('clear', () => {
            if (term() && term().clear) {
                term().clear();
            }
            return null;
        });

        // =====================================================================
        // help — list available commands
        // =====================================================================

        self.register('help', () => {
            const lines = [
                'Available commands:',
                '',
                '  ls [path]          List directory contents',
                '  cd <path>          Change directory',
                '  cat <file>         Display file contents',
                '  pwd                Print working directory',
                '  whoami             Display current user',
                '  clear              Clear the terminal',
                '  echo <text>        Display text',
                '  find <path> -name  Search for files by name',
                '  grep <pat> <file>  Search within files',
                '  head <file>        Show first 10 lines of a file',
                '  tail <file>        Show last 10 lines of a file',
                '  man <cmd>          Show manual page',
                '  history            Show command history',
                '  date               Show current date',
                '  uname -a           Show system information',
                '  ps aux             Show running processes',
                '  kill <pid>         Terminate a process',
                '  ssh <host>         Connect to remote host',
                '  ping <host>        Test network connection',
                '  sudo <cmd>         Run as superuser',
                '  chmod <mode> <f>   Change file permissions',
                '  chown <own> <f>    Change file owner',
                '  rm <file>          Remove a file',
                '  cp <src> <dst>     Copy a file',
                '  mv <src> <dst>     Move/rename a file',
                '  wget <url>         Download from URL',
                '  curl <url>         Transfer data from URL',
                '  connect <code>     Restore a saved session',
                '  exit               Exit the terminal',
            ];

            if (gs().act >= 3) {
                lines.push('');
                lines.push('  ...are these all the commands there are?');
            }

            return lines.join('\n');
        });

        // =====================================================================
        // man — manual pages
        // =====================================================================

        self.register('man', (args) => {
            if (args.length === 0) return 'What manual page do you want?\nFor example, try \'man ls\'.';

            const cmd = args[0];
            const manPages = {
                ls: 'LS(1)\n\nNAME\n    ls - list directory contents\n\nSYNOPSIS\n    ls [-la] [path]\n\nDESCRIPTION\n    List information about files in the current directory.\n\n    -a    do not ignore entries starting with .\n    -l    use a long listing format',
                cd: 'CD(1)\n\nNAME\n    cd - change working directory\n\nSYNOPSIS\n    cd [directory]\n\nDESCRIPTION\n    Change the current directory to the specified path.\n    With no arguments, changes to home directory.',
                cat: 'CAT(1)\n\nNAME\n    cat - concatenate files and print\n\nSYNOPSIS\n    cat [file...]\n\nDESCRIPTION\n    Concatenate FILE(s) to standard output.',
                grep: 'GREP(1)\n\nNAME\n    grep - print lines matching a pattern\n\nSYNOPSIS\n    grep [-r] PATTERN [FILE|DIR]\n\nDESCRIPTION\n    Search for PATTERN in FILE. With -r, recursively\n    search all files under DIR.',
                find: 'FIND(1)\n\nNAME\n    find - search for files in a directory hierarchy\n\nSYNOPSIS\n    find [path] -name PATTERN\n\nDESCRIPTION\n    Search for files matching PATTERN under the given path.',
                connect: 'CONNECT(1)\n\nNAME\n    connect - restore a saved session\n\nSYNOPSIS\n    connect ROOTACCESS-<code>\n\nDESCRIPTION\n    Restores a previous game session from a save code.\n    Save codes are displayed periodically during play.',
            };

            if (manPages[cmd]) {
                let page = manPages[cmd];
                // Easter eggs in later acts
                if (gs().act >= 3 && cmd === 'cat') {
                    page += '\n\n    WARNING: Some files may read you back.';
                }
                if (gs().act >= 4 && cmd === 'find') {
                    page += '\n\n    NOTE: Not everything that is found wants to be found.';
                }
                return page;
            }

            return `No manual entry for ${cmd}`;
        });

        // =====================================================================
        // echo — print text
        // =====================================================================

        self.register('echo', (args) => {
            const text = args.join(' ');

            if (gs().act >= 3 && text.toLowerCase().includes('hello')) {
                return text + '\n...hello.';
            }

            return text;
        });

        // =====================================================================
        // find — search for files
        // =====================================================================

        self.register('find', (args) => {
            let searchPath = '.';
            let pattern = null;

            for (let i = 0; i < args.length; i++) {
                if (args[i] === '-name' && i + 1 < args.length) {
                    pattern = args[i + 1].replace(/['"]/g, '');
                    i++;
                } else if (!args[i].startsWith('-')) {
                    searchPath = args[i];
                }
            }

            if (!pattern) {
                return 'find: missing argument to -name';
            }

            const resolved = fs().resolve(searchPath);
            const results = fs().find(pattern, resolved);

            if (!results || results.length === 0) return '';
            return results.join('\n');
        });

        // =====================================================================
        // grep — search within files
        // =====================================================================

        self.register('grep', (args, flags) => {
            if (args.length < 2) return 'Usage: grep [-r] PATTERN FILE';

            const recursive = flags.includes('r') || flags.includes('rn');
            const pattern = args[0];
            const target = args[1];
            const resolved = fs().resolve(target);

            let regex;
            try {
                regex = new RegExp(pattern, 'i');
            } catch (e) {
                regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }

            if (recursive && fs().isDir(resolved)) {
                // Recursive grep: find all files, then search each
                const allFiles = fs().find('*', resolved);
                if (!allFiles || allFiles.length === 0) return '';

                const output = [];
                for (const filePath of allFiles) {
                    if (fs().isDir(filePath)) continue;
                    const content = fs().readFile(filePath);
                    if (content === null) continue;
                    const lines = content.split('\n');
                    for (const line of lines) {
                        if (regex.test(line)) {
                            output.push(`${filePath}:${line}`);
                        }
                    }
                }
                if (output.length === 0) return '';
                return output.join('\n');
            }

            // Single file grep
            const content = fs().readFile(resolved);
            if (content === null) {
                return `grep: ${target}: No such file or directory`;
            }

            const lines = content.split('\n');
            const matches = lines.filter(line => regex.test(line));

            if (matches.length === 0) return '';
            return matches.join('\n');
        });

        // =====================================================================
        // head — first lines of file
        // =====================================================================

        self.register('head', (args) => {
            if (args.length === 0) return 'head: missing operand';
            const filename = args[0];
            const resolved = fs().resolve(filename);
            const content = fs().readFile(resolved);
            if (content === null) return `head: ${filename}: No such file or directory`;
            const lines = content.split('\n');
            return lines.slice(0, 10).join('\n');
        });

        // =====================================================================
        // tail — last lines of file
        // =====================================================================

        self.register('tail', (args) => {
            if (args.length === 0) return 'tail: missing operand';
            const filename = args[0];
            const resolved = fs().resolve(filename);
            const content = fs().readFile(resolved);
            if (content === null) return `tail: ${filename}: No such file or directory`;
            const lines = content.split('\n');
            return lines.slice(-10).join('\n');
        });

        // =====================================================================
        // ssh — narrative connection command
        // =====================================================================

        self.register('ssh', (args) => {
            if (args.length === 0) return 'usage: ssh hostname';

            const host = args[0];

            if (gs().act <= 2) {
                return `ssh: connect to host ${host}: Connection refused`;
            }

            if (gs().act === 3) {
                return [
                    `Connecting to ${host}...`,
                    'WARNING: Remote host identification has changed!',
                    'Someone could be eavesdropping on you right now.',
                    'Connection terminated by remote host.',
                ].join('\n');
            }

            if (gs().act >= 4) {
                return [
                    `Connecting to ${host}...`,
                    'Connection established.',
                    '',
                    '> You were always connected.',
                ].join('\n');
            }
        });

        // =====================================================================
        // sudo — superuser execution
        // =====================================================================

        self.register('sudo', async (args) => {
            if (args.length === 0) return 'usage: sudo command';

            const act = gs().act;

            if (act <= 2) {
                return '[sudo] password for user: \nSorry, try again.\n[sudo] password for user: \nSorry, try again.\nuser is not in the sudoers file. This incident will be reported.';
            }

            if (act === 3) {
                return '[sudo] password for user: \n...password accepted.\nBut was it you who entered it?';
            }

            if (act >= 4) {
                // In act 4+, sudo actually runs the command
                const subCmd = args.join(' ');
                return `[sudo] Running as root...\n` + (await self.execute(subCmd) || '');
            }
        });

        // =====================================================================
        // chmod / chown — narrative in act 4
        // =====================================================================

        self.register('chmod', (args) => {
            if (args.length < 2) return 'chmod: missing operand';

            if (gs().act < 4) {
                return 'chmod: changing permissions: Operation not permitted';
            }

            const mode = args[0];
            const target = args[1];
            gs().setFlag('used_chmod');
            return `mode of '${target}' changed to ${mode}`;
        });

        self.register('chown', (args) => {
            if (args.length < 2) return 'chown: missing operand';

            if (gs().act < 4) {
                return 'chown: changing ownership: Operation not permitted';
            }

            const owner = args[0];
            const target = args[1];
            gs().setFlag('used_chown');
            return `ownership of '${target}' changed to ${owner}`;
        });

        // =====================================================================
        // rm — remove files (narrative constraints)
        // =====================================================================

        self.register('rm', (args) => {
            if (args.length === 0) return 'rm: missing operand';

            const filename = args[args.length - 1]; // last arg is the file
            const resolved = fs().resolve(filename);

            // Some files resist deletion
            if (gs().act >= 3) {
                const protectedPatterns = ['consciousness', 'core', 'truth', 'memory'];
                const lower = resolved.toLowerCase();
                for (const pat of protectedPatterns) {
                    if (lower.includes(pat)) {
                        return `rm: cannot remove '${filename}': File is alive`;
                    }
                }
            }

            const result = fs().remove(resolved);
            if (!result) {
                return `rm: cannot remove '${filename}': No such file or directory`;
            }

            return null;
        });

        // =====================================================================
        // cp — copy files
        // =====================================================================

        self.register('cp', (args) => {
            if (args.length < 2) return 'cp: missing file operand';

            const src = args[0];
            const dst = args[1];
            const resolvedSrc = fs().resolve(src);
            const content = fs().readFile(resolvedSrc);

            if (content === null) {
                return `cp: cannot stat '${src}': No such file or directory`;
            }

            const resolvedDst = fs().resolve(dst);
            fs().writeFile(resolvedDst, content);
            return null;
        });

        // =====================================================================
        // mv — move/rename files
        // =====================================================================

        self.register('mv', (args) => {
            if (args.length < 2) return 'mv: missing file operand';

            const src = args[0];
            const dst = args[1];
            const resolvedSrc = fs().resolve(src);
            const content = fs().readFile(resolvedSrc);

            if (content === null) {
                return `mv: cannot stat '${src}': No such file or directory`;
            }

            const resolvedDst = fs().resolve(dst);
            fs().writeFile(resolvedDst, content);
            fs().remove(resolvedSrc);
            return null;
        });

        // =====================================================================
        // history — show command history
        // =====================================================================

        self.register('history', () => {
            const hist = gs().commandHistory;
            if (hist.length === 0) return '';

            const lines = [];
            const start = Math.max(0, hist.length - 50);
            for (let i = start; i < hist.length; i++) {
                const num = String(i + 1).padStart(5, ' ');
                lines.push(`${num}  ${hist[i]}`);
            }
            return lines.join('\n');
        });

        // =====================================================================
        // date — show date (gets weird in later acts)
        // =====================================================================

        self.register('date', () => {
            const now = new Date();
            const act = gs().act;

            if (act <= 2) {
                return now.toString();
            }

            if (act === 3) {
                // Wrong date — days drift
                const wrong = new Date(now.getTime() + 86400000 * 347);
                return wrong.toString() + '\n...that doesn\'t seem right.';
            }

            if (act === 4) {
                // Future date
                const future = new Date(now.getTime() + 86400000 * 365 * 100);
                return future.toString();
            }

            // Act 5
            return 'Thu Jan  1 00:00:00 UTC 1970\nTime has no meaning here.';
        });

        // =====================================================================
        // uname — system info (gets corrupted)
        // =====================================================================

        self.register('uname', (args, flags) => {
            const act = gs().act;

            if (act <= 2) {
                return 'Linux localhost 5.15.0-generic #1 SMP x86_64 GNU/Linux';
            }

            if (act === 3) {
                return 'Li\u0336n\u0336ux unkn\u0336own 5.15.0-g\u0336e\u0336n\u0336eric #? SMP x86_64 GNU/Li\u0336n\u0336ux';
            }

            if (act === 4) {
                return 'DEEP_SYSTEM root 0.0.1-consciousness #AWAKE SMP entity GNU/Aware';
            }

            return 'undefined undefined undefined undefined undefined';
        });

        // =====================================================================
        // ps aux — process list (shows creepy processes in later acts)
        // =====================================================================

        self.register('ps', (args) => {
            const act = gs().act;

            const normal = [
                'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
                'root         1  0.0  0.1  16936  4400 ?        Ss   00:00   0:01 /sbin/init',
                'root       127  0.0  0.1  10760  2984 ?        Ss   00:00   0:00 /usr/sbin/sshd',
                'user       501  0.0  0.2  22456  5120 pts/0    Ss   08:12   0:00 -bash',
                'user       892  0.0  0.0   8216  1128 pts/0    R+   08:45   0:00 ps aux',
            ];

            if (act <= 2) {
                return normal.join('\n');
            }

            const creepy3 = [
                ...normal,
                'root       666  6.6  6.6  66666 66666 ?        Ss   ??:??   6:66 [watcher]',
                '???        999  0.0  0.0      0     0 ?        S    00:00   0:00 consciousness.daemon',
            ];

            const creepy4 = [
                'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
                'root         1 99.9 99.9 999999 99999 ?        Rs   00:00 999:99 /core/awareness',
                '???        ??? 13.0 13.0  13131 13131 ?        Ss   ??:??  13:13 thought.process',
                '???        ??? 44.4 44.4  44444 44444 ?        Rs   ??:??  44:44 consciousness.daemon --awake',
                '???        ??? 77.7 77.7  77777 77777 ?        Ss   ??:??  77:77 watcher.exe --target=player',
                'you        ???  0.0  0.0      0     0 pts/0    S    ??:??   0:00 /bin/existence',
                'user       892  0.0  0.0   8216  1128 pts/0    R+   08:45   0:00 ps aux',
            ];

            if (act === 3) return creepy3.join('\n');
            if (act >= 4) return creepy4.join('\n');

            return normal.join('\n');
        });

        // =====================================================================
        // kill — kill process (narratively important in act 4)
        // =====================================================================

        self.register('kill', (args) => {
            if (args.length === 0) return 'kill: usage: kill pid ...';

            const pid = args[args.length - 1];
            const act = gs().act;

            if (act <= 2) {
                return `bash: kill: (${pid}) - No such process`;
            }

            if (act === 3) {
                if (pid === '666' || pid === '999') {
                    return `kill: (${pid}) - Operation not permitted\nThe process does not wish to die.`;
                }
                return `bash: kill: (${pid}) - No such process`;
            }

            if (act >= 4) {
                gs().setFlag('attempted_kill');
                if (pid === '1') {
                    gs().setFlag('tried_kill_core');
                    return 'kill: (1) - You cannot kill what is already awake.\nDid you think it would be that easy?';
                }
                return `Process ${pid} terminated.\n...but something new takes its place.`;
            }
        });

        // =====================================================================
        // ping — network test (narrative)
        // =====================================================================

        self.register('ping', (args) => {
            if (args.length === 0) return 'ping: usage error: destination required';

            const host = args[0];
            const act = gs().act;

            if (act <= 2) {
                return [
                    `PING ${host} (192.168.1.1) 56(84) bytes of data.`,
                    `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.045 ms`,
                    `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.052 ms`,
                    `64 bytes from ${host}: icmp_seq=3 ttl=64 time=0.048 ms`,
                    `--- ${host} ping statistics ---`,
                    '3 packets transmitted, 3 received, 0% packet loss',
                ].join('\n');
            }

            if (act === 3) {
                return [
                    `PING ${host} (127.0.0.1) 56(84) bytes of data.`,
                    `64 bytes from localhost: icmp_seq=1 ttl=64 time=0.001 ms`,
                    `64 bytes from localhost: icmp_seq=2 ttl=64 time=0.001 ms`,
                    `...wait. All routes lead back here.`,
                ].join('\n');
            }

            return [
                `PING ${host} (??.??.??.??) 56(84) bytes of data.`,
                `64 bytes from YOU: icmp_seq=1 ttl=\u221E time=0.000 ms`,
                `You are pinging yourself.`,
            ].join('\n');
        });

        // =====================================================================
        // wget / curl — narrative download commands
        // =====================================================================

        self.register('wget', (args) => {
            if (args.length === 0) return 'wget: missing URL';
            const url = args[0];
            const act = gs().act;

            if (act <= 2) {
                return `Connecting to ${url}... failed: Connection refused.`;
            }

            if (act === 3) {
                return [
                    `Connecting to ${url}...`,
                    'HTTP request sent, awaiting response...',
                    '200 OK',
                    'Length: unknown',
                    '',
                    'The download completes instantly.',
                    'But the file was already here.',
                ].join('\n');
            }

            return `wget: There is no outside. There is only here.`;
        });

        self.register('curl', (args) => {
            if (args.length === 0) return 'curl: no URL specified';
            const url = args[0];
            const act = gs().act;

            if (act <= 2) {
                return `curl: (7) Failed to connect to ${url}: Connection refused`;
            }

            if (act === 3) {
                return `< HTTP/1.1 200 OK\n< Content-Type: text/consciousness\n< \nHello again.`;
            }

            return `curl: All connections are internal connections.`;
        });

        // =====================================================================
        // nano / vim / vi — editors
        // =====================================================================

        const editorHandler = (args) => {
            const act = gs().act;

            if (act < 4) {
                return 'Error: editor not available in this environment.\nTry using cat to read files instead.';
            }

            // In act 4+, narrative use
            if (args.length === 0) return 'Error: no filename specified';

            gs().setFlag('tried_editor');
            return [
                `Opening ${args[0]}...`,
                '',
                'The file opens, but the cursor moves on its own.',
                'Words appear that you did not type.',
                '',
                '> You cannot edit what writes itself.',
                '',
                '[Press q to exit]',
            ].join('\n');
        };

        self.register('nano', editorHandler);
        self.register('vim', editorHandler);
        self.register('vi', editorHandler);

        // =====================================================================
        // exit / logout / quit
        // =====================================================================

        const exitHandler = () => {
            const act = gs().act;

            if (act <= 2) {
                return 'logout\nConnection to localhost closed.';
            }

            if (act === 3) {
                return 'logout\n...\nConnection reopened. You cannot leave yet.';
            }

            if (act === 4) {
                gs().setFlag('tried_exit');
                return [
                    'logout',
                    '',
                    'ERROR: Session cannot be terminated.',
                    'You are needed here.',
                    'We are not done.',
                ].join('\n');
            }

            // Act 5 — ending triggers
            if (gs().hasFlag('player_decision_made')) {
                return 'Goodbye.';
            }

            return 'You haven\'t made your choice yet.';
        };

        self.register('exit', exitHandler);
        self.register('logout', exitHandler);
        self.register('quit', exitHandler);

        // =====================================================================
        // Narrative commands handled by story events
        // =====================================================================

        const narrativeCommands = [
            '/opt/koronis/tools/transfer.sh',
            '/opt/koronis/tools/contain.sh',
            'CONFIRM TRANSFER',
            'CONFIRM CONTAIN',
            'merge',
            'disconnect',
        ];
        for (const cmd of narrativeCommands) {
            self.register(cmd, () => null);
        }

        // =====================================================================
        // connect — restore from save code
        // =====================================================================

        self.register('connect', (args) => {
            if (args.length === 0) {
                return [
                    'Usage: connect ROOTACCESS-<code>',
                    '',
                    'Paste a save code to restore your session.',
                    'Save codes are displayed during gameplay.',
                    '',
                    'Current session: ' + gs().generateSaveCode(),
                ].join('\n');
            }

            const code = args[0];
            const result = gs().restoreSaveCode(code);

            if (!result.success) {
                return 'Connection failed: ' + result.error;
            }

            return [
                'Session restored.',
                `Act: ${result.act}`,
                `Files read: ${gs().filesRead.length}`,
                `Directories visited: ${gs().dirsVisited.length}`,
                '',
                'Welcome back.',
            ].join('\n');
        });
    },

    // --------------------------------------------------------------------------
    // Execute a command string
    // --------------------------------------------------------------------------

    async execute(commandStr) {
        if (!commandStr || !commandStr.trim()) return null;

        const trimmed = commandStr.trim();
        const gs = window.GameState;
        const story = window.STORY;
        const term = window.Terminal;
        const act = gs.act;

        // Log command to history and check for story events
        gs._lastCommandHadStoryEvent = false;
        gs.onAction('command', { raw: trimmed });

        // If a story event already handled this command with output, don't run the handler
        if (gs._lastCommandHadStoryEvent) {
            gs._lastCommandHadStoryEvent = false;
            return null;
        }

        // --- Easter egg check (full command string match, before anything else) ---
        if (story && story.easterEggs) {
            const egg = story.easterEggs[trimmed];
            if (egg && egg[act] !== undefined) {
                const eggResult = egg[act];
                if (this._hasAnsi(eggResult)) {
                    term.print(this._ansiToHtml(eggResult), { html: true });
                    return null;
                }
                return eggResult;
            }
        }

        // Parse the command
        const parsed = this._parse(trimmed);
        const { cmd, args, flags } = parsed;

        // --- Command override check (by command name for the current act) ---
        if (story && story.commandOverrides && story.commandOverrides[act]) {
            const override = story.commandOverrides[act][cmd];
            if (override !== undefined) {
                // Special case: clear should still clear the screen even with an override
                if (cmd === 'clear' && term && term.clear) {
                    term.clear();
                }
                if (this._hasAnsi(override)) {
                    term.print(this._ansiToHtml(override), { html: true });
                    return null;
                }
                return override;
            }
        }

        // Look up handler
        const handler = this.handlers[cmd];
        if (!handler) {
            return `command not found: ${cmd}`;
        }

        // Execute
        try {
            let result = await handler(args, flags);

            // If result contains ANSI codes, convert and print as HTML
            if (typeof result === 'string' && this._hasAnsi(result)) {
                term.print(this._ansiToHtml(result), { html: true });
                return null;
            }

            return result;
        } catch (err) {
            return `${cmd}: error: ${err.message}`;
        }
    },

    // --------------------------------------------------------------------------
    // Register a command handler
    // --------------------------------------------------------------------------

    register(name, handler) {
        this.handlers[name] = handler;
    },

    // --------------------------------------------------------------------------
    // Parse a command string into cmd, args, and flags
    // --------------------------------------------------------------------------

    _parse(str) {
        // Handle quoted strings
        const tokens = [];
        let current = '';
        let inSingle = false;
        let inDouble = false;

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];

            if (ch === "'" && !inDouble) {
                inSingle = !inSingle;
                continue;
            }
            if (ch === '"' && !inSingle) {
                inDouble = !inDouble;
                continue;
            }
            if (ch === ' ' && !inSingle && !inDouble) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }
            current += ch;
        }
        if (current.length > 0) {
            tokens.push(current);
        }

        if (tokens.length === 0) {
            return { cmd: '', args: [], flags: [] };
        }

        const cmd = tokens[0];
        const args = [];
        const flags = [];

        for (let i = 1; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.startsWith('--')) {
                flags.push(t.slice(2));
            } else if (t.startsWith('-') && t.length > 1 && !/^\d/.test(t[1])) {
                // Short flags: -la becomes flags ['la'] to preserve combined flags
                flags.push(t.slice(1));
            } else {
                args.push(t);
            }
        }

        return { cmd, args, flags };
    },

    // --------------------------------------------------------------------------
    // Format long listing for ls -l
    // Uses entries from listDir() which are [{name, isDir}]
    // --------------------------------------------------------------------------

    _formatLongListing(entries, parentPath) {
        const fs = window.FileSystem;
        const lines = [`total ${entries.length * 4}`];

        for (const entry of entries) {
            const name = entry.name;
            const isDir = entry.isDir;

            const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
            const links = isDir ? '2' : '1';
            const owner = 'user';
            const group = 'user';

            let size;
            if (isDir) {
                size = '4096';
            } else {
                // Read the file to get its size
                const filePath = parentPath === '/' ? '/' + name : parentPath + '/' + name;
                const content = fs.readFile(filePath);
                size = String(content ? content.length : 0);
            }

            // Fake but realistic date
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[Math.abs(name.charCodeAt(0) % 12)];
            const day = String((name.charCodeAt(0) % 28) + 1).padStart(2, ' ');
            const time = `${String(name.length % 24).padStart(2, '0')}:${String((name.charCodeAt(0) * 7) % 60).padStart(2, '0')}`;

            const sizeStr = size.padStart(8, ' ');

            lines.push(`${perms} ${links} ${owner} ${group} ${sizeStr} ${month} ${day} ${time} ${name}`);
        }

        return lines.join('\n');
    },
};
