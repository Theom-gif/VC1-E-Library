import React from 'react';
import { Icons } from '../types';

interface SettingsProps {
  onNavigate: (page: any, data?: any) => void;
}

export default function Settings({ onNavigate }: SettingsProps) {
  return (
    <div className="mx-auto max-w-4xl px-6 lg:px-20 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-text">Settings</h1>
        <p className="text-sm text-text-muted">Manage your account preferences and library configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Tabs */}
        <nav className="space-y-1">
          <SettingTab active icon={<Icons.User className="size-4" />} label="Account" />
          <SettingTab icon={<Icons.Bell className="size-4" />} label="Notifications" />
          <SettingTab icon={<Icons.Eye className="size-4" />} label="Appearance" />
          <SettingTab icon={<Icons.Book className="size-4" />} label="Library Settings" />
          <SettingTab icon={<Icons.Globe className="size-4" />} label="Language & Region" />
          <div className="pt-4 mt-4 border-t border-border">
            <SettingTab icon={<Icons.LogOut className="size-4" />} label="Sign Out" danger onClick={() => onNavigate('logout')} />
          </div>
        </nav>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-8">
          <section className="p-6 rounded-2xl bg-surface border border-border space-y-6">
            <h3 className="text-lg font-bold text-text">Profile Information</h3>
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div 
                  className="size-20 rounded-full bg-primary/20 bg-cover bg-center border-2 border-primary/20"
                  style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuD1haEXmvd-9CjxAle36WW70lL3Mx9lorZ1Q4k0kbEI9nmCj-ma1YtFbS2GBfNRTBE5BU01cGbyXGzI6wE9hbeZ-RY34Gy-JJLG7xxgWRY4HEFdxc5q-LNWEd7TElRZFb4C4zbB7wby_Mv0-gV-v1vD1AzSJCtmL1-hvVMi7Z68G5TjPhr8SoVt31XZrcogHgVqvw4aN3W9Y6WZdW0NWNbBCUnRffhuITfWhijdjYig6s_j3euhV_5pa3Fs4O5MNWESVnMB286u1ZI')` }}
                />
                <button className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icons.Edit3 className="size-5 text-white" />
                </button>
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-bold text-text">Alex Johnson</h4>
                <p className="text-sm text-text-muted">alex.johnson@example.com</p>
                <button className="text-xs font-bold text-primary hover:underline">Change Email</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Display Name</label>
                <input type="text" defaultValue="Alex Johnson" className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text focus:ring-primary focus:border-primary outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Username</label>
                <input type="text" defaultValue="alexj_reads" className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text focus:ring-primary focus:border-primary outline-none" />
              </div>
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-surface border border-border space-y-6">
            <h3 className="text-lg font-bold text-text">Preferences</h3>
            <div className="space-y-4">
              <ToggleSetting 
                label="Automatic Downloads" 
                description="Automatically download new books in your favorites list for offline reading."
                enabled 
              />
              <ToggleSetting 
                label="Reading Reminders" 
                description="Receive notifications to help you maintain your daily reading streak."
                enabled 
              />
              <ToggleSetting 
                label="Public Profile" 
                description="Allow other users to see your reading activity and achievements."
              />
            </div>
          </section>

          <div className="flex justify-end gap-4">
            <button className="px-6 py-2 rounded-xl text-sm font-bold text-text-muted hover:text-text transition-all">Cancel</button>
            <button className="px-8 py-2 rounded-xl text-sm font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingTab({ icon, label, active, danger, onClick }: { icon: React.ReactNode, label: string, active?: boolean, danger?: boolean, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-primary/10 text-primary' 
        : danger 
          ? 'text-red-500 hover:bg-red-500/10' 
          : 'text-text-muted hover:bg-surface hover:text-text'
    }`}>
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function ToggleSetting({ label, description, enabled }: { label: string, description: string, enabled?: boolean }) {
  const [isOn, setIsOn] = React.useState(enabled);
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-text">{label}</h4>
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
      <button 
        onClick={() => setIsOn(!isOn)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isOn ? 'bg-primary' : 'bg-surface'}`}
      >
        <div className={`absolute top-1 left-1 size-4 bg-white rounded-full transition-transform duration-200 ${isOn ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
