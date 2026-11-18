import * as SecureStore from 'expo-secure-store';

export const SESSION_KEY = 'sg_session';

export function readSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export function writeSessionToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(SESSION_KEY, token);
}

export function clearSessionToken(): Promise<void> {
  return SecureStore.deleteItemAsync(SESSION_KEY);
}
