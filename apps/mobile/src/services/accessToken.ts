import * as SecureStore from "expo-secure-store";


const ACCESS_TOKEN_KEY = "aivision_access_token";
const LEGACY_ACCESS_TOKEN_KEY = "doi_mat_ai_access_token";


export async function getAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) return token;

  const legacyToken = await SecureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  if (!legacyToken) return null;

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacyToken);
  await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  return legacyToken;
}


export async function saveAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token.trim());
}


export async function clearAccessToken(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
  ]);
}
