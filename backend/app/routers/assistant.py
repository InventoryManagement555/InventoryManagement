from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import AssistantAsk, AssistantResponse
from app.services.assistant_service import ask_assistant

router = APIRouter(tags=["assistant"])


@router.post("/assistant/ask", response_model=AssistantResponse)
async def ask(
    payload: AssistantAsk,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = await ask_assistant(db, payload.question)
    return AssistantResponse(answer=answer)
