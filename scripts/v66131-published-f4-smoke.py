#!/usr/bin/env python3
"""Read-only public production smoke test for SBC Fantastic 4.

Uses urllib (no installed third-party packages) and only HTTP GET.
Reports live observations, never asserts paid subscription/federation proof.
Can run on GitHub-hosted runner to separate Cloud Browser DNS limitations.
"""
import datetime as dt
import json
import os
import socket
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

TIMEOUT = 12
UA = "SBC-F4-Published-ReadOnly-Smoke/1.0 (+https://sbcmia.com)"
ENDPOINTS = {
    "cc_health": "https://tyvrqnjz57.c24.airoapp.ai/healthz",
    "cc_ready": "https://tyvrqnjz57.c24.airoapp.ai/readyz",
    "cc_api": "https://tyvrqnjz57.c24.airoapp.ai/api/health",
    "cc_checkout_ui": "https://tyvrqnjz57.c24.airoapp.ai/v66-129-owner-checkout-lab.js?v=66.0.129",
    "cc_workforce_ui": "https://tyvrqnjz57.c24.airoapp.ai/v66-128-owner-while-away.js?v=66.0.128",
    "cc_lorna_ui": "https://tyvrqnjz57.c24.airoapp.ai/sbc-lorna-checklist.js?v=1",
    "office_health": "https://31qflm5uk6.c24.airoapp.ai/healthz",
    "office_api": "https://31qflm5uk6.c24.airoapp.ai/api/health",
    "office_i18n": "https://31qflm5uk6.c24.airoapp.ai/officebox-languages-v1556.js?v=15.5.6",
    "public_sbc": "https://sbcmia.com/",
    "public_reseller": "https://sbcwebsites.com/",
}
REQUIRED = {
    "cc_health", "cc_ready", "cc_api", "cc_checkout_ui", "cc_workforce_ui",
    "office_health", "office_api", "office_i18n",
    "public_sbc", "public_reseller",
}
# Report new UI separately so a source build can run before its GoDaddy deployment.
LATEST_UI = {"cc_lorna_ui"}


def fetch_once(name: str, url: str, transport=None):
    """One GET; bound response size; no cookies, authentication, or writes."""
    request = urllib.request.Request(
        url, method="GET", headers={"User-Agent": UA, "Accept": "application/json,text/javascript,text/html;q=.8"}
    )
    try:
        if transport is None:
            with urllib.request.urlopen(request, timeout=TIMEOUT, context=ssl.create_default_context()) as r:
                status = r.status
                effective_url = r.url
                body = r.read(384 * 1024 + 1)
                headers = dict(r.headers)
        else:
            status, effective_url, body, headers = transport(name, request)
        if len(body) > 384 * 1024:
            return {"name": name, "status": "INCONCLUSIVE", "reason": "RESPONSE_TOO_LARGE", "http": status}
        if not isinstance(body, bytes):
            return {"name": name, "status": "INCONCLUSIVE", "reason": "INVALID_RESPONSE_TYPE", "http": status}
        return evaluate(name, status, body, headers, effective_url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, socket.timeout, ssl.SSLError) as exc:
        # Don't emit provider response bodies, tokens or headers.
        err = type(exc).__name__
        code = getattr(exc, "code", None)
        return {"name": name, "status": "UNVERIFIED", "reason": err, "http": code}
    except Exception as exc:
        return {"name": name, "status": "UNVERIFIED", "reason": type(exc).__name__, "http": None}


def fetch(name: str, url: str, transport=None):
    result = fetch_once(name, url, transport)
    if result["http"] in (502, 503, 504):
        result = {**fetch_once(name, url, transport), "attempts": 2}
    return result


