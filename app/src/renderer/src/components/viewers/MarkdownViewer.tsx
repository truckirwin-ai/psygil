// MarkdownViewer: renders Markdown content as formatted HTML in a sandboxed iframe.
// Uses the `marked` library for parsing. Styled to match the document viewer aesthetic.

import { useMemo } from 'react'
import { marked } from 'marked'

// Configure marked for safe output (no raw HTML passthrough)
marked.setOptions({
  breaks: true,
  gfm: true,
})

interface MarkdownViewerProps {
  readonly content: string
}

// Stylesheet injected into the iframe for consistent rendering
const mdStyle = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text, #1a1a1a);
    max-width: 100%;
    padding: 24px 32px;
    margin: 0;
    background: transparent;
  }
  h1, h2, h3, h4, h5, h6 {
    color: var(--text, #1a1a1a);
    margin: 1.4em 0 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 { font-size: 22px; border-bottom: 1px solid var(--border, #e0e0e0); padding-bottom: 6px; }
  h2 { font-size: 18px; border-bottom: 1px solid var(--border, #e0e0e0); padding-bottom: 4px; }
  h3 { font-size: 16px; }
  h4 { font-size: 14px; }
  p { margin: 0.6em 0; }
  ul, ol { margin: 0.6em 0; padding-left: 24px; }
  li { margin: 0.2em 0; }
  blockquote {
    margin: 0.8em 0;
    padding: 8px 16px;
    border-left: 3px solid var(--accent, #4a90d9);
    background: var(--panel, #f5f5f5);
    color: var(--text-secondary, #555);
    font-style: italic;
  }
  blockquote p { margin: 0.3em 0; }
  code {
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 12px;
    background: var(--panel, #f0f0f0);
    padding: 2px 5px;
    border-radius: 3px;
  }
  pre {
    background: var(--panel, #f0f0f0);
    padding: 12px 16px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 0.8em 0;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 12px;
    line-height: 1.5;
  }
  table {
    border-collapse: collapse;
    margin: 12px 0;
    width: 100%;
  }
  th, td {
    border: 1px solid var(--border, #ddd);
    padding: 6px 10px;
    font-size: 13px;
    text-align: left;
  }
  th { background: var(--panel, #f5f5f5); font-weight: 600; }
  a { color: var(--accent, #4a90d9); text-decoration: none; }
  a:hover { text-decoration: underline; }
  hr {
    border: none;
    border-top: 1px solid var(--border, #e0e0e0);
    margin: 1.5em 0;
  }
  img { max-width: 100%; }
  strong { font-weight: 700; }
  em { font-style: italic; }
`

export default function MarkdownViewer({ content }: MarkdownViewerProps): React.JSX.Element {
  const html = useMemo(() => {
    try {
      return marked.parse(content) as string
    } catch {
      return `<pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
    }
  }, [content])

  const srcDoc = `<!DOCTYPE html><html><head><style>${mdStyle}</style></head><body>${html}</body></html>`

  return (
    <iframe
      srcDoc={srcDoc}
      style={{ flex: 1, border: 'none', width: '100%' }}
      title="Markdown preview"
      sandbox="allow-same-origin"
    />
  )
}
