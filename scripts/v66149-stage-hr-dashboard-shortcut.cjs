'use strict';
/* V66.149 – owner dashboard shortcut to independent HR department.
 * Source mirror parity and disposable GoDaddy staging. No new access role.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66149_HR_DEPARTMENT_SHORTCUT';
const OLD='<button type="button" class="btn ghost" onclick="sbcOpenOwnerAcceptanceDesk()">🛡️ Owner Acceptance Desk</button>';
const NEW=OLD+'<button type="button" class="btn ghost" onclick="sbcOpenHrDepartment()">👥 HR Department</button>';
const FN=String.raw