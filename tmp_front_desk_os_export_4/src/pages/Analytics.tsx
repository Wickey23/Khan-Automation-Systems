import React from 'react';
import { 
  TrendingUp, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Users, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  Zap,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const callData = [
  { name: 'Mon', calls: 120 },
  { name: 'Tue', calls: 150 },
  { name: 'Wed', calls: 180 },
  { name: 'Thu', calls: 140 },
  { name: 'Fri', calls: 210 },
  { name: 'Sat', calls: 80 },
  { name: 'Sun', calls: 45 },
];

const conversionData = [
  { name: 'New Leads', value: 450, color: '#3caff6' },
  { name: 'Contacted', value: 320, color: '#6366f1' },
  { name: 'Qualified', value: 180, color: '#8b5cf6' },
  { name: 'Booked', value: 120, color: '#10b981' },
];

export const Analytics: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-12 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Performance Analytics</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Operational insights for your front-desk workflow</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button className="px-4 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-primary">Last 7 Days</button>
            <button className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700">Last 30 Days</button>
          </div>
          <button className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-primary transition-all">
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Calls', value: '842', change: '+12.5%', icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Booking Rate', value: '24.2%', change: '+4.3%', icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Avg. Response', value: '1.2m', change: '-15%', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'up' },
              { label: 'Lead Conversion', value: '18.5%', change: '+2.1%', icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                    <stat.icon size={20} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
                    stat.trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    <ArrowUpRight size={10} />
                    {stat.change}
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Call Volume Chart */}
            <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Call Volume Trends</h3>
                  <p className="text-xs text-slate-500 font-medium">Daily inbound call activity</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Inbound Calls</span>
                </div>
              </div>
              <div className="p-8 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callData}>
                    <defs>
                      <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3caff6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3caff6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="calls" stroke="#3caff6" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Conversion Funnel</h3>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-center">
                <div className="space-y-6">
                  {conversionData.map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-slate-500">{item.name}</span>
                        <span className="text-slate-900">{item.value}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000" 
                          style={{ 
                            width: `${(item.value / conversionData[0].value) * 100}%`,
                            backgroundColor: item.color 
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Conversion</span>
                  <span className="text-lg font-black text-primary">26.7%</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Performance */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">AI Receptionist Performance</h3>
                <p className="text-xs text-slate-500 font-medium">Accuracy and resolution metrics for automated handling</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolution Rate</p>
                  <p className="text-xl font-black text-emerald-500">92.4%</p>
                </div>
                <div className="h-10 w-[1px] bg-slate-200"></div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sentiment Score</p>
                  <p className="text-xl font-black text-primary">4.8/5.0</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Top Intent</span>
                </div>
                <p className="text-sm font-bold text-slate-700">Booking Request</p>
                <p className="text-[10px] text-slate-500 mt-1">42% of all interactions</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={16} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Avg. Turns</span>
                </div>
                <p className="text-sm font-bold text-slate-700">6.4 Turns</p>
                <p className="text-[10px] text-slate-500 mt-1">Per successful resolution</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={16} className="text-purple-500" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Handoffs</span>
                </div>
                <p className="text-sm font-bold text-slate-700">8.2% Rate</p>
                <p className="text-[10px] text-slate-500 mt-1">Required operator intervention</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
