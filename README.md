# Nursing Study Suite

[![Latest release](https://img.shields.io/github/v/release/nursingschooltingz/Nursing-Study-Suite?label=latest%20release&color=4a7ff7)](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/latest)
[![Download](https://img.shields.io/badge/download-single%20HTML%20file-34d399)](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-a78bfa)](LICENSE)

Turn your lecture PDFs and PowerPoints into a complete, source-cited study system: a structured knowledge base, prioritized study guides, tagged Anki flashcards, NCLEX-style practice questions, and unfolding clinical case studies — all generated from **your own course materials**, with every fact traceable back to the exact page it came from.

The whole suite is **one HTML file**. There is nothing to install, no account to create, and no website collecting your data. You open the file in your web browser, paste in a free Google Gemini API key, upload your study materials, and go.

**Latest release: v16.9.** [Download the single HTML file](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/download/v16.9/Nursing-Study-Suite.v16.9.html), save it, then open it in your browser. The [repository HTML](Nursing-Study-Suite%20v16.9.html) includes the review follow-up fixes described below. Flash / Medium remains the Anki default. Existing saved profiles stay intact; choose **Use recommended Anki profile** to update yours. See the [release verification record](docs/reviews/v16.9-release.md) for checks and remaining limits.

Use **Knowledge** to build or import your source, **Priority** to organize study time, **Anki** for recall, **NCLEX Extract** for existing questions, **NCLEX Generate** for new practice, and **Case Studies** for unfolding cases. **Settings** shows or hides the shared API/model panel. On phones and smaller tablets it starts collapsed; **Add API key** opens it directly. Switching tools preserves your inputs and outputs. A keyboard **Skip to study workspace** link bypasses navigation.

---

## Quick Start (no tech experience needed)

**What you need:**
- A computer with Chrome, Edge, or Firefox (a laptop/desktop works much better than a phone)
- An internet connection
- A free Google account
- Your course PDFs or PowerPoint files

**The five steps:**

1. **[Download the suite file](https://github.com/nursingschooltingz/Nursing-Study-Suite/releases/latest)** — grab the `.html` file from the latest release and save it somewhere you can find it. Your Desktop or a "Nursing" folder is fine.
2. **Double-click the file.** It opens in your web browser like a webpage. That's the whole "installation."
3. **Get a free Gemini API key** (5 minutes, instructions in the next section), select **Add API key**, and paste it into **Gemini API key** in Settings. The key is like a library card that lets the app talk to Google's AI.
4. **Go to the first tab ("Knowledge")**, add the PDF or PowerPoint for your *current exam only* — just the relevant chapters, not the whole textbook — and click **Build Knowledge Base**. Wait a few minutes while it reads your material and extracts every testable fact, each one stamped with where it came from.
5. **Use the other tabs.** Once the Knowledge Base exists, every other tool feeds from it: generate a prioritized study guide, Anki flashcards, practice questions, or a full clinical case study — all built from *your* lectures, not generic internet content.

That's genuinely it. Everything below is detail.

**What happens to my files?** Your files are read *inside your own browser*. Extracted text and selected card photos are sent to Google's Gemini API for generation and transcription, along with your API key for authentication. The suite has no application server or accounts, and your Knowledge Base is stored in your browser. Google's processing and retention depend on your API service and account terms.

**Does it cost money?** Google's Gemini API has a free tier that is enough for regular study use. If you hit a temporary "rate limit" message, wait a minute and try again, or generate in smaller batches.

---

## Getting a Gemini API key

An API key is a long code (it starts with `AIza...`) that lets the suite use Google's Gemini AI on your behalf.

1. Go to **Google AI Studio**: `https://aistudio.google.com`
2. Sign in with your Google account.
3. Look for **"Get API key"** (usually a button or a left-menu item), then **"Create API key."**
4. Copy the key it shows you — the long code starting with `AIza`.
5. Select **Add API key** and paste it into **Gemini API key** in Settings.

Notes worth knowing:

- **Treat the key like a password.** Don't post it publicly. Anyone with your key can use your quota.
- The suite keeps the key only for your current browser session — **you'll re-enter it after closing the browser.** Keeping it in a password manager makes that painless.
- The key is sent only to Google, directly from your browser, when the app generates something.
- If a generation ever fails with a message about an invalid key, re-copy it from AI Studio — a missing character at the end is the usual culprit.

---

## The one idea that makes everything work

**Build the Knowledge Base first. Everything else reads from it.**

When you build the Knowledge Base, the suite extracts your material into individual **facts**, organized by condition using the **LATTE method** (Straight A Nursing's framework): **L**ook, **A**ssess, **T**ests, **T**reatments, **E**ducate, plus a Brief Patho intro for each condition. Every fact gets:

- a **fact ID** (like `FACT-12`) — its name within this Knowledge Base
- a **tier** (1 = must-know, 2 = supporting, 3 = nice-to-know)
- a **verbatim quote** from your source and a pointer to the exact **file and page/slide**

Those fact IDs then appear throughout everything the suite generates — practice questions cite them, case studies cite them, rationales cite them. **Click a current fact reference** and the Fact Inspector opens showing the original quote and source page. References from an earlier KB are marked and disabled after replacement, so a reused ID cannot open an unrelated fact. Source links help you check the model's claims; they do not establish clinical correctness.

---

## Choosing a model (the left sidebar)

The sidebar controls which Gemini model does the work. Two ways to run it:

**Auto profile (recommended — the default).** Toggle showing **✋ Manual / Auto profile**. In Auto mode, each tool uses a tuned model + "thinking level" combination — fast models for bulk extraction, more thinking for rule-heavy work like priority synthesis. There's a **Reset to recommended** button if you experiment and want the defaults back. If you don't know what to pick: leave Auto on and never think about this again.

**Manual.** Flip the toggle and you get one global switch — **⚡ Flash** or **🧠 Pro** — plus **Thinking Level** pills (low / medium / high). Every tool then uses whatever you set.

**Flash vs. Pro, practically:**

- **Flash** (`gemini-3.8-flash` by default) — fast, cheap, generous free-tier limits. It handles extraction, Anki cards, and question generation very well. This should be your default.
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
2. Add your PDF/PPTX file(s) — or photos of flashcards (see below).
3. Click **Build Knowledge Base**. Watch the log: it runs an extraction pass and then a second **audit pass** that re-reads each chunk hunting for facts the first pass missed. Recovered facts are only kept if their quoted text is actually found in your source — the suite verifies this in code, not on the AI's word.
4. Browse the result: conditions on the left, facts (with tiers, buckets, and source pointers) on the right. **⬇ Study View** exports the whole thing as a readable markdown study guide.

PPTX files are limited to 64 MiB and 2,000 slides, with separate limits on expanded XML and extracted text. If a deck exceeds a limit, split it or convert it to PDF; the suite rejects the deck instead of silently shortening it. Cancel stops extraction before it can publish a partial result.

**Extraction diagnostics.** After a build, a panel reports checked, matched, unverified and missing first-pass quotes separately, plus thin chunks and incomplete omission checks. A quote ending in `60` does not establish a match inside `600`. Primary facts remain available with quote warnings; omission recovery requires a matching quote. Comparator/arrow disagreements remain warnings. Source pointers identify the file and chunk actually read, and diagnostics retain the model's original pointer. A located quote still does not prove that its fact preserves the source's meaning.

Malformed chunk responses are recorded while other completed chunks remain usable. A build with no successful chunks preserves the previous KB and offers failure diagnostics. Optional source-quality or page-probe failures are also reported. **Export JSON** saves original responses and the report; it can contain source material, so treat it like the source itself.

**Page composition probe** (checkbox, off by default) counts the pictures, diagrams and text on each page while the file is read. It is there for development work on handling images, it measures only, and nothing is sent anywhere. Leave it off unless asked — it makes reading long books slower.

### Flashcards

You can also feed it **photographs of printed flashcards** (Davis-style and similar) — drop `.jpg`, `.png`, or `.heic` files in with everything else. A phone photo is fine; it can be rotated, at an angle, or sitting on a patterned tablecloth.

Cards go through an extra step first, and it's worth understanding why. The suite **transcribes** each card into plain text, and everything after that reads the transcript — never the photo again. That's what lets a card's facts be quoted and verified the same way a textbook's are.

It also means the transcript is the one thing nothing else can double-check. If a photo is blurry and "3 cm" is read as "8 cm", every later step will confirm that number perfectly, because every later step is reading the transcript. So:

1. Click **Transcribe**, and the cards are read.
2. **Check the numbers.** Every dose, threshold, and measurement is listed in its own box with a flag asking you to compare it against the card. This takes a few seconds per card and it's the only check that catches a misread digit.
3. Then **Build Knowledge Base** as usual.

Two other things worth knowing:

**Photograph both sides.** The back of a card doesn't have the condition's name printed on it — only the running header and the card number. The suite pairs the two faces automatically using those, but a back on its own has nothing to attach its facts to.

Removing a photo also removes its transcript from build inputs. If repeat transcriptions disagree about the face, category, or card number—or the requested comparison did not finish—the affected card stays blocked until re-transcribed. The conflicting runs remain available for inspection.

**Set "Runs per card" to 2** if you want a second opinion. Each card gets transcribed twice and anything that differs between the two is flagged. It costs a second call per card, and it catches wobbly reads — but it can't catch a card that gets misread the same way twice. The eye check in step 2 is still the one that counts.

**Saving and backups.** The KB auto-saves in your browser and survives closing it — but it lives *in that browser on that computer*. **Export JSON** regularly (before exams, before rebuilding) — that file is your backup and your way to move between computers via **Import JSON**. Clearing your browser data deletes the KB; your exported JSON is the safety net.

The Knowledge tab shows the current browser-save status. If saved copies disagree or a saved record cannot be restored safely, it preserves them and offers **Inspect**, **Export copy**, and **Use this copy**. You can also import or build a replacement, then choose **Use current workspace**. Choosing either path first archives the preserved copies; if that archive cannot be saved, they are not overwritten and saving remains paused. Saving also stops on a detected conflict with another tab. Export your in-memory KB before closing, then reload to reconcile. Before opening an older suite version, export the current KB and any recovery copies: older versions cannot interpret the new fallback/save-order metadata.

Import preserves full fact text, quotes and source strings. Invalid tier/category values or exceeded collection limits reject the import with an explanation instead of guessing values or keeping a shortened KB. Invalid rows that can be skipped are counted in the import notice. Restoring an app-saved KB preserves its IDs and content; invalid saved records stay available for recovery instead of being silently shortened or repaired.

**Rebuilding replaces.** Building or importing over an existing KB *replaces* it — the suite will show you exactly what you're about to lose ("3 conditions, 147 facts") and ask you to confirm. When in doubt: export first.

## Tab 2 — Pyramid Priority Analyzer

*Triage study content into Tier 1/2/3 priorities.*

This tab answers the question every nursing student asks the night before an exam: **"Of all this material, what actually matters most?"** It runs your content through a two-stage pipeline — a fast harvest pass that inventories every testable item, then a synthesis pass that applies an explicit prioritization rule cascade (ABCs, safety, unstable-vs-stable, time-critical interventions, psych-safety, and so on) to sort everything into **Tier 1 / Tier 2 / Tier 3** with the *reasoning shown*, including the "testable angle" — how each item is likely to be asked.

**How to use it:** feed it your content, adjust **Chunk size / Overlap** only if you have a very long document (defaults are fine), and run. Then work the output: **Filter by Strategy**, **Search Disease/Keyword**, or **Show All**, and export as **.md**, **.txt**, or **Print / Save as PDF**. Study Tier 1 until you're solid before touching Tier 2.

## Tab 3 — LATTE Anki Generator

*Anki cloze cards with LATTE tagging + tiers.*

Generates cloze-deletion flashcards ready for Anki, from your Knowledge Base. Optional boxes — **Outcomes**, **Points**, **Additional Context** (e.g., *"Exam is on cardiac meds only"*) — steer emphasis without you writing prompts.

Anki's Auto profile defaults to **Flash / Medium** in v16.2. The paired tests favored easier-to-grade reviews at Medium, while both settings still needed source review. Existing saved choices are preserved; use **Use recommended Anki profile** in Anki to update just that tool, or reset all profiles in Settings. Manual mode continues to use its shared settings.

The generator now plans each substantive source target before writing and rechecks its hidden destination after shortening or combining notes. It explicitly preserves qualifiers, timing origins and equivalent-unit masking. These are generation instructions, not a guarantee of source coverage; review the resulting cards against your KB.

**Batch diagnostics → Save diagnostics and original responses** records a normalization outcome for every processed note, including canonical tags and skipped repairs with their reasons. Source-check downloads keep those generation decisions separate from read-only checks of the captured audit notes. Older batches without that history report it as unavailable.

### Preview and style checks

After generation, switch to **Preview**, select a cloze number (c1/c2/c3), and click **Show answer** to reveal the answer and Extra. Gaps sharing a number hide together; the other answers remain visible. Use **Edit in Table** to revise a note.

Table, List and Preview show up to 50 notes per page. Use **Previous notes** and **Next notes** to browse the rest. Paging does not limit selection, source checks or exports; **Edit in Table** opens the page containing that note.

Amber style warnings separately flag missing condition/topic cues and retrieval labels, possible article clues, several gaps hidden together (including a specific three-or-more-gap warning), a review front longer than the soft 15-word target, or an answer repeated on the visible front. The last check includes hints and other visible cloze answers. These are suggestions: keep necessary clinical qualifiers and omit anchors that would reveal the answer. The warnings update as you edit and never uncheck notes or prevent export.

Use **Style warnings** or the **Review findings** dropdown to focus on a particular issue, possible duplicate, or source finding. These filters only change which notes are shown; export includes every kept note in the selected tier. Open a finding's note to inspect its review, then use **Edit in Table** to revise it.

The generator instructions require source-supported Text and Extra, preserving certainty, population, timing, exceptions, and what each number measures. **Extra is empty by default.** It is populated only with a useful explanation or contrast explicitly supplied by the source and not already conveyed by Text; generic captions, restatements, and inferred nursing explanations do not belong there. Independent answers still count as separate targets when bundled into one comma/slash answer or hidden under the same cloze number; one inseparable clinical relationship can stay together. Testable mechanisms should receive recall notes of their own. These instructions still need review against the source; the supplied v16.1 tests still found source-fidelity errors, and the new v16.2 adapter requires another measured comparison.

New structured-KB runs capture a hierarchical tag contract. A stray word such as `Disorder` after `Condition::Panic` makes that note structurally ineligible for export until repaired. Complete `Topic::` and custom domain hierarchies remain allowed. Repairing a tag restores structural eligibility while preserving your Keep choice; existing unscoped notes remain compatible. Unknown condition names and mixed source conditions remain advisory discrepancies, with no majority-based relabeling.

Notes with different Extra text, tags, priority, case, or selection remain separate. Completely equivalent valid notes merge after proven condition-alias normalization, retaining their source links, original addresses and normalization history. If manual repairs create exact duplicates, **Merge … exact duplicate note(s)** lets you choose whether to merge them; similar wording is never enough. Tier tags must be complete whitespace-separated tags with one distinct `Tier::1`, `Tier::2`, or `Tier::3`; repeated copies of the same tier have one effective value.

When importing intentional equal-Text variants into Anki, choose to **import duplicates as new notes**. Anki normally matches the first field and updates an existing note, which can replace its Extra text. Use the Cloze note type, Pipe separator and Text/Extra/Tags mapping; disable HTML for plain exports and enable it for headered exports. See [Anki's import guidance](https://docs.ankiweb.net/importing/text-files.html#duplicates-and-updating). Actual desktop import/review acceptance remains outstanding.

### Counts, validation, and sources

The summary distinguishes **kept notes** from **review cards**: c1/c2/c3 makes three reviews, while two c1 gaps make one. These totals describe the exported deck, not your daily scheduled reviews.

This suite supports flat `{{c1::answer}}` clozes and optional `{{c1::answer::hint}}` hints, with at most three distinct positive indices per note. Nested or malformed clozes, missing tier tags, pipes inside fields, and embedded line breaks must be corrected in Table before export. Generated fragments are preserved; an ambiguous line boundary also flags its neighboring note so a dropped qualifier cannot silently become an exportable instruction. Review the source and repair Text to resolve that boundary warning. Invalid notes stay visible. Checkboxes record your choice: repairing a selected note restores eligibility, and repairing a manually unchecked note leaves it unchecked.

**Facts linked to kept notes** is the global count across all tiers. It follows your edits, selection, and deletions, as do the Anki entries in the Fact Inspector. One source fact can support several notes. A link records a source association; even all facts linked does not establish that every substantive detail is tested or that the wording preserves its meaning. Replacing the KB leaves old notes visible but disables their active links, numeric checks, coverage, and export until a new batch is generated.

Open **Review and source** to compare the actual masked review, its hidden answers, and the captured supporting fact text with its condition and tier. A detail shown on the front or only in Extra is not necessarily something the review asks you to recall. The captured fact text is the source supplied to generation; a quote or another KB table cannot supply missing support afterward.

Use **Edit source links** inside that inspector to select supporting facts or enter their IDs, then apply the links. Changes retain a history and update current counts and diagnostics. Editing Text or Extra keeps the original associations but marks them for fresh review. Compare the edited wording with the captured facts, then **Apply source links** to confirm or change them; this records your review, not a semantic guarantee. The **Source-link review** filter includes these edited notes as well as unmapped or disputed associations. **Condition-tag discrepancies** shows uncertain condition assignments. Only proven aliases with clean mappings normalize automatically; ambiguous names and source grouping need review.

Expand a note's **numeric status** to inspect exact value/unit discrepancies, quote-only support, or missing/partial mappings. The comparison preserves negative signs and reads complete units: unsupported forms such as `cm²` and `cm³` require review instead of being treated as `cm`. These advisory checks cover revealed Text, Extra and visible cloze hints; they cannot establish correct comparator direction, the roles of two values, or clinical meaning. Identical-front warnings show the actual masked front and expected answers, distinguishing possible ambiguity from redundancy. Neither warning changes selection.

**Possible duplicate** findings also flag lightly reworded reviews with the same hidden answers and overlapping source associations. They require judgment and never merge notes automatically. Local source warnings can identify inconsistent explicit Fahrenheit/Celsius pairs in the supplied fact text, allowing for displayed rounding. They report a source conflict without deciding which temperature is correct. These local checks do not call the model.

For an optional broader review, expand **Check against KB**, choose the checker model and thinking level, then **Prepare review packet — no AI check yet**. Preparation is local and displays the captured settings and request count. Only **Run … source check(s)** sends the packets to Gemini and uses quota; retries can add attempts. Changing checker settings requires preparing again.

In v16.4, valid source records and findings survive an invalid neighboring record, while the group stays incomplete until all required work is resolved. **Retry / resume** checks only remaining groups using the original captured settings; valid records and original attempts are retained. A transport failure stops the session. Editing notes, changing the tier selection or replacing the KB requires a fresh packet. Exact source addresses preserve the captured wording without asking the checker to retype citations. The added source inventory may increase the displayed request count and audit cost.

The **Review queue** brings together local recall warnings and accepted source-check findings. Inspect the linked note and source, then record **Covered elsewhere** with a kept note in the selected tier, **Intentional context**, or **Fixed — reviewed manually**. These are your review decisions, not an AI pass. Edits make earlier decisions outdated. Both visible-only and Extra-only targets can merit review; all queue items remain advisory and do not block export. Decisions and their history are included in source-check downloads for the current batch.

The check compares captured fact text with actual recall targets. A completed group must account for every source word as a target or explained context, with coverage records for the chosen targets and separate Text/Extra support records for each in-scope note. Expand **Checked targets and note fields** to inspect inventories, hidden versus contextual references and unresolved records. The queue also links a bounded set of related hidden answers across the deck, with their tier and selection status, so you can inspect possible coverage before adding or deleting a note. These are literal candidates, not proof of equivalent meaning. Findings and context classifications remain model judgments; complete accounting does not certify correct or exhaustive recall. Originals remain intact.

Preparation downloads an **unrun review packet**. After execution, **Download source-check report** records completed/incomplete/outdated status, profiles, timestamps, hashes, target records, findings and mapping history. Notes, selection, tier or source changes make old results outdated. Cancelled checks retain completed groups. A completed receipt is a model judgment about the captured KB: an error already in that KB or an incorrect checker judgment can still survive. Compare questionable claims with the original source. Keep these downloads with your private course files.

Turn on **Include source references** to append concise filename/location pointers to Extra during export. It defaults off and never changes the editable Extra field. Missing pointers appear as `Source: unavailable`; quotes are not exported. With **Anki header** enabled, Text and Extra are HTML-escaped and only the trusted source separator uses a line break.

**Batch diagnostics** keeps the original response counts and findings separate from your current selection. Generation distinguishes no-note output, partial/truncated output, notes needing structural repair, and complete output. Available notes and raw responses remain inspectable. Its save button downloads original responses, the source snapshot and note provenance, including exact merges and manual repairs; source-check reports include the same provenance record. Interrupted runs have a separate diagnostics download. These files can contain course material; keep them with your private KB backups.

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

1. Generate, review the output (the tool reports structural issues, advisory findings, and **facts linked to kept notes**).
2. Check the **Anki header** box before exporting — this stamps the file with import settings so Anki configures itself.
3. **⬇ Export .txt**, then in Anki: **File → Import**, pick the file. With the header on, separator (Pipe), HTML, note type (**Cloze**), and the tags column are set automatically — just confirm and import.
4. New to Anki itself? It's a free flashcard app (`apps.ankiweb.net`) built on spaced repetition — it schedules each card right before you'd forget it. Turn on the built-in **FSRS** scheduler in Anki's settings; it's the modern algorithm and works beautifully with these cards.

## Tab 4 — NCLEX Question Extractor

*Extract practice questions from review PDFs.*

Different job from the Generator: this one pulls **existing** questions out of question-bank PDFs you already own (review books, instructor-provided practice exams) into a clean, uniform format with answers and rationales attached.

- **Inline mode** — for PDFs where each question is followed by its answer. Just add the PDF and run; **Chunk Size / Overlap** defaults are fine. Tick **Limit to specific pages** to pull a single chapter out of a large book instead of reading the whole file — the same **+ Range** picker Split Q&A uses. With page ranges on, Inline mode processes **one PDF per run**, since the ranges describe a single book.
- **Split Q&A mode** — for books with questions in one section and an answer key in another. Enter the page **Ranges** for the questions and for the answers (use **+ Range** for multiple spans), and the suite pairs them up by question number — with an AI-assisted fallback when the book's numbering is messy. Split mode processes **one PDF per run**, since the page ranges describe a single book.

Each question's **answer choices** are read out of the extracted text and shown as a list. If a question comes back with no choices attached, the card says so rather than looking complete — in Split Q&A mode the suite first tries to restore them verbatim from the source page.

Every export — **.md**, **.txt**, **Copy** and **PDF** — puts all the questions first and a single **Answer Key** at the end, so you can work through a set without the answers in view. The PDF starts the answer key on a fresh page.

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

Replacing the KB cancels pending worksheet/case generation from the old source. Completed outputs remain inspectable, but their earlier-source badges cannot open facts in the replacement KB. Worksheet and case exports state source staleness, requested/actual question counts, and incomplete or unresolved item-audit results. A repaired item is explicitly **not re-audited**; deterministic source checks do not establish clinical accuracy.

Cancelling an item audit keeps the completed worksheet and any finished verdicts. Non-MCQ questions show **N/A**, and a rejected repair keeps the previous item. Case JSON Copy retains the case fields and adds `_suiteReview` with source/audit notices and validation findings.

## Tab 6 — Clinical Case Study Generator

*Source-grounded unfolding nursing cases.*

Builds an unfolding case — a patient whose situation evolves across stages, with questions at each stage — entirely from one condition in your Knowledge Base. This is next-gen-NCLEX-style practice: recognizing cues as they're revealed, prioritizing, deciding.

**How to use it:** pick a **Condition**, a **Difficulty** (Foundational / Exam-level / Advanced), how many **Stages** and **Questions per stage**, and which question types to include — MCQ, SATA, Prioritization, Ordering, Calculation (only when your facts contain the needed numbers), Patient education. Generate, then work through it stage by stage.

**Why you can trust what it produces** — this tab has the strictest checking in the suite, and it runs automatically in code after every generation:

- Every clinical value and every rationale must **cite fact IDs from your KB packet** — citations to facts that weren't supplied are hard errors.
- Numeric values are **audited against complete values and units in cited facts or source quotes**: a made-up "K⁺ 2.4 mEq/L" pinned to a fact that only says "monitor potassium" is an error. The established threshold-instantiation exceptions remain; values outside a cited threshold can describe deterioration and warn. An assumed calculation weight stays separately identified and must be used consistently.
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

**Phone or tablet?** Navigation, settings, forms and fact review reflow for smaller screens. Wide study tables scroll within their own panels. A laptop still gives you more room for large source sets and detailed editing.

**Privacy, one more time, plainly:** your files are read in your browser. Extracted text and selected card photos are sent to Google's Gemini API for generation and transcription. Your API key is retained in browser session storage and sent to Gemini to authenticate requests; the Knowledge Base is saved in your browser. The suite has no application server, accounts, or analytics. Google's processing and retention depend on your API service and account terms. Don't feed it real patient information — it's a study tool for coursework materials.

**A note on AI accuracy.** Language models can be confidently wrong. This suite's answer to that isn't "trust us" — it's the citation system: verbatim quotes checked in code, packet-scoped fact IDs, numeric audits, coverage reports, and a Fact Inspector one click away. Use them. If a card or question ever contradicts your source, the receipt trail will show you in seconds — and your source wins.

---

## The legal bits (please actually read these)

**Why it's shared.** This suite is shared as a study tool for nursing students, built for your own coursework studying. What you may legally do with the code is governed by the [LICENSE](LICENSE) file. It comes with no support obligations.

**It can be wrong — verify everything.** The citation and audit systems exist because AI-generated content can contain errors, and they catch many but not all of them. Your official course materials, your instructors, and current clinical guidelines are the authorities — when the suite disagrees with them, they win. Be especially skeptical of anything involving drug doses, lab values, and safety parameters, and check those against your source every time.

**Not medical advice. Not for clinical use.** This is a study tool for coursework. Nothing it generates should inform the care of a real patient. In clinical settings, follow your institution's policies, current guidelines, and provider orders — never an AI study aid.

**No real patient information.** Never enter PHI or any identifiable patient data. It's a study tool, not a clinical system.

**The LATTE method belongs to Straight A Nursing.** This suite uses LATTE (Look, Assess, Tests, Treatments, Educate) as its organizational framework with credit and gratitude. It is **not affiliated with, endorsed by, or connected to Straight A Nursing** in any way. If the framework clicks for you, look them up — their materials are excellent and the method is theirs.

**NCLEX®** is a registered trademark of the National Council of State Boards of Nursing (NCSBN). This suite is not affiliated with or endorsed by NCSBN. Generated questions are practice items *in the style of* the exam — they are not, and do not resemble access to, actual exam content.

**Anki** is an independent open-source project. This suite generates files formatted for import into Anki but is not affiliated with the Anki project.

**Google Gemini.** You bring your own API key, and your use of the API is governed by Google's terms of service. You are responsible for activity and any charges on your own key. This suite is not affiliated with Google.

**Your source materials.** Only process materials you lawfully have access to. Outputs generated from copyrighted textbooks and lectures are for your personal study — don't redistribute them — and what you feed the tool should comply with your program's academic-integrity and content-sharing policies (secure exam content, for example, is off-limits).

**As-is, no warranty.** The suite is provided as-is, without warranty of any kind — including accuracy, fitness for a particular purpose, or uninterrupted operation. Use it at your own risk; your grades, your API bill, and your decisions remain your own.
