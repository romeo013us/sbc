'use strict';
/* V66.147 adds owner-initiated review candidates and paid-order preflight to the
 * existing Acceptance Desk. No background outreach, customer edits or charging.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66147_OWNER_SALES_DELIVERY_REVIEW_UI';
const SECTION_ANCHOR="'<section class=\"card\"><div class=\"card-body\"><h3>📦 Delivery acceptance</h3>'+";
const SCRIPT_ANCHOR='async function sbcAcceptOrderLookup(){';
const SECTION=String.raw