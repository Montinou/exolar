/**
 * Configuration storage for MCP server
 *
 * Stores authentication tokens and dashboard URL in user's home directory
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
const CONFIG_DIR = path.join(os.homedir(), ".e2e-dashboard-mcp");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
export function getConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            return null;
        }
        const data = fs.readFileSync(CONFIG_FILE, "utf-8");
        const config = JSON.parse(data);
        // Check if token is expired
        if (new Date(config.expiresAt) < new Date()) {
            console.error("Token has expired. Please run with --login to re-authenticate.");
            return null;
        }
        return config;
    }
    catch (error) {
        console.error("Failed to read config:", error);
        return null;
    }
}
export function saveConfig(config) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    }
    catch (error) {
        console.error("Failed to save config:", error);
        throw error;
    }
}
export function clearConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
    }
    catch (error) {
        console.error("Failed to clear config:", error);
    }
}
export function getConfigPath() {
    return CONFIG_FILE;
}
//# sourceMappingURL=config.js.map