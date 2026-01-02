/**
 * Configuration storage for MCP server
 *
 * Stores authentication tokens and dashboard URL in user's home directory
 */
export interface MCPConfig {
    token: string;
    dashboardUrl: string;
    organizationId: number;
    organizationSlug: string;
    expiresAt: string;
}
export declare function getConfig(): MCPConfig | null;
export declare function saveConfig(config: MCPConfig): void;
export declare function clearConfig(): void;
export declare function getConfigPath(): string;
//# sourceMappingURL=config.d.ts.map