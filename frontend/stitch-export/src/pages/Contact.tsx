import React from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Headset, 
  CreditCard, 
  ArrowRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';

export default function Contact() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface">
      <nav className="fixed top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 h-16">
          <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">Khan Systems</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/solutions">Solutions</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/pricing">Pricing</Link>
            <Link className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium" to="/case-studies">Case Studies</Link>
            <Link className="text-blue-600 border-b-2 border-blue-600 pb-1 text-sm font-medium" to="/contact">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="primary-gradient text-on-primary px-5 py-2 rounded-md text-sm font-medium shadow-sm active:scale-95 duration-150"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-16 max-w-2xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-medium tracking-tight text-on-surface mb-4"
          >
            Connect with our systems experts.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-on-surface-variant text-lg"
          >
            Whether you're scaling operations or starting a new digital transformation journey, our team is ready to architect your solution.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Contact Form Section */}
          <div className="lg:col-span-8 space-y-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-container-lowest p-8 lg:p-12 rounded-xl border border-outline-variant/15 shadow-sm"
            >
              <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-on-surface-variant block">Name</label>
                    <input 
                      className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none" 
                      placeholder="Jane Doe" 
                      type="text"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-on-surface-variant block">Business Name</label>
                    <input 
                      className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none" 
                      placeholder="Acme Corp" 
                      type="text"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-on-surface-variant block">Industry</label>
                    <select className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none appearance-none cursor-pointer">
                      <option>Technology</option>
                      <option>Manufacturing</option>
                      <option>Logistics</option>
                      <option>Finance</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-on-surface-variant block">Phone</label>
                    <input 
                      className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none" 
                      placeholder="+1 (555) 000-0000" 
                      type="tel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant block">Email</label>
                  <input 
                    className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none" 
                    placeholder="jane@example.com" 
                    type="email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-on-surface-variant block">Message</label>
                  <textarea 
                    className="w-full bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface outline-none resize-none" 
                    placeholder="How can we help your business grow?" 
                    rows={4}
                  ></textarea>
                </div>

                <button className="w-full md:w-auto px-8 py-4 bg-primary text-on-primary font-semibold rounded-lg shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                  Send Inquiry
                  <ArrowRight size={18} />
                </button>
              </form>
            </motion.div>

            {/* Location / Service Area Focus */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative h-[400px] w-full rounded-xl overflow-hidden grayscale contrast-[0.9] opacity-80 border border-outline-variant/15 group shadow-sm"
            >
              <img 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                src="https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&q=80&w=1200" 
                alt="San Francisco Map"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
              <div className="absolute bottom-8 left-8 bg-surface-container-lowest/90 backdrop-blur-md p-6 rounded-xl border border-outline-variant/15 max-w-xs shadow-xl">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <MapPin size={16} className="fill-primary/20" />
                  <span className="text-xs font-bold uppercase tracking-widest">Global Operations</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-1">San Francisco, CA</h3>
                <p className="text-sm text-on-surface-variant">Our central hub for engineering and strategic consulting.</p>
              </div>
            </motion.div>
          </div>

          {/* Sidebar Section */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Sales Inquiry Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/15"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center mb-6 text-on-primary-container">
                <CreditCard size={20} />
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-2">Sales Inquiry</h2>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">Interested in our enterprise solutions? Connect with our global sales team for custom pricing and demos.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <Mail size={18} className="text-primary" />
                  <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">sales@khansystems.com</span>
                </div>
                <div className="flex items-center gap-3 group cursor-pointer">
                  <Phone size={18} className="text-primary" />
                  <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">+1 (800) KHAN-SYS</span>
                </div>
              </div>
            </motion.div>

            {/* Support Card */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/15"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center mb-6 text-on-secondary-container">
                <Headset size={20} />
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-2">Support</h2>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">Existing clients can reach out 24/7 for technical assistance and infrastructure monitoring support.</p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 group cursor-pointer">
                  <CheckCircle2 size={18} className="text-secondary" />
                  <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Help Documentation</span>
                </div>
                <button className="w-full py-3 bg-surface-container-highest text-on-surface font-semibold text-sm rounded-lg hover:bg-surface-container-high transition-colors">
                  Open Support Ticket
                </button>
              </div>
            </motion.div>

            {/* Additional Info / Trust */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-8 space-y-4"
            >
              <p className="text-xs font-bold text-outline uppercase tracking-widest">Typical Response Times</p>
              <div className="flex items-center justify-between text-sm py-2 border-b border-outline-variant/10">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <Clock size={14} /> General Sales
                </span>
                <span className="font-semibold text-on-surface">&lt; 2 hours</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2 border-b border-outline-variant/10">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <Clock size={14} /> Technical Support
                </span>
                <span className="font-semibold text-on-surface">&lt; 15 mins</span>
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span className="text-on-surface-variant flex items-center gap-2">
                  <Clock size={14} /> Partnerships
                </span>
                <span className="font-semibold text-on-surface">24-48 hours</span>
              </div>
            </motion.div>
          </aside>
        </div>
      </main>
    </div>
  );
}
