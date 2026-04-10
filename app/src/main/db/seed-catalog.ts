/**
 * DSM-5-TR Diagnosis Catalog Seed
 *
 * Populates the diagnosis_catalog table with diagnoses commonly encountered
 * in forensic psychology evaluations. Uses INSERT OR IGNORE, safe to call
 * on every startup or on first catalog access.
 *
 * Columns: diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
 */

import type Database from 'better-sqlite3'

// ---------------------------------------------------------------------------
// Catalog entries
// ---------------------------------------------------------------------------

interface CatalogEntry {
  readonly code: string         // ICD-10-CM code
  readonly dsm5tr_code: string  // DSM-5-TR specifier notation (may differ from ICD code)
  readonly name: string
  readonly description: string
  readonly category: string
}

const CATALOG: readonly CatalogEntry[] = [
  // ── Major Depressive Disorder ──────────────────────────────────────────────
  {
    code: 'F32.0',
    dsm5tr_code: '296.21',
    name: 'Major Depressive Disorder, Single Episode, Mild',
    description: 'Single depressive episode; few symptoms beyond minimum, symptoms manageable, minor functional impairment.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F32.1',
    dsm5tr_code: '296.22',
    name: 'Major Depressive Disorder, Single Episode, Moderate',
    description: 'Single depressive episode; symptoms and functional impairment between mild and severe.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F32.2',
    dsm5tr_code: '296.23',
    name: 'Major Depressive Disorder, Single Episode, Severe',
    description: 'Single depressive episode; several symptoms beyond minimum, marked functional impairment.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F32.4',
    dsm5tr_code: '296.25',
    name: 'Major Depressive Disorder, Single Episode, In Partial Remission',
    description: 'Single episode; previously met full criteria, currently fewer symptoms but criteria not fully met.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F32.5',
    dsm5tr_code: '296.26',
    name: 'Major Depressive Disorder, Single Episode, In Full Remission',
    description: 'Single episode; no significant signs or symptoms present for at least 2 months.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F33.0',
    dsm5tr_code: '296.31',
    name: 'Major Depressive Disorder, Recurrent, Mild',
    description: 'Recurrent depressive episodes; current episode mild severity.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F33.1',
    dsm5tr_code: '296.32',
    name: 'Major Depressive Disorder, Recurrent, Moderate',
    description: 'Recurrent depressive episodes; current episode moderate severity.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F33.2',
    dsm5tr_code: '296.33',
    name: 'Major Depressive Disorder, Recurrent, Severe',
    description: 'Recurrent depressive episodes; current episode severe without psychotic features.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F33.3',
    dsm5tr_code: '296.34',
    name: 'Major Depressive Disorder, Recurrent, With Psychotic Features',
    description: 'Recurrent depressive episodes; current episode severe with mood-congruent or mood-incongruent psychotic features.',
    category: 'Depressive Disorders',
  },
  {
    code: 'F34.1',
    dsm5tr_code: '300.4',
    name: 'Persistent Depressive Disorder (Dysthymia)',
    description: 'Depressed mood most of the day, more days than not, for at least 2 years.',
    category: 'Depressive Disorders',
  },

  // ── Anxiety Disorders ──────────────────────────────────────────────────────
  {
    code: 'F41.1',
    dsm5tr_code: '300.02',
    name: 'Generalized Anxiety Disorder',
    description: 'Excessive anxiety and worry about various events or activities, difficult to control, causing significant distress or impairment.',
    category: 'Anxiety Disorders',
  },
  {
    code: 'F41.0',
    dsm5tr_code: '300.01',
    name: 'Panic Disorder',
    description: 'Recurrent unexpected panic attacks with persistent concern about additional attacks or their consequences.',
    category: 'Anxiety Disorders',
  },
  {
    code: 'F40.10',
    dsm5tr_code: '300.23',
    name: 'Social Anxiety Disorder',
    description: 'Marked fear or anxiety about social situations where the individual may be scrutinized by others.',
    category: 'Anxiety Disorders',
  },
  {
    code: 'F40.00',
    dsm5tr_code: '300.22',
    name: 'Agoraphobia',
    description: 'Marked fear or anxiety about two or more of five situations: public transportation, open spaces, enclosed places, crowds, being outside alone.',
    category: 'Anxiety Disorders',
  },

  // ── Trauma and Stressor-Related Disorders ────────────────────────────────
  {
    code: 'F43.10',
    dsm5tr_code: '309.81',
    name: 'Posttraumatic Stress Disorder',
    description: 'Exposure to actual or threatened death, serious injury, or sexual violence; intrusion symptoms, avoidance, negative cognitions/mood, and hyperarousal.',
    category: 'Trauma and Stressor-Related Disorders',
  },
  {
    code: 'F43.12',
    dsm5tr_code: '309.81',
    name: 'Posttraumatic Stress Disorder, Chronic',
    description: 'PTSD with duration of more than 3 months.',
    category: 'Trauma and Stressor-Related Disorders',
  },
  {
    code: 'F43.10-D',
    dsm5tr_code: '309.81',
    name: 'Posttraumatic Stress Disorder, With Dissociative Symptoms',
    description: 'PTSD with persistent or recurrent depersonalization or derealization.',
    category: 'Trauma and Stressor-Related Disorders',
  },
  {
    code: 'F43.20',
    dsm5tr_code: '309.0',
    name: 'Adjustment Disorder, With Depressed Mood',
    description: 'Emotional or behavioral symptoms in response to an identifiable stressor; depressed mood, tearfulness, or hopelessness predominate.',
    category: 'Trauma and Stressor-Related Disorders',
  },
  {
    code: 'F43.22',
    dsm5tr_code: '309.28',
    name: 'Adjustment Disorder, With Mixed Anxiety and Depressed Mood',
    description: 'Adjustment disorder with combination of depression and anxiety.',
    category: 'Trauma and Stressor-Related Disorders',
  },
  {
    code: 'F43.81',
    dsm5tr_code: '309.89',
    name: 'Prolonged Grief Disorder',
    description: 'Intense longing for the deceased and preoccupation with the deceased or circumstances of death persisting at least 12 months (6 months in children).',
    category: 'Trauma and Stressor-Related Disorders',
  },

  // ── Bipolar and Related Disorders ─────────────────────────────────────────
  {
    code: 'F31.11',
    dsm5tr_code: '296.41',
    name: 'Bipolar I Disorder, Current Episode Manic, Mild',
    description: 'Bipolar I with current or most recent episode manic, mild severity.',
    category: 'Bipolar and Related Disorders',
  },
  {
    code: 'F31.13',
    dsm5tr_code: '296.43',
    name: 'Bipolar I Disorder, Current Episode Manic, Severe',
    description: 'Bipolar I with current or most recent episode manic, severe severity.',
    category: 'Bipolar and Related Disorders',
  },
  {
    code: 'F31.31',
    dsm5tr_code: '296.51',
    name: 'Bipolar I Disorder, Current Episode Depressed, Mild',
    description: 'Bipolar I with current or most recent episode depressed, mild severity.',
    category: 'Bipolar and Related Disorders',
  },
  {
    code: 'F31.81',
    dsm5tr_code: '296.89',
    name: 'Bipolar II Disorder',
    description: 'At least one hypomanic episode and at least one major depressive episode; no manic episodes.',
    category: 'Bipolar and Related Disorders',
  },
  {
    code: 'F34.0',
    dsm5tr_code: '301.13',
    name: 'Cyclothymic Disorder',
    description: 'Numerous periods with hypomanic symptoms and numerous periods with depressive symptoms for at least 2 years.',
    category: 'Bipolar and Related Disorders',
  },

  // ── Schizophrenia Spectrum ────────────────────────────────────────────────
  {
    code: 'F20.9',
    dsm5tr_code: '295.90',
    name: 'Schizophrenia',
    description: 'Two or more of: delusions, hallucinations, disorganized speech, grossly disorganized or catatonic behavior, negative symptoms; for at least 6 months.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },
  {
    code: 'F20.81',
    dsm5tr_code: '295.40',
    name: 'Schizophreniform Disorder',
    description: 'Schizophrenia criteria met but duration 1-6 months.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },
  {
    code: 'F25.0',
    dsm5tr_code: '295.70',
    name: 'Schizoaffective Disorder, Bipolar Type',
    description: 'Schizophrenia criteria concurrent with manic or mixed episode; mood episodes present for majority of illness duration.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },
  {
    code: 'F25.1',
    dsm5tr_code: '295.70',
    name: 'Schizoaffective Disorder, Depressive Type',
    description: 'Schizophrenia criteria concurrent with major depressive episodes only.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },
  {
    code: 'F22',
    dsm5tr_code: '297.1',
    name: 'Delusional Disorder',
    description: 'One or more delusions of at least 1 month duration; full schizophrenia criteria not met.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },
  {
    code: 'F23',
    dsm5tr_code: '298.8',
    name: 'Brief Psychotic Disorder',
    description: 'Sudden onset of psychotic symptoms lasting at least 1 day but less than 1 month, with eventual full return to premorbid level.',
    category: 'Schizophrenia Spectrum and Other Psychotic Disorders',
  },

  // ── Personality Disorders ─────────────────────────────────────────────────
  {
    code: 'F60.2',
    dsm5tr_code: '301.7',
    name: 'Antisocial Personality Disorder',
    description: 'Pervasive pattern of disregard for and violation of rights of others since age 15; current age at least 18.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.3',
    dsm5tr_code: '301.83',
    name: 'Borderline Personality Disorder',
    description: 'Pervasive instability in interpersonal relationships, self-image, and affect; marked impulsivity.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.0',
    dsm5tr_code: '301.0',
    name: 'Paranoid Personality Disorder',
    description: 'Pervasive distrust and suspiciousness of others such that their motives are interpreted as malevolent.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.1',
    dsm5tr_code: '301.20',
    name: 'Schizoid Personality Disorder',
    description: 'Pervasive pattern of detachment from social relationships and restricted range of emotional expression.',
    category: 'Personality Disorders',
  },
  {
    code: 'F21',
    dsm5tr_code: '301.22',
    name: 'Schizotypal Personality Disorder',
    description: 'Pervasive pattern of social and interpersonal deficits marked by acute discomfort with close relationships, cognitive or perceptual distortions, and eccentricities.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.4',
    dsm5tr_code: '301.50',
    name: 'Histrionic Personality Disorder',
    description: 'Pervasive pattern of excessive emotionality and attention seeking.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.81',
    dsm5tr_code: '301.81',
    name: 'Narcissistic Personality Disorder',
    description: 'Pervasive pattern of grandiosity, need for admiration, and lack of empathy.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.6',
    dsm5tr_code: '301.82',
    name: 'Avoidant Personality Disorder',
    description: 'Pervasive pattern of social inhibition, feelings of inadequacy, and hypersensitivity to negative evaluation.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.7',
    dsm5tr_code: '301.6',
    name: 'Dependent Personality Disorder',
    description: 'Pervasive and excessive need to be taken care of, leading to submissive and clinging behavior and fears of separation.',
    category: 'Personality Disorders',
  },
  {
    code: 'F60.5',
    dsm5tr_code: '301.4',
    name: 'Obsessive-Compulsive Personality Disorder',
    description: 'Pervasive pattern of preoccupation with orderliness, perfectionism, and mental and interpersonal control.',
    category: 'Personality Disorders',
  },

  // ── Substance Use Disorders ───────────────────────────────────────────────
  {
    code: 'F10.20',
    dsm5tr_code: '303.90',
    name: 'Alcohol Use Disorder, Moderate to Severe',
    description: 'Problematic pattern of alcohol use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F10.10',
    dsm5tr_code: '305.00',
    name: 'Alcohol Use Disorder, Mild',
    description: 'Problematic pattern of alcohol use; 2-3 criteria met in past 12 months.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F11.20',
    dsm5tr_code: '304.00',
    name: 'Opioid Use Disorder, Moderate to Severe',
    description: 'Problematic pattern of opioid use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F12.20',
    dsm5tr_code: '304.30',
    name: 'Cannabis Use Disorder, Moderate to Severe',
    description: 'Problematic pattern of cannabis use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F14.20',
    dsm5tr_code: '304.20',
    name: 'Cocaine Use Disorder, Moderate to Severe',
    description: 'Problematic pattern of cocaine use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F15.20',
    dsm5tr_code: '304.40',
    name: 'Stimulant Use Disorder (Amphetamine-Type), Moderate to Severe',
    description: 'Problematic pattern of amphetamine-type stimulant use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },
  {
    code: 'F19.20',
    dsm5tr_code: '304.80',
    name: 'Other (or Unknown) Substance Use Disorder, Moderate to Severe',
    description: 'Problematic pattern of other or unknown substance use leading to clinically significant impairment or distress.',
    category: 'Substance-Related and Addictive Disorders',
  },

  // ── Neurodevelopmental Disorders ──────────────────────────────────────────
  {
    code: 'F84.0',
    dsm5tr_code: '299.00',
    name: 'Autism Spectrum Disorder',
    description: 'Persistent deficits in social communication/interaction across multiple contexts; restricted, repetitive patterns of behavior, interests, or activities.',
    category: 'Neurodevelopmental Disorders',
  },
  {
    code: 'F90.0',
    dsm5tr_code: '314.00',
    name: 'Attention-Deficit/Hyperactivity Disorder, Predominantly Inattentive',
    description: 'ADHD with primarily inattentive presentation: 6+ inattention symptoms predominating.',
    category: 'Neurodevelopmental Disorders',
  },
  {
    code: 'F90.1',
    dsm5tr_code: '314.01',
    name: 'Attention-Deficit/Hyperactivity Disorder, Predominantly Hyperactive-Impulsive',
    description: 'ADHD with primarily hyperactive-impulsive presentation: 6+ hyperactivity-impulsivity symptoms predominating.',
    category: 'Neurodevelopmental Disorders',
  },
  {
    code: 'F90.2',
    dsm5tr_code: '314.01',
    name: 'Attention-Deficit/Hyperactivity Disorder, Combined Presentation',
    description: 'ADHD with combined presentation: 6+ inattention AND 6+ hyperactivity-impulsivity symptoms.',
    category: 'Neurodevelopmental Disorders',
  },
  {
    code: 'F80.9',
    dsm5tr_code: '315.39',
    name: 'Language Disorder',
    description: 'Persistent difficulties in acquisition and use of language across modalities due to deficits in comprehension or production.',
    category: 'Neurodevelopmental Disorders',
  },
  {
    code: 'F81.0',
    dsm5tr_code: '315.00',
    name: 'Specific Learning Disorder, With Impairment in Reading',
    description: 'Specific learning disorder with impairment in accurate or fluent word reading, decoding, or spelling.',
    category: 'Neurodevelopmental Disorders',
  },

  // ── Dissociative Disorders ────────────────────────────────────────────────
  {
    code: 'F44.81',
    dsm5tr_code: '300.14',
    name: 'Dissociative Identity Disorder',
    description: 'Disruption of identity characterized by two or more distinct personality states; recurrent gaps in recall of everyday events.',
    category: 'Dissociative Disorders',
  },
  {
    code: 'F48.1',
    dsm5tr_code: '300.6',
    name: 'Depersonalization/Derealization Disorder',
    description: 'Persistent or recurrent experiences of depersonalization, derealization, or both; reality testing remains intact.',
    category: 'Dissociative Disorders',
  },
  {
    code: 'F44.0',
    dsm5tr_code: '300.12',
    name: 'Dissociative Amnesia',
    description: 'Inability to recall important autobiographical information, usually of traumatic or stressful nature.',
    category: 'Dissociative Disorders',
  },

  // ── Somatic Symptom and Related Disorders ────────────────────────────────
  {
    code: 'F45.1',
    dsm5tr_code: '300.82',
    name: 'Somatic Symptom Disorder',
    description: 'One or more somatic symptoms causing distress or disruption of daily life; disproportionate and persistent thoughts about symptom seriousness.',
    category: 'Somatic Symptom and Related Disorders',
  },
  {
    code: 'F45.21',
    dsm5tr_code: '300.7',
    name: 'Illness Anxiety Disorder',
    description: 'Preoccupation with having or acquiring a serious illness; somatic symptoms absent or mild.',
    category: 'Somatic Symptom and Related Disorders',
  },
  {
    code: 'F68.10',
    dsm5tr_code: '300.19',
    name: 'Factitious Disorder Imposed on Self',
    description: 'Falsification of physical or psychological signs or symptoms, or induction of injury or disease, associated with identified deception; no apparent external incentive.',
    category: 'Somatic Symptom and Related Disorders',
  },

  // ── Neurocognitive Disorders ──────────────────────────────────────────────
  {
    code: 'F02.80',
    dsm5tr_code: '294.10',
    name: 'Major Neurocognitive Disorder Due to Alzheimer\'s Disease',
    description: 'Evidence of significant cognitive decline from previous level in one or more cognitive domains; due to Alzheimer\'s disease.',
    category: 'Neurocognitive Disorders',
  },
  {
    code: 'F06.70',
    dsm5tr_code: '331.83',
    name: 'Mild Neurocognitive Disorder',
    description: 'Modest cognitive decline from previous level; does not interfere with capacity for independence in everyday activities.',
    category: 'Neurocognitive Disorders',
  },
  {
    code: 'F07.0',
    dsm5tr_code: '310.1',
    name: 'Personality Change Due to Another Medical Condition',
    description: 'Persistent personality disturbance representing change from previous characteristic personality pattern due to direct pathophysiological consequences of another medical condition.',
    category: 'Neurocognitive Disorders',
  },

  // ── Obsessive-Compulsive and Related Disorders ───────────────────────────
  {
    code: 'F42.2',
    dsm5tr_code: '300.3',
    name: 'Obsessive-Compulsive Disorder',
    description: 'Presence of obsessions, compulsions, or both that are time-consuming and cause significant distress or impairment.',
    category: 'Obsessive-Compulsive and Related Disorders',
  },
  {
    code: 'F45.22',
    dsm5tr_code: '300.7',
    name: 'Body Dysmorphic Disorder',
    description: 'Preoccupation with one or more perceived defects or flaws in physical appearance that are not observable or appear slight to others.',
    category: 'Obsessive-Compulsive and Related Disorders',
  },

  // ── Forensic-Specific / Not Mental Disorders ─────────────────────────────
  {
    code: 'R46.89',
    dsm5tr_code: 'V65.2',
    name: 'Malingering (NOT a mental disorder)',
    description: 'Intentional production of false or grossly exaggerated physical or psychological symptoms motivated by external incentives. NOT a DSM-5-TR mental disorder, listed in Other Conditions section. Requires clinical determination.',
    category: 'Other Conditions (Forensic)',
  },

  // ── Z-Codes / Psychosocial Factors ────────────────────────────────────────
  {
    code: 'Z63.4',
    dsm5tr_code: 'V61.20',
    name: 'Disruption of Family by Separation or Divorce',
    description: 'Disruption of family by separation or divorce. Used in forensic evaluations where family context is clinically relevant.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z62.810',
    dsm5tr_code: 'V61.21',
    name: 'Personal History of Physical Abuse in Childhood',
    description: 'Personal history of physical abuse in childhood. Relevant contextual factor in forensic evaluations.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z62.811',
    dsm5tr_code: 'V61.21',
    name: 'Personal History of Sexual Abuse in Childhood',
    description: 'Personal history of sexual abuse in childhood.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z62.812',
    dsm5tr_code: 'V61.21',
    name: 'Personal History of Neglect in Childhood',
    description: 'Personal history of neglect in childhood.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z65.1',
    dsm5tr_code: 'V62.5',
    name: 'Imprisonment or Other Incarceration',
    description: 'Incarceration status as clinically relevant psychosocial factor.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z65.3',
    dsm5tr_code: 'V62.5',
    name: 'Problems Related to Other Legal Circumstances',
    description: 'Problems related to other legal circumstances beyond incarceration; legal involvement as clinically relevant factor.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
  {
    code: 'Z91.89',
    dsm5tr_code: 'V15.89',
    name: 'Other Personal Risk Factors',
    description: 'Other personal history presenting risk factors not elsewhere classified.',
    category: 'Z-Codes (Psychosocial Factors)',
  },
]

// ---------------------------------------------------------------------------
// Seed function, INSERT OR IGNORE, safe to call multiple times
// ---------------------------------------------------------------------------

let catalogSeeded = false

export function seedDiagnosisCatalog(sqlite: InstanceType<typeof Database>): void {
  if (catalogSeeded) return

  const insert = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnosis_catalog
      (code, dsm5tr_code, name, description, category, is_builtin)
    VALUES
      (@code, @dsm5tr_code, @name, @description, @category, 1)
  `)

  const insertMany = sqlite.transaction((entries: readonly CatalogEntry[]) => {
    for (const entry of entries) {
      insert.run(entry)
    }
  })

  try {
    insertMany(CATALOG)
    catalogSeeded = true
  } catch (err) {
    // Non-fatal: catalog table may not exist in older DB versions
    console.warn('[seed-catalog] Failed to seed diagnosis catalog (non-fatal):', err instanceof Error ? err.message : err)
  }
}
