export type RecoveryDecision = "RETRY_TRANSIENT" | "WAIT_FOR_HUMAN" | "MARK_UNCERTAIN" | "DO_NOT_RETRY";
const transientCodes = new Set(["BROWSER_CRASH_BEFORE_SUBMIT", "NETWORK_BEFORE_SUBMIT", "WORKER_LOST_BEFORE_SUBMIT"]);
const humanCodes = new Set(["TWO_FACTOR", "CAPTCHA", "LOGIN_CONFIRMATION", "ACCOUNT_RESTRICTION"]);
export function recoveryDecision(code: string, submitMayHaveReachedInstagram: boolean): RecoveryDecision {
  if (humanCodes.has(code)) return "WAIT_FOR_HUMAN";
  if (submitMayHaveReachedInstagram) return "MARK_UNCERTAIN";
  if (transientCodes.has(code)) return "RETRY_TRANSIENT";
  return "DO_NOT_RETRY";
}
