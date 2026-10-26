/**
 * Comprehensive Light Mode Dynamic Stylesheet for Tripinn WhatsApp CRM.
 * Applied whenever html has class "light" or data-theme="light".
 */
export const lightModeStyles = `
/* ==============================================================================
   TRIPINN HOLIDAYS CRM - LIGHT MODE DYNAMIC STYLES
   ============================================================================== */

html.light,
html[data-theme="light"],
html:not(.dark) {
  color-scheme: light;
}

html.light body,
html[data-theme="light"] body,
html:not(.dark) body {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

/* 1. Surfaces & Backgrounds */
html.light [class*="bg-[#070d1a]"],
html[data-theme="light"] [class*="bg-[#070d1a]"],
html:not(.dark) [class*="bg-[#070d1a]"] {
  background-color: #f8fafc !important;
}

html.light [class*="bg-[#0b132b]"],
html[data-theme="light"] [class*="bg-[#0b132b]"],
html:not(.dark) [class*="bg-[#0b132b]"] {
  background-color: #ffffff !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
}

html.light header[class*="bg-[#0b132b]"],
html.light [class*="bg-[#0b132b]/80"],
html.light [class*="bg-[#0b132b]/90"],
html.light [class*="bg-[#0b132b]/95"],
html[data-theme="light"] header[class*="bg-[#0b132b]"],
html[data-theme="light"] [class*="bg-[#0b132b]/80"],
html:not(.dark) header[class*="bg-[#0b132b]"],
html:not(.dark) [class*="bg-[#0b132b]/80"],
html:not(.dark) [class*="bg-[#0b132b]/90"],
html:not(.dark) [class*="bg-[#0b132b]/95"] {
  background-color: rgba(255, 255, 255, 0.94) !important;
  backdrop-filter: blur(12px) !important;
}

html.light [class*="bg-[#111d3d]"],
html[data-theme="light"] [class*="bg-[#111d3d]"],
html:not(.dark) [class*="bg-[#111d3d]"] {
  background-color: #f1f5f9 !important;
  border-color: #e2e8f0 !important;
}

html.light [class*="hover:bg-[#111d3d]"]:hover,
html[data-theme="light"] [class*="hover:bg-[#111d3d]"]:hover,
html:not(.dark) [class*="hover:bg-[#111d3d]"]:hover {
  background-color: #f1f5f9 !important;
}

html.light [class*="hover:bg-[#1a2c5a]"]:hover,
html[data-theme="light"] [class*="hover:bg-[#1a2c5a]"]:hover,
html:not(.dark) [class*="hover:bg-[#1a2c5a]"]:hover {
  background-color: #e2e8f0 !important;
}

html.light [class*="bg-[#070d1a]/50"],
html.light [class*="bg-[#070d1a]/70"],
html[data-theme="light"] [class*="bg-[#070d1a]/50"],
html:not(.dark) [class*="bg-[#070d1a]/50"],
html:not(.dark) [class*="bg-[#070d1a]/70"] {
  background-color: rgba(241, 245, 249, 0.75) !important;
}

/* 2. Overriding Dark Gradients & Specialized Stat Cards */
/* Qualified Leads Card */
html.light [class*="to-[#0e2427]"],
html[data-theme="light"] [class*="to-[#0e2427]"],
html:not(.dark) [class*="to-[#0e2427]"] {
  background-image: none !important;
  background-color: #ffffff !important;
  border-color: #a7f3d0 !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
}

/* Conversion Rate Card */
html.light [class*="to-[#12233f]"],
html[data-theme="light"] [class*="to-[#12233f]"],
html:not(.dark) [class*="to-[#12233f]"] {
  background-image: none !important;
  background-color: #ffffff !important;
  border-color: #99f6e4 !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
}

/* Overdue Consultations Card */
html.light [class*="to-[#25101a]"],
html[data-theme="light"] [class*="to-[#25101a]"],
html:not(.dark) [class*="to-[#25101a]"] {
  background-image: none !important;
  background-color: #ffffff !important;
  border-color: #fecdd3 !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
}

html.light [class*="to-[#25101a]"] [class*="text-rose-400"],
html[data-theme="light"] [class*="to-[#25101a]"] [class*="text-rose-400"] {
  color: #e11d48 !important;
}

html.light [class*="to-[#25101a]"] [class*="text-rose-300"],
html[data-theme="light"] [class*="to-[#25101a]"] [class*="text-rose-300"] {
  color: #be123c !important;
}

/* Staff & Team Management Admin Banner */
html.light [class*="from-purple-950"],
html[data-theme="light"] [class*="from-purple-950"],
html:not(.dark) [class*="from-purple-950"] {
  background-image: none !important;
  background-color: #faf5ff !important;
  border-color: #e9d5ff !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
}

html.light [class*="from-purple-950"] h3,
html[data-theme="light"] [class*="from-purple-950"] h3 {
  color: #0f172a !important;
}

html.light [class*="from-purple-950"] p,
html[data-theme="light"] [class*="from-purple-950"] p {
  color: #475569 !important;
}

html.light [class*="from-purple-950"] [class*="bg-purple-500/20"],
html[data-theme="light"] [class*="from-purple-950"] [class*="bg-purple-500/20"] {
  background-color: #f3e8ff !important;
  color: #7e22ce !important;
  border-color: #d8b4fe !important;
}

/* Meta CTWA & CAPI Sidebar Banner */
html.light [class*="from-[#111d3d]"][class*="to-[#0b132b]"],
html[data-theme="light"] [class*="from-[#111d3d]"][class*="to-[#0b132b]"],
html:not(.dark) [class*="from-[#111d3d]"][class*="to-[#0b132b]"] {
  background-image: none !important;
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
}

html.light [class*="from-[#111d3d]"][class*="to-[#0b132b]"] p,
html[data-theme="light"] [class*="from-[#111d3d]"][class*="to-[#0b132b]"] p {
  color: #475569 !important;
}

/* Meta CTWA Lead Detail Modal Banner */
html.light [class*="from-[#0d2826]"],
html[data-theme="light"] [class*="from-[#0d2826]"],
html:not(.dark) [class*="from-[#0d2826]"] {
  background-image: none !important;
  background-color: #ecfdf5 !important;
  border-color: #a7f3d0 !important;
  color: #047857 !important;
}

/* 3. WhatsApp Business Cloud Inbox in Light Mode */
/* Chat Container Outer Shell */
html.light [class*="h-[78vh]"],
html[data-theme="light"] [class*="h-[78vh]"] {
  background-color: #ffffff !important;
  border-color: #e2e8f0 !important;
}

/* Left Conversations Column */
html.light [class*="md:w-80"],
html[data-theme="light"] [class*="md:w-80"] {
  background-color: #ffffff !important;
  border-color: #e2e8f0 !important;
}

/* Conversation Item Hover and Active */
html.light [class*="hover:bg-[#0e172e]"]:hover,
html[data-theme="light"] [class*="hover:bg-[#0e172e]"]:hover {
  background-color: #f8fafc !important;
}

html.light [class*="bg-[#111d3d]"][class*="border-emerald-400"],
html[data-theme="light"] [class*="bg-[#111d3d]"][class*="border-emerald-400"] {
  background-color: #ecfdf5 !important;
}

/* Avatar Circles in Conversation List */
html.light [class*="bg-slate-800"],
html[data-theme="light"] [class*="bg-slate-800"] {
  background-color: #e2e8f0 !important;
  color: #1e293b !important;
  border-color: #cbd5e1 !important;
}

/* Right Column Active Chat Header */
html.light [class*="px-5"][class*="bg-[#070d1a]"],
html[data-theme="light"] [class*="px-5"][class*="bg-[#070d1a]"] {
  background-color: #ffffff !important;
  border-color: #e2e8f0 !important;
}

/* Quick Travel Templates Bar */
html.light [class*="bg-[#091124]"],
html[data-theme="light"] [class*="bg-[#091124]"] {
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
}

html.light [class*="bg-[#091124]"] button,
html[data-theme="light"] [class*="bg-[#091124]"] button {
  background-color: #ffffff !important;
  border-color: #cbd5e1 !important;
  color: #334155 !important;
}

html.light [class*="bg-[#091124]"] button:hover,
html[data-theme="light"] [class*="bg-[#091124]"] button:hover {
  background-color: #ecfdf5 !important;
  border-color: #10b981 !important;
  color: #047857 !important;
}

/* Messages Feed Background */
html.light [class*="bg-[#080e21]"],
html[data-theme="light"] [class*="bg-[#080e21]"] {
  background-color: #f1f5f9 !important;
  border-color: #e2e8f0 !important;
}

/* Inbound Messages (Customer) */
html.light [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"],
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"] {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border-color: #e2e8f0 !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
}

html.light [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"] p,
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"] p {
  color: #0f172a !important;
}

html.light [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"] span,
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-[#111d3d]"] span {
  color: #64748b !important;
}

/* Outbound Messages (Agent) */
html.light [class*="bg-[#080e21]"] [class*="bg-emerald-600"],
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-emerald-600"] {
  background-color: #059669 !important;
  color: #ffffff !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.08) !important;
}

html.light [class*="bg-[#080e21]"] [class*="bg-emerald-600"] p,
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-emerald-600"] p {
  color: #ffffff !important;
}

html.light [class*="bg-[#080e21]"] [class*="bg-emerald-600"] span,
html[data-theme="light"] [class*="bg-[#080e21]"] [class*="bg-emerald-600"] span {
  color: rgba(255, 255, 255, 0.85) !important;
}

/* Message Composer Bar at Bottom */
html.light form[class*="bg-[#070d1a]"],
html[data-theme="light"] form[class*="bg-[#070d1a]"] {
  background-color: #ffffff !important;
  border-color: #e2e8f0 !important;
}

html.light form[class*="bg-[#070d1a]"] input,
html[data-theme="light"] form[class*="bg-[#070d1a]"] input {
  background-color: #f8fafc !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
}

/* 4. Borders & Dividers */
html.light [class*="border-[#1e293b]"],
html[data-theme="light"] [class*="border-[#1e293b]"],
html:not(.dark) [class*="border-[#1e293b]"] {
  border-color: #e2e8f0 !important;
}

html.light [class*="border-slate-700"],
html[data-theme="light"] [class*="border-slate-700"],
html:not(.dark) [class*="border-slate-700"] {
  border-color: #e2e8f0 !important;
}

html.light [class*="border-slate-800"],
html[data-theme="light"] [class*="border-slate-800"],
html:not(.dark) [class*="border-slate-800"] {
  border-color: #e2e8f0 !important;
}

html.light [class*="divide-[#1e293b]"] > *,
html[data-theme="light"] [class*="divide-[#1e293b]"] > * {
  border-color: #e2e8f0 !important;
}

/* 5. Typography & Text Colors */
html.light [class*="text-white"],
html.light .text-white,
html[data-theme="light"] [class*="text-white"],
html[data-theme="light"] .text-white,
html:not(.dark) [class*="text-white"],
html:not(.dark) .text-white {
  color: #0f172a !important;
}

html.light [class*="text-slate-100"],
html.light .text-slate-100,
html[data-theme="light"] [class*="text-slate-100"],
html:not(.dark) [class*="text-slate-100"],
html:not(.dark) .text-slate-100 {
  color: #0f172a !important;
}

html.light [class*="text-slate-200"],
html.light .text-slate-200,
html[data-theme="light"] [class*="text-slate-200"],
html:not(.dark) [class*="text-slate-200"],
html:not(.dark) .text-slate-200 {
  color: #1e293b !important;
}

html.light [class*="text-slate-300"],
html.light .text-slate-300,
html[data-theme="light"] [class*="text-slate-300"],
html:not(.dark) [class*="text-slate-300"],
html:not(.dark) .text-slate-300 {
  color: #334155 !important;
}

html.light [class*="text-slate-400"],
html.light .text-slate-400,
html[data-theme="light"] [class*="text-slate-400"],
html:not(.dark) [class*="text-slate-400"],
html:not(.dark) .text-slate-400 {
  color: #64748b !important;
}

html.light [class*="text-slate-500"],
html.light .text-slate-500,
html[data-theme="light"] [class*="text-slate-500"],
html:not(.dark) [class*="text-slate-500"],
html:not(.dark) .text-slate-500 {
  color: #64748b !important;
}

html.light [class*="hover:text-white"]:hover,
html[data-theme="light"] [class*="hover:text-white"]:hover,
html:not(.dark) [class*="hover:text-white"]:hover {
  color: #0f172a !important;
}

/* Light Mode Accent Numbers & Metrics (Deep readable colors) */
html.light [class*="text-cyan-300"],
html.light [class*="text-cyan-400"],
html[data-theme="light"] [class*="text-cyan-300"],
html:not(.dark) [class*="text-cyan-300"],
html:not(.dark) [class*="text-cyan-400"] {
  color: #0891b2 !important;
}

html.light [class*="text-green-300"],
html.light [class*="text-green-400"],
html[data-theme="light"] [class*="text-green-300"],
html:not(.dark) [class*="text-green-300"],
html:not(.dark) [class*="text-green-400"] {
  color: #059669 !important;
}

html.light [class*="text-teal-300"],
html.light [class*="text-teal-400"],
html[data-theme="light"] [class*="text-teal-300"],
html:not(.dark) [class*="text-teal-300"],
html:not(.dark) [class*="text-teal-400"] {
  color: #0d9488 !important;
}

html.light [class*="text-amber-300"],
html.light [class*="text-amber-400"],
html[data-theme="light"] [class*="text-amber-300"],
html:not(.dark) [class*="text-amber-300"],
html:not(.dark) [class*="text-amber-400"] {
  color: #b45309 !important;
}

html.light [class*="text-emerald-300"],
html.light [class*="text-emerald-400"],
html[data-theme="light"] [class*="text-emerald-300"],
html:not(.dark) [class*="text-emerald-300"],
html:not(.dark) [class*="text-emerald-400"] {
  color: #047857 !important;
}

/* 6. Form Controls (Inputs, Selects, Textareas) */
html.light input:not([type="checkbox"]):not([type="radio"]),
html.light select,
html.light textarea,
html[data-theme="light"] input:not([type="checkbox"]):not([type="radio"]),
html[data-theme="light"] select,
html[data-theme="light"] textarea,
html:not(.dark) input:not([type="checkbox"]):not([type="radio"]),
html:not(.dark) select,
html:not(.dark) textarea {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
}

html.light input::placeholder,
html.light textarea::placeholder,
html[data-theme="light"] input::placeholder,
html[data-theme="light"] textarea::placeholder,
html:not(.dark) input::placeholder,
html:not(.dark) textarea::placeholder {
  color: #94a3b8 !important;
}

/* 7. Preserve White Text ONLY on Solid Action Buttons */
html.light button[class*="bg-emerald-500"]:not([class*="/"]),
html.light button[class*="bg-emerald-600"]:not([class*="/"]),
html.light button[class*="bg-rose-500"]:not([class*="/"]),
html.light button[class*="bg-rose-600"]:not([class*="/"]),
html.light button[class*="bg-blue-600"]:not([class*="/"]),
html.light a[class*="bg-emerald-500"]:not([class*="/"]),
html[data-theme="light"] button[class*="bg-emerald-500"]:not([class*="/"]),
html[data-theme="light"] button[class*="bg-rose-500"]:not([class*="/"]),
html:not(.dark) button[class*="bg-emerald-500"]:not([class*="/"]),
html:not(.dark) button[class*="bg-emerald-600"]:not([class*="/"]),
html:not(.dark) button[class*="bg-rose-500"]:not([class*="/"]),
html:not(.dark) button[class*="bg-rose-600"]:not([class*="/"]),
html:not(.dark) button[class*="bg-blue-600"]:not([class*="/"]),
html:not(.dark) a[class*="bg-emerald-500"]:not([class*="/"]) {
  color: #ffffff !important;
}

html.light button[class*="bg-emerald-500"]:not([class*="/"]) *,
html.light button[class*="bg-emerald-600"]:not([class*="/"]) *,
html.light button[class*="bg-rose-500"]:not([class*="/"]) *,
html.light button[class*="bg-rose-600"]:not([class*="/"]) *,
html.light button[class*="bg-blue-600"]:not([class*="/"]) *,
html.light a[class*="bg-emerald-500"]:not([class*="/"]) *,
html[data-theme="light"] button[class*="bg-emerald-500"]:not([class*="/"]) *,
html[data-theme="light"] button[class*="bg-rose-500"]:not([class*="/"]) *,
html:not(.dark) button[class*="bg-emerald-500"]:not([class*="/"]) *,
html:not(.dark) button[class*="bg-emerald-600"]:not([class*="/"]) *,
html:not(.dark) button[class*="bg-rose-500"]:not([class*="/"]) *,
html:not(.dark) button[class*="bg-rose-600"]:not([class*="/"]) *,
html:not(.dark) button[class*="bg-blue-600"]:not([class*="/"]) *,
html:not(.dark) a[class*="bg-emerald-500"]:not([class*="/"]) * {
  color: #ffffff !important;
}

/* 8. Status Badges & Pills in Light Mode */
html.light [class*="bg-emerald-500/10"],
html.light [class*="bg-emerald-500/15"],
html.light [class*="bg-emerald-500/20"],
html[data-theme="light"] [class*="bg-emerald-500/10"],
html:not(.dark) [class*="bg-emerald-500/10"],
html:not(.dark) [class*="bg-emerald-500/15"],
html:not(.dark) [class*="bg-emerald-500/20"] {
  background-color: #ecfdf5 !important;
  color: #047857 !important;
  border-color: #a7f3d0 !important;
}

html.light [class*="bg-blue-500/10"],
html.light [class*="bg-blue-500/15"],
html.light [class*="bg-blue-500/20"],
html[data-theme="light"] [class*="bg-blue-500/10"],
html:not(.dark) [class*="bg-blue-500/10"],
html:not(.dark) [class*="bg-blue-500/15"],
html:not(.dark) [class*="bg-blue-500/20"] {
  background-color: #eff6ff !important;
  color: #1d4ed8 !important;
  border-color: #bfdbfe !important;
}

html.light [class*="bg-amber-500/10"],
html.light [class*="bg-amber-500/15"],
html.light [class*="bg-amber-500/20"],
html[data-theme="light"] [class*="bg-amber-500/10"],
html:not(.dark) [class*="bg-amber-500/10"],
html:not(.dark) [class*="bg-amber-500/15"],
html:not(.dark) [class*="bg-amber-500/20"] {
  background-color: #fffbeb !important;
  color: #b45309 !important;
  border-color: #fde68a !important;
}

html.light [class*="bg-purple-500/10"],
html.light [class*="bg-purple-500/15"],
html.light [class*="bg-purple-500/20"],
html[data-theme="light"] [class*="bg-purple-500/10"],
html:not(.dark) [class*="bg-purple-500/10"],
html:not(.dark) [class*="bg-purple-500/15"],
html:not(.dark) [class*="bg-purple-500/20"] {
  background-color: #faf5ff !important;
  color: #7e22ce !important;
  border-color: #e9d5ff !important;
}

html.light [class*="bg-rose-500/10"],
html.light [class*="bg-rose-500/15"],
html.light [class*="bg-rose-500/20"],
html[data-theme="light"] [class*="bg-rose-500/10"],
html:not(.dark) [class*="bg-rose-500/10"],
html:not(.dark) [class*="bg-rose-500/15"],
html:not(.dark) [class*="bg-rose-500/20"] {
  background-color: #fff1f2 !important;
  color: #be123c !important;
  border-color: #fecdd3 !important;
}

/* 9. Dialog / Modal Backdrops */
html.light [class*="bg-black/80"],
html.light [class*="bg-black/70"],
html[data-theme="light"] [class*="bg-black/80"],
html:not(.dark) [class*="bg-black/80"],
html:not(.dark) [class*="bg-black/70"] {
  background-color: rgba(15, 23, 42, 0.45) !important;
}

/* 10. SweetAlert2 in Light Mode */
html.light .swal2-popup,
html[data-theme="light"] .swal2-popup,
html:not(.dark) .swal2-popup {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
}

html.light .swal2-title,
html[data-theme="light"] .swal2-title,
html:not(.dark) .swal2-title {
  color: #0f172a !important;
}

html.light .swal2-html-container,
html[data-theme="light"] .swal2-html-container,
html:not(.dark) .swal2-html-container {
  color: #475569 !important;
}

html.light .swal2-toast,
html[data-theme="light"] .swal2-toast,
html:not(.dark) .swal2-toast {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid #e2e8f0 !important;
}

html.light .swal2-cancel,
html[data-theme="light"] .swal2-cancel,
html:not(.dark) .swal2-cancel {
  background-color: #f1f5f9 !important;
  color: #334155 !important;
  border-color: #cbd5e1 !important;
}

/* 11. Scrollbars */
html.light ::-webkit-scrollbar-track,
html[data-theme="light"] ::-webkit-scrollbar-track,
html:not(.dark) ::-webkit-scrollbar-track {
  background: #f1f5f9;
}

html.light ::-webkit-scrollbar-thumb,
html[data-theme="light"] ::-webkit-scrollbar-thumb,
html:not(.dark) ::-webkit-scrollbar-thumb {
  background: #cbd5e1;
}

html.light ::-webkit-scrollbar-thumb:hover,
html[data-theme="light"] ::-webkit-scrollbar-thumb:hover,
html:not(.dark) ::-webkit-scrollbar-thumb:hover {
  background: #10b981;
}

/* 12. Apple Mobile Navigation Bar Light Mode */
html.light nav[aria-label="Mobile Navigation"],
html[data-theme="light"] nav[aria-label="Mobile Navigation"],
html:not(.dark) nav[aria-label="Mobile Navigation"] {
  background-color: rgba(255, 255, 255, 0.92) !important;
  border-top-color: #e2e8f0 !important;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06) !important;
}

html.light nav[aria-label="Mobile Navigation"] button,
html[data-theme="light"] nav[aria-label="Mobile Navigation"] button,
html:not(.dark) nav[aria-label="Mobile Navigation"] button {
  color: #64748b;
}

html.light nav[aria-label="Mobile Navigation"] button.text-emerald-400,
html[data-theme="light"] nav[aria-label="Mobile Navigation"] button.text-emerald-400,
html:not(.dark) nav[aria-label="Mobile Navigation"] button.text-emerald-400 {
  color: #059669 !important;
}
`;
