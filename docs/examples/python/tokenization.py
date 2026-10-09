# Tokenization (PayWay Credentials on File, unscheduled payments) with FastAPI.
# POST /customers/{customer_id}/link-account -> starts ABA account linking, returns qr_string / deeplink
# POST /customers/{customer_id}/link-card    -> signed Link Card form fields for the browser to post to PayWay
# POST /payway/token-callback                -> token callback; re-fetches the token with Get token details
# POST /orders/{order_id}/pay                -> one-click payment with the saved token (CITU_FLEX)
# POST /payway/payment-callback              -> payment callback; confirms with Check transaction
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
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

# Hash field order from the Payment API page; fields you don't send hash as "".
PAYMENT_HASH_FIELDS = ["request_time", "merchant_id", "tran_id", "amount", "currency", "items", "ctid", "pwt",
                       "first_name", "last_name", "email", "phone", "purchase_type", "callback_url",
                       "custom_fields", "return_params", "payout", "token_flag", "shipping_fee"]

# Replace with your database. In a real app the customer comes from your login session,
# and each order must belong to that customer. One saved method per customer, for brevity.
CUSTOMERS = {"c1": {"id": "c1", "ctid": "cust7f3a9e21", "currency": "USD"}}
ORDERS = {"5001": {"id": "5001", "customer_id": "c1", "currency": "USD",
                   "lines": [{"price": Decimal("3.00"), "qty": 1}]}}
LINK_REQUESTS = {}  # our request_id -> customer id, stored before PayWay is called


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def new_request_id():
    return secrets.token_hex(10)  # 20 letters/digits (request_id: 5-24)


def order_amount(order):
    """Amount is computed from the server-side order, never from client input."""
    total = sum(line["price"] * line["qty"] for line in order["lines"])
    return str(total.quantize(Decimal("1") if order["currency"] == "KHR" else Decimal("0.01")))  # KHR: no decimals


def json_number(s):
    """'4.50' -> 4.5, '4.00' -> 4: the JSON text then equals str(value), the text we hash (same as Node)."""
    d = Decimal(s)
    return int(d) if d == d.to_integral_value() else float(d)


async def post(path, body):
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{BASE_URL}{path}", json=body)
    return r.json()


def link_fields(customer):
    f = {
        "request_id": new_request_id(),
        "request_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "ctid": customer["ctid"],
        "token_flag": "CITI_FLEX",  # customer-initiated only; use CITO_FLEX to charge without the customer present
        "currency": customer["currency"],
        "callback_url": b64(f"{PUBLIC_URL}/payway/token-callback"),
    }
    LINK_REQUESTS[f["request_id"]] = customer["id"]
    return f


async def link_account(customer):
    b = link_fields(customer)
    b["hash"] = payway_hash([b["merchant_id"], b["request_time"], b["ctid"], b.get("return_deeplink"),
                             b["callback_url"], b["request_id"], b["token_flag"], b["currency"]], API_KEY)
    return await post("/api/payment-credential/v3/aof/link-account", b)


def link_card_fields(customer):
    f = link_fields(customer)
    # frequency and amount are in the portal's hash sample but are not Link Card fields: hashed as "".
    f["hash"] = payway_hash([f["merchant_id"], f["request_time"], f["ctid"], f["callback_url"], f["request_id"],
                             f["token_flag"], "", "", f["currency"], f.get("continue_success_url")], API_KEY)
    return f


async def get_token_details(request_id):
    b = {"request_time": req_time(), "request_id": request_id, "merchant_id": MERCHANT_ID}
    b["hash"] = payway_hash([b["merchant_id"], b["request_time"], b["request_id"]], API_KEY)
    return await post("/api/payment-credential/v3/token-management/get-token-details", b)


