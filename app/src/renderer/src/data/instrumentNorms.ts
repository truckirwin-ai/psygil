/**
 * Instrument psychometric norms for demo/mock result generation.
 *
 * Sources (publisher manuals and authoritative references):
 *   - MMPI-3 Manual (Ben-Porath & Tellegen, 2020, UMN Press / Pearson)
 *   - PAI Professional Manual (Morey, 2007, PAR)
 *   - MCMI-IV Manual (Millon, Grossman, Millon, 2015, Pearson)
 *   - WAIS-5 Technical & Interpretive Manual (Wechsler, 2024, Pearson)
 *   - TOMM Manual (Tombaugh, 1996, MHS)
 *   - SIRS-2 Professional Manual (Rogers, Sewell, Gillard, 2010, PAR)
 *   - PCL-R 2nd Edition Manual (Hare, 2003, MHS)
 *   - HCR-20 V3 User Guide (Douglas, Hart, Webster, Belfrage, 2013)
 *   - CAPS-5 Clinician's Manual (Weathers et al., 2018, NCPTSD)
 *   - BDI-II Manual (Beck, Steer, Brown, 1996, Pearson)
 *   - BAI Manual (Beck, Steer, 1993, Pearson)
 *   - M-FAST Professional Manual (Miller, 2001, PAR)
 *   - SIMS Professional Manual (Widows & Smith, 2005, PAR)
 *   - PCL-5 Scoring Guide (Weathers et al., 2013, NCPTSD)
 *   - TSI-2 Professional Manual (Briere, 2011, PAR)
 *   - DES-II (Carlson & Putnam, 1993)
 *   - MoCA Test Administration Manual (Nasreddine, 2004)
 *   - CAARS Manual (Conners, Erhardt, Sparrow, 1999, MHS)
 *   - CPT-3 Manual (Conners, 2014, MHS)
 *   - AUDIT Manual (Babor et al., 2001, WHO)
 *   - ABAS-3 / Vineland-3 (Pearson)
 *   - FBS (Lees-Haley, English, Glenn, 1991) , embedded MMPI validity scale
 *   - SARA V3 User Manual (Kropp, Hart, 2015)
 *
 * These norms drive deterministic demo data. They are not clinical scoring
 * logic; actual scoring is performed by publisher software or licensed
 * scoring services.
 */

export type ScoreMetric =
  | 'T'          // T-score, M=50, SD=10 (MMPI family, PAI, TSI-2, CAARS, CPT-3)
  | 'BR'         // Base Rate score, 0-115 (MCMI-IV)
  | 'StdScore'   // Standard score, M=100, SD=15 (Wechsler indexes, ABAS-3, Vineland-3)
  | 'Raw'        // Raw sum (BDI-II, BAI, M-FAST, SIMS, MoCA, AUDIT, PCL-R, PCL-5, CAPS-5, TOMM trial)
  | 'Structured' // Structured rater items totaled per domain (HCR-20, SARA, SIRS-2 classification)
  | 'Pct'        // Percentile/percent correct (DES-II mean 0-100)

export interface SeverityBand {
  readonly min: number
  readonly max: number
  readonly label: string
  readonly tone: 'ok' | 'watch' | 'elevated' | 'clinical' | 'severe' | 'invalid'
}

export interface ValidityScaleNorm {
  readonly code: string
  readonly fullName: string
  /** Human-readable interpretation rule. */
  readonly rule: string
  /** Metric used to display this scale's score (usually same as parent). */
  readonly metric: ScoreMetric
  /** Lower-bound and upper-bound cutoffs used for plausible mock values. */
  readonly typicalRange: readonly [number, number]
  /** Score at which result is flagged as questionable. */
  readonly concernCutoff?: number
  /** Score at which result is flagged as invalid. */
  readonly invalidCutoff?: number
  readonly direction: 'high' | 'low' | 'bidirectional'
}

export interface ClinicalScaleNorm {
  readonly code: string
  readonly fullName: string
  /** Elevation threshold for clinical interpretation. */
  readonly elevationCutoff?: number
  /** Markedly elevated threshold (if distinct from elevationCutoff). */
  readonly markedCutoff?: number
  /** For Wechsler subtests (M=10, SD=3) , optional override of the parent metric. */
  readonly metric?: ScoreMetric
}

export interface InstrumentNorm {
  /** Scoring metric for the primary score. */
  readonly metric: ScoreMetric
  /** Non-clinical / "normal" band (informational, not a strict "pass"). */
  readonly normalRange: readonly [number, number]
  /** Publisher / source for this instrument. */
  readonly publisher: string
  /** Publication year of the latest revision. */
  readonly year: number
  /** One-line description of what the primary score represents. */
  readonly scoreLabel: string
  /** Overall severity / classification bands for interpretation. */
  readonly bands: readonly SeverityBand[]
  /** Clinical / content scales (elevations reported in results). */
  readonly clinicalScales: readonly ClinicalScaleNorm[]
  /** Validity / response-style indicators. */
  readonly validityScales: readonly ValidityScaleNorm[]
  /** Typical administration form (self-report, clinician-rated, performance, etc.). */
  readonly administrationType: 'self-report' | 'clinician-rated' | 'performance' | 'structured-interview' | 'structured-rating' | 'observation'
  /** Notes or caveats on forensic use. */
  readonly forensicNotes?: string
}

