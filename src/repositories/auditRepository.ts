/**
 * Audit Repository for recording code review operations and security metrics.
 */

import { ReviewSummary, ReviewComment } from '../types';

export interface AuditRecord {
  id: string;
  timestamp: string;
  filesCount: number;
  findingsCount: number;
  redactionsCount: number;
  injectionDetected: boolean;
  status: 'PASSED' | 'FLAGGED' | 'BLOCKED';
  summary: ReviewSummary;
  comments: ReviewComment[];
}

export class AuditRepository {
  private records: Map<string, AuditRecord> = new Map();

  public save(record: AuditRecord): AuditRecord {
    this.records.set(record.id, record);
    return record;
  }

  public getById(id: string): AuditRecord | undefined {
    return this.records.get(id);
  }

  public listAll(): AuditRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public clear(): void {
    this.records.clear();
  }
}
