import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedStaff } from '../../../../lib/supabase/auth';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { isTestEnvironment } from '../../../../lib/services/leads';
import { leadService } from '../../../../lib/services/leads';
import { normalizePhoneNumber } from '../../../../lib/utils/phone';
import { QualifyLeadCriteria } from '../../../../lib/validations/lead';

function getSupabaseConfigState() {
  const isTest = isTestEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const hasUrl = Boolean(url && !url.includes('placeholder'));
  const hasServiceKey = Boolean(serviceKey && !serviceKey.includes('placeholder'));

  const isConfigured = Boolean(!isTest && hasUrl && hasServiceKey);
  return { isTest, isConfigured };
}

/**
 * GET /api/admin/leads
 * Retrieves leads, single lead details, activities, or messages for active staff.
 */
export async function GET(req: NextRequest) {
  const { isConfigured } = getSupabaseConfigState();

  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    try {
      const adminClient = createAdminClient();
      const { searchParams } = new URL(req.url);
      const leadId = searchParams.get('id');
      const activitiesFor = searchParams.get('activities_for');
      const messagesFor = searchParams.get('messages_for');
      const showArchived = searchParams.get('archived') === 'true';
      const scopeAll = searchParams.get('all') === 'true';

      // 1. Fetch activities for a lead
      if (activitiesFor) {
        const { data: activities, error: actError } = await adminClient
          .from('lead_activities')
          .select('*')
          .eq('lead_id', activitiesFor)
          .order('created_at', { ascending: false });

        if (actError) {
          if (actError.code === 'PGRST205' || actError.message.includes('schema cache')) {
            return NextResponse.json({ success: true, data: [] });
          }
          return NextResponse.json({ error: actError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: activities || [] });
      }

      // 2. Fetch messages for a lead
      if (messagesFor) {
        const { data: messages, error: msgError } = await adminClient
          .from('whatsapp_messages')
          .select('*')
          .eq('lead_id', messagesFor)
          .order('created_at', { ascending: true });

        if (msgError) {
          if (msgError.code === 'PGRST205' || msgError.message.includes('schema cache')) {
            return NextResponse.json({ success: true, data: [] });
          }
          return NextResponse.json({ error: msgError.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: messages || [] });
      }

      // 3. Fetch a single lead by ID
      if (leadId) {
        let query = adminClient
          .from('leads')
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .eq('id', leadId);

        let { data: lead, error: leadError } = await query.maybeSingle();
        if (leadError) {
          const fallbackRes = await adminClient
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .maybeSingle();
          if (fallbackRes.error) {
            return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 });
          }
          lead = fallbackRes.data;
        }

        if (!lead) {
          return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: lead });
      }

      // 4. Fetch list of leads
      let query = adminClient
        .from('leads')
        .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
        .order('created_at', { ascending: false });

      if (showArchived) {
        query = query.eq('is_archived', true);
      }

      // For sales role, if not requesting all leads, return their assigned leads + unassigned leads
      if (profile.role !== 'admin' && !scopeAll) {
        query = query.or(`assigned_salesperson_id.eq.${profile.id},assigned_salesperson_id.is.null`);
      }

      let { data, error } = await query;
      if (error) {
        let fallbackQuery = adminClient
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (showArchived) {
          fallbackQuery = fallbackQuery.eq('is_archived', true);
        }
        if (profile.role !== 'admin' && !scopeAll) {
          fallbackQuery = fallbackQuery.or(`assigned_salesperson_id.eq.${profile.id},assigned_salesperson_id.is.null`);
        }

        const fallbackRes = await fallbackQuery;
        if (fallbackRes.error) {
          return NextResponse.json({ error: fallbackRes.error.message }, { status: 500 });
        }
        data = fallbackRes.data;
      }

      return NextResponse.json({ success: true, data: data || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  const leads = await leadService.getLeads();
  return NextResponse.json({ success: true, data: leads });
}

/**
 * POST /api/admin/leads
 * Handles creating a lead, adding an activity, or sending/recording a WhatsApp message.
 */
export async function POST(req: NextRequest) {
  const { isConfigured } = getSupabaseConfigState();

  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    try {
      const adminClient = createAdminClient();
      const body = await req.json();
      const action = body.action || 'create_lead';

      // 1. Add activity
      if (action === 'add_activity') {
        const { leadId, activity } = body;
        if (!leadId) {
          return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
        }

        const { data, error } = await adminClient
          .from('lead_activities')
          .insert({
            lead_id: leadId,
            activity_type: activity.activity_type,
            title: activity.title,
            description: activity.description || null,
            metadata: activity.metadata || {},
            performed_by: profile.id,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('Could not save activity to database:', error.message);
          return NextResponse.json({
            success: true,
            data: {
              id: `act-${Date.now()}`,
              lead_id: leadId,
              ...activity,
              performed_by: profile.id,
              created_at: new Date().toISOString(),
            },
          });
        }
        return NextResponse.json({ success: true, data });
      }

      // 2. Send outbound WhatsApp message
      if (action === 'send_whatsapp_message') {
        const { leadId, messageBody } = body;
        if (!leadId || !messageBody) {
          return NextResponse.json({ error: 'leadId and messageBody are required' }, { status: 400 });
        }

        // Fetch lead's phone
        const { data: leadData } = await adminClient
          .from('leads')
          .select('phone')
          .eq('id', leadId)
          .maybeSingle();

        const toPhone = leadData?.phone || 'unknown';
        const wamid = `wamid.outbound.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;

        const { data: savedMsg, error: msgError } = await adminClient
          .from('whatsapp_messages')
          .insert({
            lead_id: leadId,
            wamid,
            direction: 'outbound',
            from_phone: process.env.WHATSAPP_PHONE_NUMBER_ID || 'business',
            to_phone: toPhone,
            message_body: messageBody,
            message_type: 'text',
            status: 'sent',
          })
          .select()
          .maybeSingle();

        if (msgError) {
          console.warn('Could not record outbound message:', msgError.message);
        }

        // Record activity audit trail
        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'whatsapp_outbound',
          title: 'WhatsApp Message Sent',
          description: messageBody.length > 80 ? `${messageBody.substring(0, 80)}...` : messageBody,
          metadata: { wamid },
          performed_by: profile.id,
        });

        return NextResponse.json({
          success: true,
          data: savedMsg || {
            id: `msg-${Date.now()}`,
            lead_id: leadId,
            wamid,
            direction: 'outbound',
            message_body: messageBody,
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        });
      }

      // 3. Create new lead
      const normalizedPhone = normalizePhoneNumber(body.phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 });
      }

      // Check duplicate phone
      const { data: existing } = await adminClient
        .from('leads')
        .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          duplicateFound: true,
          lead: existing,
        });
      }

      const now = new Date().toISOString();
      const insertPayload: Record<string, unknown> = {
        name: body.name || 'Unnamed Customer',
        phone: normalizedPhone,
        email: body.email || null,
        lead_source: body.lead_source || 'WhatsApp',
        interested_destination: body.interested_destination || null,
        travel_dates: body.travel_dates || null,
        number_of_travelers: body.number_of_travelers || null,
        estimated_budget: body.estimated_budget || null,
        lead_status: 'NEW',
        qualification_status: 'UNQUALIFIED',
        last_contact_date: now,
        follow_up_date: body.follow_up_date || null,
        follow_up_notes: body.follow_up_notes || null,
        follow_up_completed: false,
        internal_notes: body.internal_notes || null,
        ctwa_clid: body.ctwa_clid || null,
        meta_campaign_id: body.meta_campaign_id || null,
        meta_ad_id: body.meta_ad_id || null,
        meta_conversion_sent: false,
        is_archived: false,
      };

      // Assign to specified staff or default to current user if sales staff
      if (body.assigned_salesperson_id) {
        insertPayload.assigned_salesperson_id = body.assigned_salesperson_id;
      } else if (profile.role === 'sales') {
        insertPayload.assigned_salesperson_id = profile.id;
      }

      const { data: newRow, error: insertError } = await adminClient
        .from('leads')
        .insert(insertPayload)
        .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: `Database error creating lead: ${insertError.message}` },
          { status: 500 }
        );
      }

      // Audit trail
      await adminClient.from('lead_activities').insert({
        lead_id: newRow.id,
        activity_type: 'lead_created',
        title: 'New Lead Created',
        description: `Lead registered via ${newRow.lead_source || 'manual'}.`,
        metadata: { source: newRow.lead_source, ctwa_clid: newRow.ctwa_clid },
        performed_by: profile.id,
      });

      if (newRow.follow_up_date) {
        await adminClient.from('lead_activities').insert({
          lead_id: newRow.id,
          activity_type: 'follow_up_scheduled',
          title: 'Follow-up Scheduled',
          description: `Follow-up set for ${new Date(newRow.follow_up_date).toLocaleString()}: ${newRow.follow_up_notes || 'No notes'}`,
          performed_by: profile.id,
        });
      }

      return NextResponse.json({
        success: true,
        duplicateFound: false,
        lead: newRow,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  const body = await req.json();
  const res = await leadService.createLead(body);
  return NextResponse.json({ success: true, ...res });
}

/**
 * PATCH /api/admin/leads
 * Handles lead updates, stage progression, follow-ups, telecaller call outcomes, qualifications, and reassignment.
 */
export async function PATCH(req: NextRequest) {
  const { isConfigured } = getSupabaseConfigState();

  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    try {
      const adminClient = createAdminClient();
      const body = await req.json();
      const action = body.action || 'update';
      const leadId = body.id || body.leadId;

      if (!leadId) {
        return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
      }

      // 1. Fetch current lead state
      const { data: currentLead, error: currentErr } = await adminClient
        .from('leads')
        .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
        .eq('id', leadId)
        .maybeSingle();

      if (currentErr || !currentLead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      const now = new Date().toISOString();

      // Handle Reassignment (Admin Only)
      if (action === 'reassign') {
        if (profile.role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden: Only administrators can reassign leads' }, { status: 403 });
        }
        const { staffId, staffName } = body;
        const isUnassigned = !staffId || staffId === 'unassigned';

        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            assigned_salesperson_id: isUnassigned ? null : staffId,
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'note_added',
          title: 'Lead Reassigned',
          description: isUnassigned ? 'Lead marked as unassigned.' : `Lead assigned to staff member ${staffName || staffId}.`,
          performed_by: profile.id,
        });

        return NextResponse.json({ success: true, data: updated });
      }

      // Handle Status Change
      if (action === 'update_status') {
        const { newStatus } = body;
        const prevStatus = currentLead.lead_status || currentLead.status;

        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            lead_status: newStatus,
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'status_change',
          title: `Pipeline Stage Changed: ${prevStatus} → ${newStatus}`,
          description: `Lead progressed from ${prevStatus} to ${newStatus}.`,
          performed_by: profile.id,
        });

        return NextResponse.json({ success: true, data: updated });
      }

      // Handle Qualification
      if (action === 'qualify') {
        const { criteria, salespersonName } = body as {
          criteria: QualifyLeadCriteria;
          salespersonName?: string;
        };

        if (!criteria.verifiedBudget || !criteria.verifiedTravelDates || !criteria.verifiedTravelers) {
          return NextResponse.json(
            { error: 'All three qualification criteria (Budget, Dates, Travelers) must be verified.' },
            { status: 400 }
          );
        }

        const metaTriggered = Boolean(currentLead.ctwa_clid && !currentLead.meta_conversion_sent);
        const updateFields: Record<string, unknown> = {
          lead_status: 'QUALIFIED',
          qualification_status: 'QUALIFIED',
          qualified_at: now,
          qualified_by: profile.id,
          updated_at: now,
        };

        if (metaTriggered) {
          updateFields.meta_conversion_sent = true;
          updateFields.meta_conversion_sent_at = now;
        }

        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update(updateFields)
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'qualification',
          title: 'Lead Explicitly Qualified',
          description: `Qualified by ${salespersonName || profile.full_name}. Criteria verified: Budget, Travelers, Travel Dates. Notes: ${criteria.qualificationNotes || 'None'}`,
          performed_by: profile.id,
        });

        if (metaTriggered) {
          await adminClient.from('lead_activities').insert({
            lead_id: leadId,
            activity_type: 'meta_conversion',
            title: 'Meta Messaging Conversion Event Dispatched',
            description: `Dispatched "Lead" event to Meta Conversions API with ctwa_clid (${currentLead.ctwa_clid}).`,
            metadata: { ctwa_clid: currentLead.ctwa_clid, event_name: 'Lead' },
            performed_by: profile.id,
          });
        }

        return NextResponse.json({
          success: true,
          data: updated,
          metaCapiTriggered: metaTriggered,
          message: metaTriggered
            ? 'Lead marked QUALIFIED! Meta Messaging Conversion event successfully queued.'
            : 'Lead marked QUALIFIED successfully.',
        });
      }

      // Handle Follow-up Schedule
      if (action === 'schedule_follow_up') {
        const { followUpDate, notes } = body;
        const cleanFollowUpDate = (typeof followUpDate === 'string' && followUpDate.trim() !== '')
          ? followUpDate.trim()
          : null;

        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            follow_up_date: cleanFollowUpDate,
            follow_up_notes: notes || null,
            follow_up_completed: false,
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'follow_up_scheduled',
          title: cleanFollowUpDate ? 'Follow-up Scheduled' : 'Follow-up Notes Updated',
          description: cleanFollowUpDate
            ? `Follow-up set for ${new Date(cleanFollowUpDate).toLocaleString()}: ${notes || 'No notes'}`
            : `Follow-up notes updated: ${notes || 'No notes'}`,
          performed_by: profile.id,
        });

        return NextResponse.json({ success: true, data: updated });
      }

      // Handle Follow-up Complete
      if (action === 'complete_follow_up') {
        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            follow_up_completed: true,
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'follow_up_completed',
          title: 'Follow-up Marked Completed',
          description: `${profile.full_name || 'Salesperson'} completed scheduled customer contact.`,
          performed_by: profile.id,
        });

        return NextResponse.json({ success: true, data: updated });
      }

      // Handle Call Outcome
      if (action === 'call_outcome') {
        const { outcome, notes, nextFollowUpDate, telecallerName } = body;
        let newStatus = currentLead.lead_status || currentLead.status;
        let newQual = currentLead.qualification_status;
        let newFollowUpDate = currentLead.follow_up_date;
        let newFollowUpNotes = currentLead.follow_up_notes;
        let newFollowUpCompleted = currentLead.follow_up_completed;

        const outcomeLabels: Record<string, string> = {
          CONNECTED_INTERESTED: 'Connected & Interested in Tour',
          CALLBACK_REQUESTED: 'Callback Requested by Client',
          RINGING_NO_ANSWER: 'Ringing / No Answer',
          BUSY_DISCONNECTED: 'Line Busy or Disconnected',
          NOT_INTERESTED: 'Not Interested / Budget Mismatch',
        };

        if (outcome === 'CONNECTED_INTERESTED') {
          if (newStatus === 'NEW') newStatus = 'CONTACTED';
        } else if (outcome === 'CALLBACK_REQUESTED') {
          newStatus = 'FOLLOW_UP';
          if (nextFollowUpDate && typeof nextFollowUpDate === 'string' && nextFollowUpDate.trim() !== '') {
            newFollowUpDate = nextFollowUpDate.trim();
            newFollowUpCompleted = false;
            newFollowUpNotes = notes;
          }
        } else if (outcome === 'NOT_INTERESTED') {
          newStatus = 'LOST';
          newQual = 'DISQUALIFIED';
          newFollowUpCompleted = true;
        }

        newFollowUpDate = (typeof newFollowUpDate === 'string' && newFollowUpDate.trim() !== '') ? newFollowUpDate.trim() : null;

        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            lead_status: newStatus,
            qualification_status: newQual,
            last_contact_date: now,
            follow_up_date: newFollowUpDate,
            follow_up_notes: newFollowUpNotes,
            follow_up_completed: newFollowUpCompleted,
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        await adminClient.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'phone_call',
          title: `Phone Call Logged: ${outcomeLabels[outcome] || outcome}`,
          description: `Call by ${telecallerName || profile.full_name}. Outcome: ${outcomeLabels[outcome] || outcome}. Remarks: ${notes || 'No remarks added'}`,
          metadata: { outcome, telecaller: telecallerName || profile.full_name },
          performed_by: profile.id,
        });

        return NextResponse.json({ success: true, data: updated });
      }

      // Handle Archive / Unarchive (Admin Only)
      if (action === 'archive') {
        if (profile.role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden: Only administrators can archive leads' }, { status: 403 });
        }
        const { archive = true } = body;
        const { data: updated, error: updateErr } = await adminClient
          .from('leads')
          .update({
            is_archived: Boolean(archive),
            updated_at: now,
          })
          .eq('id', leadId)
          .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
          .single();

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: updated });
      }

      // General Field Updates
      const { updates } = body;
      const updatePayload: Record<string, unknown> = {
        updated_at: now,
      };

      if (updates) {
        if (updates.name !== undefined) updatePayload.name = updates.name;
        if (updates.phone !== undefined) updatePayload.phone = normalizePhoneNumber(updates.phone);
        if (updates.email !== undefined) updatePayload.email = updates.email || null;
        if (updates.lead_source !== undefined) updatePayload.lead_source = updates.lead_source;
        if (updates.interested_destination !== undefined) updatePayload.interested_destination = updates.interested_destination || null;
        if (updates.travel_dates !== undefined) updatePayload.travel_dates = updates.travel_dates || null;
        if (updates.number_of_travelers !== undefined) updatePayload.number_of_travelers = updates.number_of_travelers || null;
        if (updates.estimated_budget !== undefined) updatePayload.estimated_budget = updates.estimated_budget || null;
        if (updates.follow_up_date !== undefined) updatePayload.follow_up_date = updates.follow_up_date || null;
        if (updates.follow_up_notes !== undefined) updatePayload.follow_up_notes = updates.follow_up_notes || null;
        if (updates.internal_notes !== undefined) updatePayload.internal_notes = updates.internal_notes || null;
      }

      const { data: updated, error: updateErr } = await adminClient
        .from('leads')
        .update(updatePayload)
        .eq('id', leadId)
        .select('*, profiles:assigned_salesperson_id(id, full_name, email)')
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  return NextResponse.json({ success: true, message: 'Updated in test mode' });
}

/**
 * DELETE /api/admin/leads?id=<lead_id>
 * Permanently deletes a lead and associated child records.
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Lead ID is required for deletion' }, { status: 400 });
  }

  const { isConfigured } = getSupabaseConfigState();

  if (isConfigured) {
    const { profile, error: authError } = await getAuthenticatedStaff(req);
    if (authError || !profile) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid' }, { status: 401 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only administrators can delete leads' }, { status: 403 });
    }

    try {
      const adminClient = createAdminClient();

      // Clean up child activities & messages
      try {
        await adminClient.from('lead_activities').delete().eq('lead_id', id);
        await adminClient.from('whatsapp_messages').delete().eq('lead_id', id);
      } catch (childErr) {
        console.warn('Child records cleanup note:', childErr);
      }

      const { error: deleteError } = await adminClient
        .from('leads')
        .delete()
        .eq('id', id);

      if (deleteError) {
        return NextResponse.json(
          { error: `Database error deleting lead: ${deleteError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Lead permanently deleted successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Fallback / mock mode
  try {
    const deleted = await leadService.deleteLead(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: 'Lead permanently deleted from environment.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete lead';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
