import { setDiscoveredYacineConfig } from "./yacine-config.server";

// These are public mobile-client identifiers from the working APK, not server
// credentials. They let the website read the same client Remote Config that
// the Android app uses to rotate the API and stream hosts.
const FIREBASE_API_KEY = "AIzaSyDRKL14PPiXzk7qNUNLgV2IsjasxNpWLeU";
const FIREBASE_PROJECT_NUMBER = "692330584196";
const FIREBASE_APP_ID = "1:692330584196:android:68ea9f0c920aa17904cad1";
const ANDROID_PACKAGE = "ver3.ycntivi.ofg";
const DISCOVERY_TTL = 6 * 60 * 60_000;

let expiresAt = 0;
let pending: Promise<void> | null = null;

function host(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const candidate = value.trim();
    const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : "https://" + candidate);
    if (parsed.protocol !== "https:") return null;
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function discoverOnce(): Promise<void> {
  const installationsUrl =
    "https://firebaseinstallations.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_NUMBER +
    "/installations";
  const installation = await fetch(installationsUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": FIREBASE_API_KEY },
    body: JSON.stringify({ appId: FIREBASE_APP_ID, authVersion: "FIS_v2", sdkVersion: "a:17.0.0" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!installation.ok) throw new Error("Firebase Installations returned " + installation.status);
  const installationJson = (await installation.json()) as { fid?: string; authToken?: { token?: string } };
  if (!installationJson.fid || !installationJson.authToken?.token) throw new Error("Firebase installation token missing");

  const remoteConfigUrl =
    "https://firebaseremoteconfig.googleapis.com/v1/projects/" +
    FIREBASE_PROJECT_NUMBER +
    "/namespaces/firebase:fetch";
  const remoteConfig = await fetch(remoteConfigUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": FIREBASE_API_KEY,
      "x-android-package": ANDROID_PACKAGE,
    },
    body: JSON.stringify({
      appId: FIREBASE_APP_ID,
      appInstanceId: installationJson.fid,
      appInstanceIdToken: installationJson.authToken.token,
      countryCode: "US",
      languageCode: "en-US",
      platformVersion: "34",
      packageName: ANDROID_PACKAGE,
      appVersion: "3.1",
      appBuild: "4",
      sdkVersion: "21.6.2",
      analyticsUserProperties: {},
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!remoteConfig.ok) throw new Error("Firebase Remote Config returned " + remoteConfig.status);
  const json = (await remoteConfig.json()) as { entries?: Record<string, unknown> };
  const apiUrl = host(json.entries?.defaults);
  const streamUrl = host(json.entries?.tv_defaults);
  if (!apiUrl && !streamUrl) throw new Error("Firebase Remote Config contained no Yacine hosts");

  setDiscoveredYacineConfig(apiUrl ?? undefined, streamUrl ?? undefined);
}

/** Refreshes the app's upstream hosts periodically, without a redeploy. */
export async function discoverYacineConfig(): Promise<void> {
  if (Date.now() < expiresAt) return;
  if (!pending) {
    pending = discoverOnce()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[auratv] Yacine config discovery failed:", message.slice(0, 300));
      })
      .finally(() => {
        expiresAt = Date.now() + DISCOVERY_TTL;
        pending = null;
      });
  }
  await pending;
}
