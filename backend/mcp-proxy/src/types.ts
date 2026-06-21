export type ResourceType = 'file' | 'endpoint' | 'any';
export type Action = 'read' | 'write' | 'delete' | 'any';
export type Effect = 'allow' | 'deny';

export interface Rule {
  resourceType: ResourceType;
  pattern: string;   // glob — matched against the resource path or tool argument
  action: Action;
  effect: Effect;
  priority: number;  // higher wins; deny beats allow at same priority
  comment?: string;  // human-readable note, ignored by engine
}

export interface Config {
  // Maps a tool name + argument key to a resource for rule matching.
  // If a tool has no mapping → denied by default (fail-closed).
  toolMappings: ToolMapping[];
  rules: Rule[];
}

export interface ToolMapping {
  // The MCP tool name, e.g. "read_file"
  tool: string;
  // Which argument holds the resource path, e.g. "path"
  pathArg: string;
  // What type of resource this is
  resourceType: ResourceType;
  // What action this tool performs
  action: Action;
}

export interface Decision {
  effect: 'allowed' | 'denied';
  reason: string;
  rule: Rule | null;  // which rule matched (null = no match = default deny)
}
