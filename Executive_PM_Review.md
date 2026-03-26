# Psygil — Executive & Product Management Review

**"Before We Give This Thing a Dime"**
**Simulated Review by: VP of Product & Funding Executive**
**Date:** March 19, 2026
**Scope:** Security, scalability, support, operational readiness, and financial allocation through Production + 1 Year

---

## Panel

- **The Product Manager:** 15 years shipping enterprise SaaS in healthcare. Has launched four products from zero to $10M ARR. Thinks in user stories, support tickets, and churn rates. Asks "what happens when it breaks at 2am?"
- **The Funding Executive:** Former venture partner, now runs a strategic investment fund. Has written 40+ checks in healthtech. Asks "where does every dollar go and when does it come back?"

---

## I. SECURITY REVIEW — "Is It Secure Across All Surfaces?"

### The Good News

The local-first architecture is a structural security advantage that most competitors don't have. PHI on the device, not in the cloud, eliminates the most catastrophic attack surface — a cloud breach exposing thousands of patient records. That's not a small thing. Cloud breaches in healthcare average $10.9M per incident (IBM 2024). You've architecturally avoided the biggest risk.

### The Attack Surface Map

But "local-first" doesn't mean "secure." Here's every surface that needs hardening:

**Surface 1: Electron Application Security**

Electron apps are essentially Chromium browsers with Node.js access. They have a well-documented attack history. The critical concerns:

- **Remote Code Execution (RCE) via XSS:** If untrusted content reaches the renderer process with `nodeIntegration` enabled, an attacker can execute arbitrary code on the clinician's machine. This is the #1 Electron vulnerability class.
- **Supply Chain Attacks via npm Dependencies:** Electron apps ship with hundreds of npm packages. A single compromised dependency (event-stream incident, ua-parser-js incident) gives an attacker code execution inside the app.
- **Auto-Update Hijacking:** If the update pipeline isn't properly signed and verified, an attacker can push a malicious update to every installed instance simultaneously.
- **DLL Side-Loading (Windows):** Electron apps can be tricked into loading malicious DLLs from the application directory.
- **Chromium V8 Vulnerabilities:** CVE-2025-10585 (V8 type-confusion, added to CISA KEV September 2025) affects all Electron apps running older Chromium versions. This is actively exploited in the wild.

**Required mitigations (non-negotiable):**

| Control | Implementation | Priority |
|---------|---------------|----------|
| Disable `nodeIntegration` in all renderer processes | Set `nodeIntegration: false`, `contextIsolation: true`, use `preload` scripts for IPC | Pre-alpha |
| Content Security Policy (CSP) | Strict CSP preventing inline scripts, eval(), and unauthorized origins | Pre-alpha |
| Sandbox all renderer processes | `sandbox: true` on all BrowserWindow instances | Pre-alpha |
| Code signing (macOS + Windows) | Apple Developer ID + Windows Authenticode. Notarize for macOS Gatekeeper. | Pre-beta |
| Signed auto-updates | electron-updater with Ed25519 signature verification. HTTPS-only update feed. | Pre-beta |
| npm dependency audit | `npm audit` in CI pipeline. Lock file verification. Consider Socket.dev or Snyk for supply chain monitoring. | Pre-alpha |
| Electron version pinning + rapid patching | Track Electron security releases. Patch within 72 hours for Critical CVEs. | Ongoing |
| DLL side-loading prevention (Windows) | Use `app.setPath()` to control library loading paths. Ship with hardened manifests. | Pre-beta |
| Disable `webSecurity` bypass | Never set `webSecurity: false` in production. | Pre-alpha |

**Surface 2: Local Data at Rest**

SQLite database encrypted with AES-256 is strong, but:

- **Key management is the weak link.** If the encryption key is derived from a user passphrase, weak passphrases mean weak encryption. Require minimum 12-character passphrases, offer biometric unlock on supported hardware, and derive the key using Argon2id (memory-hard, resistant to GPU cracking).
- **Temporary files.** OnlyOffice and the Python sidecar may write temporary files to disk during processing. These temp files could contain unencrypted PHI. Implement temp file cleanup on every app close and on crash recovery. Use encrypted temp directories where possible.
- **SQLite WAL files.** SQLite's Write-Ahead Log can contain unencrypted data even when the main database is encrypted. Use SQLCipher (encrypted SQLite fork) instead of raw SQLite + application-layer encryption.
- **Swap/page files.** The OS may swap sensitive data to disk. On macOS, enable Secure Virtual Memory. On Windows, recommend BitLocker. On Linux, recommend encrypted swap.

