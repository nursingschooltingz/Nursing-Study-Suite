# Nursing Study Suite

Turn your lecture PDFs and PowerPoints into a complete, source-cited study system: a structured knowledge base, prioritized study guides, tagged Anki flashcards, NCLEX-style practice questions, and unfolding clinical case studies — all generated from **your own course materials**, with every fact traceable back to the exact page it came from.

The whole suite is **one HTML file**. There is nothing to install, no account to create, and no website collecting your data. You open the file in your web browser, paste in a free Google Gemini API key, upload your study materials, and go.

---

## Quick Start (no tech experience needed)

**What you need:**
- A computer with Chrome, Edge, or Firefox (a laptop/desktop works much better than a phone)
- An internet connection
- A free Google account
- Your course PDFs or PowerPoint files

**The five steps:**

1. **Save the suite file** (the `.html` file) somewhere you can find it — your Desktop or a "Nursing" folder is fine.
2. **Double-click the file.** It opens in your web browser like a webpage. That's the whole "installation."
3. **Get a free Gemini API key** (5 minutes, instructions in the next section) and paste it into the **API Key** box in the left sidebar. The key is like a library card that lets the app talk to Google's AI.
4. **Go to the first tab ("Knowledge")**, add the PDF or PowerPoint for your *current exam only* — just the relevant chapters, not the whole textbook — and click **Build Knowledge Base**. Wait a few minutes while it reads your material and extracts every testable fact, each one stamped with where it came from.
5. **Use the other tabs.** Once the Knowledge Base exists, every other tool feeds from it: generate a prioritized study guide, Anki flashcards, practice questions, or a full clinical case study — all built from *your* lectures, not generic internet content.

That's genuinely it. Everything below is detail.

**Is it safe? What happens to my files?** Your PDFs are read *inside your own browser*. The extracted text is sent to Google's Gemini AI (the same company as Gmail) to be organized — and nowhere else. Nothing is uploaded to any other server, there are no accounts, and your Knowledge Base is stored in your own browser on your own computer.

**Does it cost money?** Google's Gemini API has a free tier that is enough for regular study use. If you hit a temporary "rate limit" message, wait a minute and try again, or generate in smaller batches.

---

## Getting a Gemini API key

An API key is a long code (it starts with `AIza...`) that lets the suite use Google's Gemini AI on your behalf.

1. Go to **Google AI Studio**: `https://aistudio.google.com`
2. Sign in with your Google account.
3. Look for **"Get API key"** (usually a button or a left-menu item), then **"Create API key."**
4. Copy the key it shows you — the long code starting with `AIza`.
5. Paste it into the **API Key** field in the suite's left sidebar.

Notes worth knowing:

- **Treat the key like a password.** Don't post it publicly. Anyone with your key can use your quota.
- The suite keeps the key only for your current browser session — **you'll re-enter it after closing the browser.** Keeping it in a password manager makes that painless.
- The key is sent only to Google, directly from your browser, when the app generates something.
- If a generation ever fails with a message about an invalid key, re-copy it from AI Studio — a missing character at the end is the usual culprit.

---

## The one idea that makes everything work

**Build the Knowledge Base first. Everything else reads from it.**

