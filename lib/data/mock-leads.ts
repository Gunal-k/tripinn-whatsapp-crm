import { Lead, LeadActivity, WhatsAppMessage } from '../types/crm';

export const INITIAL_MOCK_LEADS: Lead[] = [
  {
    id: 'lead-001',
    name: 'Aarav Mehta',
    phone: '919820123456',
    email: 'aarav.mehta@example.com',
    lead_source: 'WhatsApp',
    interested_destination: 'Bali Romance & Adventure 7D/6N',
    travel_dates: '2026-11-15 to 2026-11-22',
    number_of_travelers: 2,
    estimated_budget: 180000,
    lead_status: 'QUALIFIED',
    qualification_status: 'QUALIFIED',
    qualified_at: '2026-10-20T10:30:00Z',
    qualified_by: 'user-sales-01',
    assigned_salesperson_id: 'user-sales-01',
    assigned_salesperson: {
      id: 'user-sales-01',
      full_name: 'Priya Sharma',
      email: 'priya@tripinnholidays.com'
    },
    last_contact_date: '2026-10-21T09:15:00Z',
    follow_up_date: '2026-10-22T11:00:00Z',
    follow_up_notes: 'Share customized private pool villa package options in Seminyak and Ubud.',
    follow_up_completed: false,
    internal_notes: 'Couple celebrating 5th anniversary. High intent. Verified budget and travel dates.',
    ctwa_clid: 'ctwa_bali_ad_xyz987',
    meta_campaign_id: 'camp_diwali_getaways_2026',
    meta_ad_id: 'ad_bali_couples_offer',
    meta_conversion_sent: true,
    meta_conversion_sent_at: '2026-10-20T10:30:15Z',
    is_archived: false,
    created_at: '2026-10-19T14:22:00Z',
    updated_at: '2026-10-21T09:15:00Z'
  },
  {
    id: 'lead-002',
    name: 'Rohan Deshmukh',
    phone: '919876543210',
    email: 'rohan.d@example.com',
    lead_source: 'Facebook',
    interested_destination: 'Dubai Luxury Extravaganza with Desert Safari',
    travel_dates: '2026-12-24 to 2026-12-30',
    number_of_travelers: 4,
    estimated_budget: 350000,
    lead_status: 'PAYMENT_PENDING',
    qualification_status: 'QUALIFIED',
    qualified_at: '2026-10-18T16:00:00Z',
    qualified_by: 'user-sales-01',
    assigned_salesperson_id: 'user-sales-01',
    assigned_salesperson: {
      id: 'user-sales-01',
      full_name: 'Priya Sharma',
      email: 'priya@tripinnholidays.com'
    },
    last_contact_date: '2026-10-21T12:00:00Z',
    follow_up_date: '2026-10-21T17:00:00Z',
    follow_up_notes: 'Check if advance booking token payment link was completed via Razorpay.',
    follow_up_completed: false,
    internal_notes: 'Family trip (parents + 2 kids). Selected 5-star Atlantis The Palm itinerary.',
    ctwa_clid: 'ctwa_dubai_ad_456abc',
    meta_campaign_id: 'camp_winter_vacations_2026',
    meta_ad_id: 'ad_dubai_family_package',
    meta_conversion_sent: true,
    meta_conversion_sent_at: '2026-10-18T16:00:20Z',
    is_archived: false,
    created_at: '2026-10-17T11:05:00Z',
    updated_at: '2026-10-21T12:00:00Z'
  },
  {
    id: 'lead-003',
    name: 'Kavita Sundaram',
    phone: '919711223344',
    email: 'kavita.s@example.com',
    lead_source: 'WhatsApp',
    interested_destination: 'Vietnam & Cambodia Explorer',
    travel_dates: '2027-01-10 to 2027-01-20',
    number_of_travelers: 3,
    estimated_budget: 240000,
    lead_status: 'NEW',
    qualification_status: 'PENDING',
    qualified_at: null,
    qualified_by: null,
    assigned_salesperson_id: 'user-sales-02',
    assigned_salesperson: {
      id: 'user-sales-02',
      full_name: 'Rahul Varma',
      email: 'rahul@tripinnholidays.com'
    },
    last_contact_date: '2026-10-21T14:40:00Z',
    follow_up_date: '2026-10-21T15:30:00Z',
    follow_up_notes: 'Initial discovery call to confirm visa requirements and group preferences.',
    follow_up_completed: false,
    internal_notes: 'Messaged from WhatsApp ad. Needs Halong Bay cruise included.',
    ctwa_clid: 'ctwa_vietnam_click_789def',
    meta_campaign_id: 'camp_southeast_asia_2026',
    meta_ad_id: 'ad_vietnam_cruise',
    meta_conversion_sent: false,
    is_archived: false,
    created_at: '2026-10-21T14:38:00Z',
    updated_at: '2026-10-21T14:40:00Z'
  },
  {
    id: 'lead-004',
    name: 'Vikramaditya Roy',
    phone: '919988776655',
    email: 'vikram.roy@example.com',
    lead_source: 'website',
    interested_destination: 'Maldives Overwater Pool Villa',
    travel_dates: '2026-12-05 to 2026-12-10',
    number_of_travelers: 2,
    estimated_budget: 420000,
    lead_status: 'BOOKED',
    qualification_status: 'QUALIFIED',
    qualified_at: '2026-10-14T09:00:00Z',
    qualified_by: 'user-sales-01',
    assigned_salesperson_id: 'user-sales-01',
    assigned_salesperson: {
      id: 'user-sales-01',
      full_name: 'Priya Sharma',
      email: 'priya@tripinnholidays.com'
    },
    last_contact_date: '2026-10-20T18:00:00Z',
    follow_up_date: null,
    follow_up_notes: null,
    follow_up_completed: true,
    internal_notes: 'Honeymoon booking confirmed. Vouchers issued for Soneva Jani.',
    meta_conversion_sent: false,
    is_archived: false,
    created_at: '2026-10-12T08:15:00Z',
    updated_at: '2026-10-20T18:00:00Z'
  },
  {
    id: 'lead-005',
    name: 'Ananya Singhania',
    phone: '919123456789',
    email: 'ananya.singh@example.com',
    lead_source: 'Instagram',
    interested_destination: 'Kashmir Autumn Paradise 6D/5N',
    travel_dates: '2026-11-02 to 2026-11-07',
    number_of_travelers: 5,
    estimated_budget: 150000,
    lead_status: 'CONTACTED',
    qualification_status: 'PENDING',
    qualified_at: null,
    qualified_by: null,
    assigned_salesperson_id: 'user-sales-02',
    assigned_salesperson: {
      id: 'user-sales-02',
      full_name: 'Rahul Varma',
      email: 'rahul@tripinnholidays.com'
    },
    last_contact_date: '2026-10-20T15:20:00Z',
    follow_up_date: '2026-10-20T14:00:00Z', // Overdue for demonstration!
    follow_up_notes: 'Sent initial Kashmir PDF brochure. Need to follow up on house-boat option.',
    follow_up_completed: false,
    internal_notes: 'Group of friends wanting Gulmarg gondola ride and Pahalgam valley stay.',
    meta_conversion_sent: false,
    is_archived: false,
    created_at: '2026-10-19T11:00:00Z',
    updated_at: '2026-10-20T15:20:00Z'
  },
  {
    id: 'lead-006',
    name: 'Sameer Kulkarni',
    phone: '919654321098',
    email: 'sameer.k@example.com',
    lead_source: 'referral',
    interested_destination: 'Swiss Alps & Paris Highlights',
    travel_dates: '2027-04-15 to 2027-04-26',
    number_of_travelers: 2,
    estimated_budget: 600000,
    lead_status: 'COMPLETED',
    qualification_status: 'QUALIFIED',
    qualified_at: '2026-09-01T10:00:00Z',
    qualified_by: 'user-sales-01',
    assigned_salesperson_id: 'user-sales-01',
    assigned_salesperson: {
      id: 'user-sales-01',
      full_name: 'Priya Sharma',
      email: 'priya@tripinnholidays.com'
    },
    last_contact_date: '2026-10-15T11:30:00Z',
    follow_up_date: null,
    follow_up_notes: null,
    follow_up_completed: true,
    internal_notes: 'Repeat client. Full booking executed, feedback collected.',
    meta_conversion_sent: false,
    is_archived: false,
    created_at: '2026-08-25T10:00:00Z',
    updated_at: '2026-10-15T11:30:00Z'
  },
  {
    id: 'lead-007',
    name: 'Deepak Chawla',
    phone: '919543210987',
    email: null,
    lead_source: 'manual',
    interested_destination: 'Himachal Spiti Valley Expedition',
    travel_dates: null,
    number_of_travelers: 1,
    estimated_budget: 45000,
    lead_status: 'LOST',
    qualification_status: 'DISQUALIFIED',
    qualified_at: null,
    qualified_by: null,
    assigned_salesperson_id: 'user-sales-02',
    assigned_salesperson: {
      id: 'user-sales-02',
      full_name: 'Rahul Varma',
      email: 'rahul@tripinnholidays.com'
    },
    last_contact_date: '2026-10-18T10:00:00Z',
    follow_up_date: null,
    follow_up_notes: null,
    follow_up_completed: true,
    internal_notes: 'Budget was insufficient for standard safety/private vehicle tour.',
    meta_conversion_sent: false,
    is_archived: false,
    created_at: '2026-10-16T09:30:00Z',
    updated_at: '2026-10-18T10:00:00Z'
  }
];

