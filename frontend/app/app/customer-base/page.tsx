import Link from "next/link";
import {
  Bell,
  Briefcase,
  Download,
  Filter,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  Phone,
  Search,
  Settings,
  UserPlus,
  Users
} from "lucide-react";

const rows = [
  {
    name: "Sarah Chen",
    id: "KH-9021",
    email: "s.chen@example.com",
    phone: "+1 (555) 902-1244",
    status: "ACTIVE",
    statusClass: "bg-blue-100 text-blue-700",
    value: "$12,450.00",
    lastBooking: "Oct 12, 2023"
  },
  {
    name: "Marcus Wright",
    id: "KH-4412",
    email: "m.wright@domain.com",
    phone: "Missing Phone",
    status: "DEGRADED",
    statusClass: "bg-violet-100 text-violet-700",
    value: "$3,210.00",
    lastBooking: "Sep 28, 2023"
  },
  {
    name: "Elena Rodriguez",
    id: "KH-8829",
    email: "elena.r@agency.co",
    phone: "+1 (555) 441-2921",
    status: "NOT_ENABLED",
    statusClass: "bg-slate-200 text-slate-600",
    value: "$0.00",
    lastBooking: "New Customer"
  }
];

export default function CustomerBasePage() {
  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-800">
      <div className="grid min-h-screen grid-cols-[280px_1fr]">
        <aside className="flex flex-col border-r border-slate-200 bg-[#e9eef4] p-6">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[30px] font-semibold leading-none tracking-tight">ClientPortal</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Operational Suite</p>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" />
            <NavItem icon={Users} label="Customer Base" active />
            <NavItem icon={Briefcase} label="Projects" />
            <NavItem icon={Briefcase} label="Financials" />
            <NavItem icon={HelpCircle} label="Support" />
          </nav>

          <div className="mt-auto space-y-4 pt-6">
            <button className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow">
              <span className="text-lg leading-none">+</span>
              New Entry
            </button>
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">
              <HelpCircle className="h-5 w-5" />
              Help Center
            </button>
            <Link href="/auth/logout" className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">
              <LogOut className="h-5 w-5" />
              Sign Out
            </Link>
          </div>
        </aside>

        <div className="flex flex-col">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 px-8">
            <h1 className="text-4xl font-medium tracking-tight">Khan Systems</h1>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  readOnly
                  value=""
                  placeholder="Global search..."
                  className="h-11 w-[350px] rounded-2xl border border-slate-200 bg-[#e6ebf1] pl-10 pr-4 text-sm outline-none"
                />
              </div>
              <Bell className="h-5 w-5 text-slate-700" />
              <Settings className="h-5 w-5 text-slate-700" />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-200 text-xs font-bold text-orange-900">R</div>
            </div>
          </header>

          <main className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Dashboard / <span className="text-blue-700">Customer Base</span></p>
                <h2 className="mt-2 text-6xl font-medium tracking-tight text-slate-900">Customer Base</h2>
              </div>
              <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <section className="mb-6 grid grid-cols-3 gap-6">
              <MetricCard title="TOTAL CUSTOMERS" value="12,842" badge="+4.2%" />
              <MetricCard title="RETURNING CUSTOMERS (%)" value="64.8%" badge="TARGET" />
              <MetricCard title="NEW THIS MONTH" value="312" subtitle="vs 284 prev." />
            </section>

            <section className="mb-6 rounded-xl border border-slate-200 bg-[#e8edf3] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-[460px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    readOnly
                    value=""
                    placeholder="Search by name, email or ID..."
                    className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm"
                  />
                </div>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-[#dce3eb] text-sm">
                  <FilterTab label="All" active />
                  <FilterTab label="Active" />
                  <FilterTab label="Inactive" />
                  <FilterTab label="New" />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-600">Sort by:</span>
                  <span className="font-semibold">Last Booking</span>
                  <button className="rounded-lg bg-[#cfe0ef] p-2">
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[1.2fr_1.1fr_0.8fr_0.8fr_0.8fr] border-b border-slate-200 bg-[#f5f7fa] px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
                <p>Customer Name</p>
                <p>Contact Details</p>
                <p>Status</p>
                <p>Lifetime Value</p>
                <p>Last Booking</p>
              </div>

              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1.2fr_1.1fr_0.8fr_0.8fr_0.8fr] items-center border-b border-slate-100 px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-700">
                      {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[28px] font-medium leading-none">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {row.id}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{row.email}</p>
                    <p className={`flex items-center gap-2 ${row.phone.includes("Missing") ? "text-red-600" : ""}`}>
                      <Phone className="h-4 w-4" />
                      {row.phone}
                    </p>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${row.statusClass}`}>
                      {row.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-[32px] font-semibold">{row.value}</p>
                  <p className={row.lastBooking === "New Customer" ? "text-blue-700" : "text-slate-700"}>{row.lastBooking}</p>
                </div>
              ))}

              <div className="flex items-center justify-between px-6 py-5 text-sm text-slate-600">
                <p>
                  Showing <span className="font-semibold">1-25</span> of <span className="font-semibold">12,842</span> customers
                </p>
                <div className="flex items-center gap-5">
                  <button className="text-slate-500">{"<"}</button>
                  <button className="h-8 w-8 rounded bg-blue-700 text-white">1</button>
                  <button>2</button>
                  <button>3</button>
                  <span>...</span>
                  <button>514</button>
                  <button className="text-slate-500">{">"}</button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: typeof LayoutDashboard; label: string; active?: boolean }) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[30px] ${
        active ? "bg-white text-blue-700 shadow-sm" : "text-slate-700 hover:bg-white/70"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}

function FilterTab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button className={`px-5 py-2 ${active ? "bg-white font-semibold text-blue-700" : "text-slate-700"}`}>
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  badge,
  subtitle
}: {
  title: string;
  value: string;
  badge?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <p className="text-[56px] font-semibold leading-none">{value}</p>
        {badge ? (
          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">{badge}</span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