// ---------------------------------------------------------------------------
// MMPI-3 (Ben-Porath & Tellegen, 2020, Pearson)
// ---------------------------------------------------------------------------
const MMPI3_NORM: InstrumentNorm = {
  metric: 'T',
  normalRange: [40, 64],
  publisher: 'University of Minnesota Press / Pearson',
  year: 2020,
  scoreLabel: 'Uniform T-score (M=50, SD=10); clinical elevation ≥65T',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 39, label: 'Low', tone: 'ok' },
    { min: 40, max: 64, label: 'Within expected range', tone: 'ok' },
    { min: 65, max: 79, label: 'Elevated', tone: 'elevated' },
    { min: 80, max: 120, label: 'Markedly elevated', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'RCd', fullName: 'Demoralization', elevationCutoff: 65, markedCutoff: 80 },
    { code: 'RC1', fullName: 'Somatic Complaints', elevationCutoff: 65, markedCutoff: 80 },
    { code: 'RC2', fullName: 'Low Positive Emotions', elevationCutoff: 65 },
    { code: 'RC4', fullName: 'Antisocial Behavior', elevationCutoff: 65 },
    { code: 'RC6', fullName: 'Ideas of Persecution', elevationCutoff: 65 },
    { code: 'RC7', fullName: 'Dysfunctional Negative Emotions', elevationCutoff: 65 },
    { code: 'RC8', fullName: 'Aberrant Experiences', elevationCutoff: 65 },
    { code: 'RC9', fullName: 'Hypomanic Activation', elevationCutoff: 65 },
    { code: 'THD', fullName: 'Thought Dysfunction (H-O)', elevationCutoff: 65 },
    { code: 'BXD', fullName: 'Behavioral/Externalizing (H-O)', elevationCutoff: 65 },
    { code: 'EID', fullName: 'Emotional/Internalizing (H-O)', elevationCutoff: 65 },
  ],
  validityScales: [
    { code: 'CNS', fullName: 'Cannot Say', rule: 'Raw ≥18 invalidates protocol (content scales); ≥15 caution', metric: 'Raw', typicalRange: [0, 10], concernCutoff: 15, invalidCutoff: 18, direction: 'high' },
    { code: 'VRIN-r', fullName: 'Variable Response Inconsistency', rule: '≥70T suggests inconsistent responding; ≥80T invalid', metric: 'T', typicalRange: [40, 60], concernCutoff: 70, invalidCutoff: 80, direction: 'high' },
    { code: 'TRIN-r', fullName: 'True Response Inconsistency', rule: '≥70T acquiescent/nay-saying; ≥80T invalid', metric: 'T', typicalRange: [45, 60], concernCutoff: 70, invalidCutoff: 80, direction: 'high' },
    { code: 'F-r', fullName: 'Infrequent Responses', rule: '≥90T overreporting possible; ≥120T likely invalid', metric: 'T', typicalRange: [40, 70], concernCutoff: 90, invalidCutoff: 120, direction: 'high' },
    { code: 'Fp-r', fullName: 'Infrequent Psychopathology', rule: '≥100T strong overreporting indicator', metric: 'T', typicalRange: [40, 70], concernCutoff: 90, invalidCutoff: 100, direction: 'high' },
    { code: 'Fs', fullName: 'Infrequent Somatic', rule: '≥100T feigned somatic complaints', metric: 'T', typicalRange: [40, 70], concernCutoff: 90, invalidCutoff: 100, direction: 'high' },
    { code: 'FBS-r', fullName: 'Symptom Validity', rule: '≥100T possible overreporting of somatic/cognitive', metric: 'T', typicalRange: [40, 70], concernCutoff: 80, invalidCutoff: 100, direction: 'high' },
    { code: 'RBS', fullName: 'Response Bias Scale', rule: '≥100T possible cognitive malingering', metric: 'T', typicalRange: [40, 70], concernCutoff: 80, invalidCutoff: 100, direction: 'high' },
    { code: 'L-r', fullName: 'Uncommon Virtues', rule: '≥70T underreporting / defensive', metric: 'T', typicalRange: [40, 60], concernCutoff: 70, invalidCutoff: 80, direction: 'high' },
    { code: 'K-r', fullName: 'Adjustment Validity', rule: '≥70T underreporting distress', metric: 'T', typicalRange: [40, 60], concernCutoff: 70, invalidCutoff: 75, direction: 'high' },
  ],
  forensicNotes: 'Gold-standard self-report broadband measure in forensic psychology. Validity indicators are critical; always interpret clinical scales only after clearing validity.',
}

