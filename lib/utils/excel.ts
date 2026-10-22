import * as XLSX from 'xlsx';
import { Lead } from '../types/crm';
import { formatPhoneDisplay } from './phone';

export interface TelecallerExportOptions {
  telecallerName?: string;
  stageFilter?: string;
  priorityOnly?: boolean;
}

/**
 * Generates and downloads a professionally formatted Excel (.xlsx) calling sheet
 * specifically designed for telecallers, sales reps, and calling teams.
 */
export function exportTelecallerExcelSheet(leads: Lead[], options?: TelecallerExportOptions): void {
  // 1. Filter leads if specific telecaller or priority is selected
  let callingList = [...leads];

  if (options?.telecallerName && options.telecallerName !== 'ALL') {
    callingList = callingList.filter(
      (l) => l.assigned_salesperson?.full_name === options.telecallerName ||
             (options.telecallerName === 'Unassigned' && !l.assigned_salesperson_id)
    );
  }

  if (options?.stageFilter && options.stageFilter !== 'ALL') {
    callingList = callingList.filter((l) => l.lead_status === options.stageFilter);
  }

  // Sort by calling priority:
  // Overdue follow-ups first -> Today's follow-ups -> NEW leads -> CONTACTED -> QUALIFIED -> Others
  const now = Date.now();
  callingList.sort((a, b) => {
    const aFollow = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity;
    const bFollow = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity;

    const aIsOverdue = aFollow < now && !a.follow_up_completed;
    const bIsOverdue = bFollow < now && !b.follow_up_completed;

    if (aIsOverdue && !bIsOverdue) return -1;
    if (!aIsOverdue && bIsOverdue) return 1;

    // Next prioritize NEW status
    if (a.lead_status === 'NEW' && b.lead_status !== 'NEW') return -1;
    if (a.lead_status !== 'NEW' && b.lead_status === 'NEW') return 1;

    return aFollow - bFollow;
  });

  // 2. Build Telecaller Row Data with specialized calling columns
  const rows = callingList.map((lead, index) => {
    const isOverdue =
      lead.follow_up_date &&
      !lead.follow_up_completed &&
      new Date(lead.follow_up_date).getTime() < now;

    let callPriority = 'Normal';
    if (isOverdue) callPriority = 'URGENT: OVERDUE CALL';
    else if (lead.lead_status === 'NEW') callPriority = 'HIGH: NEW INBOUND';
    else if (lead.qualification_status === 'QUALIFIED') callPriority = 'HOT PROSPECT';
    else if (lead.follow_up_date && !lead.follow_up_completed) callPriority = 'SCHEDULED FOLLOW-UP';

    return {
      'S.No': index + 1,
      'Calling Priority': callPriority,
      'Customer Name': lead.name,
      'Phone Number': formatPhoneDisplay(lead.phone),
      'Direct Dial (E.164)': `+${lead.phone}`,
      'WhatsApp Quick Link': `https://wa.me/${lead.phone}`,
      'Email': lead.email || 'N/A',
      'Lead Source': lead.lead_source,
      'Meta Ad / CTWA': lead.ctwa_clid ? 'Yes (Ad Lead)' : 'No',
      'Interested Destination / Tour Package': lead.interested_destination || 'General Travel Enquiry',
      'Tentative Travel Dates': lead.travel_dates || 'Flexible',
      'Travelers Count': lead.number_of_travelers ? `${lead.number_of_travelers} Persons` : 'Not specified',
      'Estimated Budget (INR)': lead.estimated_budget ? `₹${Number(lead.estimated_budget).toLocaleString('en-IN')}` : 'Unquoted',
      'Current Pipeline Stage': lead.lead_status,
      'Qualification Status': lead.qualification_status,
      'Assigned Staff': lead.assigned_salesperson?.full_name || 'Unassigned',
      'Scheduled Call Date & Time': lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleString() : 'No schedule set',
      'Follow-up Agenda / Past Notes': lead.follow_up_notes || 'Initial consultation call required',
      'Internal CRM Notes': lead.internal_notes || '',
      'Call Outcome (Fill after call)': '', // Blank column for staff
      'Revised Follow-up Date': '',         // Blank column for staff
      'Staff Remarks / Feedback': '',  // Blank column for staff
    };
  });

  // 3. Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 4. Set column widths for comfortable printing & viewing in Excel
  const colWidths = [
    { wch: 6 },  // S.No
    { wch: 22 }, // Priority
    { wch: 22 }, // Name
    { wch: 18 }, // Phone
    { wch: 16 }, // Direct Dial
    { wch: 28 }, // WhatsApp
    { wch: 24 }, // Email
    { wch: 14 }, // Source
    { wch: 14 }, // Meta Ad
    { wch: 34 }, // Destination
    { wch: 22 }, // Travel Dates
    { wch: 14 }, // Travelers
    { wch: 20 }, // Budget
    { wch: 18 }, // Stage
    { wch: 18 }, // Qualification
    { wch: 20 }, // Assigned Staff
    { wch: 24 }, // Scheduled Date
    { wch: 35 }, // Follow-up Notes
    { wch: 30 }, // Internal Notes
    { wch: 24 }, // Call Outcome (Blank)
    { wch: 22 }, // Revised Date (Blank)
    { wch: 35 }, // Staff Remarks (Blank)
  ];
  worksheet['!cols'] = colWidths;

  // 5. Create workbook and append sheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Calling Sheet');

  // 6. Generate filename with date and staff name
  const dateStr = new Date().toISOString().slice(0, 10);
  const staffSlug = options?.telecallerName && options.telecallerName !== 'ALL'
    ? `_${options.telecallerName.replace(/\s+/g, '_')}`
    : '_All_Staff';
  const filename = `Tripinn_Calling_Sheet${staffSlug}_${dateStr}.xlsx`;

  // 7. Write and trigger download in browser
  XLSX.writeFile(workbook, filename);
}
