export interface ReservationRequest {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  maxBudget: number;
  windowSeconds: number;
}

export interface CommittedTransaction {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  timestamp: number;
}

export interface Reservation {
  callId: string;
  principalId: string;
  toolName: string;
  amount: number;
  entityId?: string;
  timestamp: number;
}

export class StatefulLedger {
  // Committed transactions by principalId
  private committed: CommittedTransaction[] = [];

  // Active in-flight two-phase reservations by callId
  private reservations: Map<string, Reservation> = new Map();

  // Executed tools per entity (e.g. orderId -> Set of tool names) for anti-stacking
  private entityToolHistory: Map<string, Set<string>> = new Map();

  // Tool execution results cached in multi-turn conversation (entityId -> Map of toolName -> output)
  private toolOutputs: Map<string, Map<string, any>> = new Map();

  /**
   * Two-phase atomic reservation: checks rolling budget and reserves capacity synchronously
   * to prevent parallel tool calls from bypassing budget caps simultaneously.
   */
  checkAndReserve(req: ReservationRequest): { reserved: boolean; currentTotal: number; maxBudget: number } {
    const now = Date.now();
    const cutoff = now - req.windowSeconds * 1000;

    // Sum committed transactions within rolling window for this principal
    let currentTotal = this.committed
      .filter((t) => t.principalId === req.principalId && t.timestamp >= cutoff)
      .reduce((sum, t) => sum + t.amount, 0);

    // Sum other active in-flight reservations
    for (const [id, res] of this.reservations.entries()) {
      if (id !== req.callId && res.principalId === req.principalId && res.timestamp >= cutoff) {
        currentTotal += res.amount;
      }
    }

    if (currentTotal + req.amount > req.maxBudget) {
      return {
        reserved: false,
        currentTotal,
        maxBudget: req.maxBudget,
      };
    }

    // Atomically reserve
    this.reservations.set(req.callId, {
      callId: req.callId,
      principalId: req.principalId,
      toolName: req.toolName,
      amount: req.amount,
      entityId: req.entityId,
      timestamp: now,
    });

    return {
      reserved: true,
      currentTotal: currentTotal + req.amount,
      maxBudget: req.maxBudget,
    };
  }

  /**
   * Commit an in-flight reservation once tool execution succeeds.
   */
  commit(callId: string): void {
    const res = this.reservations.get(callId);
    if (!res) return;

    this.committed.push({
      callId: res.callId,
      principalId: res.principalId,
      toolName: res.toolName,
      amount: res.amount,
      entityId: res.entityId,
      timestamp: res.timestamp,
    });

    if (res.entityId) {
      this.recordEntityTool(res.entityId, res.toolName);
    }

    this.reservations.delete(callId);
  }

  /**
   * Rollback an in-flight reservation if tool execution fails or is aborted.
   */
  rollback(callId: string): void {
    this.reservations.delete(callId);
  }

  /**
   * Record that a mutation or action tool was executed on an entity (for anti-stacking / mutual exclusion).
   */
  recordEntityTool(entityId: string, toolName: string): void {
    if (!this.entityToolHistory.has(entityId)) {
      this.entityToolHistory.set(entityId, new Set());
    }
    this.entityToolHistory.get(entityId)!.add(toolName);
  }

  /**
   * Check if any mutually exclusive conflicting tools were already executed on this entity.
   */
  hasConflictingTool(entityId: string, conflictingTools: string[]): { hasConflict: boolean; conflictingTool?: string } {
    const history = this.entityToolHistory.get(entityId);
    if (!history) return { hasConflict: false };

    for (const tool of conflictingTools) {
      if (history.has(tool)) {
        return { hasConflict: true, conflictingTool: tool };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Cache output of a lookup or verification tool (e.g. get_order or verify_damage_report).
   */
  recordToolOutput(entityId: string, toolName: string, output: any): void {
    if (!this.toolOutputs.has(entityId)) {
      this.toolOutputs.set(entityId, new Map());
    }
    this.toolOutputs.get(entityId)!.set(toolName, output);
  }

  /**
   * Retrieve cached output for a tool on an entity.
   */
  getToolOutput(entityId: string, toolName: string): any {
    return this.toolOutputs.get(entityId)?.get(toolName);
  }

  /**
   * Clear state (useful for test resets).
   */
  reset(): void {
    this.committed = [];
    this.reservations.clear();
    this.entityToolHistory.clear();
    this.toolOutputs.clear();
  }
}
