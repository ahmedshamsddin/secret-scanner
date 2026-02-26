import { SECRET_PATTERNS } from './patterns.js';
import { ExtractedFile } from './extractor.js';

export interface ScanFinding {
  secretType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  filePath: string;
  lineNumber: number;
  columnStart: number;
  rawMatch: string;       // partially redacted - plain secret never stored
  patternName: string;
  description: string;
  remediation: string;
}

export interface ScanResult {
  findings: ScanFinding[];
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scannedFiles: number;
  scannedLines: number;
}

function redactMatch(match: string): string {
  if (match.length <= 10) return '***REDACTED***';
  return `${match.slice(0, 4)}${'*'.repeat(Math.min(match.length - 8, 20))}${match.slice(-4)}`;
}

function scanFileContent(content: string, filePath: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const seenMatches = new Set<string>();

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const captureGroup = match[1] ?? match[0];

      const beforeMatch = content.slice(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) ?? []).length + 1;
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const columnStart = match.index - lastNewline;

      const dedupeKey = `${pattern.name}:${filePath}:${lineNumber}:${captureGroup}`;
      if (seenMatches.has(dedupeKey)) continue;
      seenMatches.add(dedupeKey);

      findings.push({
        secretType: pattern.secretType,
        severity: pattern.severity,
        filePath,
        lineNumber,
        columnStart,
        rawMatch: redactMatch(captureGroup),  // plain secret never leaves this function
        patternName: pattern.name,
        description: pattern.description,
        remediation: pattern.remediation,
      });
    }

    pattern.regex.lastIndex = 0;
  }

  return findings;
}

export function scanFiles(files: ExtractedFile[]): ScanResult {
  const allFindings: ScanFinding[] = [];
  let totalLines = 0;

  for (const file of files) {
    const fileFindings = scanFileContent(file.content, file.filePath);
    allFindings.push(...fileFindings);
    totalLines += file.content.split('\n').length;
  }

  // Sort by severity → file path → line number
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allFindings.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
    return a.lineNumber - b.lineNumber;
  });

  return {
    findings: allFindings,
    totalFindings: allFindings.length,
    criticalCount: allFindings.filter(f => f.severity === 'critical').length,
    highCount: allFindings.filter(f => f.severity === 'high').length,
    mediumCount: allFindings.filter(f => f.severity === 'medium').length,
    lowCount: allFindings.filter(f => f.severity === 'low').length,
    scannedFiles: files.length,
    scannedLines: totalLines,
  };
}
