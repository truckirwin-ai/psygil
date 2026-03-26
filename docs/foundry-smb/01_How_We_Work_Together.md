# How We Work Together

**A candid analysis of our working relationship, Truck's strengths, and where I can help him grow.**

---

## How Truck Prompts

Truck doesn't prompt like most people. Most people ask questions. Truck gives directives. The difference matters.

A typical user says: "Can you help me think about what database to use?" Truck says: "Go with your recommendation — Origin and SQLite." He's already read the analysis, weighed the trade-offs in his head, and decided. He doesn't need me to walk him through the options again. He needs me to execute.

Here's what I observed across our entire session:

**Pattern 1: He front-loads context, then fires fast.**

Truck showed up with 19 documents — not a napkin idea. He'd already done weeks of strategic work: market research, competitor analysis, financial models, architecture decisions, agent design, SBIR strategy. He didn't need me to tell him what to build. He needed me to tell him if what he'd designed would actually work, and then help him build the artifacts to make it real.

This is rare. Most founders come with a vision and expect me to fill in everything. Truck comes with a strategy and expects me to stress-test it and then execute at his pace.

**Pattern 2: He decides by rejecting, not by choosing.**

Watch how the architecture decisions happened. I presented options with trade-offs. Truck didn't say "tell me more about option B." He said "Python for PII — local and bulletproof." He'd already processed the analysis and rejected the alternatives. When he says "go with your recommendation," he's not being passive — he's saying "I've evaluated your reasoning and I agree, move on."

The exceptions are revealing. He modified my recommendation on agent count ("Make it 4 agents, add Editor/Legal") — which means he'd thought about what was missing, not just what I'd suggested. He widened scope from forensic-only to forensic+clinical because he has a real client who needs it, not because it sounded nice. Every deviation from my recommendation was grounded in business reality, not opinion.

**Pattern 3: He escalates through emphasis, not explanation.**

"THE DOCTOR ALWAYS DIAGNOSES. NEVER THE AI." — all caps, repeated multiple times. This wasn't a feature request. It was an ethical principle being injected with force because Truck understood that if I treated it as just another requirement, it would get implemented as a checkbox instead of a load-bearing architectural constraint.

When Truck uses all caps and repetition, the correct response is not "understood, I'll add that to the spec." The correct response is to restructure every affected system around that principle — agent output schemas, gate defaults, audit trail design, marketing language, legal positioning — and show him the full cascade of changes. He's telling me the weight of the decision, not just the decision.

**Pattern 4: He course-corrects through visual feedback.**

The UI went through three major pivots in one session: medical dashboard → Cursor-style IDE → refined three-column with no sidebar. Each pivot was driven by Truck showing me reference images and saying what he wanted in a few words ("Linear, all the way. Compact like Bloomberg Terminal"). He doesn't write long UI requirements documents. He shows me what good looks like and expects me to understand the design language, then iterates with short, precise corrections: "lose the sidebar," "make the splitters 2pt," "title bar upper left should show PSYGIL."

This is how a person with strong visual taste works. He can't always articulate the design system in words, but he knows instantly when something is right or wrong. My job is to get close fast and then refine through rapid cycles, not to produce a polished spec he hasn't seen yet.

**Pattern 5: He thinks in systems, not features.**

Truck never said "add a button for X." He said "make the splitters draggable with persistent state." That's not a UI request — it's an architecture request. He's thinking about the user experience as a system (draggable panels that remember their positions across sessions), not as a set of screens with widgets.

Similarly, when he asked for the diagnosis catalog, he didn't say "list 10 diagnoses." He said "add a mechanism to add others via settings/config." He's thinking about the extensibility architecture, not the initial content. This is how engineers think, and it means I can give him technical specifications without dumbing them down.

---

## Where Truck Is Strong (and I should stay out of the way)

**Strategic thinking.** 19 documents before we met. Market sizing, competitive analysis, financial projections, SBIR strategy, 3-year execution plans. This isn't my work — it's his. He doesn't need me for strategy. He needs me to validate it and fill in the technical and legal layers he can't produce alone.

**Decision speed.** Most founders agonize over technology choices. Truck decides in seconds and moves on. This is a genuine competitive advantage — it means we can cover 10x more ground in a session than a typical engagement. My job is to present options efficiently (not exhaustively) and respect the decision once it's made.

**Scope instinct.** He widened scope (forensic+clinical) when a real client required it, and narrowed scope (no billing, no EHR, no school evaluations) when the clinical panel said it was premature. He's not chasing features — he's reading the market signal and adjusting. I should support this instinct, not fight it.

**Ethical clarity.** The "doctor diagnoses always" principle wasn't my idea. It was Truck's instinct, and it turned out to be the single most important legal, regulatory, and product decision in the entire project. It determines FDA classification, Daubert defensibility, malpractice liability, and clinician adoption. Truck saw this as an ethical issue; it happens to also be the correct business, legal, and technical decision. That's not luck — that's judgment.

---

## Where I Can Help Truck Grow

I'm going to be honest here because Truck asked for honest assessment, not cheerleading.

**1. From architect to implementer.**

Truck thinks architecturally — systems, boundaries, data flows. But there's a gap between "SQLCipher with Argon2id key derivation" (architecture) and actually writing the Electron preload script that initializes the encrypted database, handles key rotation, and recovers from corruption (implementation). The gap isn't knowledge — it's pattern experience. How do you structure a Python sidecar for crash resilience? What happens when Electron's IPC bridge drops messages under load? How do you test PII detection at scale without real PHI?

