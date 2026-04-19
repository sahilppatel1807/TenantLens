export const UPGRADE_REQUIRED_CODE = "UPGRADE_REQUIRED" as const;

export class UpgradeRequiredError extends Error {
  readonly code = UPGRADE_REQUIRED_CODE;
  constructor(
    message: string,
    readonly activePropertyCount: number,
    readonly billablePropertyCount: number,
  ) {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}

export type UpgradeRequiredPayload = {
  code: typeof UPGRADE_REQUIRED_CODE;
  message: string;
  activePropertyCount: number;
  billablePropertyCount: number;
};

export function isUpgradeRequiredPayload(v: unknown): v is UpgradeRequiredPayload {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.code === UPGRADE_REQUIRED_CODE &&
    typeof o.message === "string" &&
    typeof o.activePropertyCount === "number" &&
    typeof o.billablePropertyCount === "number"
  );
}