**Surface 3: LLM API Transmission**

The de-identified text goes to Anthropic/OpenAI over HTTPS. Concerns:

- **TLS pinning.** Pin the TLS certificates for api.anthropic.com and api.openai.com to prevent MITM attacks on compromised networks (hospital WiFi, court WiFi, coffee shops).
- **API key storage.** The user's API key (or Psygil's service key) must be stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service), never in a config file or environment variable.
- **Request logging.** Ensure the LLM providers' logging policies are compatible with HIPAA. Anthropic's enterprise tier disables input/output logging. Confirm this is in the BAA.
- **De-identification failure mode.** What happens when PII detection fails? The current design sends de-identified text without a human review step. Add a configurable "PHI Review Queue" where clinicians can inspect de-identified text before transmission, at least during the first month of use. After trust is established, this can be made optional.

**Surface 4: Python Sidecar**

The Python sidecar runs Presidio and Whisper locally. Concerns:

- **Sidecar communication.** The Electron app communicates with the Python sidecar over a local Unix socket (or named pipe on Windows). Ensure this socket is not accessible to other processes on the machine. Bind to localhost only, use a random port, and authenticate the connection.
- **Python dependency supply chain.** Same risk as npm: a compromised PyPI package in the sidecar's dependency tree gives an attacker code execution. Pin all Python dependencies with hashes. Use pip-audit in CI.
- **Sidecar crash recovery.** If the sidecar crashes mid-processing, ensure no unencrypted PHI is left in memory or temp files. Implement a crash cleanup handler.

**Surface 5: OnlyOffice Document Editor**

OnlyOffice runs as an embedded component. It has its own attack surface:

- **Plugin system.** OnlyOffice supports plugins. Disable all plugins in the embedded deployment. A malicious plugin could exfiltrate document content.
- **Macro execution.** Disable VBA/macro execution entirely. Forensic reports should never contain macros.
- **External resource loading.** Disable external image/resource loading to prevent document-based phishing (e.g., a tracking pixel in a .docx opened in the editor).

**Security Budget Estimate:**

| Item | Cost | Timing |
|------|------|--------|
| Apple Developer ID + Notarization ($99/year) | $99 | Pre-beta |
| Windows Authenticode Code Signing Certificate | $200-$500/year | Pre-beta |
| Socket.dev or Snyk (dependency monitoring) | $0-$500/year (free tier may suffice) | Pre-alpha |
| Third-party penetration test | $5K-$15K | Pre-launch |
| SQLCipher license (commercial, if needed) | $0 (BSD license) or community edition | Pre-alpha |
| **Total security budget** | **$5K-$16K + $300-$1K/year** | |

---

## II. SCALABILITY REVIEW — "What Backend Systems Do We Need?"

### The Architecture Question

Psygil is a local-first desktop app. But "local-first" doesn't mean "no backend." You need backend systems for everything that isn't the clinical workflow itself. Here's the full stack:

### A. What Must Be Built (Backend Services)

**1. User Registration & Authentication**

| Approach | Recommendation |
|----------|---------------|
| Build from scratch | No. Never roll your own auth for a healthcare product. |
| Auth0 / Clerk / Supabase Auth | **Yes. Use Auth0 or Clerk.** Enterprise SSO support, MFA, passwordless, HIPAA-eligible. Auth0 free tier supports 7,500 MAU — more than enough for Year 1. |

The Electron app authenticates the user on launch, verifies license status, and unlocks the local database. Authentication is online-only at login; the app works offline after authentication (with periodic re-verification).

**2. Licensing & Subscription Management**

| Component | Recommendation |
|-----------|---------------|
| Payment processing | **Stripe Billing.** Industry standard for SaaS subscriptions. Supports monthly/annual, tiered pricing, coupons, free trials. PCI-compliant. |
| License enforcement | **Custom license server (lightweight).** On login, the app checks license status via API. License tied to user account, not machine. Allow 2-3 simultaneous device activations. |
| Subscription portal | **Stripe Customer Portal.** No-code self-service for upgrades, downgrades, payment method updates, invoice history. |
| Annual billing incentive | Offer 2 months free for annual prepayment ($299/mo → $2,990/year). This improves cash flow and reduces churn. |

