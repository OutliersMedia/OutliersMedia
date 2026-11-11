const ADMIN_ALERT_EMAIL = 'outliersmedia22@gmail.com';
const BRAND_ACCENT = '#3428f8';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInr(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 'To be finalized';
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Flexible / Not specified';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildEmailLayout({ preheader, eyebrow, heading, intro, rows = [], ctaLabel, ctaUrl, footerNote }) {
  const rowsHtml = rows
    .filter((r) => r && r.value)
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #222222;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:36%;vertical-align:top;">
            ${escapeHtml(r.label)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #222222;color:#f5f5f5;font-size:14px;font-weight:600;vertical-align:top;word-break:break-word;">
            ${r.rawHtml ? r.value : escapeHtml(r.value)}
          </td>
        </tr>
      `
    )
    .join('');

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <div style="margin-top:28px;">
          <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;background:${BRAND_ACCENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;padding:14px 24px;border-radius:10px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5f5f5;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader || heading)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050505;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#0f0f0f;border:1px solid #222222;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="height:4px;background-color:${BRAND_ACCENT};"></td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${BRAND_ACCENT};">
                OUTLIERS MEDIA • ${escapeHtml(eyebrow)}
              </p>
              <h1 style="margin:0 0 14px 0;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">
                ${escapeHtml(heading)}
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#bbbbbb;">
                ${escapeHtml(intro)}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#080808;border:1px solid #222222;border-radius:12px;border-collapse:collapse;">
                ${rowsHtml}
              </table>

              ${ctaHtml}

              <div style="margin-top:28px;padding-top:18px;border-top:1px solid #222222;font-size:12px;color:#777777;line-height:1.5;">
                ${escapeHtml(footerNote || 'Outliers Media • Chandigarh, Mohali & Panchkula • outliersmedia22@gmail.com')}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(200).json({
      sent: false,
      skipped: true,
      reason: 'RESEND_API_KEY environment variable is not configured'
    });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Outliers Media <onboarding@resend.dev>';

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      type,
      website = {},
      clientEmail,
      clientName,
      appOrigin
    } = body;

    const businessName = website.business_name || clientName || 'Website Project';
    const websiteType = website.website_type || 'Business site';
    const dashboardBaseUrl = (appOrigin || 'https://outliersmedia.in').replace(/\/+$/, '');

    let toEmail = '';
    let subject = '';
    let html = '';

    if (type === 'new_request') {
      toEmail = ADMIN_ALERT_EMAIL;
      subject = `New Website Request: ${businessName} (${websiteType})`;
      html = buildEmailLayout({
        preheader: `${businessName} submitted a new ${websiteType} request`,
        eyebrow: 'NEW WEBSITE BRIEF',
        heading: `New Website Request from ${businessName}`,
        intro: 'A client submitted a new website project brief from the Outliers Media Client Dashboard. Review the brief, set the agreed project amount, and move it to In Progress from Admin.',
        rows: [
          { label: 'Client Name', value: clientName || 'Registered Client' },
          { label: 'Client Email', value: clientEmail || 'Not provided' },
          { label: 'Business Name', value: businessName },
          { label: 'Website Type', value: websiteType },
          { label: 'Budget Shared', value: website.budget ? formatInr(website.budget) : 'Open / Flexible' },
          { label: 'Preferred Deadline', value: formatDate(website.preferred_deadline) },
          { label: 'Contact Number', value: website.contact_number || 'Not provided' },
          { label: 'Reference Links', value: website.reference_links || 'None provided' },
          { label: 'Project Brief', value: website.description || '—' }
        ],
        ctaLabel: 'Open Admin Websites Panel',
        ctaUrl: `${dashboardBaseUrl}/admin/websites`,
        footerNote: 'Outliers Media Command Center • Automated Website Brief Alert'
      });
    } else if (type === 'in_progress') {
      if (!clientEmail) {
        return res.status(400).json({ error: 'Client email is required for In Progress notification' });
      }
      toEmail = clientEmail;
      subject = `Your Website Project is In Progress — ${businessName}`;
      html = buildEmailLayout({
        preheader: `Good news! Our team has started building ${businessName}.`,
        eyebrow: 'PROJECT UPDATE • IN PROGRESS',
        heading: `Your Website Build Has Started`,
        intro: `Hi ${clientName || businessName}, great news — our team at Outliers Media has reviewed your brief and moved your ${websiteType} project into active development.`,
        rows: [
          { label: 'Project', value: businessName },
          { label: 'Website Type', value: websiteType },
          { label: 'Current Status', value: 'In Progress' },
          { label: 'Agreed Project Fee', value: website.agreed_amount ? formatInr(website.agreed_amount) : 'Confirmed with team' },
          { label: 'Target Deadline', value: formatDate(website.preferred_deadline) }
        ],
        ctaLabel: 'View Project Dashboard',
        ctaUrl: `${dashboardBaseUrl}/dashboard`,
        footerNote: 'Reply directly or contact outliersmedia22@gmail.com if you have any additions to share.'
      });
    } else if (type === 'delivered') {
      if (!clientEmail) {
        return res.status(400).json({ error: 'Client email is required for Delivered notification' });
      }
      toEmail = clientEmail;
      subject = `Your Website is Live & Delivered! — ${businessName}`;
      const safeLiveUrl = website.live_url
        ? (website.live_url.startsWith('http://') || website.live_url.startsWith('https://')
            ? website.live_url
            : `https://${website.live_url}`)
        : '';

      html = buildEmailLayout({
        preheader: `${businessName} has been delivered and is ready to view.`,
        eyebrow: 'PROJECT DELIVERED',
        heading: `Your Website Is Ready`,
        intro: `Hi ${clientName || businessName}, your website project with Outliers Media has been marked Delivered! You can preview your live site and check full project details in your dashboard.`,
        rows: [
          { label: 'Project', value: businessName },
          { label: 'Website Type', value: websiteType },
          { label: 'Status', value: 'Delivered' },
          {
            label: 'Live Website URL',
            rawHtml: Boolean(safeLiveUrl),
            value: safeLiveUrl
              ? `<a href="${escapeHtml(safeLiveUrl)}" target="_blank" rel="noopener noreferrer" style="color:${BRAND_ACCENT};text-decoration:underline;">${escapeHtml(safeLiveUrl)}</a>`
              : 'Available in your dashboard'
          },
          { label: 'Delivered On', value: formatDate(website.delivered_at || new Date().toISOString()) }
        ],
        ctaLabel: safeLiveUrl ? 'Visit Live Website' : 'Open Client Dashboard',
        ctaUrl: safeLiveUrl || `${dashboardBaseUrl}/dashboard`,
        footerNote: 'Thank you for building with Outliers Media • outliersmedia22@gmail.com'
      });
    } else {
      return res.status(400).json({ error: `Unsupported email event type: ${type}` });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: ADMIN_ALERT_EMAIL,
        subject,
        html
      })
    });

    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      return res.status(resendResponse.status).json({
        sent: false,
        error: resendPayload?.message || 'Resend API request failed'
      });
    }

    return res.status(200).json({
      sent: true,
      id: resendPayload?.id || null
    });
  } catch (err) {
    return res.status(500).json({
      sent: false,
      error: err?.message || 'Unexpected error sending email'
    });
  }
}