async def pay_with_token(order, customer):
    b = {
        "request_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": order["id"],  # max 20 chars, unique per payment
        "ctid": customer["ctid"],
        "pwt": customer["pwt"],
        "amount": json_number(order_amount(order)),
        "currency": order["currency"],
        "token_flag": "CITU_FLEX",
        "callback_url": b64(f"{PUBLIC_URL}/payway/payment-callback"),
    }
    b["hash"] = payway_hash([b.get(k) for k in PAYMENT_HASH_FIELDS], API_KEY)
    return await post("/api/payment-gateway/v3/purchase/payment-credential", b)


async def check_transaction(tran_id):
    b = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    b["hash"] = payway_hash([b["req_time"], b["merchant_id"], b["tran_id"]], API_KEY)
    return await post("/api/payment-gateway/v1/payments/check-transaction-2", b)


async def confirm_order(order):
    """Confirms one order with PayWay using our own tran_id (= order id) and server-side amount.
    The order is reserved before awaiting, so concurrent callbacks cannot both mark it."""
    if order.get("paid") or order.get("checking"):
        return bool(order.get("paid"))
    order["checking"] = True
    try:
        d = (await check_transaction(order["id"])).get("data") or {}
        order["paid"] = (d.get("payment_status") == "APPROVED"
                         and Decimal(str(d.get("original_amount"))) == Decimal(order_amount(order)))
    finally:
        order["checking"] = False
    return order["paid"]


app = FastAPI()


@app.post("/customers/{customer_id}/link-account")
async def start_link_account(customer_id: str):
    customer = CUSTOMERS.get(customer_id)
    if not customer:
        raise HTTPException(404, "customer not found")
    r = await link_account(customer)
    status = r.get("status") or {}
    if status.get("code") != "00":
        raise HTTPException(502, status.get("message"))
    return r["data"]  # qr_string (web: render as QR) and deeplink (mobile), valid 10 minutes


@app.post("/customers/{customer_id}/link-card")
async def start_link_card(customer_id: str):
    customer = CUSTOMERS.get(customer_id)
    if not customer:
        raise HTTPException(404, "customer not found")
    return {"action": f"{BASE_URL}/api/payment-credential/v3/cof/link-card", "fields": link_card_fields(customer)}


@app.post("/payway/token-callback")
async def token_callback(request: Request):
    # The token callback is not signed. Use only its request_id, and only if we issued it;
    # the token itself comes from Get token details, never from the callback body.
    request_id = str((await request.json()).get("request_id"))
    customer = CUSTOMERS.get(LINK_REQUESTS.get(request_id))
    if not customer:
        raise HTTPException(404)
    d = (await get_token_details(request_id)).get("data") or {}
    if d.get("ctid") != customer["ctid"]:
        raise HTTPException(409)
    customer["pwt"] = d.get("pwt") if d.get("status") == 1 else None  # 0 removed, 2 frozen: don't charge
    return {}


@app.post("/orders/{order_id}/pay")
async def pay(order_id: str):
    order = ORDERS.get(order_id)
    customer = CUSTOMERS.get(order["customer_id"]) if order else None
    if not order or not customer or not customer.get("pwt"):
        raise HTTPException(404, "order or saved method not found")
    if order.get("paid") or order.get("submitted"):
        raise HTTPException(409, "already submitted")
    order["submitted"] = True  # one Payment request per order: reserved before awaiting PayWay
    r = await pay_with_token(order, customer)
    status = r.get("status") or {}
    if status.get("code") != "00":
        order["submitted"] = False
        raise HTTPException(502, status.get("message"))
    return {"accepted": True}  # the result comes from the callback + Check transaction


@app.post("/payway/payment-callback")
async def payment_callback(request: Request):
    # Unsigned body: tran_id is only a lookup key (it is our order id); the result comes from
    # Check transaction for that order, compared with the server-side amount.
    order = ORDERS.get(str((await request.json()).get("tran_id")))
    if not order or not order.get("submitted"):
        raise HTTPException(404)
    paid = await confirm_order(order)
    # TODO: mark the order paid in your database when `paid` is true (make this idempotent).
    print("order", order["id"], "PAID" if paid else "not paid")
    return {}
