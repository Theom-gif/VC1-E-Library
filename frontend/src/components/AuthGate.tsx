import {FormEvent, ReactNode, useState} from 'react';
import {ArrowRight, BookOpen, Eye, EyeOff, Lock, Mail} from 'lucide-react';
import authService from '../service/authService';
import {isAuthRequired, setAuthRequired, setMembershipTier} from '../utils/readerUpgrade';

type RoleName = 'user' | 'author' | 'admin';

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  memberSince?: string;
};

type AuthGateProps = {
  children: (props: {
    user: SessionUser;
    logout: () => void;
    login: (payload: {email: string; password: string; role?: RoleName}) => Promise<void>;
    register: (payload: {
      firstname: string;
      lastname: string;
      email: string;
      password: string;
      password_confirmation: string;
      role: RoleName;
    }) => Promise<void>;
  }) => ReactNode;
};

const SESSION_KEY = 'elibrary_session';
const LOGOUT_TOKEN_KEY = 'elibrary_last_token';
const FORCE_LOGIN_KEY = 'elibrary_force_login';
const AUTO_LOGIN_BYPASS = String((import.meta as any)?.env?.VITE_AUTO_LOGIN_BYPASS || '').trim().toLowerCase() === 'true';
const ALLOW_GUEST = String((import.meta as any)?.env?.VITE_ALLOW_GUEST ?? 'true').trim().toLowerCase() !== 'false';
function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // ignore (storage may be unavailable, e.g. file:// or blocked)
  }
}