def evaluate(name, status, body, headers, url):
    result = {"name": name, "status": "UNVERIFIED", "http": int(status), "reason": ""}
    if status != 200:
        result["reason"] = "NON_200_RESPONSE"
        return result
    if name.startswith("cc_") and name.endswith(("_health", "_ready", "_api")):
        try:
            obj = json.loads(body)
            if not isinstance(obj, dict) or obj.get("ok") is not True:
                result["reason"] = "UNHEALTHY_OR_INVALID_JSON"
                return result
            if name == "cc_health":
                db = obj.get("database") or {}
                if db.get("reachable") is not True:
                    result["reason"] = "MYSQL_NOT_REACHABLE"
                    return result
            elif name == "cc_ready":
                if obj.get("writePrerequisitesReported") is not True:
                    result["reason"] = "WRITER_NOT_VERIFIED_IN_PUBLISHED"
                    return result
            else:
                if obj.get("writerLeaseReady") is not True or obj.get("recoveryRequired") is True:
                    result["reason"] = "WRITER_OR_RECOVERY_NOT_READY"
                    return result
            result["version"] = str(obj.get("version", ""))[:32]
        except (ValueError, TypeError, AttributeError):
            result["reason"] = "INVALID_JSON"
            return result
    elif name.startswith("office_") and name in ("office_health", "office_api"):
        try:
            obj = json.loads(body)
            if not isinstance(obj, dict) or obj.get("ok") is not True:
                result["reason"] = "UNHEALTHY_OR_INVALID_JSON"
                return result
            data = obj.get("data") if name == "office_api" else obj
            if not isinstance(data, dict):
                result["reason"] = "MISSING_OFFICE_HEALTH_DATA"
                return result
            version = str(data.get("version") or "")[:32]
            result["version"] = version
            if version != "15.5.0":
                result["reason"] = "OFFICE_VERSION_MISMATCH"
                return result
            if name == "office_health" and data.get("persistence") != "mysql":
                result["reason"] = "OFFICE_MYSQL_NOT_VERIFIED"
                return result
            if name == "office_api":
                result["release"] = str(data.get("release") or "")[:80]
                if data.get("databaseVerified") is not True or data.get("sessionConfigured") is not True:
                    result["reason"] = "OFFICE_DATABASE_OR_SESSION_NOT_READY"
                    return result
                if data.get("release") != "OFFICE-BOX-V15.5-CUSTOMER-OWNED-WORKSPACE":
                    result["reason"] = "OFFICE_RELEASE_MISMATCH"
                    return result
        except (ValueError, TypeError, AttributeError):
            result["reason"] = "INVALID_JSON"
            return result
    elif name == "cc_checkout_ui":
        if b"sbcOpenOwnerCheckoutLab" not in body or b"CREATE_ZERO_DOLLAR_QA" not in body:
            result["reason"] = "LATEST_CHECKOUT_UI_NOT_FOUND"
            return result
    elif name == "cc_workforce_ui":
        if b"sbcOpenWhileAway" not in body or b"while-away" not in body:
            result["reason"] = "LATEST_WORKFORCE_UI_NOT_FOUND"
            return result
    elif name == "cc_lorna_ui":
        content_type = next((v for k, v in headers.items() if k.lower() == "content-type"), "")
        if "javascript" not in content_type.lower() or b"SBC Lorna" not in body:
            result["reason"] = "LORNA_CHECKLIST_SCRIPT_NOT_SERVED"
            return result
    elif name == "office_i18n":
        if b"Office Box v15.5.6" not in body or b"Krey" not in body:
            result["reason"] = "OFFICE_ASSET_NOT_RECOGNIZED"
            return result
    elif name == "public_sbc":
        if b"Successful By Choice" not in body:
            result["reason"] = "SBC_PUBLIC_BRAND_NOT_FOUND"
            return result
    elif name == "public_reseller":
        dest = urlsplit(url)
        if dest.scheme != "https" or dest.hostname not in {
            "sbcwebsites.com", "www.sbcwebsites.com", "secureserver.net", "www.secureserver.net"
        }:
            result["reason"] = "UNRECOGNIZED_RESELLER_DESTINATION"
            return result
        if dest.hostname in {"secureserver.net", "www.secureserver.net"} and parse_qs(dest.query).get("pl_id") != ["591874"]:
            result["reason"] = "SBC_RESELLER_ID_NOT_PRESENT"
            return result
        if b"Successful By Choice" not in body:
            result["reason"] = "SBC_RESELLER_BRAND_NOT_FOUND"
            return result
    result["status"] = "VERIFIED"
    result["reason"] = "PUBLIC_GET_OK"
    return result


