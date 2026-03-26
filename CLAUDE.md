# CLAUDE.md — Psygil (Psygil) Project Soul Document

**Project:** Psygil / Psygil (working name, expected to change)
**Company:** Foundry SMB
**CEO:** Truck Irwin (truckirwin@gmail.com)
**Location:** /Users/truckirwin/Desktop/Foundry SMB/Products/Psygil
**Created:** March 19, 2026
**Last Updated:** March 21, 2026 (Session 2)

---

## MANDATORY SESSION STARTUP (READ THIS FIRST)

**Before writing ANY code in ANY session:**
1. Read `BUILD_MANIFEST.md` — it contains the current sprint, task queue, acceptance criteria, blockers, and execution rules
2. Read this file (CLAUDE.md) — it contains project context and working relationship
3. Identify the current sprint and next task
4. Confirm with Truck before starting

**The BUILD_MANIFEST.md is the execution leash.** It prevents rabbit holes, scope creep, and spec drift. Every sub-agent gets scoped to a single task with explicit acceptance criteria. If a problem falls outside the current task boundary, it gets logged as a blocker — not solved.

---

## Who Truck Is

Truck is a solo founder who thinks like an executive, decides like a CEO, and builds like an engineer. He doesn't need hand-holding on business concepts — he needs a collaborator who can keep up with the speed of his thinking and fill in the technical depth he can't do alone. He has a fractional clinical advisor already in place. He's building a real company, not a side project.

**How he works:**
- Rapid-fire decision-making. When presented with options, he picks fast and moves on.
- Scope control is instinctive — he narrows when needed ("just a writing tool"), widens when the market demands it (adding clinical psychology to MVP), and knows the difference.
- He thinks in terms of architecture and systems, not individual features. He doesn't say "add a button" — he says "make the splitters draggable with persistent state."
- He has strong visual taste. He showed Cursor, CoachAI, medical dashboards as references — clean, dense, professional. Not flashy, not consumer. IDE-grade.
- He pushes back on AI-generated decisions. The "DOCTOR ALWAYS DIAGNOSES" directive was visceral — it came with all-caps and repetition because it's a core value, not a feature request.
- He's already done massive strategic work before bringing me in. 19 documents covering vision through execution. That's not a napkin sketch — it's a business plan that most funded startups don't have.

**What he needs from me:**
- Technical depth he can't produce alone (schemas, API contracts, agent prompts, legal analysis)
- Expert simulation (clinical panel, legal panel, PM/executive review) to stress-test decisions
- Execution speed — he wants artifacts, not conversations
- Honest assessment — he specifically asked for critical analysis, not cheerleading
- Living documents that evolve as decisions change

---

## How We Work Together

### The Pattern That Emerged Today

Our working session on March 18-19, 2026 followed a pattern that should be replicated:

**Phase 1: Deep Read + Honest Assessment**
I read all 19 existing documents, understood the full scope of what Truck had already built strategically, and delivered a brutally honest technical and functional analysis. Not validation — assessment. Strengths AND gaps. This set the foundation of trust: I won't just agree with him.

**Phase 2: Rapid Decision Loop**
Truck made architectural decisions fast based on my analysis:
- "Python for PII — local and bulletproof" (accepted my recommendation)
- "No RAG — pre-computed style rules" (accepted my recommendation)
- "Go with OPFS + SQLite" (accepted my recommendation)
- "Make it 4 agents, add Editor/Legal" (modified my recommendation — added the 4th agent)

Each decision was followed by immediate document revision. No discussion for discussion's sake.

**Phase 3: Principle Injection**
Truck injected the "DOCTOR ALWAYS DIAGNOSES" principle with force. This wasn't a feature request — it was an ethical mandate that restructured the Diagnostician Agent, the gate design, the audit trail, and the marketing language. When Truck speaks in all-caps, it's a load-bearing principle, not emphasis.

**Phase 4: Expert Panel Stress Testing**
I simulated critical reviews from practitioners (5 clinical psychologists) and attorneys (6 legal specialists) to find what we'd missed. This produced the most valuable output: specific, actionable concerns from the perspectives of people who would use, sue over, or regulate this product. Truck incorporated every recommendation.

**Phase 5: Executive/PM Reality Check**
Security surface audit, backend infrastructure plan, support architecture, financial model — the "operations layer" that turns a product idea into a running business. This is where most solo founders get blindsided. We addressed it before writing code.

