import { RateLimiterMemory } from "rate-limiter-flexible";

// Max. 5 Loginversuche pro IP innerhalb von 15 Minuten
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
});

export async function checkLoginRateLimit(request: Request): Promise<string | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  try {
    await loginLimiter.consume(ip);
    return null;
  } catch {
    return "Zu viele Loginversuche. Bitte 15 Minuten warten.";
  }
}
