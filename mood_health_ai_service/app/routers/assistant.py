"""Signed internal endpoint for the unified psychological assistant."""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import ValidationError

from app.assistant.service import generate_assistant_response
from app.auth import verify_internal_auth
from app.models.contracts import AssistantResponse, AssistantResponseRequest
from app.ratelimit import rate_limit

logger = logging.getLogger("mood_ai_service")
router = APIRouter()


@router.post(
    "/api/assistant/respond",
    response_model=AssistantResponse,
    dependencies=[Depends(rate_limit())],
)
async def respond(
    http_request: Request,
    x_signature: str | None = Header(default=None),
    x_timestamp: str | None = Header(default=None),
    x_nonce: str | None = Header(default=None),
) -> AssistantResponse:
    body_bytes = await http_request.body()
    try:
        body = body_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=422, detail="Request body must use UTF-8") from error

    authenticated, auth_error = await verify_internal_auth(
        body,
        x_signature,
        x_timestamp,
        x_nonce,
    )
    if not authenticated:
        raise HTTPException(status_code=401, detail=auth_error)

    try:
        request = AssistantResponseRequest.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors()) from error

    try:
        return await generate_assistant_response(request)
    except Exception as error:
        logger.error(
            "Assistant response failed requestId=%s type=%s",
            request.requestId,
            type(error).__name__,
        )
        raise HTTPException(
            status_code=502,
            detail="AI psychological assistant is unavailable",
        ) from error