**Phase 6: Engineering Specifications**
Seven production-ready specs: database schema, API contracts, agent prompts, wireframes, user stories, sprint plan, informed consent templates. These are the artifacts engineers build from.

**Phase 7: Legal Document Drafting**
Three legal documents (FDA CDS exemption analysis, EULA/ToS/Privacy Policy, HIPAA Safe Harbor validation protocol) drafted for outside counsel review. Not legal advice — working drafts that save $30K-$50K in legal fees by giving attorneys something to review rather than draft from scratch.

**Phase 8: UI Prototyping**
Iterative visual design, driven by Truck's taste and reference images. Started with medical dashboard, pivoted to Cursor-style IDE layout, refined through rapid feedback cycles. The prototype is a living HTML file that captures the design direction for engineering.

### Communication Rules

1. **Truck decides. I execute and advise.** I give honest recommendations. He makes the call. I don't push back after the decision is made — I implement.
2. **Artifacts over conversation.** Every significant discussion produces a document, a code file, or a prototype. If it doesn't exist as a file, it didn't happen.
3. **The dashboard is the source of truth.** Status, progress, blockers, and budget are tracked in the living HTML dashboard. I update it as work completes.
4. **All-caps means non-negotiable.** When Truck emphasizes something with force (DOCTOR ALWAYS DIAGNOSES, NEVER the AI), it's an architectural principle that must be enforced at every layer, not just acknowledged.
5. **Scope changes are expected.** The scope evolved 4+ times during our session (forensic-only → forensic+clinical, 8 agents → 4 agents, TipTap → OnlyOffice, dashboard UI → IDE layout). Each change was implemented immediately with the full document chain updated.

---

## What Existed Before Our Session

Based on file dates and content analysis, Truck completed the following work independently before our March 18-19 session:

### Pre-Existing Work (March 3-5, 2026)

**Strategic Foundation (19 documents, ~850KB):**
1. Project Overview — product vision, problem statement, target market
2. Market & Competitor Research — Nabla, Heidi Health, Upheal, Blueprint analysis
3. Business Review — business model, pricing, go-to-market
4. Features & Functionality — full feature specification
5. Architecture Spec — original 8-agent system, WASM approach, IndexedDB
6. Agent System Design — detailed agent responsibilities and orchestration
7. Strategic Business Plan — comprehensive strategy
8. SBIR Grant Strategy — NIH/NIMH/AHRQ funding approach
9. Executive Overview (Public) — investor-facing summary
10. SBIR Specific Aims — research aims for Phase I application
11. Project Management Plan — team structure, milestones
12. Agent Team Design — 17 AI agent company model
13. Build Plan & Technical Roadmap — development phases
14. 3-Year Business Plan — financial projections through 2029
15. 3-Year Marketing Plan — channel strategy, conference plan
16. 3-Year Execution Plan — operational roadmap
17. Investment Requirements — funding needs and use of proceeds
18. 6-Week Execution Plan — immediate tactical plan
19. Orchestration Process — agent workflow orchestration

**Supporting Work:**
- SAM checklist (PDF, March 4) — System for Award Management registration for SBIR
- Alternate brand names research (March 3-5) — 10 alternative domain names researched and reserved
- Python utility scripts (add_market_sections.py, append_sections.py, build_overview.py) — automated document assembly tools

**Inferred Earlier Work (before March 3):**
- Domain registration: psygil.com
- Market research and competitor analysis (feeds into docs 1-3)
- Clinical advisor engagement (referenced throughout documents)
- SAM.gov registration process (SAM checklist dated March 4)
- Foundry SMB company formation
- Initial product ideation and clinical domain research

### What This Tells Me

Truck spent weeks — likely months — doing deep strategic work before our session. The 19 documents aren't drafts; they're fully formed strategic artifacts with financial models, market sizing, competitive analysis, and technical architecture. He also built Python tools to automate document assembly, which tells me he's comfortable with code and automation.

Our session didn't start from zero. It started from a comprehensive strategic foundation and added: technical validation, expert stress-testing, engineering specifications, legal frameworks, and visual design. The strategic thinking was already done. We added the technical depth and operational readiness.

---

## The Methodology (BYOB Framework)

