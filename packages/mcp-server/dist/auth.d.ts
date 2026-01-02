/**
 * OAuth-style authentication flow for MCP server
 *
 * Opens browser for user to authenticate, then receives token via local callback
 */
import { type MCPConfig } from "./config.js";
interface AuthResult {
    success: boolean;
    config?: MCPConfig;
    error?: string;
}
export declare function authenticate(dashboardUrl?: string): Promise<AuthResult>;
export {};
//# sourceMappingURL=auth.d.ts.map