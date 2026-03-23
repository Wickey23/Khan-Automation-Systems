import React from 'react';
import { 
  Phone, 
  UserPlus, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  MoreVertical,
  PhoneCall,
  CheckCircle2,
  Mail,
  Edit3,
  Sparkles,
  RefreshCw,
  Search,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Scroll Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-background-light">
        {/* Getting Started Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Need to reconfigure your workspace?</h3>
              <p className="text-sm text-slate-500">You can restart the setup wizard to update your business preferences at any time.</p>
            </div>
          </div>
          <Link to="/app/onboarding" className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
            <RefreshCw size={18} />
            <span>Restart Onboarding</span>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Calls', value: '1,284', trend: '+12.5%', icon: Phone, color: 'text-emerald-500', path: "M0,15 Q25,5 50,15 T100,5" },
            { label: 'Active Leads', value: '456', trend: '+5.2%', icon: UserPlus, color: 'text-emerald-500', path: "M0,18 Q30,15 45,5 T80,12 T100,2" },
            { label: 'Bookings', value: '89', trend: '+8.1%', icon: Calendar, color: 'text-emerald-500', path: "M0,10 Q10,20 30,5 T70,15 T100,5" },
          ].map((metric) => (
            <div key={metric.label} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{metric.label}</span>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <metric.icon size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-extrabold text-slate-900 leading-tight">{metric.value}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn("flex items-center font-bold text-sm", metric.color)}>
                    <TrendingUp size={14} className="mr-1" />
                    <span>{metric.trend}</span>
                  </div>
                  <span className="text-xs text-slate-400">from last week</span>
                </div>
              </div>
              <div className="h-12 w-full mt-2 opacity-50">
                <svg className="w-full h-full text-emerald-500" preserveAspectRatio="none" viewBox="0 0 100 20">
                  <path d={metric.path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Action Needed Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Action Needed</h2>
            <button className="text-sm text-primary font-semibold hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-xs font-semibold uppercase bg-slate-50">
                  <th className="px-6 py-3">Lead Name</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waiting Since</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'John Doe', source: 'Google Ads', status: 'Urgent', time: '12 mins', color: 'text-red-600', bg: 'bg-red-100' },
                  { name: 'Sarah Smith', source: 'Referral', status: 'Pending', time: '45 mins', color: 'text-amber-600', bg: 'bg-amber-100' },
                  { name: 'Tech Corp', source: 'Website', status: 'New', time: '1 hr', color: 'text-blue-600', bg: 'bg-blue-100' },
                  { name: 'Mike Jones', source: 'Facebook', status: 'Follow-up', time: '3 hrs', color: 'text-slate-600', bg: 'bg-slate-100' },
                ].map((lead, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-primary">
                          {lead.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{lead.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{lead.source}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", lead.bg, lead.color)}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{lead.time}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90">
                        {lead.status === 'Urgent' ? 'Call Now' : 'Review'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Rail */}
      <aside className="w-80 border-l border-slate-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Phone size={14} />
              </div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-slate-100"></div>
            </div>
            <div>
              <p className="text-sm text-slate-900 font-medium">Inbound Call from Unknown</p>
              <p className="text-xs text-slate-500 mt-0.5">2 minutes ago</p>
              <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded italic">"Hi, I'm interested in booking a dental consult next..."</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={14} />
              </div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-slate-100"></div>
            </div>
            <div>
              <p className="text-sm text-slate-900 font-medium">Booking Confirmed</p>
              <p className="text-xs text-slate-500 mt-0.5">Alice Cooper • 14 mins ago</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Mail size={14} />
              </div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-slate-100"></div>
            </div>
            <div>
              <p className="text-sm text-slate-900 font-medium">Email Sent to Lead</p>
              <p className="text-xs text-slate-500 mt-0.5">David Miller • 45 mins ago</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Edit3 size={14} />
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-900 font-medium">Status Changed</p>
              <p className="text-xs text-slate-500 mt-0.5">Robert Fox → 'Closed Won'</p>
              <p className="text-xs text-slate-500 mt-0.5">1 hour ago</p>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200">
          <button className="w-full text-center text-sm font-semibold text-slate-600 hover:text-primary transition-colors">
            Clear Timeline
          </button>
        </div>
      </aside>
    </div>
  );
};