export const INITIAL_MOCK_ACTIVITIES: Record<string, LeadActivity[]> = {
  'lead-001': [
    {
      id: 'act-001',
      lead_id: 'lead-001',
      activity_type: 'lead_created',
      title: 'Lead Ingested from WhatsApp CTWA Ad',
      description: 'Customer clicked ad "Bali Romance & Adventure" and initiated WhatsApp chat.',
      metadata: { ctwa_clid: 'ctwa_bali_ad_xyz987', campaign: 'camp_diwali_getaways_2026' },
      created_at: '2026-10-19T14:22:00Z'
    },
    {
      id: 'act-002',
      lead_id: 'lead-001',
      activity_type: 'whatsapp_inbound',
      title: 'WhatsApp Message Received',
      description: 'Hi, I saw your Bali couple package on Instagram/Facebook. Can you share details for mid-November?',
      created_at: '2026-10-19T14:22:05Z'
    },
    {
      id: 'act-003',
      lead_id: 'lead-001',
      activity_type: 'whatsapp_outbound',
      title: 'WhatsApp Message Sent',
      description: 'Hello Aarav! Welcome to Tripinn Holidays. I would be delighted to customize your Bali vacation.',
      performed_by: 'user-sales-01',
      created_at: '2026-10-19T14:25:00Z'
    },
    {
      id: 'act-004',
      lead_id: 'lead-001',
      activity_type: 'qualification',
      title: 'Lead Explicitly Qualified by Salesperson',
      description: 'Salesperson Priya Sharma verified 2 travelers, ₹1.8L budget, and confirmed travel dates in Nov.',
      performed_by: 'user-sales-01',
      created_at: '2026-10-20T10:30:00Z'
    },
    {
      id: 'act-005',
      lead_id: 'lead-001',
      activity_type: 'meta_conversion',
      title: 'Meta Conversions API Event Sent',
      description: 'Triggered official messaging conversion event "Lead" to Meta CAPI with ctwa_clid.',
      metadata: { event_name: 'Lead', status: '200_OK' },
      created_at: '2026-10-20T10:30:15Z'
    }
  ],
  'lead-003': [
    {
      id: 'act-101',
      lead_id: 'lead-003',
      activity_type: 'lead_created',
      title: 'Lead Created via WhatsApp',
      description: 'Inbound message from +91 97112 23344',
      created_at: '2026-10-21T14:38:00Z'
    },
    {
      id: 'act-102',
      lead_id: 'lead-003',
      activity_type: 'follow_up_scheduled',
      title: 'Follow-up Scheduled',
      description: 'Follow-up set for 2026-10-21 15:30',
      created_at: '2026-10-21T14:40:00Z'
    }
  ]
};

