export interface LockStore {
  set(key: string, value: string, expiryMs: number, onlyIfMissing: true): Promise<"OK" | null>;
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
}
const RELEASE_IF_OWNER = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const RENEW_IF_OWNER = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
export class AccountLease {
  private constructor(private readonly redis: LockStore, private readonly key: string, private readonly token: string, private readonly ttlMs: number) {}
  static async acquire(redis: LockStore, accountId: string, token: string, ttlMs = 60_000): Promise<AccountLease | null> {
    const key = `account-operation:${accountId}`;
    const ok = await redis.set(key, token, ttlMs, true);
    return ok ? new AccountLease(redis, key, token, ttlMs) : null;
  }
  async renew(): Promise<boolean> { return Number(await this.redis.eval(RENEW_IF_OWNER, 1, this.key, this.token, String(this.ttlMs))) === 1; }
  async release(): Promise<void> { await this.redis.eval(RELEASE_IF_OWNER, 1, this.key, this.token); }
}