When you build the Knowledge Base, the suite extracts your material into individual **facts**, organized by condition using the **LATTE method** (Straight A Nursing's framework): **L**ook, **A**ssess, **T**ests, **T**reatments, **E**ducate, plus a Brief Patho intro for each condition. Every fact gets:

- a **fact ID** (like `FACT-12`) — its permanent name inside the suite
- a **tier** (1 = must-know, 2 = supporting, 3 = nice-to-know)
- a **verbatim quote** from your source and a pointer to the exact **file and page/slide**

Those fact IDs then appear throughout everything the suite generates — practice questions cite them, case studies cite them, rationales cite them. **Click any fact ID anywhere** and the Fact Inspector opens showing the original quote and source page. If the AI ever says something, you can check the receipt in two seconds. That's the entire trust model of this suite: nothing has to be taken on faith.

---

## Choosing a model (the left sidebar)

The sidebar controls which Gemini model does the work. Two ways to run it:

**Auto profile (recommended — the default).** Toggle showing **✋ Manual / Auto profile**. In Auto mode, each tool uses a tuned model + "thinking level" combination — fast models for bulk extraction, more thinking for rule-heavy work like priority synthesis. There's a **Reset to recommended** button if you experiment and want the defaults back. If you don't know what to pick: leave Auto on and never think about this again.

**Manual.** Flip the toggle and you get one global switch — **⚡ Flash** or **🧠 Pro** — plus **Thinking Level** pills (low / medium / high). Every tool then uses whatever you set.

**Flash vs. Pro, practically:**

- **Flash** (`gemini-3.6-flash` by default) — fast, cheap, generous free-tier limits. It handles extraction, Anki cards, and question generation very well. This should be your default.
- **Pro** (`gemini-3.1-pro-preview` by default) — deeper reasoning, noticeably slower, much tighter free-tier limits. Worth trying for Case Studies or Priority synthesis if you have quota to spend; overkill for extraction.
- **Thinking level** trades speed for care. "Low" is fine for most work; bump to "medium/high" when output quality matters more than waiting.

The **Flash Model / Pro Model** text boxes exist so the suite doesn't go stale: when Google ships new model names, type them in — no update to the file needed.

---

# The tools, in tab order

## Tab 1 — LATTE Knowledge Base

*Extract once → reusable facts for every study output.*

**⚠️ The most important habit in this entire README: upload only the chapters that are on your exam.** Not the whole textbook. Not the full 900-page PDF. If Exam 2 covers chapters 61–63, give it chapters 61–63 (most PDF readers can save a page range as a new file). Why this matters so much:

- **Relevance** — everything downstream (cards, questions, cases) is generated from the KB. Feed it three chapters of exam material and every flashcard is exam material. Feed it the whole book and you'll study things that aren't on the test.
- **Quality** — extraction is more thorough on focused sources.
- **Speed and quota** — you'll burn far fewer tokens and finish in minutes instead of an hour.

The **focus box** helps here too — tell it things like *"Only Ch. 61–63 are on this exam"* or *"Skip the pediatric sections"* and extraction will honor it.

**How to use it:**

1. Optionally fill in **Course** and **Exam/unit** — these become organizational tags on your Anki cards later.
2. Add your PDF/PPTX file(s).
3. Click **Build Knowledge Base**. Watch the log: it runs an extraction pass and then a second **audit pass** that re-reads each chunk hunting for facts the first pass missed. Recovered facts are only kept if their quoted text is actually found in your source — the suite verifies this in code, not on the AI's word.
4. Browse the result: conditions on the left, facts (with tiers, buckets, and source pointers) on the right. **⬇ Study View** exports the whole thing as a readable markdown study guide.

**Saving and backups.** The KB auto-saves in your browser and survives closing it — but it lives *in that browser on that computer*. **Export JSON** regularly (before exams, before rebuilding) — that file is your backup and your way to move between computers via **Import JSON**. Clearing your browser data deletes the KB; your exported JSON is the safety net.

**Rebuilding replaces.** Building or importing over an existing KB *replaces* it — the suite will show you exactly what you're about to lose ("3 conditions, 147 facts") and ask you to confirm. When in doubt: export first.

## Tab 2 — Pyramid Priority Analyzer

*Triage study content into Tier 1/2/3 priorities.*

This tab answers the question every nursing student asks the night before an exam: **"Of all this material, what actually matters most?"** It runs your content through a two-stage pipeline — a fast harvest pass that inventories every testable item, then a synthesis pass that applies an explicit prioritization rule cascade (ABCs, safety, unstable-vs-stable, time-critical interventions, psych-safety, and so on) to sort everything into **Tier 1 / Tier 2 / Tier 3** with the *reasoning shown*, including the "testable angle" — how each item is likely to be asked.

**How to use it:** feed it your content, adjust **Chunk size / Overlap** only if you have a very long document (defaults are fine), and run. Then work the output: **Filter by Strategy**, **Search Disease/Keyword**, or **Show All**, and export as **.md**, **.txt**, or **Print / Save as PDF**. Study Tier 1 until you're solid before touching Tier 2.

## Tab 3 — LATTE Anki Generator

*Anki cloze cards with LATTE tagging + tiers.*

Generates cloze-deletion flashcards ready for Anki, from your Knowledge Base. Optional boxes — **Outcomes**, **Points**, **Additional Context** (e.g., *"Exam is on cardiac meds only"*) — steer emphasis without you writing prompts.

### The tag system (worth two minutes to learn)

Every card carries a structured set of tags, and this is where the suite quietly becomes powerful — in Anki you can filter, build filtered decks, and cram by any slice of them:

| Tag | Meaning | Example |
|---|---|---|
| `Nursing::LATTE::<Domain>` | Which LATTE bucket the fact belongs to | `Nursing::LATTE::Assess` |
| `...::<Subtag>` | Optional finer slice | `Nursing::LATTE::Tests::Labs`, `Nursing::LATTE::Treatments::Meds` |
| `Condition::<Name>` | The disease/topic, CamelCase | `Condition::HeartFailure` |
| `Tier::1 / 2 / 3` | Exam priority — every card has exactly one | `Tier::1` |

Practical plays: five days out, build a **filtered deck** on `Tier::1` and clear it first. Weak on labs? Filter `Nursing::LATTE::Tests::Labs`. Professor said the exam is heavy on one condition? `Condition::` tag, done. (Tags are hierarchical in Anki's browser — click the little arrows to drill down.)

### Getting cards into Anki

1. Generate, review the output (the tool lints its own cards and shows a **coverage check** — which KB facts made it into cards and which didn't).
2. Check the **Anki header** box before exporting — this stamps the file with import settings so Anki configures itself.
3. **⬇ Export .txt**, then in Anki: **File → Import**, pick the file. With the header on, separator (Pipe), HTML, note type (**Cloze**), and the tags column are set automatically — just confirm and import.
4. New to Anki itself? It's a free flashcard app (`apps.ankiweb.net`) built on spaced repetition — it schedules each card right before you'd forget it. Turn on the built-in **FSRS** scheduler in Anki's settings; it's the modern algorithm and works beautifully with these cards.

## Tab 4 — NCLEX Question Extractor

*Extract practice questions from review PDFs.*

Different job from the Generator: this one pulls **existing** questions out of question-bank PDFs you already own (review books, instructor-provided practice exams) into a clean, uniform format with answers and rationales attached.

- **Inline mode** — for PDFs where each question is followed by its answer. Just add the PDF and run; **Chunk Size / Overlap** defaults are fine.
- **Split Q&A mode** — for books with questions in one section and an answer key in another. Enter the page **Ranges** for the questions and for the answers (use **+ Range** for multiple spans), and the suite pairs them up by question number — with an AI-assisted fallback when the book's numbering is messy. Split mode processes **one PDF per run**, since the page ranges describe a single book.

You can **Abort** mid-run and keep everything extracted so far. Results appear as browsable cards with a filter, plus **Copy** and text export.

## Tab 5 — NCLEX Question Generator

*Generate NEW NCLEX questions from your LATTE guide.*

This writes **brand-new** NCLEX-style questions from your Knowledge Base — and this is where the fact-ID system earns its keep. The generator works on an *allocation* model: it divides your KB facts across the questions it's going to write, so coverage is systematic instead of the AI riffing on whatever it finds interesting. Every question and every answer rationale **cites the fact IDs it was built from.**

**How to use it:**

1. Set **Total Questions** and **Questions per Batch** (smaller batches are more reliable; the default is sensible).
2. Optionally filter to one condition (*blank uses all conditions*) and add context (*"This exam is 50 questions, heavy on burns"*).
3. Generate, then flip between the **worksheet** view (questions only — print it, take it cold) and the answer-key view (answers + cited rationales).
4. Check the **coverage panel**: it reports which facts were actually used in the questions you can see and lists any that went uncovered — run another batch to sweep those up.
5. **📋 Copy**, **📝 .txt**, or **🖨 PDF** to take it with you.

Skeptical of any answer? Click its fact IDs — the source quote is one tap away.

## Tab 6 — Clinical Case Study Generator

*Source-grounded unfolding nursing cases.*

Builds an unfolding case — a patient whose situation evolves across stages, with questions at each stage — entirely from one condition in your Knowledge Base. This is next-gen-NCLEX-style practice: recognizing cues as they're revealed, prioritizing, deciding.

**How to use it:** pick a **Condition**, a **Difficulty** (Foundational / Exam-level / Advanced), how many **Stages** and **Questions per stage**, and which question types to include — MCQ, SATA, Prioritization, Ordering, Calculation (only when your facts contain the needed numbers), Patient education. Generate, then work through it stage by stage.

**Why you can trust what it produces** — this tab has the strictest checking in the suite, and it runs automatically in code after every generation:

- Every clinical value and every rationale must **cite fact IDs from your KB packet** — citations to facts that weren't supplied are hard errors.
- Numeric values are **audited against the cited facts' actual text**: a made-up "K⁺ 2.4 mEq/L" pinned to a fact that only says "monitor potassium" gets an amber warning.
- Narrative prose is scanned for smuggled clinical findings; question formats are checked structurally (a SATA must have 2–4 correct answers, an Ordering answer must use every step exactly once, and so on).

A validation panel reports the results: **errors** mean the case broke the rules (it's still viewable/exportable, but it's excluded from the trusted fact-link registry and stamped as failed); **amber warnings** are advisories worth a glance — sometimes they flag a real fabrication, sometimes just a legitimately derived value. Either way, you can see exactly why.

## The Fact Inspector (works everywhere)

Not a tab — a drawer that opens when you **click any fact ID badge** anywhere in the suite. It shows:

- the fact's full text, tier, LATTE bucket, and safety flag
- the **verbatim quote** from your source material
- the **source pointer** — which file, which page or slide
- **"Used in"** — every place this session's generated artifacts cited it: which case stage presented it as data, which specific question's rationale relied on it, which card set covered it
- **Copy fact** / **Copy citation** buttons

Use it as your reflexive "wait, is that true?" button. One honest limitation: the "Used in" links reset when you reload the page (the Knowledge Base itself persists — only the session's cross-links reset). And if you rebuild the KB, old outputs' fact IDs point at the previous numbering — the Inspector will tell you when that's the case rather than showing you the wrong fact.

---

## Tips, troubleshooting, and straight answers

**The page is blank when I open the file.** The suite loads its libraries from the internet on startup — check your connection and reload. If you ever see a message saying the app *stopped because its security component failed to load*, that's deliberate self-protection; reload when you're back online.

**"Rate limit" / 429 errors mid-generation.** You've hit the free tier's speed limit. Wait a minute, use smaller batches, or generate at a less busy time. Flash has far more generous limits than Pro.

**It forgot my API key.** By design — the key lives only in the browser session. Re-paste it (password manager recommended).

**My Knowledge Base disappeared.** It's stored per-browser, per-computer, and clearing browser data deletes it. This is why the README nags you to **Export JSON** — imports restore everything in seconds.

**Print/PDF export does nothing.** Your popup blocker ate the print window; the suite falls back to an in-page print automatically, but if a blocker notification appears, allow popups for the file.

**Phone or tablet?** It runs, but building a KB and reviewing outputs is genuinely a laptop activity. Generate on the laptop, export, review anywhere.

**Privacy, one more time, plainly:** your files are read in your browser; extracted text goes to Google's Gemini API for generation and nowhere else; the suite has no server, no accounts, no analytics; your key and your KB stay on your machine. Don't feed it real patient information — it's a study tool for coursework materials.

**A note on AI accuracy.** Language models can be confidently wrong. This suite's answer to that isn't "trust us" — it's the citation system: verbatim quotes checked in code, packet-scoped fact IDs, numeric audits, coverage reports, and a Fact Inspector one click away. Use them. If a card or question ever contradicts your source, the receipt trail will show you in seconds — and your source wins.

Good luck on your exam. Build the KB tonight; thank yourself Thursday.
