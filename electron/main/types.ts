// src/main/types.ts
export interface PythonInstallation {
  installed: boolean
  version: string | null
  command: string | null
}

export interface PythonExecutionResult {
  success: boolean
  result?: string
  error?: string
  logs?: string[]
  executionTime?: number
  rawOutput?: string
}

export interface PythonPackageInfo {
  name: string
  version: string
}