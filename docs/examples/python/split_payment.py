# Split payment (PayWay Split & Payout on an Ecommerce Checkout purchase) with FastAPI.
# POST /checkout                     -> signed Purchase form fields with a payout split computed on the server
# POST /payway/callback              -> PayWay's return_url callback; confirms with Check transaction, once per order
# POST /sellers/{seller_id}/whitelist -> adds a seller's stored payout account to the PayWay whitelist (staff only)
# Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from ABA Bank),
#      PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import base64
import json
import os
from datetime import datetime, timezone
from decimal import ROUND_FLOOR, Decimal

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

# Replace with your database. Payout accounts and prices live on the server, never in the browser.
# "platform" is your own ABA account: it receives your fee so the payouts add up to the full amount.
SELLERS = {
    "s1": {"id": "s1", "account": "000133879", "whitelisted": False},
    "s2": {"id": "s2", "account": "000133880", "whitelisted": False},
    "platform": {"id": "platform", "account": "000133881", "whitelisted": False},
}
ORDERS = {"2001": {"id": "2001", "currency": "USD",
                   "lines": [{"seller_id": "s1", "price": Decimal("2.50"), "qty": 2},
                             {"seller_id": "s2", "price": Decimal("1.00"), "qty": 1}]}}
FEE_PERCENT = 10  # your commission on each line


def req_time():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def b64(s):
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def order_id_from(return_params):
    """return_params comes back in the callback as the string we sent, e.g. '{"order_id":"2001"}'."""
    try:
        return str(json.loads(return_params)["order_id"])
    except (TypeError, ValueError, KeyError):
        return None


# Work in minor units (cents; riel for KHR) so the shares add up exactly.
def unit(currency):
    return 1 if currency == "KHR" else 100


def fmt(minor, currency):
    return str(minor) if currency == "KHR" else f"{Decimal(minor) / 100:.2f}"  # KHR: no decimals


def line_minor(line, currency):
    return int(line["price"] * unit(currency)) * line["qty"]


def order_amount(order):
    return fmt(sum(line_minor(line, order["currency"]) for line in order["lines"]), order["currency"])


def json_number(s):
    """'4.50' -> 4.5, '4.00' -> 4: same JSON text as the Node example sends."""
    d = Decimal(s)
    return int(d) if d == d.to_integral_value() else float(d)


def split_order(order):
    """Amount and split come only from the server-side order and seller records."""
    shares = {}  # account -> minor units; one entry per account (code 39: duplicated account)

    def add(seller, minor):
        if not seller or not seller["whitelisted"]:
            raise ValueError(f"payout account for {seller['id'] if seller else 'unknown seller'} is not whitelisted")
        shares[seller["account"]] = shares.get(seller["account"], 0) + minor

    currency = order["currency"]
    total = 0
    for line in order["lines"]:
        minor = line_minor(line, currency)
        total += minor
        add(SELLERS.get(line["seller_id"]),
            int((Decimal(minor) * (100 - FEE_PERCENT) / 100).to_integral_value(ROUND_FLOOR)))
    fee = total - sum(shares.values())
    if fee > 0:
        add(SELLERS.get("platform"), fee)
    if len(shares) > 10:
        raise ValueError("PayWay allows at most 10 payouts per request")  # code 25
    return fmt(total, currency), [{"acc": acc, "amt": json_number(fmt(m, currency))} for acc, m in shares.items()]


def purchase_fields(order):
    amount, payout = split_order(order)  # amount equals order_amount(order); payouts add up to it exactly
    f = {
        "req_time": req_time(),
        "merchant_id": MERCHANT_ID,
        "tran_id": order["id"],  # max 20 chars, unique per attempt
        "amount": amount,
        "currency": order["currency"],
        "return_url": b64(f"{PUBLIC_URL}/payway/callback"),
        "return_params": json.dumps({"order_id": order["id"]}),  # echoed in the callback
        "payout": b64(json.dumps(payout, separators=(",", ":"))),  # Base64 JSON, e.g. [{"acc":"000133879","amt":4.5}]
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


async def add_beneficiary(payee):
    request_time = req_time()
    merchant_auth = encrypt_merchant_auth({"mc_id": MERCHANT_ID, "payee": payee})
    return await post("/api/merchant-portal/merchant-access/whitelist-account/add-whitelist-payout", {
        "request_time": request_time,
        "merchant_id": MERCHANT_ID,
        "merchant_auth": merchant_auth,
        "hash": payway_hash([request_time, merchant_auth], API_KEY),  # request_time, merchant_auth
    })


async def check_transaction(tran_id):
    b = {"req_time": req_time(), "merchant_id": MERCHANT_ID, "tran_id": tran_id}
    b["hash"] = payway_hash([b["req_time"], b["merchant_id"], b["tran_id"]], API_KEY)
    return await post("/api/payment-gateway/v1/payments/check-transaction-2", b)


app = FastAPI()


@app.post("/checkout")
async def checkout(request: Request):
    order = ORDERS.get(str((await request.json()).get("orderId")))  # only the order ID comes from the browser
    if not order:
        raise HTTPException(404, "order not found")
    if order.get("paid"):
        raise HTTPException(409, "order already paid")
    try:
        fields = purchase_fields(order)
    except ValueError as e:
        raise HTTPException(409, str(e))  # e.g. a seller not whitelisted yet
    return {"action": f"{BASE_URL}/api/payment-gateway/v1/payments/purchase", "fields": fields}


@app.post("/payway/callback")
async def callback(request: Request):
    # Don't trust the callback body: find the order from the return_params we sent, then confirm with
    # Check transaction for our own tran_id and the server-side amount. PayWay splits the money itself.
    order = ORDERS.get(order_id_from((await request.json()).get("return_params")))
    if not order:
        raise HTTPException(404)
    if order.get("paid") or order.get("checking"):
        return {}  # already confirmed or being confirmed
    order["checking"] = True  # reserve before awaiting PayWay
    try:
        d = (await check_transaction(order["id"])).get("data") or {}
        if (d.get("payment_status") == "APPROVED"
                and Decimal(str(d.get("original_amount"))) == Decimal(order_amount(order))):
            order["paid"] = True
    finally:
        order["checking"] = False
    print("order", order["id"], "PAID" if order.get("paid") else "not paid")
    return {}


# TODO: protect this route with your staff authentication. Only the seller ID comes from the request;
# the account is your stored record for that seller.
@app.post("/sellers/{seller_id}/whitelist")
async def whitelist(seller_id: str):
    seller = SELLERS.get(seller_id)
    if not seller:
        raise HTTPException(404, "seller not found")
    if seller["whitelisted"]:
        return {"whitelisted": True}
    r = await add_beneficiary(seller["account"])
    # The portal lists no success code for this API; accept only an Active (status 1) beneficiary.
    if (r.get("data") or {}).get("status") == 1:
        seller["whitelisted"] = True
    return JSONResponse({"whitelisted": seller["whitelisted"], "status": r.get("status")},
                        status_code=200 if seller["whitelisted"] else 502)
