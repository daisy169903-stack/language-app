import { Capacitor, registerPlugin } from "@capacitor/core";

interface SecureUpdatesPlugin {
  getToken(): Promise<{ value: string }>;
  setToken(options: { value: string }): Promise<void>;
  clearToken(): Promise<void>;
}
const secure = registerPlugin<SecureUpdatesPlugin>("SecureUpdates");
// Browser previews never persist a credential in localStorage or the progress export.
let previewToken = "";
export async function getUpdateToken(): Promise<string> {
  return Capacitor.isNativePlatform()
    ? (await secure.getToken()).value
    : previewToken;
}
export async function setUpdateToken(value: string): Promise<void> {
  if (value.length > 1024 || /[\r\n]/.test(value))
    throw new Error("Érvénytelen token.");
  if (Capacitor.isNativePlatform()) await secure.setToken({ value });
  else previewToken = value;
}
export async function clearUpdateToken(): Promise<void> {
  if (Capacitor.isNativePlatform()) await secure.clearToken();
  else previewToken = "";
}
