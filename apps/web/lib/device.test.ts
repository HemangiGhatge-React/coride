import { describe, expect, it } from "vitest";
import { describeDevice } from "./device";

const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  chromeLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  operaWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
};

describe("describeDevice: browsers", () => {
  it.each([
    [UA.chromeWindows, "Chrome on Windows"],
    [UA.edgeWindows, "Edge on Windows"], // contains "Chrome" and "Safari" too
    [UA.operaWindows, "Opera on Windows"],
    [UA.firefoxWindows, "Firefox on Windows"],
    [UA.firefoxLinux, "Firefox on Linux"],
    [UA.safariMac, "Safari on Mac"],
    [UA.chromeMac, "Chrome on Mac"],
    [UA.safariIphone, "Safari on iPhone"], // contains "Mac OS X"
    [UA.chromeIphone, "Chrome on iPhone"], // CriOS
    [UA.safariIpad, "Safari on iPad"],
    [UA.chromeAndroid, "Chrome on Android"], // contains "Linux"
    [UA.chromeLinux, "Chrome on Linux"],
  ])("%s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });
});

describe("describeDevice: the CoRide mobile app", () => {
  it.each([
    ["CoRide/1.0 (Android 15; Pixel 8)", "CoRide Android app"],
    ["CoRide/1.0 (iOS 18.0; iPhone15,2)", "CoRide iOS app"],
    ["coride/1 CFNetwork/1568.100.1 Darwin/24.0.0", "CoRide iOS app"], // React Native's iOS default
    ["CoRide/2.3", "CoRide app"],
    ["okhttp/4.9.2", "Android app"], // React Native's Android default
    ["MyOtherApp/7 CFNetwork/1568.100.1 Darwin/24.0.0", "iOS app"],
  ])("%s", (ua, label) => {
    expect(describeDevice(ua)).toBe(label);
  });
});

describe("describeDevice: fallbacks", () => {
  it.each([[null], [undefined], [""], ["   "], ["curl/8.4.0"], ["PostmanRuntime/7.39.0"], ["Mozilla/5.0"], ["x".repeat(300)]])(
    "%j is an unknown device",
    (ua) => {
      expect(describeDevice(ua as string | null | undefined)).toBe("Unknown device");
    },
  );

  it("names the browser alone when the OS cannot be told", () => {
    expect(describeDevice("Mozilla/5.0 (Unknown) Gecko/20100101 Firefox/131.0")).toBe("Firefox");
  });
});
