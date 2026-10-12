/**
 * A short, human label for a session's User-Agent: "Chrome on Windows", "Safari on iPhone",
 * "CoRide Android app", or "Unknown device" when there is nothing usable (old sessions have none).
 * Order matters: many browsers' user agents contain other browsers' names (Edge and Opera say
 * Chrome, Chrome says Safari), and iPhone/Android user agents contain Mac OS X/Linux.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "Unknown device";

  // The CoRide mobile app, once it sends a CoRide/<version> User-Agent. React Native's default on
  // iOS is also "<app name>/<build> CFNetwork/<n> Darwin/<n>", so that form is recognised too.
  if (/^CoRide\//i.test(ua)) {
    if (/Android/i.test(ua)) return "CoRide Android app";
    if (/\biOS\b|iPhone|iPad|CFNetwork|Darwin/i.test(ua)) return "CoRide iOS app";
    return "CoRide app";
  }
  // React Native's default HTTP stacks, which is what the mobile app sends today.
  if (/^okhttp\//i.test(ua)) return "Android app";
  if (/CFNetwork/i.test(ua)) return "iOS app";

  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(ua)
        ? "Firefox"
        : /CriOS\/|Chrome\//.test(ua)
          ? "Chrome"
          : /Version\/[\d.]+.*Safari\//.test(ua)
            ? "Safari"
            : null;

  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux|X11/.test(ua)
                ? "Linux"
                : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? "Unknown device";
}
