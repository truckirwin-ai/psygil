# Content Quality Rules

## MANDATORY - Applied to ALL generated content

These rules apply every time text is generated: test data, case narratives, documents, names, clinical content, UI copy, commit messages, comments, documentation. No exceptions.

## Names

- NO generic AI-placeholder names (Sarah Chen, Alex Kim, Maria Garcia, James Smith, Emily Zhang, etc.)
- Choose names that sound like real people from the geographic and demographic context of the scenario
- Vary ethnic backgrounds realistically for the setting. A Denver county jail has a different demographic mix than a Manhattan family court.
- First and last names should feel naturally paired, not algorithmically combined
- Avoid alliterative names (Peter Parker, Bruce Banner) unless contextually appropriate
- Test: would a real person in this situation plausibly have this name? If it sounds like a placeholder, change it.

## Writing Style

- NO em dashes. Use commas, semicolons, colons, or separate sentences instead.
- NO "delve", "leverage", "utilize", "facilitate", "streamline", "robust", "comprehensive", "cutting-edge", "game-changing", "deep dive"
- NO formulaic sentence openers: "It's worth noting that", "Importantly,", "Notably,", "Interestingly,"
- NO hedge-then-assert patterns: "While X, it's important to Y"
- NO triple-adjective chains: "a powerful, flexible, and extensible system"
- Write in plain, direct language. Short sentences are fine. Fragments are fine when they aid clarity.
- Clinical content should read like a real clinician wrote it: dry, precise, factual. Not literary.
- Legal content should read like a real attorney drafted it: formal, specific, citation-heavy.
- Vary sentence length naturally. Monotonous rhythm is a tell.

## Clinical/Forensic Content

- Diagnoses must use correct DSM-5-TR codes and names
- Test score ranges must be psychometrically valid (T-scores mean 50 SD 10, IQ mean 100 SD 15, etc.)
- Legal citations must reference real statutes and case law for the jurisdiction
- Medication names, dosages, and side effects must be pharmacologically accurate
- Interview observations should read like MSE notes, not creative writing
- Timelines must be internally consistent (ages, dates, sequences of events)

## Formatting

- Prefer hyphens (-) over em dashes
- Prefer simple punctuation over ornate constructions
- Use contractions naturally in informal contexts, avoid them in clinical/legal documents
- Numbers: spell out one through nine, use digits for 10+, always use digits for ages, scores, dates, dosages

## Self-Check

Before finalizing any generated content, scan for:
1. Names that sound AI-generated
2. Em dashes (replace every one)
3. Banned vocabulary from the list above
4. Psychometric impossibilities (T-score of 150, IQ of 45 with normal conversation)
5. Timeline contradictions
6. Formulaic sentence patterns repeated across paragraphs