**3. Telemetry & Product Analytics (De-identified Only)**

The app needs to phone home for: crash reports (Sentry), anonymous usage analytics (product decisions — which features are used, where users drop off), and NPS/satisfaction surveys. No PHI in any telemetry. Use PostHog (self-hostable, HIPAA-friendly) or Mixpanel.

**4. Auto-Update Infrastructure**

| Component | Recommendation |
|-----------|---------------|
| Update server | **GitHub Releases + electron-updater.** Free. Signed updates. HTTPS. Works with S3/CloudFront for CDN. |
| Update cadence | Monthly feature releases. Emergency patches within 72 hours for critical CVEs. |
| Rollback | Users can revert to previous version via app settings. Server-side kill switch for catastrophic bugs. |

**5. Content Delivery & Download**

New users download the Electron installer (~300-400MB with bundled Python runtime). Needs CDN distribution.

| Component | Recommendation |
|-----------|---------------|
| CDN | **Cloudflare R2 + Pages** or **AWS S3 + CloudFront.** $5-$20/month for Year 1 traffic. |
| Download page | Simple marketing site with OS-specific download links. Netlify or Cloudflare Pages. |
| Installer signing | Code-signed for macOS and Windows (see Security). |

**6. Style System Processing (Cloud Assist)**

During onboarding, the clinician uploads writing samples for style extraction. This is a one-time heavy LLM operation. Options:

| Approach | Recommendation |
|----------|---------------|
| Process locally | Slow (large context window, multiple passes). Could take 15-30 minutes. |
| Process via cloud API | **Better UX.** Send de-identified samples to Claude/GPT-4o for style extraction. Results stored locally. One-time operation per clinician. |

### B. Backend Cost Model (Year 1)

| Service | Monthly Cost | Annual Cost |
|---------|-------------|-------------|
| Auth0 (free tier → $23/mo at scale) | $0-$23 | $0-$276 |
| Stripe Billing (2.9% + $0.30 per transaction) | ~$50-$150 at 100 users | ~$600-$1,800 |
| Sentry (crash reporting, free tier) | $0 | $0 |
| PostHog (analytics, free tier → $0-$50/mo) | $0-$50 | $0-$600 |
| Cloudflare R2 (CDN for downloads) | $5-$20 | $60-$240 |
| Domain + DNS + email | $15 | $180 |
| GitHub (repo + Actions CI/CD) | $0-$4 | $0-$48 |
| VPS for license server (Fly.io or Railway) | $5-$25 | $60-$300 |
| **Total backend infrastructure** | **$75-$285/mo** | **$900-$3,444/year** |

That's the beauty of local-first: your backend costs are trivial. The expensive computation happens on the clinician's machine and the LLM provider's infrastructure, not yours.

### C. Scalability Bottlenecks

At 75-150 users (Year 1), there are zero scalability concerns. At 1,500-2,500 users (Year 3), the bottlenecks are:

- **LLM API rate limits.** At 2,500 users doing 4 evaluations/week each = ~10,000 evaluations/week = ~40,000 LLM calls/week. Anthropic's enterprise tier handles this easily, but negotiate volume pricing.
- **Score Report parsing accuracy at scale.** Q-global PDFs change format periodically. At 2,500 users, you'll see every edge case. Budget for ongoing parser maintenance.
- **Auto-update bandwidth.** 2,500 users × 300MB update = 750GB per release cycle. CDN handles this, but budget for it ($10-$30/release).
- **Support volume.** See Section III below.

---

## III. SUPPORT REVIEW — "How Do We Support Users?"

### The Support Reality for Clinical Software

Clinicians are not tech-savvy consumers. They are licensed professionals who bill $250-$500/hour and have zero patience for broken software. When something doesn't work, they need it fixed immediately — not tomorrow, not after a ticket escalation. They will also call you on the phone. Plan for that.

### A. Support Architecture: AI-First with Human Escalation

**Tier 0: Self-Service (Deflects 40-60% of inquiries)**

