---
title: "Email-to-Fax: How to Send a Secure Fax via Gmail or Outlook and Pay Later"
description: "Route inbound fax jobs through email attachments—receive a Stripe checkout link, pay securely, then RonFax sends your PDF automatically to any US fax number."
date: "2026-05-06"
keywords:
  - email to fax
  - fax via Gmail
  - Outlook fax attachment
faq:
  - question: "How does RonFax email-to-fax work?"
    answer: "When configured with **Cloudflare Email Routing** plus a Worker that forwards to our webhook (`POST /api/webhooks/email-inbound`), we accept JSON or multipart with your PDF or image attachment, extract the destination fax number from your To address (e.g. fax+15551234567@yourdomain), build Stripe Checkout, and email you a payment link via Resend. After you pay, the normal Stripe webhook pipeline transmits the fax."
  - question: "Is paying by email link secure?"
    answer: "Checkout always happens on Stripe’s hosted page (HTTPS). RonFax never stores your card on our servers—only the fax metadata and blob path needed for transmission."
---

Trend data shows searches combining **Gmail**, **Outlook**, **attachments**, and **fax** climbing as remote teams try to bridge email workflows with regulated destinations that still require traditional fax.

This guide explains the **email-to-fax** model RonFax supports: send files from your favorite mail client, **receive a Stripe payment link**, and let automation finish the job after checkout.

## Why “just attach a PDF to an email” is not enough

Plain SMTP email cannot talk directly to analog fax hardware. A **gateway** must convert your attachment into the G.711 fax audio stream that carriers expect. RonFax acts as that gateway **after** you confirm payment so we can meter abuse and keep per-page pricing predictable.

## Step-by-step flow

1. **Configure inbound routing** — Use Cloudflare Email Routing → **Workers** script (see repo `scripts/cloudflare-email-inbound-worker.mjs`) to POST JSON to `POST /api/webhooks/email-inbound`. The Worker must send `Authorization: Bearer <EMAIL_INBOUND_SECRET>`.  
2. **Address your email** — Use a plus-address at your verified domain such as `fax+15551234567@inbound.example.com`. The ten digits after `fax+` become the destination.  
3. **Attach PDFs or scans** — Multiple attachments merge into one PDF automatically.  
4. **Receive “Complete payment”** — RonFax emails you a Stripe Checkout URL.  
5. **Pay securely** — Stripe confirms the session; the Stripe webhook sends your fax through Sinch / Phaxio and updates `/status/...` just like the browser flow.

## Gmail vs. Outlook tips

Both clients handle multi-part MIME attachments the same way. Keep files under your mailbox provider’s send limits; RonFax further caps merged PDFs at **8 MB** to match the normal uploader.

## When browser upload is simpler

If you just need a one-off fax and already have a PDF, drag it into **ronfax.com**. Use email when you are scripting, forwarding from a shared mailbox, or integrating with systems that cannot open a browser.

## Compliance note

Email gateways can help HIPAA-conscious teams **track who submitted what**, but you are still responsible for BAAs with your mail provider and document retention policy.

---

Need help enabling inbound mail? Start with Cloudflare Email Routing + Wrangler for the Worker, set `RONFAX_INBOUND_URL` and the `EMAIL_INBOUND_SECRET` secret to match your RonFax app env.