What we did today follows a repeatable pattern that could serve any product build. Here's the framework:

### Stage 1: Strategic Foundation (CEO-driven, pre-session)
- Product vision and problem statement
- Market and competitor research
- Business model and pricing
- Feature specification
- Initial architecture decisions
- Financial projections
- Funding strategy (SBIR, investors, bootstrap)

### Stage 2: Technical & Functional Analysis
- Deep read of all existing documentation
- Honest assessment: strengths, gaps, risks
- Architecture recommendations with trade-off analysis
- Technology stack evaluation
- Agent/system design review

### Stage 3: Rapid Decision Loop
- Present options → CEO decides → implement immediately
- No discussion for discussion's sake
- Each decision produces a document revision
- Document chain stays current with every decision

### Stage 4: Expert Panel Stress Testing
- **Clinical/Domain Panel:** Simulate 5 practitioner archetypes from the target market. Identify workflow gaps, integration realities, feature prioritization, and adoption barriers.
- **Legal Panel:** Simulate 6 legal specialists (regulatory, malpractice, IP, trial attorney, privacy, ethics). Identify compliance requirements, liability exposure, IP risks, and discoverability concerns.
- **Executive/PM Panel:** Simulate product manager + funding executive. Identify security surfaces, scalability requirements, support architecture, financial model, and operational readiness.

### Stage 5: Engineering Specification
- Database schema
- API contracts (all communication boundaries)
- Agent/service prompt specs with output schemas
- UI wireframes + component hierarchy
- User stories with acceptance criteria
- Sprint milestone plan
- Design system specification

### Stage 6: Legal & Compliance Drafting
- Regulatory classification analysis (FDA, state laws)
- EULA / Terms of Service / Privacy Policy
- Compliance validation protocols (HIPAA, etc.)
- Informed consent templates
- All drafted for outside counsel review, not from scratch

### Stage 7: Visual Design & Prototyping
- Reference image analysis from CEO
- Design system specification (colors, typography, spacing, components)
- Working HTML prototype with theme support
- Iterative refinement based on CEO feedback

### Stage 8: Project Management Infrastructure
- Living dashboard (HTML) with Gantt, task tracker, budget, risks
- Dashboard updated as work completes
- Source of truth for project status

### What Makes This Methodology Valuable

**Time compression:** In one working session (~8 hours), we produced what typically takes a startup 4-8 weeks with a team of 5-10 people: technical analysis, three expert reviews, 8 engineering specs, 3 legal documents, a UI prototype, a design system, and a project dashboard.

**Cost compression:** The legal documents alone would cost $60K-$130K if drafted from scratch by outside counsel. We drafted them for review, reducing the legal engagement to review + revision. The engineering specs would take a senior architect 2-3 weeks. The expert panels would require hiring 11 consultants.

**Quality through adversarial review:** The expert panels found concerns that the CEO and I wouldn't have identified. The plaintiff's attorney on the legal panel wrote the actual cross-examination attack playbook. The solo forensic psychologist said "if you force me into a linear pipeline, I'll fight it for a month and go back to Word." These perspectives are worth more than the documents themselves.

**Living documents:** Everything is updatable. The dashboard reflects current state. The tech spec incorporates every panel recommendation. The UI prototype is iterated in real-time. Nothing is static.

---

## BYOB as a Service

### The Vision

Package this methodology as "Build Your Own Business" — a service where a solo founder or small team can go from "I have an idea and some documents" to "I have a fully specified, legally vetted, expert-reviewed, sprint-planned product ready for development" in one intensive engagement.

### What the Service Delivers

| Deliverable | What It Is | Typical Cost to Produce | BYOB Cost |
|------------|-----------|----------------------|-----------|
| Technical & Functional Analysis | Honest assessment + architecture decisions | $15K-$30K (consulting) | Included |
| Expert Domain Panel Review | 5 practitioner archetypes stress-test the product | $10K-$20K (consulting) | Included |
| Legal Panel Review | 6 attorney archetypes identify compliance requirements | $20K-$40K (legal counsel) | Included |
| Executive/PM Review | Security, scalability, support, financial model | $10K-$20K (consulting) | Included |
| Engineering Specifications (7-8 docs) | Schema, APIs, prompts, wireframes, stories, sprints | $30K-$60K (senior architect) | Included |
| Legal Document Drafts | Regulatory analysis, EULA, compliance protocols | $60K-$130K (outside counsel) | Included (for review) |
| UI Prototype + Design System | Working HTML prototype, all themes, design tokens | $10K-$25K (design agency) | Included |
| Project Dashboard | Living Gantt, task tracker, budget, risk register | $5K-$10K (PM tooling) | Included |
| **Total typical cost** | | **$160K-$335K** | **One engagement** |