// ---------------------------------------------------------------------------
// PAI (Morey, 2007)
// ---------------------------------------------------------------------------
const PAI_NORM: InstrumentNorm = {
  metric: 'T',
  normalRange: [40, 69],
  publisher: 'PAR',
  year: 2007,
  scoreLabel: 'T-score (M=50, SD=10); clinical interpretation ≥70T',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 39, label: 'Low', tone: 'ok' },
    { min: 40, max: 69, label: 'Average', tone: 'ok' },
    { min: 70, max: 84, label: 'Clinically significant', tone: 'clinical' },
    { min: 85, max: 120, label: 'Markedly elevated', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'SOM', fullName: 'Somatic Complaints', elevationCutoff: 70 },
    { code: 'ANX', fullName: 'Anxiety', elevationCutoff: 70 },
    { code: 'ARD', fullName: 'Anxiety-Related Disorders', elevationCutoff: 70 },
    { code: 'DEP', fullName: 'Depression', elevationCutoff: 70 },
    { code: 'MAN', fullName: 'Mania', elevationCutoff: 70 },
    { code: 'PAR', fullName: 'Paranoia', elevationCutoff: 70 },
    { code: 'SCZ', fullName: 'Schizophrenia', elevationCutoff: 70 },
    { code: 'BOR', fullName: 'Borderline Features', elevationCutoff: 70 },
    { code: 'ANT', fullName: 'Antisocial Features', elevationCutoff: 70 },
    { code: 'ALC', fullName: 'Alcohol Problems', elevationCutoff: 70 },
    { code: 'DRG', fullName: 'Drug Problems', elevationCutoff: 70 },
    { code: 'AGG', fullName: 'Aggression (Treatment)', elevationCutoff: 70 },
    { code: 'SUI', fullName: 'Suicidal Ideation (Treatment)', elevationCutoff: 70 },
  ],
  validityScales: [
    { code: 'ICN', fullName: 'Inconsistency', rule: '≥73T inconsistent responding', metric: 'T', typicalRange: [45, 60], concernCutoff: 64, invalidCutoff: 73, direction: 'high' },
    { code: 'INF', fullName: 'Infrequency', rule: '≥75T random/careless responding', metric: 'T', typicalRange: [45, 60], concernCutoff: 60, invalidCutoff: 75, direction: 'high' },
    { code: 'NIM', fullName: 'Negative Impression', rule: '≥92T overreporting; ≥110T feigning likely', metric: 'T', typicalRange: [45, 70], concernCutoff: 84, invalidCutoff: 92, direction: 'high' },
    { code: 'PIM', fullName: 'Positive Impression', rule: '≥68T defensiveness/underreporting', metric: 'T', typicalRange: [45, 60], concernCutoff: 57, invalidCutoff: 68, direction: 'high' },
  ],
  forensicNotes: 'Popular forensic alternative to MMPI; shorter administration. NIM and RDF index are primary overreporting indicators.',
}

// ---------------------------------------------------------------------------
// MCMI-IV (Millon, Grossman, Millon, 2015)
// ---------------------------------------------------------------------------
const MCMI4_NORM: InstrumentNorm = {
  metric: 'BR',
  normalRange: [0, 74],
  publisher: 'Pearson',
  year: 2015,
  scoreLabel: 'Base Rate score, 0-115; presence ≥75 BR, prominence ≥85 BR',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 59, label: 'Absent', tone: 'ok' },
    { min: 60, max: 74, label: 'Subclinical', tone: 'watch' },
    { min: 75, max: 84, label: 'Feature present', tone: 'elevated' },
    { min: 85, max: 115, label: 'Prominent / clinically marked', tone: 'severe' },
  ],
  clinicalScales: [
    { code: '1', fullName: 'Schizoid', elevationCutoff: 75, markedCutoff: 85 },
    { code: '2A', fullName: 'Avoidant', elevationCutoff: 75 },
    { code: '2B', fullName: 'Melancholic', elevationCutoff: 75 },
    { code: '3', fullName: 'Dependent', elevationCutoff: 75 },
    { code: '4A', fullName: 'Histrionic', elevationCutoff: 75 },
    { code: '4B', fullName: 'Turbulent', elevationCutoff: 75 },
    { code: '5', fullName: 'Narcissistic', elevationCutoff: 75 },
    { code: '6A', fullName: 'Antisocial', elevationCutoff: 75 },
    { code: '6B', fullName: 'Sadistic', elevationCutoff: 75 },
    { code: '7', fullName: 'Compulsive', elevationCutoff: 75 },
    { code: '8A', fullName: 'Negativistic', elevationCutoff: 75 },
    { code: '8B', fullName: 'Masochistic', elevationCutoff: 75 },
    { code: 'S', fullName: 'Schizotypal', elevationCutoff: 75 },
    { code: 'C', fullName: 'Borderline', elevationCutoff: 75 },
    { code: 'P', fullName: 'Paranoid', elevationCutoff: 75 },
  ],
  validityScales: [
    { code: 'V', fullName: 'Invalidity', rule: 'Raw ≥2 invalidates protocol', metric: 'Raw', typicalRange: [0, 1], concernCutoff: 1, invalidCutoff: 2, direction: 'high' },
    { code: 'X', fullName: 'Disclosure', rule: 'BR <34 or >178 invalid; 34-178 interpretable', metric: 'BR', typicalRange: [60, 85], concernCutoff: 100, invalidCutoff: 178, direction: 'bidirectional' },
    { code: 'Y', fullName: 'Desirability', rule: 'BR ≥75 suggests positive self-presentation', metric: 'BR', typicalRange: [40, 70], concernCutoff: 75, direction: 'high' },
    { code: 'Z', fullName: 'Debasement', rule: 'BR ≥75 suggests negative self-presentation', metric: 'BR', typicalRange: [40, 70], concernCutoff: 75, invalidCutoff: 85, direction: 'high' },
  ],
  forensicNotes: 'DSM-5-aligned personality pathology. Less strong than MMPI-3 as a broadband forensic measure; useful as an adjunct.',
}

