import fs from "fs/promises"
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SALT_ROUNDS = 10; // ~10 hashes/sec

/**
 * Manage storing of logins through txt files. None of the functions verify if the user is allowed to perform an action
 */
export class Database {
    #logins = new Map<string, string>(); //key: username, value: password

    constructor() {
        this.readLogins();
    }

    async readLogins() {
        const data = await fs.readFile(path.join(__dirname, '../database/logins.txt'));
        const userPass = data.toString().trim().split('\n');
        if (userPass.length % 2 != 0) throw new Error('Malformed logins txt');
        for (let index = 0; index < userPass.length; index += 2) {
            this.#logins.set(userPass[0], userPass[1]);
        }
    }
    async writeLogins() {
        await fs.writeFile(path.join(__dirname, '../database/logins.txt'), Array.from(this.#logins).flat().join('\n'));
        return true;
    }

    async createAccount(username: string, plaintextPassword: string) {
        const hashPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
        this.#logins.set(hashPassword, username);
        await this.writeLogins();
    }
    async checkAccount(username: string, plaintextPassword: string): Promise<boolean> {
        if (!this.#logins.has(username)) return false;
        return await bcrypt.compare(plaintextPassword, this.#logins.get(username)!);
    }
    async deleteAccount(username: string, plaintextPassword: string) {
        return await this.checkAccount(username, plaintextPassword) && this.#logins.delete(username) && await this.writeLogins();
    }
}