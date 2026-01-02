/**
 * HTTP Client for E2E Dashboard MCP API
 *
 * Makes authenticated requests to the dashboard's MCP endpoint
 */
export class MCPClient {
    config;
    requestId = 0;
    constructor(config) {
        this.config = config;
    }
    async callTool(name, args) {
        const request = {
            jsonrpc: "2.0",
            id: ++this.requestId,
            method: "tools/call",
            params: {
                name,
                arguments: args,
            },
        };
        const response = await this.makeRequest(request);
        if (response.error) {
            return {
                content: [{ type: "text", text: JSON.stringify({ error: response.error.message }) }],
                isError: true,
            };
        }
        const result = response.result;
        return {
            content: result.content || [{ type: "text", text: JSON.stringify(result) }],
            isError: result.isError,
        };
    }
    async listTools() {
        const request = {
            jsonrpc: "2.0",
            id: ++this.requestId,
            method: "tools/list",
        };
        const response = await this.makeRequest(request);
        if (response.error) {
            throw new Error(response.error.message);
        }
        const result = response.result;
        return result.tools || [];
    }
    async makeRequest(request) {
        const url = `${this.config.dashboardUrl}/api/mcp`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.token}`,
                },
                body: JSON.stringify(request),
            });
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Authentication expired. Please run with --login to re-authenticate.");
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("fetch")) {
                throw new Error(`Failed to connect to dashboard at ${url}. Please check your internet connection.`);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=client.js.map