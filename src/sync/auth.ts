import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = '177937117872-1veq1rbbpvt8p04coso76kuup7avv5fn.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DEVELOPER_ERROR = '10';

export type Account = { email: string; name: string | null };

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
}

const toAccount = ({ user }: User): Account => ({ email: user.email, name: user.name });

export function describeAuthError(e: unknown): string {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'На телефоне нет или устарели сервисы Google Play.';
    if (e.code === DEVELOPER_ERROR)
      return 'Google не узнал приложение. Проверь в Google Cloud Android-клиент: пакет dev.akiradude.plenka и SHA-1 ключа из EAS.';
    if (e.code === statusCodes.SIGN_IN_REQUIRED) return 'Нужно заново войти в Google.';
  }
  return e instanceof Error ? e.message : String(e);
}

export async function connect(): Promise<Account | null> {
  configure();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  return isSuccessResponse(response) ? toAccount(response.data) : null;
}

export async function currentAccount(): Promise<Account | null> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const cached = GoogleSignin.getCurrentUser();
  if (cached) return toAccount(cached);
  const response = await GoogleSignin.signInSilently();
  return response.type === 'success' ? toAccount(response.data) : null;
}

export async function accessToken(): Promise<string | null> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const response = await GoogleSignin.signInSilently();
  if (response.type !== 'success') return null;
  return (await GoogleSignin.getTokens()).accessToken;
}

export async function dropToken(token: string): Promise<void> {
  await GoogleSignin.clearCachedAccessToken(token);
}

export async function disconnect(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
}