// ---------------------------------------------------------------------------
// WAIS-V (Wechsler, 2024) , standard scores M=100 SD=15; subtests M=10 SD=3
// ---------------------------------------------------------------------------
const WAIS5_NORM: InstrumentNorm = {
  metric: 'StdScore',
  normalRange: [90, 109],
  publisher: 'Pearson',
  year: 2024,
  scoreLabel: 'Standard score (M=100, SD=15); subtests scaled score (M=10, SD=3)',
  administrationType: 'performance',
  bands: [
    { min: 0, max: 69, label: 'Extremely Low', tone: 'severe' },
    { min: 70, max: 79, label: 'Borderline', tone: 'elevated' },
    { min: 80, max: 89, label: 'Low Average', tone: 'watch' },
    { min: 90, max: 109, label: 'Average', tone: 'ok' },
    { min: 110, max: 119, label: 'High Average', tone: 'ok' },
    { min: 120, max: 129, label: 'Superior', tone: 'ok' },
    { min: 130, max: 160, label: 'Very Superior', tone: 'ok' },
  ],
  clinicalScales: [
    { code: 'FSIQ', fullName: 'Full Scale IQ' },
    { code: 'VCI', fullName: 'Verbal Comprehension Index' },
    { code: 'VSI', fullName: 'Visual Spatial Index' },
    { code: 'FRI', fullName: 'Fluid Reasoning Index' },
    { code: 'WMI', fullName: 'Working Memory Index' },
    { code: 'PSI', fullName: 'Processing Speed Index' },
    { code: 'GAI', fullName: 'General Ability Index' },
    { code: 'CPI', fullName: 'Cognitive Proficiency Index' },
  ],
  validityScales: [
    { code: 'RDS', fullName: 'Reliable Digit Span', rule: 'Age-corrected RDS ≤6 raises validity concern for effort', metric: 'Raw', typicalRange: [7, 12], concernCutoff: 7, invalidCutoff: 6, direction: 'low' },
  ],
  forensicNotes: 'Cognitive validity requires embedded PVTs (RDS) plus stand-alone PVT (e.g., TOMM) per forensic best practice.',
}

// ---------------------------------------------------------------------------
// TOMM (Tombaugh, 1996)
// ---------------------------------------------------------------------------
const TOMM_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [45, 50],
  publisher: 'MHS',
  year: 1996,
  scoreLabel: 'Correct responses per 50-item trial; PVT cutoff <45 on Trial 2 or Retention',
  administrationType: 'performance',
  bands: [
    { min: 45, max: 50, label: 'Adequate effort', tone: 'ok' },
    { min: 40, max: 44, label: 'Borderline / possible malingering', tone: 'watch' },
    { min: 0, max: 39, label: 'Strong malingering indicator', tone: 'invalid' },
  ],
  clinicalScales: [
    { code: 'Trial 1', fullName: 'Trial 1' },
    { code: 'Trial 2', fullName: 'Trial 2', elevationCutoff: 45 },
    { code: 'Retention', fullName: 'Retention Trial', elevationCutoff: 45 },
  ],
  validityScales: [
    { code: 'Trial 2', fullName: 'Trial 2 cutoff', rule: '<45 suggests insufficient effort (false-positive rate low in neurologically intact)', metric: 'Raw', typicalRange: [45, 50], concernCutoff: 45, invalidCutoff: 40, direction: 'low' },
    { code: 'Retention', fullName: 'Retention cutoff', rule: '<45 consistent with non-credible performance', metric: 'Raw', typicalRange: [45, 50], concernCutoff: 45, invalidCutoff: 40, direction: 'low' },
  ],
  forensicNotes: 'Well-validated stand-alone PVT. Resistant to coaching; insensitive to bona fide dementia until severe stages.',
}

// ---------------------------------------------------------------------------
// SIRS-2 (Rogers et al., 2010)
// ---------------------------------------------------------------------------
const SIRS2_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 20],
  publisher: 'PAR',
  year: 2010,
  scoreLabel: 'Primary scale raw sums; classification via decision tree',
  administrationType: 'structured-interview',
  bands: [
    { min: 0, max: 0, label: 'Genuine Responding', tone: 'ok' },
    { min: 1, max: 1, label: 'Indeterminate-General', tone: 'watch' },
    { min: 2, max: 2, label: 'Indeterminate-Psychiatric', tone: 'watch' },
    { min: 3, max: 3, label: 'Probable Feigning', tone: 'elevated' },
    { min: 4, max: 4, label: 'Definite Feigning', tone: 'invalid' },
  ],
  clinicalScales: [
    { code: 'RS', fullName: 'Rare Symptoms' },
    { code: 'SC', fullName: 'Symptom Combinations' },
    { code: 'IA', fullName: 'Improbable & Absurd Symptoms' },
    { code: 'BL', fullName: 'Blatant Symptoms' },
    { code: 'SU', fullName: 'Subtle Symptoms' },
    { code: 'SEV', fullName: 'Severity of Symptoms' },
    { code: 'SEL', fullName: 'Selectivity of Symptoms' },
    { code: 'RO', fullName: 'Reported vs Observed' },
  ],
  validityScales: [
    { code: 'MT', fullName: 'Modified Total Index', rule: 'Elevations across primary scales increase confidence of feigning classification', metric: 'Raw', typicalRange: [0, 15], concernCutoff: 20, invalidCutoff: 30, direction: 'high' },
  ],
  forensicNotes: 'Gold-standard structured interview for feigned mental disorder. Classification, not continuous score, drives interpretation.',
}

