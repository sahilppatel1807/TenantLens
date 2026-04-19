type CheckoutOk = { url: string };
type CheckoutErr = { error: string };

function parsePayload(data: unknown): CheckoutOk | CheckoutErr {
  if (typeof data !== "object" || data === null) {
    return { error: "Invalid response from server." };
  }
  const rec = data as Record<string, unknown>;
  if (typeof rec.url === "string" && rec.url.length > 0) {
    return { url: rec.url };
  }
  if (typeof rec.error === "string" && rec.error.length > 0) {
    return { error: rec.error };
  }
  return { error: "Could not start checkout." };
}

/**
 * Starts a Stripe subscription Checkout session and redirects the browser.
 * Call only from the client (uses `fetch` + `window`).
 */
export async function startSubscriptionCheckout(): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  const raw = await res.text();
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Invalid response from server."
        : `Could not start checkout (${res.status}).`,
    );
  }

  const parsed = parsePayload(data);
  if (!res.ok || "error" in parsed) {
    throw new Error("error" in parsed ? parsed.error : "Could not start checkout.");
  }

  window.location.href = parsed.url;
}
