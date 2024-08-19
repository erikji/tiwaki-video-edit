import { randomUUID } from "crypto";

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

    add(username: string, expiration?: number): string {
        const token = randomUUID();
        this.#tokens.set(token, { username, expiration });
        return token;
    }

    renew(token: string, expiration?: number) {
        if (!this.#tokens.has(token)) return;
        this.#tokens.set(token, {...this.#tokens.get(token)!, expiration });
    }

    check(token: string): string | undefined {
        const entry = Array.from(this.#tokens.entries()).find(e => e[0] == token);
        if (!entry) return;
        else return entry[1].username;
    }

    delete(token: string): boolean {
        return this.#tokens.delete(token);
    }
}