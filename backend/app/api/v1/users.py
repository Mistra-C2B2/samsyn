"""
User API endpoints for account management.

Provides endpoints for:
- User data deletion (GDPR right to erasure)
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete the current user's account and data.

    This endpoint implements GDPR Article 17 (Right to Erasure) and:
    1. Transfers map ownership to collaborators (editors first, then viewers)
       or to a placeholder user if no collaborators exist
    2. Transfers layer ownership to placeholder
    3. Anonymizes comments (transfers to placeholder)
    4. Removes user from all collaborations
    5. Deletes user from local database
    6. Deletes user from Clerk

    The user will be signed out automatically after deletion.

    Returns:
        Status message confirming deletion

    Raises:
        401: If not authenticated
        500: If deletion fails
    """
    user_service = UserService(db)

    try:
        deleted = await user_service.delete_user_with_smart_transfer(
            current_user.clerk_id
        )

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user account",
            )

        return {"status": "success", "message": "Your account has been deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user account: {str(e)}",
        )