// ---------------------------------------------------------------------------
// PCL-R 2nd Ed. (Hare, 2003)
// ---------------------------------------------------------------------------
const PCLR_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 19],
  publisher: 'MHS',
  year: 2003,
  scoreLabel: 'Total 0-40; US research cutoff ≥30 = psychopathy',
  administrationType: 'structured-rating',
  bands: [
    { min: 0, max: 19, label: 'Low psychopathic traits', tone: 'ok' },
    { min: 20, max: 29, label: 'Moderate traits', tone: 'elevated' },
    { min: 30, max: 40, label: 'Psychopathy range (US cutoff)', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'Factor 1', fullName: 'Interpersonal/Affective (Facets 1-2)' },
    { code: 'Factor 2', fullName: 'Lifestyle/Antisocial (Facets 3-4)' },
    { code: 'Facet 1', fullName: 'Interpersonal' },
    { code: 'Facet 2', fullName: 'Affective' },
    { code: 'Facet 3', fullName: 'Lifestyle' },
    { code: 'Facet 4', fullName: 'Antisocial' },
  ],
  validityScales: [],
  forensicNotes: 'Requires interview plus collateral file review. Certified rater training strongly recommended before forensic use.',
}

// ---------------------------------------------------------------------------
// HCR-20 V3 (Douglas et al., 2013)
// ---------------------------------------------------------------------------
const HCR20_NORM: InstrumentNorm = {
  metric: 'Structured',
  normalRange: [0, 10],
  publisher: 'Mental Health, Law, & Policy Institute (SFU)',
  year: 2013,
  scoreLabel: 'Structured professional judgment; items 0/1/2, summary risk Low/Moderate/High',
  administrationType: 'structured-rating',
  bands: [
    { min: 0, max: 1, label: 'Low future violence risk', tone: 'ok' },
    { min: 2, max: 2, label: 'Moderate risk', tone: 'elevated' },
    { min: 3, max: 3, label: 'High risk', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'H', fullName: 'Historical (10 items)' },
    { code: 'C', fullName: 'Clinical (5 items)' },
    { code: 'R', fullName: 'Risk Management (5 items)' },
    { code: 'Case Priority', fullName: 'Case Prioritization' },
  ],
  validityScales: [],
  forensicNotes: 'SPJ model; numeric totals are secondary to the structured clinical judgment and case formulation.',
}

// ---------------------------------------------------------------------------
// CAPS-5 (Weathers et al., 2018)
// ---------------------------------------------------------------------------
const CAPS5_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 25],
  publisher: 'National Center for PTSD',
  year: 2018,
  scoreLabel: 'Total severity 0-80 (20 items × 0-4); dx requires B, C, D, E criterion counts',
  administrationType: 'structured-interview',
  bands: [
    { min: 0, max: 10, label: 'Minimal', tone: 'ok' },
    { min: 11, max: 25, label: 'Subthreshold', tone: 'watch' },
    { min: 26, max: 45, label: 'Moderate PTSD', tone: 'elevated' },
    { min: 46, max: 65, label: 'Severe PTSD', tone: 'severe' },
    { min: 66, max: 80, label: 'Extreme PTSD', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'B', fullName: 'Intrusion (1 required, ≥2 severity)' },
    { code: 'C', fullName: 'Avoidance (1 required, ≥2 severity)' },
    { code: 'D', fullName: 'Cognition/Mood (2 required, ≥2 severity)' },
    { code: 'E', fullName: 'Arousal/Reactivity (2 required, ≥2 severity)' },
  ],
  validityScales: [],
  forensicNotes: 'Preferred structured interview for DSM-5 PTSD. Pair with validity measures (MMPI-3, SIMS) in forensic contexts.',
}

// ---------------------------------------------------------------------------
// BDI-II (Beck et al., 1996)
// ---------------------------------------------------------------------------
const BDI2_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 13],
  publisher: 'Pearson',
  year: 1996,
  scoreLabel: 'Total 0-63',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 13, label: 'Minimal', tone: 'ok' },
    { min: 14, max: 19, label: 'Mild', tone: 'watch' },
    { min: 20, max: 28, label: 'Moderate', tone: 'elevated' },
    { min: 29, max: 63, label: 'Severe', tone: 'severe' },
  ],
  clinicalScales: [{ code: 'Total', fullName: 'Total Depression Severity' }],
  validityScales: [],
  forensicNotes: 'Transparent self-report; vulnerable to response bias. Confirm with validity measures in forensic use.',
}

// ---------------------------------------------------------------------------
// BAI (Beck & Steer, 1993)
// ---------------------------------------------------------------------------
const BAI_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 7],
  publisher: 'Pearson',
  year: 1993,
  scoreLabel: 'Total 0-63',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 7, label: 'Minimal', tone: 'ok' },
    { min: 8, max: 15, label: 'Mild', tone: 'watch' },
    { min: 16, max: 25, label: 'Moderate', tone: 'elevated' },
    { min: 26, max: 63, label: 'Severe', tone: 'severe' },
  ],
  clinicalScales: [{ code: 'Total', fullName: 'Total Anxiety Severity' }],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// M-FAST (Miller, 2001)
