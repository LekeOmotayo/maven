/**
 * Review Controller for handling REST API requests.
 */

import { IncomingMessage, ServerResponse } from 'http';
import { ReviewService } from '../services/reviewService';
import { SeverityLevel } from '../types';

export class ReviewController {
  private service: ReviewService;

  constructor(service: ReviewService) {
    this.service = service;
  }

  public async handleSimulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseJsonBody(req);
      const diffText = body.diff || body.diffText || '';
      const filename = body.filename || 'src/index.ts';
      const enablePiiScrubbing = body.enablePiiScrubbing !== false;
      const enableInjectionDefense = body.enableInjectionDefense !== false;
      const minSeverity = (body.minSeverity as SeverityLevel) || 'LOW';

      const result = await this.service.executeReview({
        diffText,
        filename,
        enablePiiScrubbing,
        enableInjectionDefense,
        minSeverity,
        isMockMode: true,
      });

      this.sendJson(res, 200, { success: true, ...result });
    } catch (err: any) {
      this.sendJson(res, 400, { success: false, error: err.message || 'Invalid request' });
    }
  }

  public handleListAudits(req: IncomingMessage, res: ServerResponse): void {
    const records = this.service.getAuditRepo().listAll();
    this.sendJson(res, 200, { audits: records });
  }

  public handleHealth(req: IncomingMessage, res: ServerResponse): void {
    this.sendJson(res, 200, {
      status: 'ok',
      service: '@lekeomotayo/deep-code-review-action',
      version: '1.0.0',
      port: 8095,
    });
  }

  private parseJsonBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error('Malformed JSON'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: ServerResponse, statusCode: number, data: any): void {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(payload);
  }
}
