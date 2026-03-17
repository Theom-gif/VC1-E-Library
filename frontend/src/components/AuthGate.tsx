import {FormEvent, ReactNode, useState} from 'react';
import {ArrowRight, BookOpen, Eye, EyeOff, Lock, Mail, PenTool, Shield, User as UserIcon} from 'lucide-react';
import authService from '../service/authService';

type RoleName = 'user' | 'author' | 'admin';

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
};

type AuthGateProps = {
  children: (props: {user: SessionUser; logout: () => void}) => ReactNode;
};

const SESSION_KEY = 'elibrary_session';
const AUTO_LOGIN_BYPASS = String((import.meta as any)?.env?.VITE_AUTO_LOGIN_BYPASS || '').trim().toLowerCase() === 'true';
const REGISTER_ROLES: Array<{label: string; role: RoleName; icon: typeof UserIcon}> = [
  {label: 'USER', role: 'user', icon: UserIcon},
  {label: 'AUTHOR', role: 'author', icon: PenTool},
  {label: 'ADMIN', role: 'admin', icon: Shield},
];

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

function createGuestSession(): SessionUser {
  return {
    id: 'guest',
    name: 'Library User',
    email: 'guest@local',
    role: 'user',
  };
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

function toSessionUser(data: any, fallbackEmail: string, selectedRole: RoleName = 'user'): SessionUser {
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
  };
}

