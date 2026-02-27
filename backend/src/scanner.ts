import { SECRET_PATTERNS } from './patterns.js';
import { ExtractedFile } from './extractor.js';

export interface ScanFinding {
  secretType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  filePath: string;
  lineNumber: number;
  columnStart: number;
  rawMatch: string;       // partially redacted - plain secret never stored
  codeSnippet: string;    // source line with match redacted
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

function getShannonEntropy(value: string): number {
  if (!value) return 0;
  const freq = new Map<string, number>();
  for (const ch of value) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function shouldSuppressMatch(patternName: string, lineText: string, captureGroup: string): boolean {
  const normalizedLine = lineText.toLowerCase();
  const looksLikeComment = /^\s*(?:#|\/\/|\/\*|\*|--)/.test(lineText);
  const hasExampleHint = /\b(example|sample|dummy|test|mock|placeholder|changeme|todo)\b/.test(normalizedLine);

  if (hasExampleHint && looksLikeComment) return true;

  if (patternName === 'generic_secret') {
    if (hasExampleHint) return true;
    const normalizedSecret = captureGroup.toLowerCase();
    if (/^(password|secret|token|apikey|api_key|12345678|abcdefgh|changeme|example|test123)/.test(normalizedSecret)) {
      return true;
    }
    if (getShannonEntropy(captureGroup) < 3.2) return true;
  }

  return false;
}

function scanFileContent(content: string, filePath: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const seenMatches = new Set<string>();
  const lines = content.split('\n');

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const captureGroup = match[1] ?? match[0];

      const beforeMatch = content.slice(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) ?? []).length + 1;
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const columnStart = match.index - lastNewline;
      const lineText = lines[lineNumber - 1] ?? '';

      if (shouldSuppressMatch(pattern.name, lineText, captureGroup)) continue;

      if (pattern.name === 'private_key' && !/-----END\s(?:RSA\s|EC\s|DSA\s|OPENSSH\s)?PRIVATE KEY-----/.test(content)) {
        continue;
      }

      const dedupeKey = `${pattern.name}:${filePath}:${lineNumber}:${captureGroup}`;
      if (seenMatches.has(dedupeKey)) continue;
      seenMatches.add(dedupeKey);

      const redactedMatch = redactMatch(captureGroup);
      const escapedMatch = captureGroup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const redactedLine = lineText.replace(new RegExp(escapedMatch, 'g'), redactedMatch);

      findings.push({
        secretType: pattern.secretType,
        severity: pattern.severity,
        filePath,
        lineNumber,
        columnStart,
        rawMatch: redactedMatch,  // plain secret never leaves this function
        codeSnippet: redactedLine.trim() || '[line unavailable]',
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
