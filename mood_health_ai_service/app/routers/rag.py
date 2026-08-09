"""Signed internal RAG answer endpoint."""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import ValidationError

from app.auth import verify_internal_auth
from app.models.contracts import RagAnswerRequest, RagAnswerResponse
from app.rag.service import RagNotReadyError, answer_question
from app.ratelimit import rate_limit

logger = logging.getLogger("mood_ai_service")
router = APIRouter()


@router.post(
    "/api/rag/answer",
    response_model=RagAnswerResponse,
    dependencies=[Depends(rate_limit())],
)
async def answer(
    http_request: Request,
    x_signature: str | None = Header(default=None),
    x_timestamp: str | None = Header(default=None),
    x_nonce: str | None = Header(default=None),
) -> RagAnswerResponse:
    body_bytes = await http_request.body()
    try:
        body = body_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=422, detail="请求体必须使用 UTF-8") from error

    authenticated, auth_error = await verify_internal_auth(
        body,
        x_signature,
        x_timestamp,
        x_nonce,
    )
    if not authenticated:
        raise HTTPException(status_code=401, detail=auth_error)

    try:
        request = RagAnswerRequest.model_validate_json(body)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors()) from error

    try:
        return await answer_question(request)
    except RagNotReadyError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.error(
            "RAG answer failed requestId=%s type=%s",
            request.requestId,
            type(error).__name__,
        )
        raise HTTPException(status_code=502, detail="知识助手暂时不可用") from error
