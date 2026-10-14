import crypto from 'crypto';

type CallRecord = {
  toolName: string;
  argsHash: string;
  timestamp: number;
};

type CircuitBreakerConfig = {
  maxConsecutiveIdenticalCalls: number; // e.g. 4
  maxCallsPerMinute: number;            // e.g. 30
};

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxConsecutiveIdenticalCalls: 4,
  maxCallsPerMinute: 30,
};

class CircuitBreakerManager {
  private history: Map<string, CallRecord[]> = new Map();

  private hashArgs(args: Record<string, unknown>): string {
    const sorted = Object.keys(args).sort().map(k => `${k}:${JSON.stringify(args[k])}`).join('|');
    return crypto.createHash('md5').update(sorted).digest('hex');
  }

  /**
   * Check if a tool execution trips the loop / circuit breaker.
   */
  public check(
    sessionId: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    config: CircuitBreakerConfig = DEFAULT_CONFIG
  ): { tripped: boolean; reason?: string } {
    const now = Date.now();
    const argsHash = this.hashArgs(toolArgs);

    let sessionCalls = this.history.get(sessionId) ?? [];
    // Clean entries older than 60 seconds
    sessionCalls = sessionCalls.filter(c => now - c.timestamp < 60_000);

    // 1. Rate check: Calls per minute
    if (sessionCalls.length >= config.maxCallsPerMinute) {
      return {
        tripped: true,
        reason: `Rate limit exceeded: Session made ${sessionCalls.length} tool calls in the last 60 seconds (max allowed: ${config.maxCallsPerMinute}). Execution halted.`,
      };
    }

    // 2. Loop check: Consecutive identical tool calls
    const recentIdentical = sessionCalls.slice(-config.maxConsecutiveIdenticalCalls);
    if (
      recentIdentical.length === config.maxConsecutiveIdenticalCalls &&
      recentIdentical.every(c => c.toolName === toolName && c.argsHash === argsHash)
    ) {
      return {
        tripped: true,
        reason: `Runaway loop detected: Tool "${toolName}" was called ${config.maxConsecutiveIdenticalCalls + 1} consecutive times with identical arguments. Execution halted to protect downstream services and token budget.`,
      };
    }

    // Record call
    sessionCalls.push({ toolName, argsHash, timestamp: now });
    this.history.set(sessionId, sessionCalls);

    return { tripped: false };
  }

  /**
   * Reset circuit breaker state for a session (e.g. after human manual approval or reset)
   */
  public reset(sessionId: string): void {
    this.history.delete(sessionId);
  }
}

export const circuitBreaker = new CircuitBreakerManager();
