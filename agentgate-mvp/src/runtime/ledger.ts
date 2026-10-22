export interface RecordedCall {
  callId: string;
  sessionId: string;
  principalId: string;
  toolName: string;
  args: Record<string, any>;
  output: Record<string, any>;
  timestampMs: number;
}

export interface PendingReservation {
  principalId: string;
  toolName: string;
  args: Record<string, any>;
  amountReserved: number;
  scopeEntityKey?: string;
  timestampMs: number;
}

export class StatefulLedger {
  recordedCalls: RecordedCall[] = [];
  pendingReservations: Map<string, PendingReservation> = new Map();

  recordReadOutput(
    sessionId: string,
    principalId: string,
    toolName: string,
    args: Record<string, any>,
    output: Record<string, any>,
    timestampMs?: number
  ): void {
    const callId = `read_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.recordedCalls.push({
      callId,
      sessionId,
      principalId,
      toolName,
      args,
      output,
      timestampMs: timestampMs ?? Date.now(),
    });
  }

  findPriorOutput(
    sessionId: string,
    toolName: string,
    matchArgKey: string,
    matchArgValue: any
  ): Record<string, any> | undefined {
    // Search backward to return the latest matching output in this session
    for (let i = this.recordedCalls.length - 1; i >= 0; i--) {
      const call = this.recordedCalls[i];
      if (
        call.sessionId === sessionId &&
        call.toolName === toolName &&
        call.args[matchArgKey] === matchArgValue
      ) {
        return call.output;
      }
    }
    return undefined;
  }

  hasConflictingMutation(
    conflictingTools: string[],
    scopeKey: string,
    scopeValue: any
  ): boolean {
    if (scopeValue === undefined || scopeValue === null) {
      return false;
    }

    // 1. Check committed calls across ALL sessions
    for (const call of this.recordedCalls) {
      if (
        conflictingTools.includes(call.toolName) &&
        call.args[scopeKey] === scopeValue
      ) {
        return true;
      }
    }

    // 2. Check pending reservations across ALL sessions
    for (const res of this.pendingReservations.values()) {
      if (
        conflictingTools.includes(res.toolName) &&
        res.args[scopeKey] === scopeValue
      ) {
        return true;
      }
    }

    return false;
  }

  getPrincipalSpend(
    principalId: string,
    sharedTools: string[],
    argField: string,
    windowSeconds: number,
    nowMs: number
  ): number {
    const windowStartMs = nowMs - windowSeconds * 1000;
    let total = 0;

    // 1. Sum committed calls for principal within rolling window
    for (const call of this.recordedCalls) {
      if (
        call.principalId === principalId &&
        sharedTools.includes(call.toolName) &&
        call.timestampMs >= windowStartMs
      ) {
        const val = Number(call.args[argField]) || 0;
        total += val;
      }
    }

    // 2. Sum active pending reservations
    for (const res of this.pendingReservations.values()) {
      if (
        res.principalId === principalId &&
        sharedTools.includes(res.toolName) &&
        res.timestampMs >= windowStartMs
      ) {
        total += res.amountReserved;
      }
    }

    return total;
  }

  createReservation(
    callId: string,
    reservationData: PendingReservation
  ): void {
    this.pendingReservations.set(callId, reservationData);
  }

  commitReservation(callId: string, output: Record<string, any>): void {
    const pending = this.pendingReservations.get(callId);
    if (!pending) return;

    this.pendingReservations.delete(callId);
    this.recordedCalls.push({
      callId,
      sessionId: pending.args.sessionId ?? "default",
      principalId: pending.principalId,
      toolName: pending.toolName,
      args: pending.args,
      output,
      timestampMs: pending.timestampMs,
    });
  }

  rollbackReservation(callId: string): void {
    this.pendingReservations.delete(callId);
  }
}