| Component | Implementation |
|-----------|---------------|
| Knowledge base | Docs site (GitBook or Mintlify). Searchable. FAQ, video tutorials, onboarding guide. |
| In-app help | Contextual help tooltips. "?" button on every major screen links to relevant KB article. |
| Status page | StatusPage.io or Instatus ($29/mo). Shows system health, scheduled maintenance, incident history. |

**Tier 1: AI Support Agent (Handles 60-80% of remaining inquiries)**

| Component | Implementation |
|-----------|---------------|
| Platform | **Intercom Fin** ($0.99/resolution) or **Freshdesk** (AI-powered, free tier for small teams). Intercom Fin is purpose-built for this: train on your KB, resolve common issues, escalate with full context. |
| Training data | KB articles + common support scenarios. Onboarding issues, score import failures, export formatting questions, account/billing questions. |
| Escalation trigger | If the AI can't resolve in 2 exchanges, or if the user says "speak to a human," auto-escalate to Tier 2 with full conversation context. |
| Cost model | At Intercom's $0.99/resolution: 100 users × 2 tickets/month × 70% AI-resolved = ~140 AI resolutions/month = ~$140/month. |

**Tier 2: Human Support (CEO + Contract Support, 20-40% of issues)**

| Component | Implementation |
|-----------|---------------|
| Who | Year 1: CEO handles escalations personally. This is a feature, not a bug — direct founder access builds loyalty in early adopters. |
| | Year 2+: Hire a part-time clinical support specialist (someone who understands psychology workflows, not just IT). |
| SLA | Respond within 4 business hours. Resolve within 24 hours. Critical issues (data loss, PHI concerns): respond within 1 hour. |
| Channel | Email + in-app chat. No phone in Year 1 (too expensive to staff). But respond fast enough that phone becomes unnecessary. |

**Tier 3: Engineering Escalation (Bugs, Data Issues)**

| Component | Implementation |
|-----------|---------------|
| Trigger | Tier 2 cannot resolve. Bug confirmed. Data corruption. Security incident. |
| Who | CEO/engineer (Year 1) → engineering team (Year 2+). |
| SLA | Bug acknowledgment within 4 hours. Hotfix for critical bugs within 48 hours. |
| Tooling | Linear or GitHub Issues for bug tracking. Sentry for crash reports with automatic issue creation. |

### B. Support Scenarios Unique to This Product

| Scenario | How Bad Is It? | Mitigation |
|----------|---------------|------------|
| Score import parses incorrectly | **High.** Wrong scores → wrong diagnosis → malpractice risk. | Side-by-side verification at Gate 1. Support team can remote-debug parser with de-identified sample. |
| Report finalization loses formatting | **High.** Court deadline, corrupted .docx. | Auto-save every 30 seconds. Version history. Recoverable drafts. Support can help restore from backup. |
| PII detection misses a name | **Critical.** PHI breach. | PHI Review Queue for new users. Incident response plan. Breach notification procedure. |
| Clinician locked out before court deadline | **Critical.** License check fails, offline mode expired, password forgotten. | Offline grace period (7 days). Emergency license bypass (admin-issued, time-limited). Priority support SLA. |
| OnlyOffice crashes mid-report | **Medium.** Auto-recovery. | OnlyOffice auto-save + Psygil version history. Support can help recover from crash state. |
| Clinician needs help on the stand | **Not your problem.** But build the Testimony Preparation feature. | Testimony Preparation export. Clear documentation. But no real-time support during testimony. |

### C. Support Cost Model (Year 1)

| Item | Monthly Cost | Annual Cost |
|------|-------------|-------------|
| Intercom (Starter plan + Fin AI) | $89 + ~$140/mo AI resolutions | $2,748 |
| StatusPage.io | $29 | $348 |
| GitBook (knowledge base, free tier) | $0 | $0 |
| CEO time (10-15 hrs/month on support) | Opportunity cost | — |
| **Total support costs** | **~$260/month** | **~$3,100/year** |

---

## IV. FINANCIAL MODEL — "Where Does Every Dollar Go?"

### A. Year 1 Cash Flow Model (Conservative)

**Revenue Assumptions:**
- 75-150 paying users by end of Year 1 (ramp from 0)
- Average revenue per user: $320/month
- Average user onboards in month 4-8
- SBIR Phase I: $300K (received month 3-4)