export const INITIAL_MOCK_MESSAGES: Record<string, WhatsAppMessage[]> = {
  'lead-001': [
    {
      id: 'msg-001',
      lead_id: 'lead-001',
      wamid: 'wamid.HBgMOTExOTgyMDEyMzQ1NhUCMR4XFDAxMjM0NTY3ODkwMTIzNDU2NwA=',
      direction: 'inbound',
      from_phone: '919820123456',
      to_phone: '919800000000',
      message_body: 'Hi, I saw your Bali couple package on Instagram/Facebook. Can you share details for mid-November?',
      message_type: 'text',
      status: 'received',
      created_at: '2026-10-19T14:22:05Z',
      updated_at: '2026-10-19T14:22:05Z'
    },
    {
      id: 'msg-002',
      lead_id: 'lead-001',
      wamid: 'wamid.HBgMOTExOTgwMDAwMDAwMBICMR4XFDk5OTg4ODc3NzY2NjU1NTQ0NAA=',
      direction: 'outbound',
      from_phone: '919800000000',
      to_phone: '919820123456',
      message_body: 'Hello Aarav! Welcome to Tripinn Holidays. I would be delighted to customize your Bali vacation. We have private pool villas in Seminyak and ocean view resorts in Nusa Dua. Could you share your preferred flight departure city?',
      message_type: 'text',
      status: 'read',
      created_at: '2026-10-19T14:25:00Z',
      updated_at: '2026-10-19T14:26:30Z'
    },
    {
      id: 'msg-003',
      lead_id: 'lead-001',
      wamid: 'wamid.HBgMOTExOTgyMDEyMzQ1NhUCMR4XFDExMjIzMzQ0NTU2Njc3ODg5OAA=',
      direction: 'inbound',
      from_phone: '919820123456',
      to_phone: '919800000000',
      message_body: 'We are flying from Mumbai. We want 3 nights Ubud and 3 nights Seminyak with floating breakfast and Mount Batur sunrise trek.',
      message_type: 'text',
      status: 'received',
      created_at: '2026-10-19T14:32:00Z',
      updated_at: '2026-10-19T14:32:00Z'
    },
    {
      id: 'msg-004',
      lead_id: 'lead-001',
      wamid: 'wamid.HBgMOTExOTgwMDAwMDAwMBICMR4XFDQ0NTU2Njc3ODg5OTAwMTEyMgA=',
      direction: 'outbound',
      from_phone: '919800000000',
      to_phone: '919820123456',
      message_body: 'Perfect choice! I have drafted an exclusive 7D/6N itinerary with private luxury transfers, floating breakfast, and the sunrise trek. Sending the PDF quotation right away.',
      message_type: 'text',
      status: 'delivered',
      created_at: '2026-10-21T09:15:00Z',
      updated_at: '2026-10-21T09:15:10Z'
    }
  ],
  'lead-003': [
    {
      id: 'msg-101',
      lead_id: 'lead-003',
      wamid: 'wamid.HBgMOTExOTcxMTIyMzM0NBICMR4XFDU1NjY3Nzg4OTkwMDExMjIzMwA=',
      direction: 'inbound',
      from_phone: '919711223344',
      to_phone: '919800000000',
      message_body: 'Hello, what is the best package for Vietnam in January for 3 adults?',
      message_type: 'text',
      status: 'received',
      created_at: '2026-10-21T14:38:00Z',
      updated_at: '2026-10-21T14:38:00Z'
    }
  ]
};
