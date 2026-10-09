# Pre-auth & capture (PayWay Pre-auth) with FastAPI.
# POST /bookings/{booking_id}/hold    -> signed Purchase form fields with type=pre-auth (hold the deposit)
# POST /payway/callback               -> PayWay's return_url callback; confirms the hold with Check transaction
# POST /bookings/{booking_id}/capture -> completes the pre-auth for the final bill (staff only)
# POST /bookings/{booking_id}/cancel  -> cancels the pre-auth, releasing the hold (staff only)
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from ABA Bank),
#      PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from payway_hash import payway_hash

BASE_URL = os.environ.get("PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
MERCHANT_ID = os.environ["PAYWAY_MERCHANT_ID"]
API_KEY = os.environ["PAYWAY_API_KEY"]
RSA_PUBLIC_KEY = os.environ["PAYWAY_RSA_PUBLIC_KEY"]
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://your-shop.example")

# Hash field order from the Purchase API page; fields you don't send hash as "".
HASH_FIELDS = ["req_time", "merchant_id", "tran_id", "amount", "items", "shipping", "firstname", "lastname",
               "email", "phone", "type", "payment_option", "return_url", "cancel_url", "continue_success_url",
               "return_deeplink", "currency", "custom_fields", "return_params", "payout", "lifetime",
               "additional_params", "google_pay_token", "skip_success_page"]

# Replace with your database. Amounts live on the server, never in the browser.
# deposit = amount to hold; lines = final bill, filled in when the service ends.
BOOKINGS = {"7001": {"id": "7001", "currency": "USD", "deposit": Decimal("100.00"),
                     "lines": [{"price": Decimal("80.00"), "qty": 1}]}}


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def booking_id_from(return_params):
    """return_params comes back in the callback as the string we sent, e.g. '{"booking_id":"7001"}'."""
    try:
        return str(json.loads(return_params)["booking_id"])
    except (TypeError, ValueError, KeyError):
        return None


def money(n, currency):
    return str(n.quantize(Decimal("1") if currency == "KHR" else Decimal("0.01")))  # KHR: no decimals


def hold_amount(b):
    return money(b["deposit"], b["currency"])


def final_amount(b):
    return money(sum(line["price"] * line["qty"] for line in b["lines"]), b["currency"])


def json_number(s):
    """'4.50' -> 4.5, '4.00' -> 4: same JSON text as the Node example sends."""
    d = Decimal(s)
    return int(d) if d == d.to_integral_value() else float(d)


def hold_fields(booking):
    f = {
        "req_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": booking["id"],  # max 20 chars; this tran_id is what we complete or cancel later
        "amount": hold_amount(booking),
        "type": "pre-auth",
        "currency": booking["currency"],
        "return_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "return_params": json.dumps({"booking_id": booking["id"]}),  # echoed in the callback
    }
    f["hash"] = payway_hash([f.get(k) for k in HASH_FIELDS], API_KEY)
    return f


def encrypt_merchant_auth(obj):
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


async def complete_pre_auth(booking, amount):
    request_time = req_time()
    merchant_auth = encrypt_merchant_auth({"mc_id": MERCHANT_ID, "tran_id": booking["id"],
                                           "complete_amount": json_number(amount)})
    return await post("/api/merchant-portal/merchant-access/online-transaction/pre-auth-completion", {
        "request_time": request_time,
        "merchant_id": MERCHANT_ID,
        "merchant_auth": merchant_auth,
        "hash": payway_hash([merchant_auth, request_time, MERCHANT_ID], API_KEY),  # Complete: auth, time, id
    })


async def cancel_pre_auth(booking):
    request_time = req_time()
    merchant_auth = encrypt_merchant_auth({"mc_id": MERCHANT_ID, "tran_id": booking["id"]})
    return await post("/api/merchant-portal/merchant-access/online-transaction/pre-auth-cancellation", {
        "request_time": request_time,
        "merchant_id": MERCHANT_ID,
        "merchant_auth": merchant_auth,
        "hash": payway_hash([MERCHANT_ID, merchant_auth, request_time], API_KEY),  # Cancel: id, auth, time
    })


async def check_transaction(tran_id):
    b = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    b["hash"] = payway_hash([b["req_time"], b["merchant_id"], b["tran_id"]], API_KEY)
    return await post("/api/payment-gateway/v1/payments/check-transaction-2", b)


async def settle(booking, call, done_status):
    """Complete and cancel are one-shot and mutually exclusive: the booking leaves HELD before we await
    PayWay, so only one of them can be sent; it returns to HELD only if PayWay did not confirm."""
    if booking.get("state") != "HELD":
        raise HTTPException(409, f"booking is {booking.get('state') or 'not held'}")
    booking["state"] = "SETTLING"
    r = {}
    try:
        r = await call()
    finally:
        ok = (r.get("status") or {}).get("code") == "00" and r.get("transaction_status") == done_status
        booking["state"] = done_status if ok else "HELD"
    return JSONResponse({"state": booking["state"], "status": r.get("status")}, status_code=200 if ok else 502)


app = FastAPI()


@app.post("/bookings/{booking_id}/hold")
async def hold(booking_id: str):
    booking = BOOKINGS.get(booking_id)
    if not booking:
        raise HTTPException(404, "booking not found")
    return {"action": f"{BASE_URL}/api/payment-gateway/v1/payments/purchase", "fields": hold_fields(booking)}


@app.post("/payway/callback")
async def callback(request: Request):
    # Don't trust the callback body: find the booking from the return_params we sent, then confirm the
    # hold with Check transaction for our own tran_id and the server-side hold amount.
    booking = BOOKINGS.get(booking_id_from((await request.json()).get("return_params")))
    if not booking:
        raise HTTPException(404)
    if booking.get("state") or booking.get("checking"):
        return {}  # already confirmed or being confirmed
    booking["checking"] = True  # reserve before awaiting PayWay
    try:
        d = (await check_transaction(booking["id"])).get("data") or {}
        if (d.get("payment_status") == "PRE-AUTH"
                and Decimal(str(d.get("original_amount"))) == Decimal(hold_amount(booking))):
            booking["state"] = "HELD"
    finally:
        booking["checking"] = False
    print("booking", booking["id"], booking.get("state") or "not held")
    return {}


# TODO: protect the two routes below with your staff authentication.
@app.post("/bookings/{booking_id}/capture")
async def capture(booking_id: str):
    booking = BOOKINGS.get(booking_id)
    if not booking:
        raise HTTPException(404, "booking not found")
    amount = final_amount(booking)  # from the server-side bill, never from the request
    # Cards may complete up to +10% over the hold; this example stays within the held amount.
    if Decimal(amount) > Decimal(hold_amount(booking)):
        raise HTTPException(400, "final amount exceeds hold")
    return await settle(booking, lambda: complete_pre_auth(booking, amount), "COMPLETED")


@app.post("/bookings/{booking_id}/cancel")
async def cancel(booking_id: str):
    booking = BOOKINGS.get(booking_id)
    if not booking:
        raise HTTPException(404, "booking not found")
    return await settle(booking, lambda: cancel_pre_auth(booking), "CANCELLED")
