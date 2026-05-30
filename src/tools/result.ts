// ABOUTME: Shared shape and constructors for MCP tool results.
// ABOUTME: Tools return ok(text) for success and err(text) for expected failures.

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}
