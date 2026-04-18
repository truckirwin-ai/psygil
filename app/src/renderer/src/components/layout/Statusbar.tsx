import { useEffect, useState } from 'react'

function deriveLlmLabel(
  mode: string | null,
  provider: string | null,
  model: string | null,
): string {
  if (mode === 'byok') {
    if (provider === 'openai') {
      const name = model === 'gpt-4o' ? 'GPT-4o' : model === 'gpt-4-turbo' ? 'GPT-4 Turbo' : (model ?? 'GPT')
      return `LLM: ${name} (your key)`
    }
    if (provider === 'google') {
      const name = model === 'gemini-1.5-pro' ? 'Gemini 1.5 Pro' : model === 'gemini-1.5-flash' ? 'Gemini 1.5 Flash' : (model ?? 'Gemini')
      return `LLM: ${name} (your key)`
    }
    // anthropic or unknown
    const name = model?.includes('opus') ? 'Claude Opus 4' : model?.includes('haiku') ? 'Claude Haiku 4.5' : 'Claude Sonnet 4'
    return `LLM: ${name} (your key)`
  }
  // passthrough or unconfigured
  return 'LLM: Psygil AI (Sonnet)'
}

export default function Statusbar(): React.JSX.Element {
  const [llmLabel, setLlmLabel] = useState('LLM: Psygil AI (Sonnet)')

  useEffect(() => {
    void (async () => {
      try {
        const resp = await window.psygil.setup.getConfig()
        if (resp.status === 'success' && resp.data.config.ai) {
          const { mode, provider, model } = resp.data.config.ai
          setLlmLabel(deriveLlmLabel(mode, provider, model))
        }
      } catch { /* non-fatal */ }
    })()
  }, [])

  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        background: 'var(--panel)',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--stage-complete)',
              display: 'inline-block',
            }}
          />
          Connected
        </span>
        <span>{llmLabel}</span>
        <span>PHI: UNID Redaction &#10003;</span>
        <span>Storage: Local</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>12 active cases</span>
        <span>v0.1.0-alpha</span>
      </div>
    </div>
  )
}