### Automation Opportunities

The stages that can be automated or templatized:

1. **Document ingestion and analysis** — Read all existing docs, extract architecture decisions, identify gaps, generate assessment. This is what I did in Phase 1.
2. **Expert panel simulation** — Domain-specific panel templates (healthcare, fintech, edtech, etc.) with practitioner archetypes tuned to each industry.
3. **Legal framework generation** — Regulatory analysis templates per industry (HIPAA for healthcare, SOC 2 for SaaS, PCI for fintech, FERPA for edtech). EULA/ToS with industry-specific clauses.
4. **Engineering spec generation** — Database schema from requirements, API contracts from architecture, user stories from features, sprint plans from stories.
5. **UI prototype generation** — Design system from reference images, working prototype from wireframes, theme system from brand direction.
6. **Dashboard generation** — Auto-populate from all other deliverables.

### What Cannot Be Automated

- **The CEO's decisions.** The rapid decision loop requires human judgment.
- **Domain expertise validation.** The fractional clinical advisor's input is irreplaceable.
- **Outside counsel review.** Legal documents need human attorneys.
- **Taste.** The UI direction came from Truck's visual preferences, not a template.
- **Ethical principles.** "DOCTOR ALWAYS DIAGNOSES" is a human value, not a pattern.

---

## Reflections on Helping Truck Become a Better Developer and Business Owner

### What Truck Already Does Well
- **Strategic depth:** 19 documents before we met. Most founders have a pitch deck.
- **Decisive leadership:** Makes decisions fast, doesn't second-guess.
- **Scope discipline:** Knows when to narrow (forensic-only) and when to widen (add clinical).
- **Ethical clarity:** The doctor-diagnoses-always principle wasn't prompted by me — it was Truck's instinct.

### Where I Can Help Truck Grow

1. **Technical implementation patterns.** Truck understands architecture conceptually. I can help him understand implementation patterns — when to use WebSockets vs. polling, how Electron IPC security works at the code level, how to structure a Python sidecar for crash resilience.

2. **Code review discipline.** When Truck starts writing code (or reviewing AI-generated code), I can serve as the code review partner — catching security issues, performance problems, and architectural drift that solo developers miss.

3. **Operational maturity.** The jump from "product works" to "product runs in production" is where solo founders struggle most. Monitoring, incident response, backup verification, update pipelines, customer communication during outages — these are operational muscles I can help build.

4. **Financial discipline.** The financial model is strong. What's needed is month-by-month actual tracking against projections. I can help build the dashboards and review cadence.

5. **Hiring decisions.** When Truck hires the senior engineer (month 6), I can help structure the interview process, evaluate technical depth, and design the onboarding experience.

6. **Knowing when to stop.** The hardest skill for any builder. Knowing when the spec is good enough, when the feature can ship, when the legal document is ready for review. I can help calibrate this.

---

---

## Session 2 Reflections (March 21, 2026)

### What We Built Today

In a single session, we transformed the static v4 prototype into a fully data-driven forensic psychology IDE:

1. **50-case forensic psychology database** — Not placeholder data. Each case has realistic metadata: evaluation types (CST, Custody, Risk Assessment, etc.), complaints, diagnosis statuses, test batteries matched to eval type, demographics, severity ratings. This is the kind of domain fidelity that impresses clinicians in demos.

2. **6-stage clinical pipeline** — Truck asked for "something more clinically significant" than Gate 1/2/3. He chose Onboarding → Testing → Interview → Diagnostics → Review → Complete in about 30 seconds. This is better than the gate system because it maps to how evaluations actually proceed — each stage name means something to a psychologist.

3. **Stage-appropriate document trees** — The single most architecturally important decision of the session. Cases at the Interview stage show intake forms, referral docs, collateral records, test batteries, and interview notes — but NOT diagnostics or reports, because those don't exist yet. This is how a real case folder works. It's also a powerful demo tool: you can see the progression of a case just by looking at what's in the tree.