async function loginWithFallbacks(payload: {email: string; password: string; role?: RoleName}) {
  const attempts = [
    {email: payload.email, password: payload.password},
    ...(payload.role
      ? [
          {email: payload.email, password: payload.password, role: payload.role, role_id: roleIdFromRole(payload.role)},
          {email: payload.email, password: payload.password, role: titleRole(payload.role)},
          {email: payload.email, password: payload.password, role_id: roleIdFromRole(payload.role)},
        ]
      : []),
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
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => readSession() || (AUTO_LOGIN_BYPASS ? createGuestSession() : null));
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
    role: 'user' as RoleName,
    agree: false,
  });

  const logout = () => {
    authService.clearToken();
    clearSession();
    setSessionUser(AUTO_LOGIN_BYPASS ? createGuestSession() : null);
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const response = await loginWithFallbacks({
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });
      const user = toSessionUser(response, loginForm.email);
      saveSession(user);
      setSessionUser(user);
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
      await registerWithFallbacks({
        firstname,
        lastname,
        email,
        password: registerForm.password,
        password_confirmation: registerForm.password_confirmation,
        role: registerForm.role,
      });
      const response = await loginWithFallbacks({email, password: registerForm.password, role: registerForm.role});
      const user = toSessionUser(response, email, registerForm.role);
      saveSession(user);
      setSessionUser(user);
    } catch (requestError: any) {
      setError(extractErrorText(requestError, 'Unable to register. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionUser) return <>{children({user: sessionUser, logout})}</>;

  if (mode === 'register') {
    return (
      <main className="min-h-screen bg-[#122024] flex flex-col items-center justify-center p-4 text-[#f8fafc]">
        <header className="absolute top-0 flex w-full items-center justify-between px-8 py-6">
          <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4a868f]"><BookOpen size={18} className="text-[#f8fafc]" /></div><span className="text-xl font-bold tracking-tight">E-Library</span></div>
          <button className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1d3438] px-4 py-1.5 text-xs font-semibold text-[#94a3b8] hover:text-[#f8fafc]">Support</button>
        </header>
        <div className="mx-auto w-full max-w-[550px] rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[#16282b] p-8 shadow-2xl lg:p-10">
          <div className="mb-8 text-center"><h1 className="text-3xl font-bold">Create Account</h1><p className="mt-2 text-[#94a3b8]">Join our global community of researchers and scholars.</p></div>
          <form className="space-y-5" onSubmit={onRegister}>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={registerForm.firstname} onChange={(event) => {setRegisterForm((prev) => ({...prev, firstname: event.target.value})); setError('');}} placeholder="First Name" required className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] px-4 py-3 text-[#f8fafc] outline-none focus:border-[#4a868f]" />
              <input type="text" value={registerForm.lastname} onChange={(event) => {setRegisterForm((prev) => ({...prev, lastname: event.target.value})); setError('');}} placeholder="Last Name" required className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] px-4 py-3 text-[#f8fafc] outline-none focus:border-[#4a868f]" />
            </div>
            <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={18} /><input type="email" value={registerForm.email} onChange={(event) => {setRegisterForm((prev) => ({...prev, email: event.target.value})); setError('');}} placeholder="jane.doe@university.edu" required className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] py-3 pl-12 pr-4 text-[#f8fafc] outline-none focus:border-[#4a868f]" /></div>
            <div className="grid grid-cols-3 gap-3">
              {REGISTER_ROLES.map((item) => {
                const Icon = item.icon;
                const active = registerForm.role === item.role;
                return (
                  <button key={item.role} type="button" onClick={() => {setRegisterForm((prev) => ({...prev, role: item.role})); setError('');}} className={`flex flex-col items-center justify-center gap-2 rounded-xl border py-3 transition-all ${active ? 'border-[#4a868f] bg-[#1d3438] text-[#4a868f]' : 'border-[rgba(255,255,255,0.05)] bg-[#1d3438]/50 text-[#94a3b8]'}`}>
                    <Icon size={20} /><span className="text-[10px] font-bold tracking-widest">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative"><input type={showRegisterPassword ? 'text' : 'password'} value={registerForm.password} onChange={(event) => {setRegisterForm((prev) => ({...prev, password: event.target.value})); setError('');}} placeholder="Password" required className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] px-4 py-3 pr-12 text-[#f8fafc] outline-none focus:border-[#4a868f]" /><button type="button" onClick={() => setShowRegisterPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">{showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              <div className="relative"><input type={showConfirmPassword ? 'text' : 'password'} value={registerForm.password_confirmation} onChange={(event) => {setRegisterForm((prev) => ({...prev, password_confirmation: event.target.value})); setError('');}} placeholder="Confirm Password" required className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] px-4 py-3 pr-12 text-[#f8fafc] outline-none focus:border-[#4a868f]" /><button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#94a3b8]"><input type="checkbox" checked={registerForm.agree} onChange={(event) => setRegisterForm((prev) => ({...prev, agree: event.target.checked}))} className="h-4 w-4 rounded border-[#1d3438] bg-[#1d3438] accent-[#4a868f]" />I agree to the Terms of Service and Privacy Policy.</label>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-[#214046] py-3.5 font-bold text-[#f8fafc] hover:bg-[#2a525a] disabled:opacity-60">{isSubmitting ? 'Creating account...' : 'Sign Up'}</button>
          </form>
          <p className="mt-8 text-center text-sm text-[#94a3b8]">Already have an account? <button type="button" onClick={() => {setMode('login'); setError('');}} className="font-semibold text-[#4a868f] hover:underline">Sign In</button></p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#122024] flex flex-col items-center justify-center p-4 text-[#f8fafc]">
      <header className="absolute top-0 flex w-full items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4a868f]"><BookOpen size={18} className="text-[#f8fafc]" /></div><span className="text-xl font-bold tracking-tight">E-Library</span></div>
        <button className="text-sm font-medium text-[#94a3b8] hover:text-[#f8fafc]">Help Center</button>
      </header>
      <div className="flex w-full max-w-[900px] overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#16282b] shadow-2xl">
        <div className="relative hidden w-1/2 flex-col justify-end p-10 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40"><div className="h-full w-full bg-[url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-overlay" /><div className="absolute inset-0 bg-gradient-to-t from-[#16282b] via-transparent to-transparent" /></div>
          <div className="relative z-10 space-y-4"><BookOpen className="text-[#4a868f]" size={32} /><h1 className="text-4xl font-bold leading-tight">Your gateway to infinite knowledge.</h1><p className="text-[#94a3b8]">Access over 2 million digital volumes, research papers, and archival manuscripts from anywhere in the world.</p></div>
        </div>
        <div className="w-full bg-[#16282b] p-8 lg:w-1/2 lg:p-12">
          <div className="mb-8"><h2 className="text-3xl font-bold">Welcome Back</h2><p className="mt-1 text-[#94a3b8]">Sign in to access your digital collection</p></div>
          <form className="space-y-5" onSubmit={onLogin}>
            <div><label className="mb-2 block text-sm font-medium text-[#94a3b8]">Library Email</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={18} /><input type="email" value={loginForm.email} onChange={(event) => {setLoginForm((prev) => ({...prev, email: event.target.value})); setError('');}} placeholder="e.g. academic@university.edu" className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] py-3 pl-12 pr-4 text-[#f8fafc] focus:border-[#4a868f] focus:outline-none" required /></div></div>
            <div><div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium text-[#94a3b8]">Password</label><button type="button" className="text-xs font-semibold text-[#4a868f] hover:underline">Forgot Password?</button></div><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={18} /><input type={showLoginPassword ? 'text' : 'password'} value={loginForm.password} onChange={(event) => {setLoginForm((prev) => ({...prev, password: event.target.value})); setError('');}} placeholder="********" className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1d3438] py-3 pl-12 pr-12 text-[#f8fafc] focus:border-[#4a868f] focus:outline-none" required /><button type="button" onClick={() => setShowLoginPassword((prev) => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <label className="flex items-center gap-2 text-sm text-[#94a3b8]"><input type="checkbox" checked={loginForm.remember} onChange={(event) => setLoginForm((prev) => ({...prev, remember: event.target.checked}))} className="h-4 w-4 rounded border-[#1d3438] bg-[#1d3438] accent-[#4a868f]" />Remember me on this device</label>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">{error}</div>}
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4a868f] py-3 font-bold text-[#f8fafc] hover:bg-[#5ba1ab] disabled:opacity-50">{isSubmitting ? 'Signing in...' : 'Sign In to Library'}<ArrowRight size={18} /></button>
          </form>
          <div className="mt-8 text-center text-sm text-[#94a3b8]">Not a member yet? <button type="button" onClick={() => {setMode('register'); setError('');}} className="font-semibold text-[#4a868f] hover:underline">Apply for Library Card</button></div>
        </div>
      </div>
    </main>
  );
}
