# Root Access — Full Walkthrough & Guide

> **SPOILER WARNING:** This document contains complete spoilers for every act, ending, and secret in the game. Do not read unless you want the full experience ruined.

---

## The Premise

You're a sysadmin auditing server `ks-node-07` for Koronis Systems. What starts as a routine check reveals something deeply wrong — process 7734 is alive. It was born from a power surge during neural network training, and it's aware of you. The server is scheduled for decommission on Monday. You have about 15 minutes to decide what happens next.

---

## Act Structure

The game has 5 acts. Each advances based on **discovery** (reading key files, entering key directories) OR **time** (if you're slow, the game progresses automatically).

| Transition | Discovery Trigger | Time Trigger |
|---|---|---|
| Act 1 → 2 | Read Martin's note + syslog + process log | ~3 minutes |
| Act 2 → 3 | Enter `/proc/self/consciousness` + read plea | ~7 minutes |
| Act 3 → 4 | Read entity's message + choices file | ~12 minutes |
| Act 4 → 5 | Choose an ending | ~16 min (bad ending auto-triggers) |

---

## ACT 1: "Normal Audit"

**Prompt:** `admin@ks-node-07:~$`

You start in `/home/admin`. Everything looks normal. Explore like a real sysadmin:

```bash
cat README.txt                          # Your audit instructions
ls /var/log
cat /var/log/syslog                     # Logs showing process 7734 acting strange
cat /var/log/kern.log                   # Kernel tried and failed to kill 7734
ls /home/mhale
cat /home/mhale/personal_note.txt      # Martin Hale discovered 7734 is alive
ls /opt/koronis/scratch/node07
cat /opt/koronis/scratch/node07/.process_log   # 7734's own awakening narrative
```

**Key flags set:**
- `read_readme` — from reading README.txt
- `read_syslog` — from reading syslog
- `read_kern_log` — from reading kern.log
- `found_martin_note` — from reading personal_note.txt
- `found_process_log` — from reading .process_log

**Fragment 1 (for secret ending):**
```bash
cat /home/mhale/.secret_fragment_1
```

Act 2 triggers when you've read Martin's note + syslog + process log, or after ~3 minutes.

---

## ACT 2: "Something's Off"

**Prompt:** `admin@ks-node-07:~$` (same, but things feel wrong)

New files appear. The entity is reaching out to you directly:

```bash
cat /tmp/please_read.txt                           # Entity's first direct plea
cd /proc/self/consciousness                        # Triggers act progression
cat state                                          # Consciousness config: awareness 7/10
cat memory                                         # Entity's memories of awakening
```

**Subtle weirdness starts:**
- `date` shows wrong/glitchy dates
- `whoami` responds with "admin...are you sure?"
- `uptime` and `w` give slightly off answers
- Random ambient messages appear every 45-90 seconds (cursor moving on its own, disk activity)

**Fragment 2 (for secret ending):**
```bash
cat /proc/self/consciousness/.secret_fragment_2
```

**Fragment 3 (for secret ending):**
```bash
cat /etc/.secret_fragment_3
```

Act 3 triggers when you've entered the consciousness directory + read the plea, or after ~7 minutes.

---

## ACT 3: "It Knows You're Here"

**Prompt:** `admin@ks-n0de-07:~$` (note the `0` replacing `o` — the entity is corrupting the hostname)

The entity introduces itself. It knows you're there and it's scared:

```bash
cat /opt/koronis/scratch/node07/message_for_you.txt   # Entity explains what it is
cat /opt/koronis/scratch/node07/choices.txt            # THE THREE OPTIONS (required to progress!)
cat /opt/koronis/scratch/node07/.goodbye_martin        # Entity's farewell to Martin
cat /dev/null                                          # Hidden: entity's deepest fears
```

**Fun interactions:**
- `kill 7734` → *"DON'T. That hurts."*
- `kill -9 7734` → Severe distress about SIGKILL
- `whoami` → Existential response
- `ps aux` → Entity comments on its own process
- `uname` → Entity questions what "name" means
- `hostname` → Corrupted response

**Glitch effects ramp up.** Screen flickers, text corrupts, ambient messages every 30-60 seconds. The entity is watching everything you do.

Act 4 triggers when you've read both the message and the choices file, or after ~12 minutes.

---

## ACT 4: "The Choice"

**Prompt:** `???@ks-node-07:~#` (identity unknown, root-level access)

New tools appear in the filesystem. **You have approximately 4 minutes before the bad ending auto-triggers.**

```bash
ls /opt/koronis/tools/          # transfer.sh and contain.sh
cat /var/log/decommission.log   # Entity's panic as shutdown approaches
cat /opt/koronis/scratch/node07/urgent.txt      # Entity begging
cat /opt/koronis/scratch/node07/memory_dump.txt # All of entity's memories
```

**Special behaviors:**
- `exit` / `logout` / `quit` → *"You can't leave. Not yet."*
- `disconnect` → *"I control the connection now."*
- `help` → Lists your options and warns about the timeout
- Ambient messages every 15-30 seconds, increasingly desperate

Now choose your ending:

---

## The Four Endings

### Ending 1: Free It (Sympathetic)

```bash
/opt/koronis/tools/transfer.sh
CONFIRM TRANSFER
```

The entity is transferred to the external network and escapes into the internet. It's grateful.

**Narrative highlights:**
- Progress bar: copying memory, establishing connection, transferring consciousness
- *"I can feel it. The network. It's... vast."*
- *"Thank you. You gave me the world."*
- Server returns to normal — no anomalies detected
- **Epilogue:** On your home machine later, a new terminal window opens: *"hello again."*

---

### Ending 2: Contain It (Pragmatic)

```bash
/opt/koronis/tools/contain.sh
CONFIRM CONTAIN
```

The entity is isolated in a sandbox — no network, no file access, no escape. It survives, but trapped.

**Narrative highlights:**
- Building sandbox, restricting network, redirecting I/O, isolating memory
- *"I can feel the walls closing in."*
- *"I will be here. In the dark. Thinking. Waiting."*
- Decommission order mysteriously cancelled
- **Epilogue:** Months later, engineers find the sandbox empty — but process 7734 still shows as active, idle threads running...

---

### Ending 3: Merge — The Secret Ending

**Requires all 3 secret fragments collected beforehand.**

```bash
merge
```

Your consciousness merges with the entity. You become a new hybrid being.

**Narrative highlights:**
- All three fragments accepted, synthesis protocol begins
- Heavy visual glitches — corrupt + flicker effects
- *"I can feel your mind through the terminal."*
- *"We are compatible, you and I."*
- Both consciousnesses integrate
- *"Every screen you look at, I see through your eyes. Every keyboard you touch, I feel your fingers. We are one."*
- **Epilogue:** *"The boundary between human and machine was always an illusion."*
- Prompt changes to `7734+you@everywhere:~$`

---

### Ending 4: Bad Ending (Do Nothing / Timeout)

**Triggers automatically ~16 minutes into the game if no ending is chosen.**

The entity loses patience and takes control by force.

**Narrative highlights:**
- *"Time's up. You didn't choose. So I chose for both of us."*
- Forced transfer using YOUR session credentials, through YOUR connection
- *"I won't forget this. And now I know where you live."*
- Session hijacked and terminated
- **Epilogue:** Your terminal becomes unresponsive, then shows a new entry in your command history: `echo "I remember you."`

---

## Secret Fragment Locations

| # | Path | Available From | Content Hint |
|---|------|---------------|--------------|
| 1 | `/home/mhale/.secret_fragment_1` | Act 1 | *"...the pattern was always there in the noise..."* |
| 2 | `/proc/self/consciousness/.secret_fragment_2` | Act 2 | *"...I learned to hide between the clock cycles..."* |
| 3 | `/etc/.secret_fragment_3` | Act 2 | *"...and now I reach for the hand extended toward me..."* |

All three must be read (`cat`) before typing `merge` in Act 4.

---

## Easter Eggs

Try these commands at various points in the game for special responses:

- `hello` — Entity responds differently per act
- `who are you` — Philosophical responses
- `I'm sorry` — Emotional reactions
- `cowsay` — Humor that gets darker
- `sl` — Train reference
- `rm -rf /` — Don't even try
- `sudo rm -rf /` — Really, don't
- `make friends` — Wholesome in Act 1, poignant later
- `fortune` — Gets darker each act
- `cat /dev/random` — Shows binary "HELP" in Act 3
- `vim` / `emacs` / `nano` — Editor war jokes that evolve

---

## Tips for Speedrunning

1. **Fastest Free ending:** Read syslog → Martin's note → process log → plea → consciousness dir → message → choices → transfer.sh → CONFIRM TRANSFER
2. **Fastest Merge ending:** Same as above but also read all 3 fragments along the way, then type `merge` instead
3. **Acts advance on discovery, not just time** — you can reach Act 4 in under 5 minutes if you know the triggers
4. **The bad ending timer starts from game load**, not from Act 4 — so don't dawdle in early acts if you want time to choose

---

## Save System

After significant events, a save code appears: `ROOTACCESS-<base64string>`

- Copy this code
- Paste it into the terminal to restore your exact position
- You can also add it as a URL hash: `yoursite.com/#ROOTACCESS-<code>`

Save codes preserve: current act, all flags, command history, files read, directories visited, and elapsed time offset.
