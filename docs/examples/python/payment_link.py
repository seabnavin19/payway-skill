# Payment link (PayWay Payment Link API) with FastAPI.
# POST /orders/{order_id}/payment-link -> creates a payment link for a server-side order, returns the URL to send
# POST /payway/callback                -> PayWay's return_url callback; confirms with Check transaction
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from PayWay),
#      PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
import json
import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import FastAPI, HTTPException, Request

from payway_hash import payway_hash

BASE_URL = os.environ.get("PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
MERCHANT_ID = os.environ["PAYWAY_MERCHANT_ID"]
API_KEY = os.environ["PAYWAY_API_KEY"]
RSA_PUBLIC_KEY = os.environ["PAYWAY_RSA_PUBLIC_KEY"]
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://your-shop.example")

# Replace with your database. Prices live on the server, never in the browser.
ORDERS = {"3001": {"id": "3001", "currency": "USD", "title": "Order 3001",
                   "lines": [{"price": Decimal("4.00"), "qty": 1}]}}


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def order_amount(order):
    """Amount is computed from the server-side order, never from client input."""
    total = sum(line["price"] * line["qty"] for line in order["lines"])
    return str(total.quantize(Decimal("1") if order["currency"] == "KHR" else Decimal("0.01")))  # KHR: no decimals


def encrypt_merchant_auth(obj):
    """JSON encrypted with PayWay's RSA public key in 117-byte chunks, then Base64
    (port of the portal's PHP opensslEncryption; PKCS#1 v1.5 = PHP openssl_public_encrypt default)."""
    key = load_pem_public_key(RSA_PUBLIC_KEY.encode("ascii"))
    src = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    out = b"".join(key.encrypt(src[i:i + 117], padding.PKCS1v15()) for i in range(0, len(src), 117))
    return base64.b64encode(out).decode("ascii")


async def create_payment_link(order):
    request_time = req_time()
    merchant_auth = encrypt_merchant_auth({
        "mc_id": MERCHANT_ID,
        "title": order["title"],
        "amount": order_amount(order),
        "currency": order["currency"],
        "payment_limit": "1",
        "expired_date": str(int(time.time()) + 7 * 24 * 3600),  # Unix time, 7 days
        "return_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "merchant_ref_no": order["id"],
    })
    fields = {
        "request_time": request_time,
        "merchant_id": MERCHANT_ID,
        "merchant_auth": merchant_auth,
        "hash": payway_hash([request_time, MERCHANT_ID, merchant_auth], API_KEY),
    }
    # files=(None, value) makes httpx send multipart/form-data text fields.
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/merchant-portal/merchant-access/payment-link/create",
                              files={k: (None, v) for k, v in fields.items()})
    return r.json()


async def get_payment_link_details(link_id):
    body = {"request_time": req_time(), "merchant_id": MERCHANT_ID,
            "merchant_auth": encrypt_merchant_auth({"mc_id": MERCHANT_ID, "id": link_id})}
    body["hash"] = payway_hash([body["request_time"], body["merchant_id"], body["merchant_auth"]], API_KEY)
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/merchant-portal/merchant-access/payment-link/detail", json=body)
    return r.json()


async def check_transaction(tran_id):
    body = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    body["hash"] = payway_hash([body["req_time"], body["merchant_id"], body["tran_id"]], API_KEY)
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2", json=body)
    return r.json()


# ponytail: in-memory, single process. With a DB: insert tran_id into a unique column first
# (that insert is the reservation), delete it if PayWay does not confirm.
USED_TRAN_IDS = set()

app = FastAPI()


@app.post("/orders/{order_id}/payment-link")
async def payment_link(order_id: str):
    order = ORDERS.get(order_id)
    if not order:
        raise HTTPException(404, "order not found")
    res = await create_payment_link(order)
    status = res.get("status") or {}
    if status.get("code") != "00":
        raise HTTPException(502, status.get("message"))
    order["link_id"] = res["data"]["id"]  # store with the order: used to bind the callback to this order's link
    return {"paymentLink": res["data"]["payment_link"]}  # send this to the customer


@app.post("/payway/callback")
async def callback(request: Request):
    # Callback has tran_id (PayWay's), status and merchant_ref_no (our order ID) - all unauthenticated.
    # Check transaction does not return the link id or merchant_ref_no, so bind the payment to THIS
    # order by asking PayWay about the order's own link (payment_limit 1 => PAID after one payment),
    # Each tran_id marks at most one order paid, and each order accepts at most one tran_id.
    body = await request.json()
    order = ORDERS.get(str(body.get("merchant_ref_no")))
    tran_id = str(body.get("tran_id"))
    if (not order or not order.get("link_id") or order.get("paid_tran_id") or order.get("checking")
            or tran_id in USED_TRAN_IDS):
        raise HTTPException(409)
    order["checking"] = True  # reserve order and tran_id before awaiting PayWay, so concurrent callbacks can't both pass
    USED_TRAN_IDS.add(tran_id)
    paid, d = False, {}
    try:
        link = (await get_payment_link_details(order["link_id"])).get("data") or {}
        d = (await check_transaction(tran_id)).get("data") or {}
        amount = Decimal(order_amount(order))
        paid = (link.get("status") == "PAID" and Decimal(str(link.get("amount"))) == amount
                and d.get("payment_status") == "APPROVED" and Decimal(str(d.get("original_amount"))) == amount)
    finally:
        if paid:
            order["paid_tran_id"] = tran_id  # paid flag and tran_id set together
        else:
            USED_TRAN_IDS.discard(tran_id)  # release on non-confirmation
        order["checking"] = False
    # TODO: mark the order paid in your database when `paid` is true (make this idempotent).
    print("order", order["id"], "PAID" if paid else f"not paid: {d.get('payment_status')}")
    return {}
