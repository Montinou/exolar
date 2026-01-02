/**
 * HTTP Client for E2E Dashboard MCP API
 *
 * Makes authenticated requests to the dashboard's MCP endpoint
 */
import type { MCPConfig } from "./config.js";
export declare class MCPClient {
    private config;
    private requestId;
    constructor(config: MCPConfig);
    callTool(name: string, args: Record<string, unknown>): Promise<{
        content: Array<{
            type: "text";
            text: string;
        }>;
        isError?: boolean;
    }>;
    listTools(): Promise<Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>>;
    private makeRequest;
}
//# sourceMappingURL=client.d.ts.map