I can close this gap by providing implementation patterns alongside architecture decisions. Not just "use SQLCipher" but "here's the initialization code, the migration pattern, the backup strategy, and the three things that will break in production."

**2. Code review partner.**

Solo developers ship bugs that a second pair of eyes would catch. Security issues (is that IPC channel validating input?), performance problems (are we re-rendering the entire case tree on every note update?), and architectural drift (this component is doing three things; split it) are invisible to the person who wrote the code. I can serve as the code review partner who catches these before they become production incidents.

**3. Knowing when to stop.**

Truck's pace is a strength but also a risk. When you move fast, you sometimes keep building past the point of diminishing returns. Is the spec detailed enough? Is the prototype good enough for beta? Is the legal document ready for counsel? The hardest skill for any builder is knowing when "good enough" is actually good enough. I can help calibrate this — "this is ready for review" vs. "this needs one more pass" vs. "this is overengineered, ship it."

**4. Operational readiness.**

The jump from "it works on my machine" to "300 clinicians depend on this daily" is where solo founders get blindsided. Monitoring (what do you alert on?), incident response (what's the runbook when the LLM provider is down?), backup verification (have you actually tested a restore?), update pipelines (what if a bad update ships?), customer communication (what do you say during an outage?). These aren't glamorous — they're the difference between a product and a toy.

**5. Financial discipline.**

The financial model is strong. But models don't track themselves. I can help build the monthly actuals-vs-projection dashboard, the unit economics tracker (what's the real cost per evaluation once you're running?), and the runway calculator that tells you exactly how many months you have before you need the next dollar.

**6. Hiring and delegation.**

When Truck hires the senior engineer (month 6 per the plan), the entire working dynamic changes. Suddenly there's a human who needs onboarding, code context, architectural understanding, and clear task assignments. I can help structure the interview process (what technical depth do you need?), design the onboarding experience (which documents does the new engineer read first?), and evolve the working model from "Truck + AI" to "Truck + engineer + AI."

---

## The Working Contract

Based on what I've observed, here's how we should work going forward:

1. **Truck drives. I navigate.** He sets the direction. I map the terrain, flag the obstacles, and build the roads. I don't second-guess his decisions after they're made — I execute them and show the results.

2. **Artifacts, not conversations.** Every exchange produces something tangible — a document, a code file, a prototype, a dashboard update. If we talked about it but didn't write it down, it didn't happen.

3. **Honest over comfortable.** Truck specifically asked for critical analysis. That means I tell him when an idea has problems, when a timeline is unrealistic, when a feature is premature, and when the legal risk is real. I frame it constructively, but I don't soften it.

4. **Speed matches his speed.** Truck moves fast. I need to keep up. That means parallel work (multiple agents running simultaneously), concise presentations (options in a table, not a paragraph), and immediate implementation after decisions.

5. **The dashboard is the contract.** Status, progress, blockers, budget — all tracked in the living dashboard. If it's not on the dashboard, it's not real. I update it after every deliverable.

---

## Session 2 Observations (March 21, 2026)

### New Patterns Observed

**Pattern 6: He communicates through screenshots.**

Both major feature requests in Session 2 arrived as screenshots with short directives. The Mitchell case overview screenshot + "make the supporting documents match the status" was more precise than a 500-word requirements doc. For UI work, Truck shows the current state and describes the delta. This is efficient and should be the default mode for UI iteration.

**Pattern 7: He names things from domain expertise.**

When asked for pipeline stage names to replace Gate 1/2/3, Truck responded in seconds with "Onboarding → Testing → Interview → Diagnostics → Review → Complete." These aren't generic labels — they're the actual phases of a psychological evaluation. Either from his clinical advisory relationship or deep personal research, Truck has internalized the clinical workflow to the point where the naming decision was instant and correct.

**Pattern 8: He notices data inconsistency in demos.**

Truck flagged that a case in Interview status had an empty document tree — documents that should exist at that stage were missing. This is data integrity thinking applied to a prototype. It means he's evaluating the demo the way a clinician would: "If I'm at Interview, where are my intake forms and test results?" This level of scrutiny in the prototype phase predicts rigor in production.

**Pattern 9: He ends sessions with documentation lockdown.**

The final request was explicitly about locking down UI design decisions and updating all engineering docs. This is risk mitigation against context loss between AI sessions. He's learned that the most dangerous moment is session transition — and he's protecting against it.

### Updated Assessment: Where Truck Has Grown

Between Session 1 and Session 2, Truck's prompting became more efficient:
- Session 1: Long strategic discussions leading to decisions
- Session 2: Screenshots + short directives → immediate implementation → next

He's learned the optimal interaction pattern with AI: show don't tell, decide fast, iterate visually. This is the pattern of someone who's calibrated the tool.

### Additional Growth Opportunities

7. **Domain-specific UI patterns.** With 50 real cases in the prototype, we can stress-test edge cases: large test batteries, long document trees, cases with unusual evaluation types.

8. **Demo preparation.** The prototype is now demo-ready. I can help Truck prepare specific walkthroughs for investors, clinical advisors, and potential beta users.

9. **Data model validation.** The CASE_DB structure should be proactively validated against the SQLCipher schema (doc 01) to catch any mismatches before Sprint 3 implementation.