// ---------------------------------------------------------------------------
const MFAST_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 5],
  publisher: 'PAR',
  year: 2001,
  scoreLabel: 'Total 0-25; cutoff ≥6 indicates possible feigning',
  administrationType: 'structured-interview',
  bands: [
    { min: 0, max: 5, label: 'Negative screen', tone: 'ok' },
    { min: 6, max: 10, label: 'Possible feigning', tone: 'elevated' },
    { min: 11, max: 25, label: 'Strong feigning indicator', tone: 'invalid' },
  ],
  clinicalScales: [
    { code: 'RO', fullName: 'Reported vs Observed' },
    { code: 'ES', fullName: 'Extreme Symptomatology' },
    { code: 'RC', fullName: 'Rare Combinations' },
    { code: 'US', fullName: 'Unusual Hallucinations' },
    { code: 'UH', fullName: 'Unusual Symptom Course' },
    { code: 'NI', fullName: 'Negative Image' },
    { code: 'S', fullName: 'Suggestibility' },
  ],
  validityScales: [
    { code: 'Total', fullName: 'M-FAST Total', rule: '≥6 screen positive for feigning', metric: 'Raw', typicalRange: [0, 4], concernCutoff: 6, invalidCutoff: 11, direction: 'high' },
  ],
}

// ---------------------------------------------------------------------------
// SIMS (Widows & Smith, 2005)
// ---------------------------------------------------------------------------
const SIMS_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 14],
  publisher: 'PAR',
  year: 2005,
  scoreLabel: 'Total 0-75; cutoff >14 = possible feigning; subscales have per-domain cutoffs',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 14, label: 'Negative screen', tone: 'ok' },
    { min: 15, max: 24, label: 'Possible feigning', tone: 'elevated' },
    { min: 25, max: 75, label: 'Strong feigning indicator', tone: 'invalid' },
  ],
  clinicalScales: [
    { code: 'P', fullName: 'Psychosis', elevationCutoff: 2 },
    { code: 'AF', fullName: 'Affective Disorders', elevationCutoff: 6 },
    { code: 'N', fullName: 'Neurologic Impairment', elevationCutoff: 3 },
    { code: 'AM', fullName: 'Amnestic Disorders', elevationCutoff: 3 },
    { code: 'LI', fullName: 'Low Intelligence', elevationCutoff: 3 },
  ],
  validityScales: [
    { code: 'Total', fullName: 'SIMS Total', rule: '>14 screen positive for feigned psychopathology', metric: 'Raw', typicalRange: [0, 12], concernCutoff: 15, invalidCutoff: 25, direction: 'high' },
  ],
}

// ---------------------------------------------------------------------------
// PCL-5 (Weathers et al., 2013)
// ---------------------------------------------------------------------------
const PCL5_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 32],
  publisher: 'National Center for PTSD',
  year: 2013,
  scoreLabel: 'Total 0-80; provisional PTSD cutoff ≥33 (veteran samples)',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 32, label: 'Below cutoff', tone: 'ok' },
    { min: 33, max: 49, label: 'Probable PTSD', tone: 'elevated' },
    { min: 50, max: 80, label: 'Severe symptomatology', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'B', fullName: 'Intrusion' },
    { code: 'C', fullName: 'Avoidance' },
    { code: 'D', fullName: 'Cognition/Mood' },
    { code: 'E', fullName: 'Arousal/Reactivity' },
  ],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// TSI-2 (Briere, 2011)
// ---------------------------------------------------------------------------
const TSI2_NORM: InstrumentNorm = {
  metric: 'T',
  normalRange: [40, 64],
  publisher: 'PAR',
  year: 2011,
  scoreLabel: 'T-score; clinical elevation ≥65T',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 64, label: 'Non-clinical', tone: 'ok' },
    { min: 65, max: 79, label: 'Elevated', tone: 'elevated' },
    { min: 80, max: 120, label: 'Markedly elevated', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'ANX', fullName: 'Anxious Arousal', elevationCutoff: 65 },
    { code: 'DEP', fullName: 'Depression', elevationCutoff: 65 },
    { code: 'AI', fullName: 'Anger', elevationCutoff: 65 },
    { code: 'IA', fullName: 'Intrusive Experiences', elevationCutoff: 65 },
    { code: 'DA', fullName: 'Defensive Avoidance', elevationCutoff: 65 },
    { code: 'DIS', fullName: 'Dissociation', elevationCutoff: 65 },
    { code: 'SOM', fullName: 'Somatic Preoccupations', elevationCutoff: 65 },
    { code: 'SXD', fullName: 'Sexual Disturbance', elevationCutoff: 65 },
    { code: 'SC', fullName: 'Suicidality', elevationCutoff: 65 },
    { code: 'TOR', fullName: 'Tension Reduction Behavior', elevationCutoff: 65 },
  ],
  validityScales: [
    { code: 'ATR', fullName: 'Atypical Response', rule: '≥75T suggests overreporting', metric: 'T', typicalRange: [45, 65], concernCutoff: 70, invalidCutoff: 90, direction: 'high' },
    { code: 'RL', fullName: 'Response Level', rule: '≥75T suggests underreporting/defensiveness', metric: 'T', typicalRange: [45, 60], concernCutoff: 70, invalidCutoff: 75, direction: 'high' },
    { code: 'INC', fullName: 'Inconsistent Response', rule: '≥75T inconsistent responding', metric: 'T', typicalRange: [45, 60], concernCutoff: 70, invalidCutoff: 75, direction: 'high' },
  ],
}

