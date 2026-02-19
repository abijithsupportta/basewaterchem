/**
 * Pure business logic for complaint resolution.
 * Framework-independent, easily testable.
 */
export class ComplaintRules {
  /**
   * Build the resolution payload
   */
  static buildResolutionPayload(resolutionNotes: string) {
    return {
      status: 'resolved' as const,
      resolved_date: new Date().toISOString(),
      resolution_notes: resolutionNotes,
    };
  }
}
