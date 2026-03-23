import React from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Globe, 
  CreditCard, 
  Users, 
  Palette, 
  ChevronRight,
  Sparkles,
  Clock,
  Phone,
  Calendar,
  MessageSquare,
  Zap,
  Bot,
  Volume2,
  Headphones,
  Key,
  Database,
  Mail,
  Smartphone,
  Check,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = React.useState('AI Identity');

  const menuItems = [
    { id: 'Profile', icon: User, label: 'Operator Profile' },
    { id: 'AI Identity', icon: Bot, label: 'AI Identity & Voice' },
    { id: 'Operations', icon: Clock, label: 'Operational Hours' },
    { id: 'Handoff', icon: Zap, label: 'Human Handoff Rules' },
    { id: 'Telephony', icon: Phone, label: 'Telephony Setup' },
    { id: 'Calendar', icon: Calendar, label: 'Calendar Integration' },
    { id: 'Notifications', icon: Bell, label: 'Notifications' },
    { id: 'Security', icon: Shield, label: 'Security' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Settings Navigation */}
      <aside className="w-72 border-r border-slate-200 flex flex-col shrink-0 bg-slate-50/30">
        <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center shrink-0">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Control Center</h1>
        </header>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all group",
                activeSection === item.id 
                  ? "bg-white text-primary shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              <item.icon size={18} className={cn(
                "transition-colors",
                activeSection === item.id ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {item.label}
              {activeSection === item.id && <ChevronRight size={14} className="ml-auto text-primary/50" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Settings Content */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto p-12">
          {activeSection === 'AI Identity' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Bot size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">AI Identity & Voice</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Configure how your AI receptionist presents itself to patients.</p>
              </header>

              <div className="grid grid-cols-1 gap-8">
                {/* Identity Card */}
                <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Name</label>
                      <input 
                        type="text" 
                        defaultValue="Stitch AI" 
                        className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold focus:border-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tone of Voice</label>
                      <select className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none">
                        <option>Professional & Warm</option>
                        <option>Direct & Efficient</option>
                        <option>Casual & Friendly</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Prompt / Personality</label>
                    <textarea 
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium leading-relaxed focus:border-primary outline-none transition-all"
                      defaultValue="You are a professional receptionist for a high-end dental clinic. Your goal is to be helpful, empathetic, and efficient. Always verify insurance information before booking new patients."
                    />
                  </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest px-1">Voice Synthesis</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['Aria (Female)', 'Marcus (Male)', 'Elena (Female)'].map((voice, i) => (
                      <button 
                        key={voice}
                        className={cn(
                          "p-6 rounded-2xl border transition-all text-left group relative overflow-hidden",
                          i === 0 ? "border-primary bg-primary/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                            i === 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                          )}>
                            <Volume2 size={20} />
                          </div>
                          {i === 0 && <Check size={16} className="text-primary" />}
                        </div>
                        <p className="text-xs font-bold text-slate-900">{voice}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-medium">High Fidelity • Neural</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button className="px-6 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest">Discard Changes</button>
                <button className="px-6 py-3 rounded-xl bg-primary text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase tracking-widest">Save Configuration</button>
              </div>
            </div>
          )}

          {activeSection === 'Operations' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Clock size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Operational Hours</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Define when your AI should handle calls vs. routing to human staff.</p>
              </header>

              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-4">Day</th>
                      <th className="px-8 py-4">Status</th>
                      <th className="px-8 py-4">Hours</th>
                      <th className="px-8 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                      <tr key={day} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5 text-sm font-bold text-slate-900">{day}</td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest",
                            day === 'Saturday' || day === 'Sunday' ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {day === 'Saturday' || day === 'Sunday' ? 'Closed' : 'Open'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-xs font-bold text-slate-600">
                          {day === 'Saturday' || day === 'Sunday' ? '--' : '09:00 AM - 05:00 PM'}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'Handoff' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Zap size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Human Handoff Rules</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Configure triggers for when the AI should escalate to a human operator.</p>
              </header>

              <div className="space-y-4">
                {[
                  { title: 'Sentiment Escalation', desc: 'Handoff if patient sentiment drops below 3/10 for more than 2 turns.', active: true },
                  { title: 'Emergency Keywords', desc: 'Immediate handoff if keywords like "pain", "bleeding", or "emergency" are detected.', active: true },
                  { title: 'Complex Inquiries', desc: 'Handoff if AI cannot resolve the inquiry within 3 attempts.', active: false },
                  { title: 'High-Value Leads', desc: 'Handoff if patient expresses interest in high-value services (e.g., implants).', active: true },
                ].map((rule) => (
                  <div key={rule.title} className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">{rule.title}</h3>
                      <p className="text-xs text-slate-500 font-medium">{rule.desc}</p>
                    </div>
                    <div className={cn(
                      "w-12 h-6 rounded-full p-1 transition-all cursor-pointer",
                      rule.active ? "bg-primary" : "bg-slate-200"
                    )}>
                      <div className={cn(
                        "h-4 w-4 rounded-full bg-white shadow-sm transition-all",
                        rule.active ? "translate-x-6" : "translate-x-0"
                      )}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'Profile' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <User size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Operator Profile</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Manage your personal identity and front-desk availability.</p>
              </header>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-8 shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-extrabold text-2xl shadow-inner">
                        SK
                      </div>
                      <button className="absolute -bottom-2 -right-2 h-8 w-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-primary transition-all">
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-slate-900">Profile Picture</h3>
                      <p className="text-xs text-slate-500 font-medium">JPG, GIF or PNG. Max size of 800K</p>
                      <div className="flex gap-2 mt-2">
                        <button className="px-3 py-1.5 rounded-lg bg-slate-900 text-[10px] font-bold text-white uppercase tracking-widest hover:bg-slate-800 transition-all">Upload</button>
                        <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">Remove</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                      <input type="text" defaultValue="Sameer Kumar" className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operator Role</label>
                      <select className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none">
                        <option>Senior Receptionist</option>
                        <option>Front-Desk Manager</option>
                        <option>Support Specialist</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                      <input type="email" defaultValue="sameerk0723@gmail.com" className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                      <input type="text" defaultValue="+1 (555) 123-4567" className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Front-Desk Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Active Status</p>
                        <p className="text-[10px] text-slate-500 font-medium">Show as available for handoffs</p>
                      </div>
                      <div className="w-10 h-5 rounded-full bg-primary p-1 cursor-pointer">
                        <div className="h-3 w-3 rounded-full bg-white translate-x-5"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Auto-Handoff Notification</p>
                        <p className="text-[10px] text-slate-500 font-medium">Alert when AI requests human intervention</p>
                      </div>
                      <div className="w-10 h-5 rounded-full bg-primary p-1 cursor-pointer">
                        <div className="h-3 w-3 rounded-full bg-white translate-x-5"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Telephony' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Phone size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Telephony Setup</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Configure your business lines and AI call routing behavior.</p>
              </header>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                        <Globe size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">+1 (888) 555-0199</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">Verified</span>
                          <span className="text-[10px] text-slate-400 font-medium">Primary Business Line</span>
                        </div>
                      </div>
                    </div>
                    <button className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">Change Number</button>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provider</p>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded bg-slate-200"></div>
                        <p className="text-xs font-bold text-slate-900">Twilio Cloud</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing Status</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <p className="text-xs font-bold text-slate-900">AI-First Routing Active</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Voicemail & Failover</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failover Number</label>
                      <input type="text" defaultValue="+1 (555) 999-8888" className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all" />
                      <p className="text-[10px] text-slate-400 font-medium">Calls route here if AI and Human operators are unavailable.</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-900">AI Voicemail Transcription</p>
                        <p className="text-[10px] text-slate-500 font-medium">Automatically transcribe and summarize voicemails</p>
                      </div>
                      <div className="w-10 h-5 rounded-full bg-primary p-1 cursor-pointer">
                        <div className="h-3 w-3 rounded-full bg-white translate-x-5"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Calendar' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Calendar size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Calendar Integration</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Connect your scheduling system to enable AI-powered bookings.</p>
              </header>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Mail size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Google Calendar</p>
                        <p className="text-[10px] text-slate-500 font-medium">connected as admin@mainstreetdental.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest">Synced</span>
                      <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><Settings size={16} /></button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Booking Calendar</label>
                    <div className="grid grid-cols-1 gap-2">
                      {['Primary Schedule', 'Dr. Aris - Operatory 1', 'Dr. Sarah - Operatory 2'].map((cal, i) => (
                        <div key={cal} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-3 w-3 rounded-full", i === 0 ? "bg-primary" : "bg-slate-300")}></div>
                            <p className="text-xs font-bold text-slate-900">{cal}</p>
                          </div>
                          {i === 0 && <Check size={14} className="text-primary" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Booking Behavior</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Booking Window</label>
                      <select className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none">
                        <option>Next 14 Days</option>
                        <option>Next 30 Days</option>
                        <option>Next 60 Days</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buffer Time</label>
                      <select className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none">
                        <option>15 Minutes</option>
                        <option>30 Minutes</option>
                        <option>None</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Conflict Handling</p>
                      <p className="text-[10px] text-slate-500 font-medium">Prevent double-bookings automatically</p>
                    </div>
                    <div className="w-10 h-5 rounded-full bg-primary p-1 cursor-pointer">
                      <div className="h-3 w-3 rounded-full bg-white translate-x-5"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Notifications' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Bell size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notifications</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Control how and when you are alerted about front-desk activity.</p>
              </header>

              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alert Channels</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { title: 'Internal Dashboard Alerts', desc: 'Real-time popups within the control plane', icon: Globe, active: true },
                      { title: 'Email Summaries', desc: 'Daily digest of missed calls and bookings', icon: Mail, active: true },
                      { title: 'SMS Escalations', desc: 'Direct text alerts for critical handoffs', icon: Smartphone, active: false },
                    ].map((channel) => (
                      <div key={channel.title} className="px-8 py-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                            <channel.icon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{channel.title}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{channel.desc}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "w-10 h-5 rounded-full p-1 transition-all cursor-pointer",
                          channel.active ? "bg-primary" : "bg-slate-200"
                        )}>
                          <div className={cn(
                            "h-3 w-3 rounded-full bg-white shadow-sm transition-all",
                            channel.active ? "translate-x-5" : "translate-x-0"
                          )}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-8 py-4 border-b border-slate-200">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Subscriptions</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { title: 'Booking Confirmations', active: true },
                      { title: 'Missed Call Alerts', active: true },
                      { title: 'AI Escalation Requests', active: true },
                      { title: 'New Lead Detected', active: true },
                      { title: 'System Health Warnings', active: false },
                    ].map((event) => (
                      <div key={event.title} className="px-8 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <p className="text-xs font-bold text-slate-700">{event.title}</p>
                        <div className={cn(
                          "w-10 h-5 rounded-full p-1 transition-all cursor-pointer",
                          event.active ? "bg-primary" : "bg-slate-200"
                        )}>
                          <div className={cn(
                            "h-3 w-3 rounded-full bg-white shadow-sm transition-all",
                            event.active ? "translate-x-5" : "translate-x-0"
                          )}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Security' && (
            <div className="space-y-10">
              <header>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Shield size={24} />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Security & Access</h2>
                </div>
                <p className="text-sm text-slate-500 font-medium">Manage credentials, session policies, and audit logs.</p>
              </header>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Authentication Policies</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Two-Factor Authentication (2FA)</p>
                        <p className="text-[10px] text-slate-500 font-medium">Enforce for all operator logins</p>
                      </div>
                      <div className="w-10 h-5 rounded-full bg-primary p-1 cursor-pointer">
                        <div className="h-3 w-3 rounded-full bg-white translate-x-5"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Session Timeout</label>
                      <select className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none">
                        <option>30 Minutes</option>
                        <option>1 Hour</option>
                        <option>4 Hours</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">API & Credentials</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Key size={16} className="text-primary" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active API Token</p>
                          <p className="text-xs font-mono text-slate-300">st_live_••••••••••••4f2a</p>
                        </div>
                      </div>
                      <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Rotate</button>
                    </div>
                    <div className="flex items-center gap-2 px-2">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <p className="text-[10px] text-slate-500 font-medium">All credentials encrypted with AES-256</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
