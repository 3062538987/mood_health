"""Public facade for the unified psychological-assistant graph."""

from app.agent.orchestration import run_assistant_agent
from app.models.contracts import AssistantResponse, AssistantResponseRequest


async def generate_assistant_response(request: AssistantResponseRequest) -> AssistantResponse:
    return await run_assistant_agent(request)
