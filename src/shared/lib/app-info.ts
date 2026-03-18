import { getVersion } from "@tauri-apps/api/app";

export interface AppInfo {
  name: string;
  version: string;
}

export const FALLBACK_APP_INFO: AppInfo = {
  name: __APP_NAME__,
  version: __APP_VERSION__,
};

/**
 * Falls back to build-time constants when the runtime API is unavailable.
 */
export async function loadAppInfo(): Promise<AppInfo> {
  try {
    const version = await getVersion();

    return {
      name: FALLBACK_APP_INFO.name,
      version,
    };
  } catch {
    return FALLBACK_APP_INFO;
  }
}