// ---------------------------------------------------------------------------
// DES-II (Carlson & Putnam, 1993)
// ---------------------------------------------------------------------------
const DES2_NORM: InstrumentNorm = {
  metric: 'Pct',
  normalRange: [0, 14],
  publisher: 'Public domain (Carlson & Putnam)',
  year: 1993,
  scoreLabel: 'Mean of 28 items (0-100); screen cutoff ≥30',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 14, label: 'Non-clinical', tone: 'ok' },
    { min: 15, max: 29, label: 'Subclinical dissociation', tone: 'watch' },
    { min: 30, max: 100, label: 'Clinical dissociation / DID screen', tone: 'elevated' },
  ],
  clinicalScales: [
    { code: 'Amnesia', fullName: 'Dissociative Amnesia' },
    { code: 'Absorption', fullName: 'Absorption' },
    { code: 'Depersonalization', fullName: 'Depersonalization/Derealization' },
  ],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// MoCA (Nasreddine, 2004)
// ---------------------------------------------------------------------------
const MOCA_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [26, 30],
  publisher: 'MoCA Clinic',
  year: 2004,
  scoreLabel: 'Total 0-30; cutoff <26 suggests cognitive impairment',
  administrationType: 'performance',
  bands: [
    { min: 26, max: 30, label: 'Normal', tone: 'ok' },
    { min: 18, max: 25, label: 'Mild cognitive impairment', tone: 'elevated' },
    { min: 10, max: 17, label: 'Moderate impairment', tone: 'severe' },
    { min: 0, max: 9, label: 'Severe impairment', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'Visuo', fullName: 'Visuospatial/Executive' },
    { code: 'Name', fullName: 'Naming' },
    { code: 'Mem', fullName: 'Delayed Recall' },
    { code: 'Att', fullName: 'Attention' },
    { code: 'Lang', fullName: 'Language' },
    { code: 'Abs', fullName: 'Abstraction' },
    { code: 'Or', fullName: 'Orientation' },
  ],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// CAARS (Conners, Erhardt, Sparrow, 1999)
// ---------------------------------------------------------------------------
const CAARS_NORM: InstrumentNorm = {
  metric: 'T',
  normalRange: [40, 64],
  publisher: 'MHS',
  year: 1999,
  scoreLabel: 'T-score; elevated ≥65T, markedly elevated ≥70T',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 64, label: 'Average', tone: 'ok' },
    { min: 65, max: 69, label: 'Slightly atypical', tone: 'elevated' },
    { min: 70, max: 120, label: 'Markedly atypical', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'A', fullName: 'Inattention/Memory Problems', elevationCutoff: 65 },
    { code: 'B', fullName: 'Hyperactivity/Restlessness', elevationCutoff: 65 },
    { code: 'C', fullName: 'Impulsivity/Emotional Lability', elevationCutoff: 65 },
    { code: 'D', fullName: 'Self-Concept Problems', elevationCutoff: 65 },
    { code: 'E', fullName: 'DSM-5 Inattentive Symptoms', elevationCutoff: 65 },
    { code: 'F', fullName: 'DSM-5 Hyperactive-Impulsive', elevationCutoff: 65 },
    { code: 'G', fullName: 'DSM-5 ADHD Symptoms Total', elevationCutoff: 65 },
    { code: 'H', fullName: 'ADHD Index', elevationCutoff: 65 },
  ],
  validityScales: [
    { code: 'INC', fullName: 'Inconsistency Index', rule: 'Raw ≥8 raises inconsistent responding concern', metric: 'Raw', typicalRange: [0, 5], concernCutoff: 6, invalidCutoff: 8, direction: 'high' },
  ],
}

// ---------------------------------------------------------------------------
// CPT-3 (Conners, 2014)
// ---------------------------------------------------------------------------
const CPT3_NORM: InstrumentNorm = {
  metric: 'T',
  normalRange: [40, 59],
  publisher: 'MHS',
  year: 2014,
  scoreLabel: 'T-score per domain; higher = worse performance',
  administrationType: 'performance',
  bands: [
    { min: 0, max: 59, label: 'Average', tone: 'ok' },
    { min: 60, max: 64, label: 'Mildly atypical', tone: 'watch' },
    { min: 65, max: 69, label: 'Moderately atypical', tone: 'elevated' },
    { min: 70, max: 120, label: 'Markedly atypical', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'Det', fullName: 'Detectability (d′)', elevationCutoff: 65 },
    { code: 'Om', fullName: 'Omissions', elevationCutoff: 65 },
    { code: 'Comm', fullName: 'Commissions', elevationCutoff: 65 },
    { code: 'HRT', fullName: 'Hit Reaction Time', elevationCutoff: 65 },
    { code: 'HRT SD', fullName: 'HRT Standard Deviation', elevationCutoff: 65 },
    { code: 'Var', fullName: 'Variability', elevationCutoff: 65 },
    { code: 'Per', fullName: 'Perseverations', elevationCutoff: 65 },
  ],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// AUDIT (Babor et al., 2001)
// ---------------------------------------------------------------------------
const AUDIT_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 7],
  publisher: 'WHO',
  year: 2001,
  scoreLabel: 'Total 0-40',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 7, label: 'Low risk', tone: 'ok' },
    { min: 8, max: 15, label: 'Hazardous use', tone: 'watch' },
    { min: 16, max: 19, label: 'Harmful use', tone: 'elevated' },
    { min: 20, max: 40, label: 'Likely dependence', tone: 'severe' },
  ],
  clinicalScales: [{ code: 'Total', fullName: 'Alcohol Use Disorder Total' }],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// ABAS-3 & Vineland-3 (adaptive behavior)
