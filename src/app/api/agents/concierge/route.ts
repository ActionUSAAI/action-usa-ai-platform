import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://slasbfepqovdsezmadjh.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const RESEND_KEY    = process.env.RESEND_API_KEY!;
const FROM          = "ACTION USA AI <noreply@actionusaai.com>";
const SITE_URL      = "https://actionusaai.com";

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type MessageType =
  | "status_update" | "task_reminder" | "document_request"
  | "deadline_alert" | "welcome" | "completion" | "rfe_alert" | "custom";

type Audience = "client" | "admin" | "both";

function toneFor(messageType: MessageType): string {
  if (messageType === "deadline_alert" || messageType === "rfe_alert") return "urgent";
  if (messageType === "completion" || messageType === "welcome") return "warm";
  return "professional";
}

function priorityFor(messageType: MessageType): string {
  if (messageType === "deadline_alert" || messageType === "rfe_alert") return "urgent";
  return "normal";
}

interface ClaudeMessage {
  subject: string;
  body_text: string;
  body_html: string;
  generated_text: string;
}

async function callClaude(
  clientName: string,
  visaType: string,
  caseStatus: string,
  recentEvents: { event_type: string; description: string; event_date: string }[],
  triggerEvent: string,
  audience: Audience,
  messageType: MessageType,
  language: string,
): Promise<ClaudeMessage> {
  const tone = toneFor(messageType);

  const eventsText = recentEvents.length > 0
    ? recentEvents.map(e => `- [${e.event_date}] ${e.event_type}: ${e.description}`).join("\n")
    : "No recent events recorded.";

  const audienceNote = audience === "client"
    ? "You are writing directly to the client. Use warm, non-technical language. Avoid legal jargon."
    : audience === "admin"
    ? "You are writing a summary for the internal legal team. Be concise and precise."
    : "You are writing a message appropriate for both the client and the admin team.";

  const toneNote = {
    professional: "Maintain a professional, clear tone.",
    urgent: "This message is time-sensitive. Convey urgency clearly but without alarming the reader unnecessarily.",
    warm: "Use a warm, encouraging, and supportive tone.",
    celebratory: "This is good news! Use an upbeat, celebratory tone to share the achievement.",
  }[tone] ?? "Maintain a professional tone.";

  const systemPrompt = `You are the Client Concierge for ACTION USA AI, a premium immigration law firm specializing in extraordinary ability visas (O-1A, O-1B, EB-1A, EB-1B).

Your role is to communicate case progress to clients and staff in a clear, reassuring, and professional manner. You bridge the gap between complex immigration procedures and the client's understanding.

Guidelines:
- Never give legal advice or make promises about case outcomes
- Always reassure the client that their team is actively working on their case
- Reference specific case details when available to make messages feel personal
- Keep messages concise: 3-5 sentences for clients, slightly more detail for admins
- ${audienceNote}
- ${toneNote}
- Language: ${language === "es" ? "Respond entirely in Spanish." : "Respond in English."}

You must respond with a JSON object only — no markdown, no explanation — with this exact shape:
{
  "subject": "Email subject line (max 60 chars)",
  "body_text": "Plain text version of the message",
  "body_html": "HTML version wrapped in <p> tags",
  "generated_text": "The core message content (same as body_text)"
}`;

  const userPrompt = `Generate a ${messageType.replace(/_/g, " ")} message for the following case:

Client: ${clientName}
Visa type: ${visaType || "TBD"}
Current case status: ${caseStatus || "in progress"}
Trigger event: ${triggerEvent}

Recent case activity:
${eventsText}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";

  try {
    return JSON.parse(raw) as ClaudeMessage;
  } catch {
    // Fallback if Claude adds markdown fences
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ClaudeMessage;
    throw new Error("Claude response was not valid JSON: " + raw.slice(0, 200));
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.id as string;
}

export async function POST(request: NextRequest) {
  const db = adminDb();

  let body: {
    case_id: string;
    trigger_event: string;
    audience: Audience;
    message_type: MessageType;
    language?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { case_id, trigger_event, audience, message_type, language = "es" } = body;

  if (!case_id || !trigger_event || !audience || !message_type) {
    return NextResponse.json(
      { error: "Missing required fields: case_id, trigger_event, audience, message_type" },
      { status: 400 },
    );
  }

  // ── 1. Create agent_run record ────────────────────────────────────────────
  const { data: run, error: runErr } = await db
    .from("agent_runs")
    .insert({
      case_id,
      agent_name: "client_concierge",
      status: "running",
      started_at: new Date().toISOString(),
      input_snapshot: { trigger_event, audience, message_type, language },
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: "Failed to create agent run", detail: runErr?.message }, { status: 500 });
  }
  const runId = run.id as string;

  try {
    // ── 2. Fetch case context ───────────────────────────────────────────────
    const { data: caseRow, error: caseErr } = await db
      .from("cases")
      .select(`
        id, case_type, status,
        clients ( id, first_name, last_name, email, profile_id )
      `)
      .eq("id", case_id)
      .single();

    if (caseErr || !caseRow) {
      throw new Error(`Case not found: ${caseErr?.message}`);
    }

    const client = Array.isArray(caseRow.clients) ? caseRow.clients[0] : caseRow.clients;
    if (!client) throw new Error("No client linked to this case");

    const clientName = `${client.first_name} ${client.last_name}`.trim();
    const clientEmail = client.email as string;

    // ── 3. Fetch 3 most recent agent_case_events ──────────────────────────
    const { data: events } = await db
      .from("agent_case_events")
      .select("event_type, description, event_date")
      .eq("case_id", case_id)
      .order("event_date", { ascending: false })
      .limit(3);

    const recentEvents = (events ?? []) as { event_type: string; description: string; event_date: string }[];

    // ── 4. Call Claude ────────────────────────────────────────────────────
    const generated = await callClaude(
      clientName,
      caseRow.case_type as string,
      caseRow.status as string,
      recentEvents,
      trigger_event,
      audience,
      message_type,
      language,
    );

    // ── 5. Find recipient profile ─────────────────────────────────────────
    // For audience=admin we notify the admin profile; for client/both we notify the client.
    let recipientId = client.profile_id as string | null;

    if (audience === "admin") {
      const { data: adminProfile } = await db
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .single();
      recipientId = adminProfile?.id ?? recipientId;
    }

    if (!recipientId) throw new Error("No profile_id for recipient");

    // ── 6. Insert agent_notifications (pending) ───────────────────────────
    const { data: notification, error: notifErr } = await db
      .from("agent_notifications")
      .insert({
        run_id: runId,
        case_id,
        recipient_id: recipientId,
        recipient_role: audience,
        channel: "both",
        status: "pending",
        subject: generated.subject,
        body_text: generated.body_text,
        body_html: generated.body_html,
        action_url: `${SITE_URL}/portal`,
        action_label: language === "es" ? "Ver mi caso" : "View my case",
        trigger_event,
        source_agent: "client_concierge",
        priority: priorityFor(message_type),
      })
      .select("id")
      .single();

    if (notifErr || !notification) {
      throw new Error(`Failed to insert notification: ${notifErr?.message}`);
    }
    const notificationId = notification.id as string;

    // ── 7. Insert agent_concierge_messages ────────────────────────────────
    await db.from("agent_concierge_messages").insert({
      run_id: runId,
      case_id,
      notification_id: notificationId,
      message_type,
      audience,
      generated_text: generated.generated_text,
      tone: toneFor(message_type),
      language,
      context_snapshot: {
        clientName,
        visaType: caseRow.case_type,
        caseStatus: caseRow.status,
        recentEvents,
      },
    });

    // ── 8. Send email via Resend ──────────────────────────────────────────
    let resendId: string | null = null;
    let sendError: string | null = null;

    try {
      resendId = await sendEmail(clientEmail, generated.subject, generated.body_html);
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    // ── 9. Update notification status ────────────────────────────────────
    await db
      .from("agent_notifications")
      .update(
        sendError
          ? { status: "failed", error_detail: sendError }
          : { status: "sent", sent_at: new Date().toISOString(), resend_id: resendId },
      )
      .eq("id", notificationId);

    // ── 10. Complete agent_run ────────────────────────────────────────────
    await db
      .from("agent_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_summary: {
          notification_id: notificationId,
          email_sent: !sendError,
          subject: generated.subject,
        },
      })
      .eq("id", runId);

    return NextResponse.json({
      success: true,
      notification_id: notificationId,
      message_preview: generated.body_text.slice(0, 200),
      ...(sendError ? { email_warning: sendError } : {}),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await db
      .from("agent_runs")
      .update({ status: "failed", error_detail: msg, completed_at: new Date().toISOString() })
      .eq("id", runId);

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