function safeLocalStorageRemove(key: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeSessionStorageGet(key: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeSessionStorageRemove(key: string) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readSession(): SessionUser | null {
  const raw = safeLocalStorageGet(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function saveSession(user: SessionUser) {
  safeLocalStorageSet(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  safeLocalStorageRemove(SESSION_KEY);
}

function shouldForceLogin(): boolean {
  return String(safeSessionStorageGet(FORCE_LOGIN_KEY) || '') === 'true';
}

function setForceLogin(value: boolean) {
  if (value) safeSessionStorageSet(FORCE_LOGIN_KEY, 'true');
  else safeSessionStorageRemove(FORCE_LOGIN_KEY);
}

function createGuestSession(): SessionUser {
  return {
    id: 'guest',
    name: 'Library User',
    email: 'guest@local',
    role: 'user',
  };
}

function isGuestUser(user: SessionUser | null): boolean {
  return Boolean(user && user.id === 'guest');
}

function normalizeRole(role: unknown): RoleName {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (normalized === '1' || normalized === 'admin' || normalized === 'administrator') return 'admin';
  if (normalized === '2' || normalized === 'author') return 'author';
  return 'user';
}

function roleIdFromRole(role: RoleName): number {
  if (role === 'admin') return 1;
  if (role === 'author') return 2;
  return 3;
}

function titleRole(role: RoleName): string {
  if (role === 'admin') return 'Admin';
  if (role === 'author') return 'Author';
  return 'User';
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function pickDateString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized) continue;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}

function extractErrorText(error: any, fallback: string): string {
  const errors = error?.data?.errors;
  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (messages.length) return messages.slice(0, 3).join(' ');
  }
  return error?.data?.message || error?.data?.error || error?.message || fallback;
}

function isRoleValidationError(error: any): boolean {
  const status = Number(error?.status || 0);
  if (status < 400 || status >= 500) return false;
  const text = `${error?.message || ''} ${error?.data?.message || ''}`.toLowerCase();
  return text.includes('role');
}

function toSessionUser(
  data: any,
  fallbackEmail: string,
  selectedRole: RoleName = 'user',
  fallbackMemberSince?: string,
): SessionUser {
  const backendUser = data?.user || data?.data?.user || data?.profile || data?.data?.profile || data || {};
  const first = pickString(backendUser?.firstname, backendUser?.first_name);
  const last = pickString(backendUser?.lastname, backendUser?.last_name);
  const role = normalizeRole(
    backendUser?.role ??
      backendUser?.role_name ??
      backendUser?.role_id ??
      data?.role ??
      data?.role_name ??
      data?.role_id ??
      selectedRole,
  );
  return {
    id: pickString(backendUser?.id, backendUser?.user_id, backendUser?._id, `u_${Date.now()}`),
    name: pickString(backendUser?.name, backendUser?.full_name, `${first} ${last}`.trim(), fallbackEmail.split('@')[0], 'User'),
    email: pickString(backendUser?.email, fallbackEmail).toLowerCase(),
    role,
    memberSince: pickDateString(
      backendUser?.member_since,
      backendUser?.registered_at,
      backendUser?.created_at,
      backendUser?.joined_at,
      backendUser?.createdAt,
      data?.member_since,
      data?.registered_at,
      data?.created_at,
      data?.joined_at,
      fallbackMemberSince,
    ),
  };
}

async function loginWithFallbacks(payload: {email: string; password: string; role?: RoleName}) {
  const attempts = [
    ...(payload.role
      ? [
          {email: payload.email, password: payload.password, role: payload.role, role_id: roleIdFromRole(payload.role)},
          {email: payload.email, password: payload.password, role: titleRole(payload.role)},
          {email: payload.email, password: payload.password, role_id: roleIdFromRole(payload.role)},
        ]
      : []),
    {email: payload.email, password: payload.password},
  ];
  let lastRoleError: any = null;
  for (const attempt of attempts) {
    try {
      return await authService.login(attempt);
    } catch (error: any) {
      if (!isRoleValidationError(error)) throw error;
      lastRoleError = error;
    }
  }
  throw lastRoleError || new Error('Login failed.');
}

async function registerWithFallbacks(payload: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: RoleName;
}) {
  const basePayload = {
    firstname: payload.firstname,
    lastname: payload.lastname,
    name: `${payload.firstname} ${payload.lastname}`.trim(),
    email: payload.email,
    password: payload.password,
    password_confirmation: payload.password_confirmation,
    confirm_password: payload.password_confirmation,
  };
  const attempts = [
    {...basePayload, role: payload.role, role_id: roleIdFromRole(payload.role)},
    {...basePayload, role: titleRole(payload.role), role_id: roleIdFromRole(payload.role)},
    {...basePayload, role_id: roleIdFromRole(payload.role)},
    {...basePayload, role: payload.role},
    basePayload,
  ];
  let lastRoleError: any = null;
  for (const attempt of attempts) {
    try {
      return await authService.register(attempt);
    } catch (error: any) {
      if (!isRoleValidationError(error)) throw error;
      lastRoleError = error;
    }
  }
  throw lastRoleError || new Error('Registration failed.');
}

export default function AuthGate({children}: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => {
    const stored = readSession();
    if (stored && !isGuestUser(stored)) return stored;
    if (shouldForceLogin()) {
      clearSession();
      return null;
    }
    if (stored && isGuestUser(stored)) return stored;
    if (AUTO_LOGIN_BYPASS || ALLOW_GUEST) {
      setAuthRequired(false);
      setForceLogin(false);
      const guest = createGuestSession();
      saveSession(guest);
      return guest;
    }
    if (isAuthRequired()) {
      clearSession();
      return null;
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({email: '', password: '', remember: false});
  const [registerForm, setRegisterForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    password_confirmation: '',
    agree: false,
  });

  const logout = () => {
    const token = authService.getToken();
    if (token) {
      safeLocalStorageSet(LOGOUT_TOKEN_KEY, token);
    }
    authService.clearToken();
    clearSession();
    setMembershipTier('normal');
    if (ALLOW_GUEST) {
      setAuthRequired(false);
      setForceLogin(false);
      const guest = createGuestSession();
      saveSession(guest);
      setSessionUser(guest);
      return;
    }
    setAuthRequired(true);
    setForceLogin(true);
    setSessionUser(null);
  };

  const login = async (payload: {email: string; password: string; role?: RoleName}) => {
    const response = await loginWithFallbacks({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      role: payload.role,
    });
    const previousMemberSince = readSession()?.memberSince;
    const user = toSessionUser(response, payload.email, payload.role ?? 'user', previousMemberSince);
    saveSession(user);
    setAuthRequired(false);
    setForceLogin(false);
    setSessionUser(user);
    if ((payload.role ?? 'user') === 'user') {
      setMembershipTier('reader');
    }
  };

  const register = async (payload: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: RoleName;
  }) => {
    const response = await registerWithFallbacks(payload);
    let sessionSource = response;
    if (!authService.getToken()) {
      const loginResponse = await loginWithFallbacks({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        role: payload.role,
      });
      sessionSource = loginResponse;
    }
    const user = toSessionUser(sessionSource, payload.email, payload.role, new Date().toISOString());
    saveSession(user);
    setAuthRequired(false);
    setForceLogin(false);
    setSessionUser(user);
    if (payload.role === 'user') {
      setMembershipTier('reader');
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await login({
        email: loginForm.email,
        password: loginForm.password,
        role: 'user',
      });
    } catch (requestError: any) {
      setError(extractErrorText(requestError, 'Unable to login. Please check your credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    const firstname = registerForm.firstname.trim();
    const lastname = registerForm.lastname.trim();
    const email = registerForm.email.trim().toLowerCase();
    if (firstname.length < 2 || lastname.length < 2) {
      setError('First name and last name must each be at least 2 characters.');
      setIsSubmitting(false);
      return;
    }
    if (registerForm.password !== registerForm.password_confirmation) {
      setError('Password confirmation does not match.');
      setIsSubmitting(false);
      return;
    }
    if (!registerForm.agree) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      setIsSubmitting(false);
      return;
    }
    try {
      await register({
        firstname,
        lastname,
        email,
        password: registerForm.password,
        password_confirmation: registerForm.password_confirmation,
        role: 'user',
      });
    } catch (requestError: any) {
      setError(extractErrorText(requestError, 'Unable to register. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionUser) return <>{children({user: sessionUser, logout, login, register})}</>;

  if (mode === 'register') {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7fcfd,_#eef6f7_55%,_#e8f0f2)] dark:bg-[#0f1b1f] flex flex-col items-center justify-center p-4 text-slate-900 dark:text-[#f8fafc]">
        <header className="absolute top-0 flex w-full items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5da7b3] shadow-sm">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#f8fafc]">E-Library</span>
          </div>
          <button className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:text-slate-900 dark:border-white/10 dark:bg-[#1d3438] dark:text-[#94a3b8] dark:hover:text-[#f8fafc]">
            Support
          </button>
        </header>
        <div className="mx-auto w-full max-w-[560px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] lg:p-10 dark:border-white/10 dark:bg-[#16282b] dark:shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-[#f8fafc]">Create Account</h1>
            <p className="mt-2 text-slate-500 dark:text-[#94a3b8]">Join our global community of researchers and scholars.</p>
          </div>
          <form className="space-y-5" onSubmit={onRegister}>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={registerForm.firstname} onChange={(event) => {setRegisterForm((prev) => ({...prev, firstname: event.target.value})); setError('');}} placeholder="First Name" required className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] px-4 py-3 text-slate-900 outline-none focus:border-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" />
              <input type="text" value={registerForm.lastname} onChange={(event) => {setRegisterForm((prev) => ({...prev, lastname: event.target.value})); setError('');}} placeholder="Last Name" required className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] px-4 py-3 text-slate-900 outline-none focus:border-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" />
            </div>
            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]" size={18} /><input type="email" value={registerForm.email} onChange={(event) => {setRegisterForm((prev) => ({...prev, email: event.target.value})); setError('');}} placeholder="jane.doe@university.edu" required className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] py-3 pl-12 pr-4 text-slate-900 outline-none focus:border-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative"><input type={showRegisterPassword ? 'text' : 'password'} value={registerForm.password} onChange={(event) => {setRegisterForm((prev) => ({...prev, password: event.target.value})); setError('');}} placeholder="Password" required className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" /><button type="button" onClick={() => setShowRegisterPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]">{showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              <div className="relative"><input type={showConfirmPassword ? 'text' : 'password'} value={registerForm.password_confirmation} onChange={(event) => {setRegisterForm((prev) => ({...prev, password_confirmation: event.target.value})); setError('');}} placeholder="Confirm Password" required className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" /><button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#94a3b8]"><input type="checkbox" checked={registerForm.agree} onChange={(event) => setRegisterForm((prev) => ({...prev, agree: event.target.checked}))} className="h-4 w-4 rounded border-slate-300 bg-white accent-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438]" />I agree to the Terms of Service and Privacy Policy.</label>
            {error && <p className="text-center text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-[#5da7b3] py-3.5 font-bold text-white hover:bg-[#4e96a2] disabled:opacity-60 shadow-sm">{isSubmitting ? 'Creating account...' : 'Sign Up'}</button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-500 dark:text-[#94a3b8]">Already have an account? <button type="button" onClick={() => {setMode('login'); setError('');}} className="font-semibold text-[#4e96a2] hover:underline">Sign In</button></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7fcfd,_#eef6f7_55%,_#e8f0f2)] dark:bg-[#0f1b1f] flex flex-col items-center justify-center p-4 text-slate-900 dark:text-[#f8fafc]">
      <header className="absolute top-0 flex w-full items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5da7b3] shadow-sm">
            <BookOpen size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#f8fafc]">E-Library</span>
        </div>
        <button className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-[#94a3b8] dark:hover:text-[#f8fafc]">Help Center</button>
      </header>
      <div className="flex w-full max-w-[980px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#16282b] dark:shadow-2xl">
        <div className="relative hidden w-1/2 flex-col justify-end p-10 lg:flex">
          <div className="absolute inset-0 z-0">
            <div className="h-full w-full bg-[url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80')] bg-cover bg-center" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,37,46,0.25),rgba(10,37,46,0.55))]" />
          </div>
          <div className="relative z-10 space-y-4 text-white">
            <BookOpen className="text-[#9dd6df]" size={32} />
            <h1 className="text-4xl font-bold leading-tight">Your gateway to infinite knowledge.</h1>
            <p className="max-w-md text-white/80">Access over 2 million digital volumes, research papers, and archival manuscripts from anywhere in the world.</p>
          </div>
        </div>
        <div className="w-full bg-white p-8 lg:w-1/2 lg:p-12 dark:bg-[#16282b]">
          <div className="mb-8"><h2 className="text-3xl font-bold text-slate-900 dark:text-[#f8fafc]">Welcome Back</h2><p className="mt-1 text-slate-500 dark:text-[#94a3b8]">Sign in to access your digital collection</p></div>
          <form className="space-y-5" onSubmit={onLogin}>
            <div><label className="mb-2 block text-sm font-medium text-slate-500 dark:text-[#94a3b8]">Library Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]" size={18} /><input type="email" value={loginForm.email} onChange={(event) => {setLoginForm((prev) => ({...prev, email: event.target.value})); setError('');}} placeholder="e.g. academic@university.edu" className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] py-3 pl-12 pr-4 text-slate-900 focus:border-[#5da7b3] focus:outline-none dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" required /></div></div>
            <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-slate-500 dark:text-[#94a3b8]">Password</label><button type="button" className="text-xs font-semibold text-[#4e96a2] hover:underline">Forgot Password?</button></div><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]" size={18} /><input type={showLoginPassword ? 'text' : 'password'} value={loginForm.password} onChange={(event) => {setLoginForm((prev) => ({...prev, password: event.target.value})); setError('');}} placeholder="********" className="w-full rounded-xl border border-slate-200 bg-[#f8fbfc] py-3 pl-12 pr-12 text-slate-900 focus:border-[#5da7b3] focus:outline-none dark:border-white/10 dark:bg-[#1d3438] dark:text-[#f8fafc]" required /><button type="button" onClick={() => setShowLoginPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#94a3b8]">{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-[#94a3b8]"><input type="checkbox" checked={loginForm.remember} onChange={(event) => setLoginForm((prev) => ({...prev, remember: event.target.checked}))} className="h-4 w-4 rounded border-slate-300 bg-white accent-[#5da7b3] dark:border-white/10 dark:bg-[#1d3438]" />Remember me on this device</label>
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5da7b3] py-3 font-bold text-white hover:bg-[#4e96a2] disabled:opacity-50 shadow-sm">{isSubmitting ? 'Signing in...' : 'Sign In to Library'}<ArrowRight size={18} /></button>
          </form>
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-[#94a3b8]">Not a member yet? <button type="button" onClick={() => {setMode('register'); setError('');}} className="font-semibold text-[#4e96a2] hover:underline">Apply for Library Card</button></div>
        </div>
      </div>
    </main>
  );
}
