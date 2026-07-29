/* ============================================================
   Build the FCC Broadband Consumer Labels from one data file.

     node internal/build-fcc-labels.mjs

   Emits, both under internal/:
     fcc-label-preview.html   paste-ready <details> block per plan, plus a
                              preview page so the labels can be eyeballed
     broadband-labels.csv     the machine-readable version

   Generating both from internal/fcc-labels.data.json is the point: the FCC
   requires the on-page label and the machine-readable file to carry the same
   values, and hand-maintaining six labels plus a CSV is how they drift.

   The script REFUSES to emit anything marked publish-ready while a required
   value is still null. Fill the nulls in the data file, re-run, then paste
   each block into its matching <div class="fcc-slot" data-fcc="..."> in
   index.html and upload the CSV to the site root.
============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(HERE, 'fcc-labels.data.json'), 'utf8'));
const s = d.shared;

// ---- what is still missing -------------------------------------------------
const missing = [];
if (!d.frn) missing.push('frn (10-digit FCC Registration Number)');
if (!d.networkManagementUrl) missing.push('networkManagementUrl');
for (const p of d.plans) {
  for (const [k, label] of [['typicalDownMbps', 'typical download'], ['typicalUpMbps', 'typical upload'], ['typicalLatencyMs', 'typical latency']]) {
    if (p[k] == null) missing.push(`${p.name}: ${label}`);
  }
}

const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const gap = v => v == null ? '<span class="fcc-needed">NEEDED</span>' : esc(v);
const upi = p => d.frn ? `F${d.frn}${p.code}` : `F<span class="fcc-needed">FRN</span>${p.code}`;

const row = (label, value, cls = '') =>
  `    <div class="f-row${cls ? ' ' + cls : ''}"><span>${label}</span><span>${value}</span></div>`;
const ind = (label, value, cls = '') =>
  `    <div class="f-row${cls ? ' ' + cls : ''}"><span class="ind">${label}</span><span>${value}</span></div>`;

function label(p) {
  const kind = p.serviceType === 'Mobile' ? 'Mobile' : 'Fixed';
  const nm = d.networkManagementUrl
    ? `<a href="${esc(d.networkManagementUrl)}">Read our Policy</a>`
    : `<span class="fcc-needed">NEEDED: network management URL</span>`;
  return `<!-- paste into: <div class="fcc-slot" data-fcc="${esc(p.name)}"> -->
<details class="fcc-label">
  <summary>Broadband Facts label</summary>
  <div class="fcc-facts">
    <div class="f-title">Broadband Facts</div>
    <div class="f-provider">${esc(d.provider)}</div>
    <div class="f-plan">${esc(p.name)}</div>
    <div class="f-type">${kind} Broadband Consumer Disclosure</div>
${row('Monthly Price', '$' + esc(p.monthlyPrice), 'major')}
    <div class="f-note">This Monthly Price is ${s.introductoryRate ? '' : 'not '}an introductory rate.</div>
    <div class="f-note f-end">This Monthly Price does ${s.contractRequired ? '' : 'not '}require a contract.</div>
    <div class="f-row head"><span>Additional Charges &amp; Terms</span><span></span></div>
${ind('Provider Monthly Fees', esc(s.providerMonthlyFees))}
${ind('One-Time Fees at the Time of Purchase', '')}
${ind('&nbsp;&nbsp;' + esc(s.oneTimeFeeName), '$' + esc(s.oneTimeFeeAmount))}
${ind('Early Termination Fee', esc(s.earlyTerminationFee))}
${ind('Government Taxes', esc(s.governmentTaxes), 'f-end')}
${row('Discounts &amp; Bundles', `<a href="${esc(s.discountsBundlesUrl)}">${esc(s.discountsBundles)}</a>`, 'f-end')}
    <div class="f-row head"><span>Speeds Provided with Plan</span><span></span></div>
${ind('Typical Download Speed', gap(p.typicalDownMbps) + ' Mbps')}
${ind('Typical Upload Speed', gap(p.typicalUpMbps) + ' Mbps')}
${ind('Typical Latency', gap(p.typicalLatencyMs) + ' ms', 'f-end')}
${row('Data Included with Monthly Price', esc(s.dataIncluded))}
${ind('Charges for Additional Data Usage', esc(s.additionalDataCharge), 'f-end')}
${row('Network Management', nm)}
${row('Privacy', `<a href="${esc(d.privacyUrl)}">Read our Policy</a>`, 'f-end')}
    <div class="f-row head"><span>Customer Support</span><span></span></div>
${ind('Phone', `<a href="tel:${esc(d.supportPhoneE164)}">${esc(d.supportPhoneDisplay)}</a>`)}
${ind('Website', `<a href="${esc(d.supportUrl)}">wifisquared.com</a>`, 'f-end')}
    <div class="f-foot">Learn more about the terms used on this label by visiting the FCC's Consumer Resource Center. <a href="https://fcc.gov/consumer">fcc.gov/consumer</a></div>
    <div class="f-upi">Unique Plan Identifier: ${upi(p)}</div>
  </div>
</details>`;
}

// ---- CSV -------------------------------------------------------------------
const cols = ['provider_name', 'unique_plan_id', 'plan_name', 'service_type', 'monthly_price',
  'introductory_rate', 'contract_required', 'provider_monthly_fees', 'one_time_fee_name',
  'one_time_fee_amount', 'early_termination_fee', 'government_taxes', 'discounts_bundles_url',
  'typical_download_mbps', 'typical_upload_mbps', 'typical_latency_ms', 'data_included',
  'additional_data_charge', 'network_management_url', 'privacy_policy_url', 'support_phone', 'support_url'];

const cell = v => {
  const t = v == null ? 'NEEDED' : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const csv = [cols.join(',')].concat(d.plans.map(p => [
  d.provider, d.frn ? `F${d.frn}${p.code}` : `F<FRN>${p.code}`, p.name, p.serviceType, p.monthlyPrice,
  s.introductoryRate ? 'Yes' : 'No', s.contractRequired ? 'Yes' : 'No', s.providerMonthlyFees,
  s.oneTimeFeeName, s.oneTimeFeeAmount, s.earlyTerminationFee, s.governmentTaxes, s.discountsBundlesUrl,
  p.typicalDownMbps, p.typicalUpMbps, p.typicalLatencyMs, s.dataIncluded, s.additionalDataCharge,
  d.networkManagementUrl, d.privacyUrl, d.supportPhoneCsv, d.supportUrl,
].map(cell).join(','))).join('\n') + '\n';

// ---- write -----------------------------------------------------------------
const ready = missing.length === 0;
const banner = ready
  ? `<p class="ready">All required values are present. Paste each block into its matching
     <code>.fcc-slot</code> in index.html, copy the FCC LABEL CSS into the site's &lt;style&gt;,
     upload broadband-labels.csv to the site root, and re-check the current FCC display rule.</p>`
  : `<p class="blocked"><b>NOT READY TO PUBLISH — ${missing.length} value${missing.length === 1 ? '' : 's'} still missing.</b></p>
     <ul>${missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`;

writeFileSync(join(HERE, 'fcc-label-preview.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>FCC label preview — INTERNAL, generated file</title>
<!-- GENERATED by internal/build-fcc-labels.mjs. Do not hand-edit; edit
     internal/fcc-labels.data.json and re-run. Not linked from the site. -->
<style>
body{font-family:Inter,system-ui,sans-serif;background:#F4F7FC;color:#182234;margin:0;padding:32px 18px;line-height:1.6}
.wrap{max-width:1140px;margin:0 auto}
.blocked{background:#FFE9E9;border:1.5px solid #D64545;border-radius:10px;padding:14px 18px}
.ready{background:#E6F7ED;border:1.5px solid #2E9E5B;border-radius:10px;padding:14px 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px;margin-top:26px}
.cell{background:#fff;border:1px solid #DCE5F2;border-radius:12px;padding:18px}
pre{background:#0A1F3C;color:#EAF2FE;border-radius:10px;padding:16px;overflow-x:auto;font-size:.74rem;line-height:1.5}
.fcc-label{margin:0;font-size:.85rem}
.fcc-label>summary{cursor:pointer;font-weight:600;color:#2E7CF6;padding:6px 0}
.fcc-facts{border:2px solid #000;background:#fff;padding:14px 16px;margin-top:8px}
.fcc-facts .f-title{font-size:1.55rem;font-weight:700;line-height:1.1;border-bottom:8px solid #000;padding-bottom:6px;margin-bottom:8px}
.fcc-facts .f-provider{font-weight:600}
.fcc-facts .f-type{font-size:.8rem;border-bottom:4px solid #000;padding-bottom:8px;margin-bottom:8px}
.fcc-facts .f-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #000}
.fcc-facts .f-row.head{font-weight:700}
.fcc-facts .f-row.major{font-weight:700;font-size:.95rem;border-bottom:4px solid #000}
.fcc-facts .f-row .ind{padding-left:14px;font-weight:400}
.fcc-facts .f-note{font-size:.78rem;padding:5px 0;border-bottom:1px solid #000}
.fcc-facts .f-end{border-bottom:4px solid #000}
.fcc-facts a{color:#00E;text-decoration:underline}
.fcc-facts .f-foot,.fcc-facts .f-upi{font-size:.78rem;padding-top:6px;word-break:break-all}
.fcc-needed{background:#FFE58A;font-weight:700;padding:0 4px;border-radius:3px}
</style></head><body><div class="wrap">
<h1>FCC Broadband Facts — generated preview</h1>
<p>Generated from <code>internal/fcc-labels.data.json</code>. Internal file, not linked from the site.</p>
${banner}
<div class="grid">
${d.plans.map(p => `<div class="cell"><h2>${esc(p.name)}</h2>${label(p)}</div>`).join('\n')}
</div>
<h2 style="margin-top:40px">Paste-ready markup</h2>
<pre>${d.plans.map(p => esc(label(p))).join('\n\n')}</pre>
<h2>broadband-labels.csv</h2>
<pre>${esc(csv)}</pre>
</div></body></html>
`);

writeFileSync(join(HERE, 'broadband-labels.csv'), csv);

console.log(ready
  ? 'READY — all required values present.'
  : `NOT READY — ${missing.length} missing:\n  - ${missing.join('\n  - ')}`);
console.log('\nwrote internal/fcc-label-preview.html and internal/broadband-labels.csv');
