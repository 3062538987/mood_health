import hmac
import hashlib
import os
import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

INTERNAL_TOKEN = os.environ.get("AI_SERVICE_INTERNAL_TOKEN", "dev-token-change-in-production")
MAX_AGE_SECONDS = 300


class HmacAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/health" or request.url.path == "/api/health/ready":
            return await call_next(request)

        try:
            signature = request.headers.get("X-Signature")
            timestamp_str = request.headers.get("X-Timestamp")
            nonce = request.headers.get("X-Nonce")

            if not signature or not timestamp_str or not nonce:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing HMAC headers"},
                )

            try:
                timestamp = int(timestamp_str)
            except ValueError:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid timestamp"},
                )

            if abs(time.time() - timestamp) > MAX_AGE_SECONDS:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Request timestamp expired"},
                )

            body = await request.body()
            body_str = body.decode("utf-8") if body else ""
            message = f"{body_str}{timestamp_str}{INTERNAL_TOKEN}"
            expected = hmac.new(
                INTERNAL_TOKEN.encode("utf-8"),
                message.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            if not hmac.compare_digest(signature, expected):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "HMAC signature mismatch"},
                )

            return await call_next(request)
        except HTTPException:
            raise
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"detail": f"Internal auth error: {str(e)}"},
            )