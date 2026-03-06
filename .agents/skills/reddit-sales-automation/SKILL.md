---
name: reddit-sales-automation
description: Automates 99% accurate lead discovery and "Value-First" outreach on Reddit. Uses a two-agent system (Asan/MarkBTM) with Airtable staging for approval and safe DM "nudging" with Spintax.
---

# 🦅 Reddit Sales Automation (Eagle-Eye)

## When to use this skill
- High-intent lead discovery for "The Residential Address".
- Solving founder problems (Stripe blocks, KYC, US Banking) with instructional "How-To" blueprints.
- Safe, non-spammy direct outreach using aged G2G accounts.

## Workflow

### 1. Discovery Engine (Asan)
- **Scanning**: Use keywords like "Stripe block", "residential address", "Wise rejected", "US LLC French".
- **Vector DB Check**: Compare new threads against the **Airtable Examples** (Few-Shot Prompting) to ensure 99% lead accuracy.
- **Blueprinting**: Generate a technical, instructional response (How-To) that solves the user's problem without selling yet.
- **Push to Staging**: Push the Thread URL and Draft to the Airtable `Reddit Leads` table with `Status = "New"`.

### 2. Approval Gate (User)
- User reviews the drafted response in Airtable.
- Checking **"Is Approved"** moves the lead to the execution queue.

### 3. Execution & Nurturing (MarkBTM)
- **The Reply**: MarkBTM posts the approved technical blueprint to the Reddit thread.
- **The Nudge**: MarkBTM sends a DM (using Spintax variations) such as: *"{Hi|Hey}! I saw your post. I build tools for X, wanted to see if you needed more help?"*
- **Conversion**: Only share links/calendly AFTER the user responds to the DM.

## Rules & Standards
- **Value First**: Comments must be 100% helpful guides. NO SALES PITCH in the main comment.
- **Safety**: 
  - Use G2G Aged Accounts (1k+ Karma).
  - Use Spintax for all DMs.
  - Max 25-50 DMs/day per account.
- **No Fabrication**: NEVER use made-up case studies. Stick to general "French founder guides".

## Tools & MCPs
- `RubeMCP`: Direct Reddit/Airtable API interactions.
- `Vector DB`: (Supabase/Pinecone) for storing high-quality lead examples for Asan.
- `Telegram Alerts`: Notify user when leads are ready in Airtable.