// ---------------------------------------------------------------------------
const ABAS3_NORM: InstrumentNorm = {
  metric: 'StdScore',
  normalRange: [90, 109],
  publisher: 'Pearson',
  year: 2015,
  scoreLabel: 'General Adaptive Composite (M=100, SD=15); deficits ≤70',
  administrationType: 'observation',
  bands: [
    { min: 0, max: 69, label: 'Extremely Low', tone: 'severe' },
    { min: 70, max: 79, label: 'Low', tone: 'elevated' },
    { min: 80, max: 89, label: 'Below Average', tone: 'watch' },
    { min: 90, max: 109, label: 'Average', tone: 'ok' },
    { min: 110, max: 160, label: 'Above Average', tone: 'ok' },
  ],
  clinicalScales: [
    { code: 'GAC', fullName: 'General Adaptive Composite' },
    { code: 'Conceptual', fullName: 'Conceptual Domain' },
    { code: 'Social', fullName: 'Social Domain' },
    { code: 'Practical', fullName: 'Practical Domain' },
  ],
  validityScales: [],
}

const VINELAND3_NORM: InstrumentNorm = {
  ...ABAS3_NORM,
  scoreLabel: 'Adaptive Behavior Composite (M=100, SD=15); deficits ≤70',
  clinicalScales: [
    { code: 'ABC', fullName: 'Adaptive Behavior Composite' },
    { code: 'Comm', fullName: 'Communication' },
    { code: 'DLS', fullName: 'Daily Living Skills' },
    { code: 'Soc', fullName: 'Socialization' },
    { code: 'Motor', fullName: 'Motor Skills (optional)' },
  ],
}

// ---------------------------------------------------------------------------
// FBS (Lees-Haley, English, Glenn, 1991) , embedded MMPI validity scale
// ---------------------------------------------------------------------------
const FBS_NORM: InstrumentNorm = {
  metric: 'Raw',
  normalRange: [0, 20],
  publisher: 'MMPI-2/2-RF embedded',
  year: 1991,
  scoreLabel: 'Raw score; elevated ≥22 (male) / ≥24 (female); ≥29 likely overreporting',
  administrationType: 'self-report',
  bands: [
    { min: 0, max: 21, label: 'Within limits', tone: 'ok' },
    { min: 22, max: 28, label: 'Elevated , possible overreporting', tone: 'elevated' },
    { min: 29, max: 43, label: 'Strong overreporting indicator', tone: 'invalid' },
  ],
  clinicalScales: [{ code: 'FBS', fullName: 'Symptom Validity Raw' }],
  validityScales: [
    { code: 'FBS', fullName: 'Symptom Validity Scale', rule: 'Raw ≥29 suggests overreporting of somatic/cognitive symptoms', metric: 'Raw', typicalRange: [8, 20], concernCutoff: 22, invalidCutoff: 29, direction: 'high' },
  ],
}

// ---------------------------------------------------------------------------
// SARA V3 (Kropp & Hart, 2015)
// ---------------------------------------------------------------------------
const SARA_NORM: InstrumentNorm = {
  metric: 'Structured',
  normalRange: [0, 10],
  publisher: 'ProActive ReSolutions',
  year: 2015,
  scoreLabel: 'SPJ; items rated present/possibly-present/absent; summary Low/Moderate/High',
  administrationType: 'structured-rating',
  bands: [
    { min: 0, max: 1, label: 'Low risk', tone: 'ok' },
    { min: 2, max: 2, label: 'Moderate risk', tone: 'elevated' },
    { min: 3, max: 3, label: 'High risk', tone: 'severe' },
  ],
  clinicalScales: [
    { code: 'IPV', fullName: 'Intimate Partner Violence History' },
    { code: 'PAH', fullName: 'Psychosocial Adjustment History' },
    { code: 'MH', fullName: 'Mental Health Problems' },
    { code: 'Risk', fullName: 'Risk Management / Case Prioritization' },
  ],
  validityScales: [],
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const INSTRUMENT_NORMS: Record<string, InstrumentNorm> = {
  'MMPI-3': MMPI3_NORM,
  PAI: PAI_NORM,
  'MCMI-IV': MCMI4_NORM,
  'WAIS-V': WAIS5_NORM,
  TOMM: TOMM_NORM,
  'SIRS-2': SIRS2_NORM,
  'PCL-R': PCLR_NORM,
  'HCR-20': HCR20_NORM,
  'HCR-20v3': HCR20_NORM,
  'CAPS-5': CAPS5_NORM,
  'BDI-II': BDI2_NORM,
  BAI: BAI_NORM,
  'M-FAST': MFAST_NORM,
  SIMS: SIMS_NORM,
  'PCL-5': PCL5_NORM,
  'TSI-2': TSI2_NORM,
  'DES-II': DES2_NORM,
  MoCA: MOCA_NORM,
  CAARS: CAARS_NORM,
  'CPT-3': CPT3_NORM,
  AUDIT: AUDIT_NORM,
  'ABAS-3': ABAS3_NORM,
  'Vineland-3': VINELAND3_NORM,
  FBS: FBS_NORM,
  SARA: SARA_NORM,
}

export function bandForScore(norm: InstrumentNorm, score: number): SeverityBand {
  return norm.bands.find((b) => score >= b.min && score <= b.max) ?? norm.bands[norm.bands.length - 1]
}