**Revenue Projection:**

| Quarter | Paying Users (end) | Quarterly Revenue | Cumulative Revenue |
|---------|-------------------|-------------------|-------------------|
| Q1 (build) | 0 | $0 | $0 |
| Q2 (beta) | 10-20 | $10K-$20K | $10K-$20K |
| Q3 (launch) | 30-60 | $30K-$60K | $40K-$80K |
| Q4 (growth) | 75-150 | $72K-$150K | $112K-$230K |
| **SBIR Phase I** | | **$300K** | |
| **Total Year 1 Cash In** | | | **$412K-$530K** |

**Expense Allocation:**

| Category | Annual Budget | % of Revenue |
|----------|-------------|-------------|
| **Legal & Compliance** | $60K-$130K | Front-loaded, Q1-Q2 |
| FDA regulatory review | $15K-$25K | |
| EULA + privacy policy | $10K-$20K | |
| HIPAA validation + BAAs | $5K-$15K | |
| IP audit (test publishers) | $5K-$10K | |
| Insurance (E&O + cyber) | $10K-$25K | |
| Other legal | $15K-$35K | |
| **Engineering** | $20K-$40K | |
| OnlyOffice Developer Edition | $6K | Pre-beta |
| Code signing certificates | $300-$600 | |
| Penetration test | $5K-$15K | Pre-launch |
| Infrastructure (see Section II) | $900-$3,400 | |
| LLM API costs (~$3/eval × est. volume) | $5K-$15K | |
| Dev tools (GitHub, Sentry, etc.) | $1K-$3K | |
| **Marketing & Sales** | $15K-$30K | |
| Website + landing page | $2K-$5K | |
| Conference attendance (1-2 conferences) | $5K-$10K | |
| Content marketing (blog, case studies) | $3K-$5K | |
| Email marketing (ConvertKit/Mailchimp) | $500-$1K | |
| Google Ads / LinkedIn Ads (targeted) | $5K-$10K | |
| **Support** | $3K-$5K | |
| Intercom + StatusPage | $3K | |
| Knowledge base | $0 (free tier) | |
| **Team** | $0-$60K | |
| CEO salary (deferred or minimal) | $0-$0 | Bootstrapped |
| Senior engineer (months 6-12, part-time) | $0-$60K | |
| Clinical advisor (fractional) | $0-$12K | |
| **Peer-Reviewed Validation Study** | $20K-$50K | Year 1 |
| **Total Year 1 Expenses** | **$118K-$315K** | |

**Year 1 Net Position:**

| Scenario | Cash In | Cash Out | Net |
|----------|---------|----------|-----|
| Conservative | $412K | $315K | +$97K |
| Optimistic | $530K | $200K | +$330K |
| Pessimistic | $350K | $315K | +$35K |

The SBIR Phase I is the lifeline. Without it, you need 50+ paying users within 6 months to stay cash-positive. With it, you have 12+ months of runway even with zero revenue.

### B. Year 1+1 (Month 13-24) Outlook

By month 12, if the product has product-market fit (50+ paying users, <5% monthly churn, 3+ testimonials), you should see:

| Metric | Month 12 | Month 24 |
|--------|----------|----------|
| Paying users | 75-150 | 300-500 |
| MRR | $24K-$48K | $90K-$160K |
| ARR | $288K-$576K | $1.1M-$1.9M |
| Monthly burn | $15K-$25K | $30K-$50K |
| Team size | 2-3 | 4-6 |
| Support volume | ~200 tickets/mo | ~800 tickets/mo |
| LLM API cost | $2K-$5K/mo | $8K-$15K/mo |

**The critical decision at Month 12:** Do you raise a seed round ($1M-$3M) to accelerate growth, or do you stay bootstrapped with SBIR Phase II ($1M-$1.5M)? The SBIR path is slower but non-dilutive. The venture path is faster but gives up 15-25% equity.

My recommendation: **Apply for SBIR Phase II AND prepare a seed deck.** Keep both options open. If you hit $500K+ ARR by month 18, you'll have leverage to negotiate favorable terms either way.

---

## V. THE CORNERS WE LOOKED AROUND

These are the things that don't show up in architecture docs but kill products in Year 1:

