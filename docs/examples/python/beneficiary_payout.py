# Beneficiary payout (PayWay Payout) with FastAPI.
# POST /payouts/{payout_id}/send    -> sends one payout batch from your settlement account, at most once (staff only)
# POST /sellers/{seller_id}/disable -> disables a seller's beneficiary with Update a beneficiary status (staff only)
# Whitelist each account first with Add a beneficiary to whitelist (see the split-payment example).
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from ABA Bank), PAYWAY_BASE_URL (default sandbox)
import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from payway_hash import payway_hash

BASE_URL = os.environ.get("PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
MERCHANT_ID = os.environ["PAYWAY_MERCHANT_ID"]
API_KEY = os.environ["PAYWAY_API_KEY"]
RSA_PUBLIC_KEY = os.environ["PAYWAY_RSA_PUBLIC_KEY"]

# Replace with your database. Accounts and amounts come only from your own records:
# a payout batch is created by your accounting (e.g. weekly seller earnings), never from a request body.
SELLERS = {
    "s1": {"id": "s1", "account": "000133879", "active": True},
    "s2": {"id": "s2", "account": "000133880", "active": True},
}
PAYOUTS = {"P20261009001": {"id": "P20261009001", "currency": "USD",
                            "lines": [{"seller_id": "s1", "amount": Decimal("12.50")},
                                      {"seller_id": "s2", "amount": Decimal("7.25")}]}}


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


# Work in minor units (cents; riel for KHR) so the total is the exact sum of the lines.
def unit(currency):
    return 1 if currency == "KHR" else 100


def json_number(minor, currency):
    """Minor units -> the JSON number the Node example sends: 1250 -> 12.5, 2000 -> 20."""
    d = Decimal(minor) / unit(currency)
    return int(d) if d == d.to_integral_value() else float(d)


def beneficiaries_for(batch):
    shares = {}  # account -> minor units, one entry per account
    currency = batch["currency"]
    for line in batch["lines"]:
        seller = SELLERS.get(line["seller_id"])
        if not seller or not seller["active"]:
            raise ValueError(f"seller {line['seller_id']} is not an active beneficiary")
        shares[seller["account"]] = shares.get(seller["account"], 0) + int(line["amount"] * unit(currency))
    if len(shares) > 10:
        raise ValueError("PayWay allows at most 10 beneficiaries per request")  # code 25
    amount = json_number(sum(shares.values()), currency)  # code 92: must equal the sum of the beneficiary amounts
    return amount, [{"account": acc, "amount": json_number(m, currency)} for acc, m in shares.items()]


def rsa_encrypt(obj):
    """JSON encrypted with the RSA public key in 117-byte chunks, then Base64
    (port of the portal's PHP sample; PKCS#1 v1.5 = PHP openssl_public_encrypt default)."""
    key = load_pem_public_key(RSA_PUBLIC_KEY.encode("ascii"))
    src = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    out = b"".join(key.encrypt(src[i:i + 117], padding.PKCS1v15()) for i in range(0, len(src), 117))
    return base64.b64encode(out).decode("ascii")


async def post(path, body):
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}{path}", json=body)
    return r.json()


async def send_payout(batch, plan):
    amount, beneficiaries = plan
    b = {"merchant_id": MERCHANT_ID, "tran_id": batch["id"], "beneficiaries": rsa_encrypt(beneficiaries),
         "amount": amount, "currency": batch["currency"]}
    # Payout hash: merchant_id, tran_id, beneficiaries, amount, custom_fields ("" when not sent), currency.
    # The portal's PHP sample outputs a hex digest here (no base64_encode), so payway_hash() is not used.
    message = "".join([b["merchant_id"], b["tran_id"], b["beneficiaries"], json.dumps(amount), "", b["currency"]])
    b["hash"] = hmac.new(API_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha512).hexdigest()
    return await post("/api/payment-gateway/v2/direct-payment/merchant/payout", b)


async def update_beneficiary_status(payee, status):
    request_time = req_time()
    merchant_auth = rsa_encrypt({"mc_id": MERCHANT_ID, "payee": payee, "status": status})
    return await post("/api/merchant-portal/merchant-access/whitelist-account/update-whitelist-status", {
        "request_time": request_time,
        "merchant_id": MERCHANT_ID,
        "merchant_auth": merchant_auth,
        "hash": payway_hash([request_time, merchant_auth], API_KEY),  # request_time, merchant_auth (Base64)
    })


app = FastAPI()


# TODO: protect both routes with your staff authentication. Only record IDs come from the request.
@app.post("/payouts/{payout_id}/send")
async def send(payout_id: str):
    batch = PAYOUTS.get(payout_id)
    if not batch:
        raise HTTPException(404, "payout not found")
    if batch.get("state"):
        raise HTTPException(409, f"payout is {batch['state']}")
    try:
        plan = beneficiaries_for(batch)
    except ValueError as e:
        raise HTTPException(409, str(e))  # nothing sent
    batch["state"] = "SENDING"  # reserve before awaiting PayWay: a double-click or retry cannot send twice
    try:
        r = await send_payout(batch, plan)
    except Exception as e:
        # Unknown outcome (network error, timeout): money may have moved. Never auto-retry; reconcile first.
        batch["state"] = "NEEDS_REVIEW"
        return JSONResponse({"state": batch["state"], "error": str(e)}, status_code=502)
    s = r.get("status") or {}
    ok = s.get("code") == "0" and Decimal(str(r.get("transaction_amount"))) == Decimal(str(plan[0]))
    # Anything but a clean success stays out of the send path until someone reconciles it
    # (codes 4/83 mean this tran_id was already used; 91 means the beneficiary credit failed).
    batch["state"] = "PAID" if ok else "NEEDS_REVIEW"
    batch["result"] = r  # keep external_reference, payout_id and trace_id for reconciliation
    return JSONResponse({"state": batch["state"], "status": s}, status_code=200 if ok else 502)


@app.post("/sellers/{seller_id}/disable")
async def disable(seller_id: str):
    seller = SELLERS.get(seller_id)
    if not seller:
        raise HTTPException(404, "seller not found")
    seller["active"] = False  # stop using the account locally before awaiting PayWay
    r = await update_beneficiary_status(seller["account"], 0)
    ok = (r.get("status") or {}).get("code") == "00" and (r.get("data") or {}).get("status") == 0
    return JSONResponse({"disabled": ok, "status": r.get("status")}, status_code=200 if ok else 502)
