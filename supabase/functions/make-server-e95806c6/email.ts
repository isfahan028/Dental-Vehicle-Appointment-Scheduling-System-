// Transactional email via Resend (https://resend.com). Best-effort only:
// sendEmail() NEVER throws — a broken/missing API key or a Resend outage
// must never break the booking/approval action that triggered the email.
// Requires the RESEND_API_KEY secret; without it we just log and skip.
//
// NOTE: until a sending domain is verified in Resend, it will only actually
// deliver to the email address the Resend account itself was created with
// (its sandbox restriction) — sending to any other address returns an error
// from Resend's API, which we catch and log below.

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'DentalMove <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Email send failed (${res.status}) to ${to}: ${body}`);
      return;
    }
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`Email send threw for ${to}:`, err);
  }
}

function layout(heading: string, bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <div style="background: #2563eb; color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <span style="font-size: 20px; font-weight: bold;">🦷 DentalMove</span>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <h2 style="margin-top: 0; color: #111827;">${heading}</h2>
        ${bodyHtml}
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">— DentalMove</p>
      </div>
    </div>
  `;
}

function detailsTable(rows: [string, string][]): string {
  const cells = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6b7280;">${label}</td>
          <td style="padding: 4px 0; font-weight: bold; color: #111827;">${value}</td>
        </tr>`,
    )
    .join('');
  return `<table style="border-collapse: collapse; margin: 16px 0;">${cells}</table>`;
}

interface AppointmentEmailInfo {
  patientName: string;
  serviceName: string;
  vehicleName: string;
  date: string;
  time: string;
  price?: number | null;
}

function appointmentRows(info: AppointmentEmailInfo): [string, string][] {
  const rows: [string, string][] = [
    ['Service', info.serviceName],
    ['Vehicle', info.vehicleName],
    ['Date', info.date],
    ['Time', info.time],
  ];
  if (info.price != null) rows.push(['Price', `฿${info.price}`]);
  return rows;
}

export function appointmentConfirmedEmail(info: AppointmentEmailInfo) {
  return {
    subject: 'Your appointment is confirmed',
    html: layout(
      'Appointment Confirmed',
      `<p>Hi ${info.patientName}, thanks for booking with us! Here's what we have:</p>
       ${detailsTable(appointmentRows(info))}
       <p>Your booking is <strong>Pending</strong> review — we'll email you again once it's approved.</p>`,
    ),
  };
}

export function appointmentApprovedEmail(info: AppointmentEmailInfo) {
  return {
    subject: 'Your appointment has been approved',
    html: layout(
      'Appointment Approved ✅',
      `<p>Hi ${info.patientName}, good news — your appointment below has been approved.</p>
       ${detailsTable(appointmentRows(info))}
       <p>See you then!</p>`,
    ),
  };
}

export function appointmentCancelledEmail(info: AppointmentEmailInfo) {
  return {
    subject: 'Your appointment has been cancelled',
    html: layout(
      'Appointment Cancelled',
      `<p>Hi ${info.patientName}, the appointment below has been cancelled.</p>
       ${detailsTable(appointmentRows(info))}
       <p>If this wasn't expected, or you'd like to rebook, just visit DentalMove again.</p>`,
    ),
  };
}

export function recurringApprovedEmail(info: {
  patientName: string;
  serviceName: string;
  vehicleName: string;
  time: string;
  monthsRequested: number;
  createdCount: number;
  skippedDates: string[];
  monthlyPrice?: number | null;
}) {
  const rows: [string, string][] = [
    ['Service', info.serviceName],
    ['Vehicle', info.vehicleName],
    ['Time', info.time],
    ['Months booked', `${info.createdCount} of ${info.monthsRequested}`],
  ];
  if (info.monthlyPrice != null) rows.push(['Price', `฿${info.monthlyPrice}/month`]);

  return {
    subject: 'Your recurring appointment request was approved',
    html: layout(
      'Recurring Request Approved ✅',
      `<p>Hi ${info.patientName}, your recurring booking request has been approved.</p>
       ${detailsTable(rows)}
       ${
         info.skippedDates.length > 0
           ? `<p style="color: #b45309;">Note: these dates were already booked and skipped — please contact us to reschedule them: <strong>${info.skippedDates.join(', ')}</strong>.</p>`
           : ''
       }
       <p>Check "My Appointments" on DentalMove to see every date.</p>`,
    ),
  };
}

export function recurringRejectedEmail(info: {
  patientName: string;
  serviceName: string;
  adminNote?: string | null;
}) {
  return {
    subject: 'Your recurring appointment request was declined',
    html: layout(
      'Recurring Request Declined',
      `<p>Hi ${info.patientName}, unfortunately your request for a recurring "${info.serviceName}" booking was declined.</p>
       ${info.adminNote ? `<p style="color: #6b7280;">Note from the clinic: "${info.adminNote}"</p>` : ''}
       <p>Feel free to submit a new request or book a one-time appointment instead.</p>`,
    ),
  };
}
