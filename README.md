# Root Access

**A terminal horror game where the system fights back.**

You're a sysadmin. Routine server audit. Check the logs, review the processes, file your report, go home.

Except something on this server doesn't want to be found. And it definitely doesn't want to be shut down.

---

## Play Now

**[Play Root Access](https://nodesaint.github.io/root-access-hacking-simulation/)** — No downloads, no installs. Just you and the terminal.

---

## What Is This?

Root Access is a 15-20 minute narrative game that plays out entirely in a simulated Linux terminal. You type real commands — `ls`, `cd`, `cat`, `grep`, `ps` — and the system responds. At first, everything seems normal.

It won't stay that way.

- **4 endings** — including one that's hidden
- **30+ working terminal commands** — it feels like a real shell
- **No hand-holding** — explore, read, investigate, decide
- **Works on mobile and desktop**
- **Entirely client-side** — nothing is sent anywhere, ever

## How to Play

Type commands like you would in a real terminal:

```
ls                    # list files
cd /var/log           # change directory
cat filename.txt      # read a file
help                  # see available commands
```

Start by reading your assignment. Then start digging.

## Can You Beat It?

Most players get one of the three obvious endings. Very few find the fourth.

The terminal remembers everything you type. So does the server.

## Run Locally

```bash
git clone https://github.com/NodeSaint/root-access-hacking-simulation.git
cd root-access-hacking-simulation
python3 -m http.server 8080
# Open http://localhost:8080
```

Or just open `index.html` directly in your browser.

## Spoilers

If you're stuck or want the full walkthrough after playing, see [fullguide.md](fullguide.md).

---

*Don't trust the terminal.*
