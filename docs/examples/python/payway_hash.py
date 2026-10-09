import base64
import hashlib
import hmac


def payway_hash(values, api_key):
    """HMAC-SHA512 (base64) over field values concatenated in the order given in each
    API page's "Authentication & hash" section. Pass values as the exact strings you
    send (e.g. "10.00", not 10). Server-side only: never expose the API key."""
    message = "".join("" if v is None else str(v) for v in values)
    digest = hmac.new(api_key.encode("utf-8"), message.encode("utf-8"), hashlib.sha512).digest()
    return base64.b64encode(digest).decode("ascii")
