import React from 'react';
import { 
  Shield, 
  BarChart3, 
  Download, 
  Filter, 
  Calendar, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  FileText,
  PieChart,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const revenueData = [
  { month: 'Oct', value: 124000 },
  { month: 'Nov', value: 145000 },
  { month: 'Dec', value: 168000 },
  { month: 'Jan', value: 182000 },
  { month: 'Feb', value: 210000 },
  { month: 'Mar', value: 245000 },
];

export const AdminReports: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background-light">
      {/* Header */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-12 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="text-primary" size={16} />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Global Control Plane</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Financial & Operational Reports</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2">
            <Download size={18} />
            Export Data
          </button>
          <button className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
            <FileText size={18} />
            Generate PDF
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-12">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Total Revenue (ARR)', value: '$2.94M', change: '+24%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Avg. Revenue / Org', value: '$2,284', change: '+5.2%', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Churn Rate', value: '1.2%', change: '-0.4%', icon: PieChart, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'down' },
              { label: 'Customer LTV', value: '$14.2k', change: '+12%', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                    <stat.icon size={20} />
                  </div>
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
                    stat.trend === 'down' ? "bg-emerald-50 text-emerald-600" : "bg-emerald-50 text-emerald-600"
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
            {/* Revenue Chart */}
            <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Revenue Growth</h3>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last 6 Months</span>
                </div>
              </div>
              <div className="p-8 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      tickFormatter={(value) => `$${value/1000}k`}
                    />
                    <Tooltip 
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {revenueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === revenueData.length - 1 ? '#3caff6' : '#e2e8f0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Organizations */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Top Performers</h3>
              </div>
              <div className="p-8 flex-1 space-y-6">
                {[
                  { name: 'Acme Dental', rev: '$12,400', usage: '4.2k mins' },
                  { name: 'Global Real Estate', rev: '$8,200', usage: '2.8k mins' },
                  { name: 'Tech Solutions', rev: '$4,500', usage: '1.5k mins' },
                  { name: 'Legacy Corp', rev: '$3,200', usage: '1.1k mins' },
                  { name: 'Health First', rev: '$2,800', usage: '0.9k mins' },
                ].map((org, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{org.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{org.usage}</p>
                    </div>
                    <span className="text-sm font-black text-slate-900">{org.rev}</span>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <button className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                  View Full Ranking
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
