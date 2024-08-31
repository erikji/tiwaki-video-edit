import { randomUUID } from "crypto";

/**
 * Simple token handler
 */
export class LoginManager {
    readonly #tokens = new Map<string, { username: string, expiration?: number }>();

    constructor() {
        setInterval(() => {
            for (const [token, data] of this.#tokens) {
                if (data.expiration && data.expiration < Date.now()) {
                    this.#tokens.delete(token);
                }
            }
        }, 1000);
    }
    
    /**
     * Add token
     * @param {string} username username to generate token for
     * @param {number} expiration expiration UNIX timestamp, in ms
     * @returns {string} the generated token
     */
    add(username: string, expiration?: number): string {
        const token = randomUUID();
        this.#tokens.set(token, { username, expiration });
        return token;
    }

    /**
     * Renew token
     * @param {string} token The token to renew
     * @param {number} expiration new expiration UNIX timestamp, in ms
     * @returns {boolean} true if a token existed and has been renewed, or false if the token does not exist.
     */
    renew(token: string, expiration?: number): boolean {
        if (!this.#tokens.has(token)) return false;
        this.#tokens.set(token, {...this.#tokens.get(token)!, expiration });
        return true;
    }

    /**
     * Check if a token exists
     * @param {string} token The token to check
     * @returns {string | undefined} If the token exists, return the username associated with the token, otherwise return undefined
     */
    check(token: string): string | undefined {
        const entry = Array.from(this.#tokens.entries()).find(e => e[0] == token);
        if (!entry) return;
        else return entry[1].username;
    }

    /**
     * Delete a token
     * @param {string} token The token to delete
     * @returns {boolean} true if a token existed and has been removed, or false if the token does not exist.
     */
    delete(token: string): boolean {
        return this.#tokens.delete(token);
    }
}