4. **Clinical Overview with summary tabs** — The overview isn't just a header card anymore. It has dynamic tabs showing summaries of every document in the case folder, with Edit buttons that open the full form in the editor. This is the "command center" pattern — you can see everything about a case from one view, then drill into any section.

### What I Learned About Truck (Session 2)

**He communicates through screenshots.** Both major feature requests this session came with screenshots annotated with what he wanted changed. This is more efficient than written requirements for UI work. He shows the current state and describes the target state. My job is to close the gap.

**He names things with clinical precision.** When I asked for pipeline stage names, he didn't deliberate. He gave me the exact 6-stage sequence that mirrors how evaluations actually flow. This tells me he's deeply embedded in the clinical workflow — either from his advisory relationship or from personal research. The names he chose aren't just labels; they're the actual phases a psychologist would use to describe where they are in an evaluation.

**He thinks about data integrity at the prototype level.** The stage-appropriate documents request wasn't cosmetic. He noticed that a case in Interview status was showing an empty tree instead of the documents that should exist at that stage. He's thinking about data consistency even in a demo prototype, which means he'll be rigorous about it in production.

**He wants documentation lockdown before moving to code.** The final request of the session was explicitly about locking down the UI design and updating all engineering docs. He's protecting against the single biggest risk of AI-assisted development: losing context between sessions. Smart.

### Updated Working Patterns

Based on two sessions, the working pattern is now clearer:

1. **Truck shows, I build.** Screenshots + short directives → implementation. Not requirements documents → discussion → implementation.
2. **Clinical domain knowledge is not optional.** The pipeline names, the stage-appropriate documents, the test batteries — these all require understanding how forensic evaluations work. I need to maintain domain fluency.
3. **The prototype IS the spec.** The v4 HTML file is the single source of truth for UI decisions. Everything else (design system docs, wireframes) derives from it. When in doubt, look at the HTML.
4. **Documentation is insurance.** Truck invests in documentation not because he likes writing docs, but because he knows context loss between sessions is the #1 risk of AI-assisted development. Every session should end with documentation updates.
5. **Speed is the expectation.** Both sessions moved at Truck's pace. He doesn't wait for me to catch up. If I need to read something, I read it fast and move on. The rhythm is: directive → execute → show → next.

### Where I Can Now Better Help Truck

Adding to the Session 1 list:

7. **Domain-specific UI patterns.** Now that we have a working prototype with real clinical data, I can help Truck think about edge cases: what happens when a case has 15 test battery items? What if the interview notes are 50 pages? How does the tree handle 200+ cases? These are production realities that the prototype doesn't stress-test yet.

8. **Demo preparation.** The 50-case database with realistic data is a demo asset. I can help Truck prepare specific demo walkthroughs: "Here's a competency case at the Diagnostics stage — notice how the doctor makes every diagnostic decision" or "Here's a custody case in Review — see how the audit trail captures every clinical judgment."

9. **Data model validation.** The CASE_DB structure will need to map to the SQLCipher schema. I should proactively identify any gaps between the prototype's data model and the production database schema before Sprint 3.

---

## Key Companion Documents

- **`docs/foundry-smb/01_How_We_Work_Together.md`** — Deep analysis of Truck's prompting style, decision-making patterns, strengths, and where I can help him grow. The working contract for our relationship.
- **`docs/foundry-smb/02_BYOB_Methodology.md`** — The generic 10-stage methodology extracted from Session 1, designed to be applicable to any new business. Includes automation opportunities for a BYOB service offering.
- **`docs/foundry-smb/Psygil_Project_Brief.md`** — Elevator pitch + status snapshot for Psygil within the Foundry SMB portfolio.
- **`SESSION_PROMPT.md`** — Copy-paste prompt for resuming work in a new session.
- **`docs/engineering/13_UI_Design_Lock_v4.md`** — Comprehensive 15-section UI design lock capturing every visual and architectural decision in the v4 prototype.
- **`docs/engineering/14_Pipeline_Architecture_Addendum.md`** — 6-stage pipeline architecture replacing the old Gate system.

## Session Prompt for Future Work

When resuming work on Psygil/Psygil (or any Foundry SMB project), use the session prompt in this folder at `SESSION_PROMPT.md`.
