/**
 * Psygil Agent System, Public Exports
 *
 * Re-exports the agent runner, individual agents, and types for use by
 * other main-process modules.
 */

export { runAgent, isValidAgentType, isSuccessful } from './runner'
export { registerAgentHandlers } from './agent-handlers'
export { runIngestorAgent, getLatestIngestorResult } from './ingestor'
export { runDiagnosticianAgent, getLatestDiagnosticianResult } from './diagnostician'
export { runWriterAgent, getLatestWriterResult } from './writer'
export { runEditorAgent, getLatestEditorResult } from './editor'
export type { AgentType, AgentConfig, AgentResult } from './runner'
export type { IngestorOutput } from './ingestor'
export type { DiagnosticianOutput } from './diagnostician'
export type { WriterOutput, WriterSection, WriterReportSummary } from './writer'
export type { EditorOutput, EditorAnnotation, EditorRevisionPriority } from './editor'
