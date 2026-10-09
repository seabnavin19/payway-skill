# Recurring (PayWay Credentials on File, scheduled payments) with FastAPI.
# POST /subscriptions/{sub_id}/subscribe -> signed Subscription form fields (first payment + CITR_FIX consent)
# POST /payway/callback                  -> payment callback for any charge; confirms with Check transaction
# POST /payway/token-callback            -> token callback; takes the token from Get token details
# charge_due(subscription, cycle)        -> call from your daily job for each due cycle (MITR_FIX)
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
import json
import os
import secrets
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import FastAPI, HTTPException, Request

from payway_hash import payway_hash

BASE_URL = os.environ.get("PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
MERCHANT_ID = os.environ["PAYWAY_MERCHANT_ID"]
API_KEY = os.environ["PAYWAY_API_KEY"]
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://your-shop.example")

# Hash field orders from the Subscription and Payment API pages; fields you don't send hash as "".
SUBSCRIPTION_HASH_FIELDS = ["req_time", "merchant_id", "tran_id", "amount", "items", "shipping", "firstname",
                            "lastname", "email", "phone", "type", "payment_option", "return_url", "cancel_url",
                            "continue_success_url", "return_deeplink", "currency", "custom_fields", "return_params",
                            "payout", "lifetime", "additional_params", "skip_success_page", "token_flag", "frequency"]
PAYMENT_HASH_FIELDS = ["request_time", "merchant_id", "tran_id", "amount", "currency", "items", "ctid", "pwt",
                       "first_name", "last_name", "email", "phone", "purchase_type", "callback_url",
                       "custom_fields", "return_params", "payout", "token_flag", "shipping_fee"]

# Replace with your database. Plan prices live on the server, never in the browser.
PLANS = {"gym": {"amount": "20.00", "currency": "USD", "frequency": "1M"}}  # 1W, 1M or 2M
SUBSCRIPTIONS = {"s1": {"id": "s1", "plan": "gym", "ctid": "cust7f3a9e21"}}
CHARGES = {}  # our tran_id -> {"tran_id", "subscription_id", "amount", "paid"}


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def tran_id_from(return_params):
    """return_params comes back in the callback as the string we sent, e.g. '{"tran_id":"s1c1"}'."""
    try:
        return str(json.loads(return_params)["tran_id"])
    except (TypeError, ValueError, KeyError):
        return None


def json_number(s):
    """'4.50' -> 4.5, '4.00' -> 4: the JSON text then equals str(value), the text we hash (same as Node)."""
    d = Decimal(s)
    return int(d) if d == d.to_integral_value() else float(d)


async def post(path, body):
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}{path}", json=body)
    return r.json()


def subscribe_fields(sub):
    plan = PLANS[sub["plan"]]
    tran_id = f"{sub['id']}c1x{secrets.token_hex(4)}"  # unique per sign-up attempt, max 20 chars
    CHARGES[tran_id] = {"tran_id": tran_id, "subscription_id": sub["id"], "amount": plan["amount"]}
    f = {
        "req_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": tran_id,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "payment_option": "abapay",
        "return_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "return_params": json.dumps({"tran_id": tran_id}),  # echoed in the payment callback
        "ctid": sub["ctid"],
        "token_flag": "CITR_FIX",
        "frequency": plan["frequency"],
    }
    f["hash"] = payway_hash([f.get(k) for k in SUBSCRIPTION_HASH_FIELDS], API_KEY)
    return f


async def get_token_details(request_id):
    b = {"request_time": req_time(), "request_id": request_id, "merchant_id": MERCHANT_ID}
    b["hash"] = payway_hash([b["merchant_id"], b["request_time"], b["request_id"]], API_KEY)
    return await post("/api/payment-credential/v3/token-management/get-token-details", b)