def selftest():
    assert set(ENDPOINTS) == REQUIRED | LATEST_UI
    for url in ENDPOINTS.values():
        assert url.startswith("https://")
        assert "?" not in url or "?v=" in url
    assert evaluate("cc_checkout_ui", 200, b"sbcOpenOwnerCheckoutLab CREATE_ZERO_DOLLAR_QA", {}, "")["status"] == "VERIFIED"
    assert evaluate("cc_checkout_ui", 200, b"<html>login</html>", {}, "")["status"] == "UNVERIFIED"
    assert evaluate("cc_ready", 200, json.dumps({"ok": True, "writePrerequisitesReported": False}).encode(), {}, "")["status"] == "UNVERIFIED"
    assert evaluate("cc_ready", 200, json.dumps({"ok": True, "writePrerequisitesReported": True}).encode(), {}, "")["status"] == "VERIFIED"
    assert evaluate("office_api", 200, json.dumps({
        "ok": True, "data": {"version": "15.5.0", "release": "OFFICE-BOX-V15.5-CUSTOMER-OWNED-WORKSPACE",
                              "databaseVerified": True, "sessionConfigured": True}
    }).encode(), {}, "")["status"] == "VERIFIED"
    assert evaluate("office_health", 503, b"", {}, "")["status"] == "UNVERIFIED"
    assert evaluate("cc_lorna_ui", 200, b"<html>SBC Lorna</html>", {"Content-Type": "text/html"}, "")["status"] == "UNVERIFIED"
    assert evaluate("cc_lorna_ui", 200, b"// SBC Lorna", {"Content-Type": "application/javascript"}, "")["status"] == "VERIFIED"
    assert evaluate("public_reseller", 200, b"Successful By Choice", {}, "https://www.secureserver.net/?pl_id=591874")["status"] == "VERIFIED"
    assert evaluate("public_reseller", 200, b"Successful By Choice", {}, "https://example.com/?dest=secureserver.net")["status"] == "UNVERIFIED"
    attempts = iter([(503, "", b"", {}), (200, "", b"Successful By Choice", {})])
    retried = fetch("public_sbc", ENDPOINTS["public_sbc"], transport=lambda n, r: next(attempts))
    assert retried["status"] == "VERIFIED" and retried["attempts"] == 2
    assert fetch("cc_health", ENDPOINTS["cc_health"], transport=lambda n, r: (
        200, r.full_url, json.dumps({"ok": True, "database": {"reachable": True}}).encode(), {}
    ))["status"] == "VERIFIED"
    assert fetch("office_health", ENDPOINTS["office_health"], transport=lambda n, r: (
        401, r.full_url, b"", {}
    ))["status"] == "UNVERIFIED"
    print("[SBC F4 LIVE PUBLIC SMOKE] SELFTEST PASS: GET only, provider-independent, fail-closed and diagnostic-safe")


def run():
    observations = [fetch(name, url) for name, url in ENDPOINTS.items()]
    ok = all(obs["status"] == "VERIFIED" for obs in observations if obs["name"] in REQUIRED)
    latest_ui = all(obs["status"] == "VERIFIED" for obs in observations if obs["name"] in LATEST_UI)
    results = {
        "test": "SBC F4 published public READ-ONLY smoke",
        "observedAtUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "requiredPublicChecksPassed": ok,
        "latestUiAssetsServed": latest_ui,
        "forbiddenOperationsPerformed": 0,
        "providerCharges": 0,
        "liveOfficeBoxFederationAuthenticated": "NOT_TESTED_OWNER_AUTH_REQUIRED",
        "recurringProviderSubscriptionVerified": "NOT_TESTED_PROVIDER_AUTH_REQUIRED",
        "ownerCheckoutLabCompletedAgainstPublishedMysql": "NOT_TESTED_OWNER_AUTH_REQUIRED",
        "actualPublishedGitCommit": "NOT_PROVABLE_BY_PUBLIC_HEALTH_ROUTES",
        "checks": observations,
    }
    Path("f4-published-smoke-results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf8")
    summary = [
        "## SBC Fantastic 4 — public Published smoke check",
        "Only public GETs; no payments, credentials, orders or subscriptions.",
        "",
        "| Check | Result | HTTP | Evidence |",
        "|---|---|---|---|",
    ]
    for x in observations:
        summary.append(f"| {x['name']} | {x['status']} | {x.get('http') or '—'} | {x['reason']} |")
    summary += [
        "",
        f"**Required public checks across all four products:** {'PASS' if ok else 'NOT VERIFIED'}.",
        f"**New Lorna checklist asset:** {'SERVED' if latest_ui else 'NOT VERIFIED'}.",
        "**Still unverified:** authenticated Command Center ⇄ Office Box federation, GoDaddy Published exact commit,",
        "owner $0 persisted checkout/manual completion, and real recurring billing provider.",
        "",
    ]
    text = "\n".join(summary)
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf8") as f:
            f.write(text + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        selftest()
        sys.exit(0)
    sys.exit(run())