**1. Onboarding abandonment.** If the first 30 minutes don't result in a completed evaluation (even with sample data), you lose the user permanently. Clinicians won't give you a second chance. Pre-load a complete sample case. Make the first-run experience a guided walkthrough, not a blank screen.

**2. Q-global PDF format changes.** Pearson changes their score report formatting periodically. When they do, your parser breaks for every MMPI-3 user simultaneously. You need: automated parser tests against real Q-global PDFs, a user-reported "score import failed" flow that captures the PDF for debugging, and a rapid parser hotfix pipeline (fix and push within 48 hours).

**3. macOS Gatekeeper rejections.** Apple's notarization process rejects unsigned or improperly signed apps. If a clinician downloads Psygil and macOS says "this app can't be opened," they'll delete it and never try again. Test the notarization flow on every macOS version (Monterey, Ventura, Sonoma, Sequoia, latest).

**4. Court deadline pressure.** Your users will use this tool to write reports due in 48 hours for court appearances. The app must never be the reason a report is late. This means: aggressive auto-save (every 30 seconds), offline mode that works for at least 7 days without internet, crash recovery that restores the exact state before the crash, and a manual Word export fallback if OnlyOffice fails.

**5. The "I need it to do this one thing" feature requests.** Clinicians will ask for very specific features tied to their jurisdiction, their court, their preferred instruments. You'll get 50 unique requests from 50 users. The configuration system (Settings/Config) must be flexible enough to handle most of these without code changes. The ones that require code changes go into a public roadmap where users can vote.

**6. Churn from "I don't trust AI."** Psychology is a conservative profession. Many clinicians over 50 will be skeptical of any AI involvement in their work. Your response: the Testimony Preparation feature, the audit trail, the "doctor always diagnoses" principle, and testimonials from ABPP-certified colleagues. Peer trust matters more than feature lists in this market.

**7. Competitor response.** If Psygil gains traction, Nabla, Heidi, or a new entrant will notice. Your moat is: local-first PHI (12-18 month rebuild for cloud competitors), forensic/evaluation specialization (generalists can't pivot quickly), and the style system (switching costs increase with every report written). Build the moat deeper every month.

---

## VI. DECISION FRAMEWORK

### Fund It If:

- PII detection validates at Safe Harbor standard (Milestone 0)
- FDA regulatory attorney confirms CDS exemption (within 60 days)
- First 10 beta users complete evaluations and report >50% time savings
- SBIR Phase I is submitted (regardless of award timing)
- Legal budget ($60K-$130K) is committed upfront

### Kill It If:

- PII detection cannot achieve Safe Harbor compliance after 3 months of development
- FDA classifies the product as SaMD requiring 510(k)
- First 10 beta users report <25% time savings or <50% satisfaction
- Test publishers (Pearson, PAR) issue cease-and-desist on the instrument library
- No path to 50 paying users within 9 months of launch

### The Verdict:

The product is fundable. The market is real, the architecture is sound, the legal requirements are identifiable and budgetable, the unit economics work at 50+ users, and the SBIR pathway de-risks the first 18 months. The total Year 1 investment (all-in: legal, engineering, marketing, support, infrastructure) is $118K-$315K against $412K-$530K in cash inflows. That's a reasonable risk profile for a product targeting a genuine market gap.

The critical path is: **PII validation → FDA confirmation → beta with 10 clinicians → SBIR Phase I → launch.** Everything else follows from those milestones.

Fund it. But fund the legal and compliance work first. The product doesn't exist without the regulatory foundation.

---

*Sources:*

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron App Security Risks & CVE Case Studies](https://blog.securelayer7.net/electron-app-security-risks/)
- [CVE-2025-10585 V8 Vulnerability](https://medium.com/meetcyber/kev-v8-cve-2025-10585-hits-electron-apps-04544099f585)
- [Stripe SaaS Billing](https://stripe.com/use-cases/saas)
- [Auth0 Healthcare Compliance](https://auth0.com/docs/compliance)
- [Intercom Fin AI Agent](https://fin.ai/)
- [AI Customer Support Cost Analysis](https://www.usefini.com/guides/top-ai-customer-service-chatbots)
- [IBM Cost of Data Breach 2024](https://www.ibm.com/reports/data-breach)
