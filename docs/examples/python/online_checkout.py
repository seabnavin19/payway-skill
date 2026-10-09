# Online checkout (PayWay Ecommerce Checkout) with FastAPI.
# POST /checkout          -> signed Purchase form fields for the browser to post to PayWay
# POST /payway/callback   -> PayWay's return_url callback; confirms with Check transaction
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import FastAPI, HTTPException, Request

from payway_hash import payway_hash

BASE_URL = os.environ.get("PAYWAY_BASE_URL", "https://checkout-sandbox.payway.com.kh")
MERCHANT_ID = os.environ["PAYWAY_MERCHANT_ID"]
API_KEY = os.environ["PAYWAY_API_KEY"]
PUBLIC_URL = os.environ.get("PUBLIC_URL", "https://your-shop.example")

# Hash field order from the Purchase API page; fields you don't send hash as "".
HASH_FIELDS = ["req_time", "merchant_id", "tran_id", "amount", "items", "shipping", "firstname", "lastname",
               "email", "phone", "type", "payment_option", "return_url", "cancel_url", "continue_success_url",
               "return_deeplink", "currency", "custom_fields", "return_params", "payout", "lifetime",
               "additional_params", "google_pay_token", "skip_success_page"]

# Replace with your database. Prices live on the server, never in the browser.
ORDERS = {"1001": {"id": "1001", "currency": "USD",
                   "lines": [{"price": Decimal("2.50"), "qty": 2}, {"price": Decimal("1.00"), "qty": 1}]}}


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def order_id_from(return_params):
    """return_params comes back in the callback as the string we sent, e.g. '{"order_id":"1001"}'."""
    try:
        return str(json.loads(return_params)["order_id"])
    except (TypeError, ValueError, KeyError):
        return None


def order_amount(order):
    """Amount is computed from the server-side order, never from client input."""
    total = sum(line["price"] * line["qty"] for line in order["lines"])
    return str(total.quantize(Decimal("1") if order["currency"] == "KHR" else Decimal("0.01")))  # KHR: no decimals


def purchase_fields(order):
    f = {
        "req_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": order["id"],  # max 20 chars, unique per attempt
        "amount": order_amount(order),
        "currency": order["currency"],
        "return_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "return_params": json.dumps({"order_id": order["id"]}),  # echoed in the callback
    }
    f["hash"] = payway_hash([f.get(k) for k in HASH_FIELDS], API_KEY)
    return f


async def check_transaction(tran_id):
    body = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    body["hash"] = payway_hash([body["req_time"], body["merchant_id"], body["tran_id"]], API_KEY)
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2", json=body)
    return r.json()


app = FastAPI()


@app.post("/checkout")
async def checkout(request: Request):
    order = ORDERS.get(str((await request.json()).get("orderId")))  # only the order ID comes from the browser
    if not order:
        raise HTTPException(404, "order not found")
    return {"action": f"{BASE_URL}/api/payment-gateway/v1/payments/purchase", "fields": purchase_fields(order)}


@app.post("/payway/callback")
async def callback(request: Request):
    # Don't trust the callback body: re-check the status with PayWay and compare the amount.
    # The portal describes the callback tran_id as gateway-generated, so find the order from the
    # return_params we sent (documented as included in the callback), then check our own tran_id.
    order = ORDERS.get(order_id_from((await request.json()).get("return_params")))
    if not order:
        raise HTTPException(404)
    d = (await check_transaction(order["id"])).get("data") or {}
    paid = d.get("payment_status") == "APPROVED" and Decimal(str(d.get("original_amount"))) == Decimal(order_amount(order))
    # TODO: mark the order paid in your database when `paid` is true (make this idempotent).
    print("order", order["id"], "PAID" if paid else f"not paid: {d.get('payment_status')}")
    return {}
