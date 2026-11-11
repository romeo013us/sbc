'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '../index.php'), 'utf8');
const packageCard = page.match(/<article\b[^>]*>(?:(?!<\/article>)[\s\S])*?square\.link\/u\/uf53mzCR[\s\S]*?<\/article>/)?.[0];
assert.match(packageCard, /<h3>Business Basic<\/h3>/);
assert.match(packageCard, /\$349/);
assert.match(packageCard, /\b200 business cards\b/);
assert.doesNotMatch(packageCard, /Essentials|\b250 business cards\b/);

for (const field of ['sbc-login-email', 'sbc-login-password', 'sbc-reg-name', 'sbc-reg-business', 'sbc-reg-email', 'sbc-reg-password']) {
  assert.match(page, new RegExp('<label for="' + field + '">'));
}

const elements = new Map();
const document = {
  activeElement: null,
  getElementById(id) { return elements.get(id); },
  addEventListener(name, fn) { assert.equal(name, 'keydown'); this.onKeydown = fn; },
};
function element(id, { visible = true, tabIndex = 0 } = {}) {
  const node = {
    isConnected: true,
    style: {},
    tabIndex,
    attrs: {},
    focus() { document.activeElement = this; },
    getClientRects() { return visible ? [{}] : []; },
    setAttribute(name, value) { this.attrs[name] = value; },
  };
  elements.set(id, node);
  return node;
}
const trigger = element('sbc-account-button');
const backdrop = element('sbc-v27-portal-backdrop');
const dialog = element('sbc-v27-portal');
const closeButton = element('sbc-portal-close');
const email = element('sbc-login-email');
const submit = element('submit');
const hiddenRegister = element('sbc-register-email', { visible: false });
const heading = element('sbc-account-welcome', { tabIndex: -1 });
element('sbc-auth-area');
element('sbc-account-area');
const classes = new Set();
backdrop.classList = {
  add: name => classes.add(name),
  remove: name => classes.delete(name),
  contains: name => classes.has(name),
};
const children = [closeButton, email, submit, hiddenRegister, heading];
dialog.querySelectorAll = () => children;
dialog.contains = node => children.includes(node);

const portalScript = page.match(/<script id="sbc-v27-portal-js">([\s\S]*?)<\/script>/)[1];
const portal = vm.runInNewContext(portalScript + '\nSBCPortal;', {
  document,
  fetch: async () => ({ ok: false, json: async () => ({ ok: false }) }),
});
function press(key, shiftKey = false) {
  let prevented = false;
  document.onKeydown({ key, shiftKey, preventDefault() { prevented = true; } });
  return prevented;
}

trigger.focus();
portal.open(trigger);
assert.equal(backdrop.attrs['aria-hidden'], 'false');
assert.equal(document.activeElement, closeButton);
assert.equal(press('Tab', true), true);
assert.equal(document.activeElement, submit);
assert.equal(press('Tab'), true);
assert.equal(document.activeElement, closeButton);
email.focus();
assert.equal(press('Tab'), false);
assert.equal(press('Escape'), true);
assert.equal(document.activeElement, trigger);
assert.equal(backdrop.attrs['aria-hidden'], 'true');
assert.equal(press('Escape'), false);

const mobile = element('sbc-mobile-account-button');
portal.open(mobile);
portal.close();
assert.equal(document.activeElement, mobile);
console.log('SBCMIA checkout offer and portal keyboard contract PASS');
