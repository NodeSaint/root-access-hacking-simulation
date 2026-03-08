/**
 * Virtual In-Memory Filesystem for Root Access
 *
 * Stores directories as nested plain objects and files as strings.
 * Provides POSIX-like path resolution, traversal, and mutation.
 */
(function () {
    'use strict';

    // The root of the entire filesystem tree.
    // Directories are plain objects, files are strings.
    var _tree = {};

    // Home directory constant
    var HOME = '/home/admin';

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    /**
     * Normalize an absolute path:
     *  - collapse repeated slashes
     *  - resolve . and ..
     *  - strip trailing slash (except root)
     */
    function normalizePath(p) {
        if (!p || p === '/') return '/';

        var parts = p.split('/');
        var resolved = [];

        for (var i = 0; i < parts.length; i++) {
            var seg = parts[i];
            if (seg === '' || seg === '.') continue;
            if (seg === '..') {
                if (resolved.length > 0) resolved.pop();
            } else {
                resolved.push(seg);
            }
        }

        return '/' + resolved.join('/');
    }

    /**
     * Walk the tree to the node at the given absolute path.
     * Returns { parent, key, node } or null if any segment is missing.
     */
    function walk(absPath) {
        if (absPath === '/') {
            return { parent: null, key: null, node: _tree };
        }

        var segments = absPath.split('/').filter(Boolean);
        var current = _tree;

        for (var i = 0; i < segments.length; i++) {
            if (current === null || current === undefined || typeof current === 'string') {
                return null; // tried to traverse into a file
            }
            var seg = segments[i];
            if (!current.hasOwnProperty(seg)) {
                return null;
            }
            if (i === segments.length - 1) {
                return { parent: current, key: seg, node: current[seg] };
            }
            current = current[seg];
        }

        // Should not reach here, but just in case
        return { parent: null, key: null, node: current };
    }

    /**
     * Ensure all intermediate directories exist for a given absolute path,
     * creating them as empty objects if needed.  Returns the parent dir object.
     */
    function ensureParentDirs(absPath) {
        var segments = absPath.split('/').filter(Boolean);
        var current = _tree;

        // Walk all but the last segment (the file/dir itself)
        for (var i = 0; i < segments.length - 1; i++) {
            var seg = segments[i];
            if (!current.hasOwnProperty(seg)) {
                current[seg] = {};
            } else if (typeof current[seg] === 'string') {
                // A file is in the way — overwrite with directory
                current[seg] = {};
            }
            current = current[seg];
        }

        return current;
    }

    /**
     * Deep-merge source into target (both plain objects representing dirs).
     * String values overwrite; objects merge recursively; null removes.
     */
    function deepMerge(target, source) {
        var keys = Object.keys(source);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var val = source[k];

            if (val === null || val === undefined) {
                // Removal sentinel
                delete target[k];
            } else if (typeof val === 'string') {
                target[k] = val;
            } else if (typeof val === 'object' && val !== null) {
                if (typeof target[k] !== 'object' || typeof target[k] === 'string') {
                    target[k] = {};
                }
                deepMerge(target[k], val);
            }
        }
    }

    /**
     * Deep clone a plain object / string tree.
     */
    function deepClone(obj) {
        if (typeof obj === 'string') return obj;
        if (obj === null || obj === undefined) return obj;
        var out = {};
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            out[keys[i]] = deepClone(obj[keys[i]]);
        }
        return out;
    }

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------

    window.FileSystem = {
        cwd: HOME,

        /**
         * Initialize the filesystem from a base tree object.
         * The tree is deep-cloned so the original is never mutated.
         */
        init: function (baseFS) {
            _tree = deepClone(baseFS || {});
            this.cwd = HOME;

            // Ensure the home directory exists
            this._ensureDir(HOME);
        },

        /**
         * Overlay additional files / changes onto the existing tree.
         * `changes` uses the same nested-object format:
         *   - string values create/overwrite files
         *   - object values create/merge directories
         *   - null values remove entries
         */
        overlay: function (changes) {
            if (!changes) return;
            deepMerge(_tree, deepClone(changes));
        },

        /**
         * Remove a file or directory at the given path (absolute or relative).
         * Returns true if something was removed, false otherwise.
         */
        remove: function (path) {
            var abs = this.resolve(path);
            if (abs === '/') return false; // don't remove root

            var info = walk(abs);
            if (!info || !info.parent) return false;

            delete info.parent[info.key];
            return true;
        },

        /**
         * Read a file. Returns the content string, or null if the path
         * does not exist or is a directory.
         */
        readFile: function (absolutePath) {
            var abs = normalizePath(absolutePath);
            var info = walk(abs);
            if (!info) return null;
            if (typeof info.node !== 'string') return null;
            return info.node;
        },

        /**
         * Write (create or overwrite) a file.
         * Intermediate directories are created automatically.
         */
        writeFile: function (absolutePath, content) {
            var abs = normalizePath(absolutePath);
            var segments = abs.split('/').filter(Boolean);
            if (segments.length === 0) return; // can't write to root

            var parent = ensureParentDirs(abs);
            var filename = segments[segments.length - 1];
            parent[filename] = (content === undefined || content === null) ? '' : String(content);
        },

        /**
         * List directory contents.
         * Returns an array of { name, isDir } sorted alphabetically,
         * or null if the path doesn't exist or isn't a directory.
         */
        listDir: function (absolutePath) {
            var abs = normalizePath(absolutePath);
            var info = walk(abs);
            if (!info) return null;
            if (typeof info.node === 'string') return null; // it's a file

            var dirObj = (abs === '/') ? _tree : info.node;
            var keys = Object.keys(dirObj);

            // Sort: directories first, then alphabetical within each group
            var entries = keys.map(function (k) {
                return { name: k, isDir: typeof dirObj[k] === 'object' && dirObj[k] !== null };
            });

            entries.sort(function (a, b) {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            return entries;
        },

        /**
         * Check if a path exists.
         */
        exists: function (absolutePath) {
            var abs = this.resolve(absolutePath);
            return walk(abs) !== null;
        },

        /**
         * Check if the path is a directory.
         */
        isDir: function (absolutePath) {
            var abs = this.resolve(absolutePath);
            var info = walk(abs);
            if (!info) return false;
            if (abs === '/') return true;
            return typeof info.node === 'object' && info.node !== null;
        },

        /**
         * Resolve a relative (or absolute) path to a normalized absolute path.
         * Handles ~, ., .., and chains thereof.
         */
        resolve: function (relativePath) {
            if (!relativePath) return normalizePath(this.cwd);

            var p = relativePath;

            // Handle ~ (home alias)
            if (p === '~') {
                return HOME;
            }
            if (p.indexOf('~/') === 0) {
                p = HOME + p.substring(1);
            }

            // If not absolute, prepend cwd
            if (p[0] !== '/') {
                p = this.cwd + '/' + p;
            }

            return normalizePath(p);
        },

        /**
         * Change the current working directory.
         * Returns true on success, false if the target doesn't exist or isn't a dir.
         */
        cd: function (path) {
            var abs = this.resolve(path);
            if (!this.isDir(abs)) return false;
            this.cwd = abs;
            return true;
        },

        /**
         * Get the parent directory of a path.
         */
        dirname: function (path) {
            var abs = normalizePath(path);
            if (abs === '/') return '/';
            var idx = abs.lastIndexOf('/');
            return idx === 0 ? '/' : abs.substring(0, idx);
        },

        /**
         * Get the filename portion of a path.
         */
        basename: function (path) {
            var abs = normalizePath(path);
            if (abs === '/') return '/';
            var idx = abs.lastIndexOf('/');
            return abs.substring(idx + 1);
        },

        /**
         * Find files matching a simple glob pattern.
         *
         * Supported patterns:
         *   "*.txt"       – match in startPath only
         *   "**\/*.log"    – recursive match
         *   "secret*"     – prefix match
         *
         * Returns an array of absolute paths.
         */
        find: function (pattern, startPath) {
            var base = startPath ? this.resolve(startPath) : this.cwd;
            var results = [];
            var regex = this._globToRegex(pattern);
            // Always recurse — find semantics expect recursive search
            var recursive = true;

            this._walk(base, regex, recursive, results);
            results.sort();
            return results;
        },

        // ---------------------------------------------------------------
        // Internal helpers
        // ---------------------------------------------------------------

        /**
         * Ensure a directory path exists, creating intermediates.
         */
        _ensureDir: function (absPath) {
            var segments = absPath.split('/').filter(Boolean);
            var current = _tree;
            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i];
                if (!current.hasOwnProperty(seg)) {
                    current[seg] = {};
                } else if (typeof current[seg] === 'string') {
                    current[seg] = {};
                }
                current = current[seg];
            }
        },

        /**
         * Convert a simple glob to a RegExp.
         * Supports * (any chars except /), ** (any path), and ? (single char).
         */
        _globToRegex: function (pattern) {
            // Strip leading **/ for the recursive flag — we handle traversal separately
            var p = pattern.replace(/^\*\*\//, '');

            var reStr = '';
            for (var i = 0; i < p.length; i++) {
                var ch = p[i];
                if (ch === '*') {
                    reStr += '[^/]*';
                } else if (ch === '?') {
                    reStr += '[^/]';
                } else if (ch === '.') {
                    reStr += '\\.';
                } else {
                    reStr += ch;
                }
            }

            return new RegExp('^' + reStr + '$');
        },

        /**
         * Recursively walk the tree starting at absPath, collecting paths
         * whose basename matches the regex.
         */
        _walk: function (absPath, regex, recursive, results) {
            var info = walk(absPath);
            if (!info) return;

            var dirObj = (absPath === '/') ? _tree : info.node;
            if (typeof dirObj === 'string') return; // not a directory

            var keys = Object.keys(dirObj);
            for (var i = 0; i < keys.length; i++) {
                var name = keys[i];
                var childPath = absPath === '/' ? '/' + name : absPath + '/' + name;
                var isDirectory = typeof dirObj[name] === 'object' && dirObj[name] !== null;

                if (regex.test(name)) {
                    results.push(childPath);
                }

                if (isDirectory && recursive) {
                    this._walk(childPath, regex, recursive, results);
                }
            }
        },
    };
})();
