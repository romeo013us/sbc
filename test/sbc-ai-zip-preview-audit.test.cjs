'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditPreviewFiles } = require('../enterprise/sbc-ai-zip-proposals.cjs');

const file = (name, value) => ({ name, content: Buffer.from(value) });

test('valid multipage ZIP references get a useful private preview readiness report', () => {
 const result = auditPreviewFiles([
  file('index.html', '<link rel="stylesheet" href="assets/site.css"><img src="images/cover.webp"><a href="about.html">About</a><a href="#contact">Contact</a>'),
  file('about.html', '<a href="./index.html">Home</a><img src="images/cover.webp">'),
  file('assets/site.css', 'body{margin:0}'),
  file('images/cover.webp', 'photo'),
 ]);
 assert.equal(result.status, 'PREVIEW_LINKS_OK');
 assert.equal(result.checkedPages, 2);
 assert.equal(result.issueCount, 0);
 assert.deepEqual(result.issues, []);
});

test('preview QA catches missing assets, missing linked pages and root-absolute assets rather than claiming ready', () => {
 const result = auditPreviewFiles([
  file('index.html', '<script src="/assets/app.js"></script><img src="images/missing.webp"><a href="pages/services.html">Services</a>'),
  file('assets/app.js', 'console.log("present")'),
 ]);
 assert.equal(result.status, 'PREVIEW_LINKS_NEED_REVIEW');
 const kinds = result.issues.map(issue => issue.code);
 assert(kinds.includes('ROOT_ABSOLUTE_PATH'));
 assert(kinds.includes('MISSING_ASSET'));
 assert(kinds.includes('MISSING_PAGE'));
 assert.equal(result.issueCount, 3);
});

test('nested HTML paths resolve against their own folder instead of customer account root', () => {
 const result = auditPreviewFiles([
  file('index.html', '<a href="pages/contact.html">Contact</a>'),
  file('pages/contact.html', '<link rel="stylesheet" href="../assets/main.css"><img src="../images/logo.svg">'),
  file('assets/main.css', 'body{}'),
  file('images/logo.svg', '<svg></svg>'),
 ]);
 assert.equal(result.status, 'PREVIEW_LINKS_OK');
 assert.equal(result.issueCount, 0);
});

test('external subresources are noted as blocked by sandbox but external navigation links are not', () => {
 const result = auditPreviewFiles([
  file('index.html', '<script src="https://cdn.example.com/app.js"></script><a href="https://example.org">Company</a><a href="mailto:hello@example.com">Email</a>'),
 ]);
 assert.equal(result.issueCount, 1);
 assert.equal(result.issues[0].code, 'EXTERNAL_RESOURCE_BLOCKED');
 assert.equal(result.issues[0].page, 'index.html');
});

test('QA issues are bounded and do not expose external URLs or raw HTML', () => {
 const images = Array.from({length:25},(_,i)=>'<img src="missing'+i+'.png">').join('');
 const result = auditPreviewFiles([file('index.html', images)]);
 assert.equal(result.issueCount,25);
 assert.equal(result.issues.length,12);
 assert.equal(result.status,'PREVIEW_LINKS_NEED_REVIEW');
 assert(result.issues.every(x=>!JSON.stringify(x).includes('<img')));
});

test('empty and malformed file collections never claim preview readiness', () => {
 assert.equal(auditPreviewFiles([]).status, 'PREVIEW_LINKS_NEED_REVIEW');
 assert.equal(auditPreviewFiles([file('assets/app.js','123')]).status, 'PREVIEW_LINKS_NEED_REVIEW');
});
