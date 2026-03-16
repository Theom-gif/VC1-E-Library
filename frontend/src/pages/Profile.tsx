import React from 'react';
import { Icons, BookType } from '../types';
import { motion } from 'motion/react';
import {useLibrary} from '../context/LibraryContext';

interface ProfileProps {
  user: { name: string, photo: string, membership: string };
  onUpdateUser: (user: any) => void;
  onNavigate: (page: any, data?: any) => void;
}

export default function Profile({ user, onUpdateUser, onNavigate }: ProfileProps) {
  const {books} = useLibrary();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(user.name);
  const [editPhoto, setEditPhoto] = React.useState(user.photo);

  const handleSave = () => {
    onUpdateUser({ ...user, name: editName, photo: editPhoto });
    setIsEditing(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-20 py-10 space-y-12">
      {/* Profile Header */}
      <section className="relative rounded-3xl overflow-hidden bg-surface border border-border p-8 md:p-12">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-primary/30 via-bg to-primary/30 opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-8">
          <div className="relative group">
            <div 
              className="size-32 rounded-3xl bg-primary/20 bg-cover bg-center border-4 border-bg shadow-2xl overflow-hidden"
              style={{ backgroundImage: `url('${isEditing ? editPhoto : user.photo}')` }}
            >
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Icons.Edit3 className="size-8 text-white" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-primary text-white shadow-lg">
              <Icons.Award className="size-5" />
            </div>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full md:w-64 bg-surface border border-border rounded-xl px-4 py-2 text-text focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Photo URL</label>
                  <input 
                    type="text" 
                    value={editPhoto}
                    onChange={(e) => setEditPhoto(e.target.value)}
                    className="w-full md:w-96 bg-surface border border-border rounded-xl px-4 py-2 text-text text-xs focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-text">{user.name}</h1>
                <p className="text-text-muted">Passionate reader & Sci-Fi enthusiast • Member since 2022</p>
              </>
            )}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
              <StatBadge label="Books Read" value="124" icon={<Icons.Book className="size-3" />} />
              <StatBadge label="Reading Streak" value="12 Days" icon={<Icons.Flame className="size-3" />} />
              <StatBadge label="Followers" value="842" icon={<Icons.User className="size-3" />} />
            </div>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 rounded-xl font-bold text-text-muted hover:text-text transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  className="bg-primary text-white px-8 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  Edit Profile
                </button>
                <button className="bg-surface text-text border border-border p-2 rounded-xl hover:bg-white/10 transition-all">
                  <Icons.Share2 className="size-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Activity & Stats */}
        <div className="lg:col-span-2 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Reading Activity</h3>
              <select className="bg-surface border border-border rounded-lg px-3 py-1 text-xs font-bold outline-none text-text">
                <option className="bg-bg">Last 7 Days</option>
                <option className="bg-bg">Last 30 Days</option>
                <option className="bg-bg">This Year</option>
              </select>
            </div>
            <div className="h-64 w-full bg-surface border border-border rounded-2xl p-6 flex items-end justify-between gap-3">
              {[45, 80, 30, 95, 60, 40, 75].map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
                  <div className="w-full bg-primary/5 rounded-t-lg flex-1 flex items-end overflow-hidden">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                      className="w-full bg-gradient-to-t from-primary/40 to-primary rounded-t-lg relative group cursor-pointer"
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface border border-border text-text text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap shadow-xl z-10">
                        {val} mins
                      </div>
                    </motion.div>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-xl font-bold text-text">Currently Reading</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {books.slice(0, 2).map((book) => (
                <div 
                  key={book.id}
                  onClick={() => onNavigate('book-details', book)}
                  className="p-4 rounded-2xl bg-surface border border-border flex gap-4 cursor-pointer group hover:border-primary/30 transition-all"
                >
                  <img src={book.cover} alt={book.title} className="w-20 h-28 object-cover rounded-lg shadow-lg" />
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <h4 className="font-bold text-sm text-text group-hover:text-primary transition-colors line-clamp-1">{book.title}</h4>
                      <p className="text-[10px] text-text-muted">{book.author}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-text-muted">Progress</span>
                        <span className="text-primary">{book.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${book.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Achievements & Friends */}
        <div className="space-y-12">
          <section className="space-y-6">
            <h3 className="text-xl font-bold text-text">Achievements</h3>
            <div className="grid grid-cols-3 gap-4">
              <Achievement icon={<Icons.Flame className="text-orange-500" />} label="Streak" />
              <Achievement icon={<Icons.Award className="text-yellow-500" />} label="Elite" />
              <Achievement icon={<Icons.Rocket className="text-primary" />} label="Fast" />
              <Achievement icon={<Icons.BookOpen className="text-emerald-500" />} label="Scholar" />
              <Achievement icon={<Icons.Star className="text-purple-500" />} label="Critic" />
              <div className="aspect-square rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted/20">
                <Icons.Plus className="size-6" />
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-text">Friends</h3>
              <button className="text-xs font-bold text-primary hover:underline">See All</button>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((f) => (
                <div key={f} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-surface border border-border" />
                    <div>
                      <p className="text-sm font-bold text-text">Friend Name {f}</p>
                      <p className="text-[10px] text-text-muted">Reading: The Hobbit</p>
                    </div>
                  </div>
                  <Icons.MessageSquare className="size-4 text-text-muted/20" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border">
      <div className="text-primary">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter leading-none">{label}</span>
        <span className="text-xs font-bold text-text">{value}</span>
      </div>
    </div>
  );
}

function Achievement({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="aspect-square rounded-2xl bg-surface border border-border flex flex-col items-center justify-center gap-2 group hover:border-primary/30 transition-all cursor-pointer">
      <div className="size-8 rounded-full bg-surface flex items-center justify-center transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-text-muted uppercase">{label}</span>
    </div>
  );
}
