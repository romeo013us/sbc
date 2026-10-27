/* SBC V48.6 — Policies & Standards Center */
(function(){
  const E=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const R=()=>state.me?.role||'employee';
  const canEdit=()=>['owner','manager'].includes(R());
  const policy={
    version:'V48.6.0', status:'OWNER REVIEW DRAFT', effectiveDate:'',
    attendance:{
      title:'Attendance & Timekeeping Policy',
      purpose:'Set clear expectations for scheduled attendance, accurate timekeeping, breaks, call-outs and dependable coverage.',
      rules:[
        'Employees are expected to report for scheduled work on time, ready to work.',
        'Clock in and clock out using the approved SBC timekeeping method. Never work off the clock.',
        'Record breaks accurately and return from breaks on time. Do not extend breaks without approval.',
        'If you will be late, absent, or unable to complete a scheduled shift, notify the owner/manager as soon as reasonably possible and before the shift when practical.',
        'A no-call/no-show is an attendance issue and may result in discipline based on the circumstances and applicable law.',
        'Employees must never clock in/out for another person, ask another person to do so, falsify hours, alter records without authorization, or misrepresent time worked.',
        'Attendance records must reflect actual attendance status. A clocked-in record does not by itself prove continuous work activity.',
        'Approved leave, disability accommodations, protected absences, and other legally protected time are handled according to applicable law and company procedures.',
        'Repeated lateness, unapproved absences, missed shifts, early departures, or inaccurate time records may lead to corrective action after review.'
      ],
      dos:['Be on time and ready to work.','Communicate early when attendance changes.','Use the time clock honestly.','Ask before changing a schedule or extending a break.','Keep contact information current so the company can reach you about schedule changes.'],
      donts:['Do not buddy-punch or share time-clock credentials.','Do not work off the clock.','Do not falsify hours or attendance records.','Do not disappear from a scheduled shift without communication.','Do not assume a missed shift is approved because you sent a message. Wait for acknowledgement when approval is required.']
    },
    discipline:{
      title:'Employee Conduct & Progressive Discipline Policy',
      purpose:'Define workplace standards, a fair documentation process, and the range of corrective actions SBC may use when standards are not met.',
      standards:[
        'Treat coworkers, customers, vendors and the public professionally and respectfully.',
        'Follow lawful instructions, assigned procedures, approved workflows and role permissions.',
        'Protect customer information, company information, credentials, payment information and system access.',
        'Be accurate. Do not fabricate leads, customer facts, sales activity, work performed, time records, approvals, prices, guarantees or system results.',
        'Use SBC systems only for authorized business purposes and within the employee’s role.',
        'Do not harass, threaten, discriminate against, retaliate against, or intentionally intimidate another person.',
        'Report suspected security issues, customer-impacting errors, safety concerns or policy violations promptly.',
        'Maintain professional communication in person, by phone, SMS, email, social media used for work, and inside SBC systems.'
      ],
      process:[
        {step:'1',name:'Coaching / Verbal Guidance',desc:'Clarify the expectation, explain the concern, document the conversation when appropriate, and establish the expected correction.'},
        {step:'2',name:'Written Warning',desc:'Document the policy or performance issue, the required correction, and a reasonable follow-up point.'},
        {step:'3',name:'Final Warning / Last-Chance Direction',desc:'For continued or significant issues, document the seriousness, required correction and consequences of further violations.'},
        {step:'4',name:'Separation',desc:'Employment may end when performance or conduct does not meet requirements or when the circumstances warrant separation.'}
      ],
      serious:[
        'Some conduct may warrant skipping progressive steps after review, including serious misconduct, theft or fraud, violence or threats, harassment or retaliation, intentional falsification, unauthorized access to protected systems or data, deliberate customer deception, or other conduct requiring immediate action.',
        'Before discipline is finalized, SBC should review the facts, preserve relevant records, allow the employee an opportunity to provide relevant information when appropriate, and document the decision.',
        'Nothing in this draft is intended to limit any employee right or protection provided by applicable law, regulation, contract, or an approved leave/accommodation process.'
      ],
      dos:['Ask when you are unsure instead of guessing.','Document important customer and work activity.','Escalate errors early.','Use only the permissions assigned to your role.','Accept coaching professionally and correct the issue.'],
      donts:['Do not lie to management or customers.','Do not bypass security or owner controls.','Do not use another employee’s account.','Do not retaliate against someone who raises a concern.','Do not alter records to make performance, attendance, sales, or fulfillment appear better than it is.']
    }
  };
  function list(arr){return '<ul class="sbc-policy-list">'+arr.map(x=>`<li>${E(x)}</li>`).join('')+'</ul>'}
  function section(title,body){return `<section class="card section sbc-policy-card"><div class="card-head"><h2>${E(title)}</h2><span class="badge blue">POLICY</span></div><div class="card-body">${body}</div></section>`}
  function renderPolicy(){
    const edit=canEdit();
    const a=policy.attendance,d=policy.discipline;
    $('#viewEyebrow').textContent='PEOPLE & STANDARDS'; $('#viewTitle').textContent='Policies & Standards';
    $('#content').innerHTML=`<div class="sbc-policy-hero"><div><div class="eyebrow">SBC PEOPLE OPERATIONS · ${E(policy.status)}</div><h2>How SBC expects us to work.</h2><p>This is the central home for attendance, conduct, discipline and future company policies. Policies can be expanded as SBC grows.</p></div><div class="sbc-policy-meta"><strong>${E(policy.version)}</strong><span>Owner review required before final adoption</span></div></div>
    ${section(a.title,`<p><strong>Purpose:</strong> ${E(a.purpose)}</p><h3>Core Rules</h3>${list(a.rules)}<div class="grid two"><div><h3>DO</h3>${list(a.dos)}</div><div><h3>DON'T</h3>${list(a.donts)}</div></div>`)}
    ${section(d.title,`<p><strong>Purpose:</strong> ${E(d.purpose)}</p><h3>Workplace Standards</h3>${list(d.standards)}<h3>Progressive Discipline Process</h3><div class="sbc-discipline-grid">${d.process.map(x=>`<article><span class="sbc-step">${E(x.step)}</span><strong>${E(x.name)}</strong><p>${E(x.desc)}</p></article>`).join('')}</div><div class="install-tip"><strong>Serious Misconduct & Legal Protections</strong>${list(d.serious)}</div><div class="grid two"><div><h3>DO</h3>${list(d.dos)}</div><div><h3>DON'T</h3>${list(d.donts)}</div></div>`)}
    ${section('Policy Administration',`<div class="grid three"><div><strong>Status</strong><p>${E(policy.status)}</p></div><div><strong>Version</strong><p>${E(policy.version)}</p></div><div><strong>Effective Date</strong><p>${policy.effectiveDate?E(policy.effectiveDate):'To be set after owner review'}</p></div></div><p class="mini">Owner/management should review each policy before it is issued as an official employee policy. Future policy categories can be added here without hiding or replacing prior policies.</p>${edit?'<div class="actions"><button class="btn primary" onclick="sbcPolicyOwnerReview()">Review / Prepare for Approval</button></div>':''}`)}
    ${section('Policy Roadmap',`<div class="grid three"><div class="list-card"><strong>Scheduling & Attendance</strong><div class="mini">Attendance, punctuality, breaks, call-outs, timekeeping.</div></div><div class="list-card"><strong>Conduct & Discipline</strong><div class="mini">Standards, investigations, corrective action and documentation.</div></div><div class="list-card"><strong>Technology & Security</strong><div class="mini">Credentials, systems, customer data, devices and acceptable use.</div></div><div class="list-card"><strong>Customer Service</strong><div class="mini">Professional communication, promises, escalation and complaints.</div></div><div class="list-card"><strong>Sales Ethics</strong><div class="mini">Accurate pricing, approved packages, no fabricated claims.</div></div><div class="list-card"><strong>Workplace Safety</strong><div class="mini">Safety reporting, emergencies and safe work practices.</div></div></div>`)} `;
  }
  window.sbcPolicyOwnerReview=()=>{openModal('Policy Review Checklist',`<div class="install-tip"><strong>Before adoption</strong><p>Review the attendance and discipline language for SBC's actual staffing model, confirm any required legal/HR review, set the effective date, and then publish the approved version to employees.</p><label>Owner review notes<textarea id="sbcPolicyNotes" rows="6" placeholder="What should change before approval?"></textarea></label><div class="actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn primary" onclick="closeModal();toast('Review notes captured for this session. Final policy approval remains an owner action.')">Save Review Note</button></div></div>`)};
  window.renderSbcPolicies=renderPolicy;
})();