async def charge_due(sub, cycle):
    """Call from your daily job for each due cycle (2, 3, ...; your job decides the dates; cycle 1 is the sign-up).
    Each cycle has one tran_id, reserved before awaiting PayWay, so a re-run or a parallel run cannot charge it twice."""
    plan = PLANS[sub["plan"]]
    if not sub.get("pwt"):
        raise RuntimeError(f"subscription {sub['id']} has no active token")
    tran_id = f"{sub['id']}c{cycle}"
    if tran_id in CHARGES:
        return CHARGES[tran_id]
    charge = {"tran_id": tran_id, "subscription_id": sub["id"], "amount": plan["amount"]}
    CHARGES[tran_id] = charge
    b = {
        "request_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": tran_id,
        "ctid": sub["ctid"],
        "pwt": sub["pwt"],
        "amount": json_number(plan["amount"]),  # the fixed subscribed amount
        "currency": plan["currency"],
        "token_flag": "MITR_FIX",
        "callback_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "return_params": json.dumps({"tran_id": tran_id}),
    }
    b["hash"] = payway_hash([b.get(k) for k in PAYMENT_HASH_FIELDS], API_KEY)
    r = await post("/api/payment-gateway/v3/purchase/payment-credential", b)
    status = r.get("status") or {}
    if status.get("code") != "00":  # rejected: release the cycle so the next job run retries it
        del CHARGES[tran_id]
        raise RuntimeError(f"charge {tran_id} rejected: {status.get('message')}")
    return charge  # paid is set later by the callback (or call confirm_charge if no callback arrives)


async def check_transaction(tran_id):
    b = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    b["hash"] = payway_hash([b["req_time"], b["merchant_id"], b["tran_id"]], API_KEY)
    return await post("/api/payment-gateway/v1/payments/check-transaction-2", b)


async def confirm_charge(charge):
    """Confirms one charge with PayWay using our own tran_id and server-side amount; reserved before awaiting."""
    if charge.get("paid") or charge.get("checking"):
        return bool(charge.get("paid"))
    charge["checking"] = True
    try:
        d = (await check_transaction(charge["tran_id"])).get("data") or {}
        charge["paid"] = (d.get("payment_status") == "APPROVED"
                          and Decimal(str(d.get("original_amount"))) == Decimal(charge["amount"]))
    finally:
        charge["checking"] = False
    return charge["paid"]


app = FastAPI()


@app.post("/subscriptions/{sub_id}/subscribe")
async def subscribe(sub_id: str):
    sub = SUBSCRIPTIONS.get(sub_id)  # in a real app: the logged-in customer's subscription
    if not sub:
        raise HTTPException(404, "subscription not found")
    if sub.get("pwt"):
        raise HTTPException(409, "already subscribed")
    return {"action": f"{BASE_URL}/api/payment-gateway/v1/payments/purchase", "fields": subscribe_fields(sub)}


@app.post("/payway/callback")
async def callback(request: Request):
    # Unsigned body: return_params / tran_id are only lookup keys into charges WE created;
    # the result comes from Check transaction for that charge, compared with its server-side amount.
    body = await request.json()
    charge = CHARGES.get(tran_id_from(body.get("return_params")) or str(body.get("tran_id")))
    if not charge:
        raise HTTPException(404)
    paid = await confirm_charge(charge)
    # TODO: record the payment in your database when `paid` is true (make this idempotent).
    print("charge", charge["tran_id"], "PAID" if paid else "not paid")
    return {}


@app.post("/payway/token-callback")
async def token_callback(request: Request):
    # Not signed, and the Subscription request has no request_id of ours. So the token is taken only
    # from Get token details, and only if it matches one of our subscriptions: same ctid, CITR_FIX,
    # and the plan's frequency, amount and currency.
    d = (await get_token_details(str((await request.json()).get("request_id")))).get("data") or {}

    def matches(s):
        p = PLANS[s["plan"]]
        return (s["ctid"] == d.get("ctid") and d.get("token_flag") == "CITR_FIX"
                and d.get("frequency") == p["frequency"] and d.get("currency") == p["currency"]
                and Decimal(str(d.get("subscribed_amount") or "NaN")) == Decimal(p["amount"]))

    sub = next((s for s in SUBSCRIPTIONS.values() if matches(s)), None)
    if not sub:
        raise HTTPException(409)
    sub["pwt"] = d.get("pwt") if d.get("status") == 1 else None  # 0 removed, 2 frozen: stop charging
    return {}
