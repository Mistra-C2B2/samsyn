"""
Clerk webhook endpoint for user synchronization.

Handles Clerk webhook events:
- user.created: Create new user in database
- user.updated: Update existing user profile
- user.deleted: Remove user from database (reassign ownership)

Security: Verifies webhook signatures using Svix to ensure requests are from Clerk.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from app.config import settings
from app.database import get_db
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Handle Clerk webhook events for user synchronization.

    Events handled:
    - user.created: Create new user in database
    - user.updated: Update existing user profile
    - user.deleted: Remove user and reassign ownership to placeholder

    Security:
        Verifies webhook signature using Clerk's webhook secret (via Svix).
        Returns 400 if signature verification fails.

    Error Handling:
        Returns 200 for most errors to prevent Clerk retries on transient issues.
        Logs errors for debugging.

    Args:
        request: FastAPI request object
        response: FastAPI response object
        db: Database session

    Returns:
        JSON response with status
    """
    # Get webhook secret from config
    webhook_secret = settings.CLERK_WEBHOOK_SECRET

    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    # Get request headers for signature verification
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }

    # Get raw body for signature verification
    body = await request.body()

    # Verify webhook signature
    try:
        wh = Webhook(webhook_secret)
        payload = wh.verify(body, headers)
    except WebhookVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook verification failed: {str(e)}",
        )

    # Parse event
    event_type = payload.get("type")
    event_data = payload.get("data")

    if not event_type or not event_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook payload"
        )

    # Initialize user service
    user_service = UserService(db)

    try:
        # Handle different event types
        if event_type == "user.created":
            await handle_user_created(event_data, user_service)

        elif event_type == "user.updated":
            await handle_user_updated(event_data, user_service)

        elif event_type == "user.deleted":
            await handle_user_deleted(event_data, user_service)

        else:
            # Log unknown event types but don't fail
            print(f"Unhandled webhook event type: {event_type}")

        return {"status": "success"}

    except Exception as e:
        # Log error but return 200 to prevent Clerk retries
        # For critical errors, you might want to return 500 to trigger retry
        print(f"Error processing webhook: {str(e)}")

        # For now, returning 200 to acknowledge receipt
        return {"status": "error", "message": str(e)}


async def handle_user_created(event_data: Dict[str, Any], user_service: UserService):
    """
    Handle user.created event from Clerk.

    Extracts user data from Clerk event and creates user in database.
    Uses get_or_create to handle duplicate webhook deliveries.

    Args:
        event_data: Clerk event data
        user_service: User service instance

    Raises:
        ValueError: If required user data is missing
    """
    # Extract user data from Clerk event
    clerk_id = event_data.get("id")

    # Get email addresses (Clerk can have multiple)
    email_addresses = event_data.get("email_addresses", [])
    primary_email_id = event_data.get("primary_email_address_id")

    # Find primary email
    primary_email = None
    if primary_email_id:
        primary_email = next(
            (
                e["email_address"]
                for e in email_addresses
                if e.get("id") == primary_email_id
            ),
            None,
        )

    # Fallback to first email if primary not found
    if not primary_email and email_addresses:
        primary_email = email_addresses[0]["email_address"]

    if not clerk_id or not primary_email:
        raise ValueError("Missing required user data (id or email)")

    # Create user schema
    user_data = UserCreate(
        clerk_id=clerk_id,
        email=primary_email,
        username=event_data.get("username"),
        first_name=event_data.get("first_name"),
        last_name=event_data.get("last_name"),
        profile_image_url=event_data.get("profile_image_url"),
    )

    # Create or get user (handles duplicate webhook deliveries)
    user, created = user_service.get_or_create(clerk_id, user_data)

    if created:
        print(f"Created user: {user.clerk_id} ({user.email})")
    else:
        print(f"User already exists: {user.clerk_id}")


async def handle_user_updated(event_data: Dict[str, Any], user_service: UserService):
    """
    Handle user.updated event from Clerk.

    Updates existing user with new data from Clerk.

    Args:
        event_data: Clerk event data
        user_service: User service instance

    Raises:
        ValueError: If user ID is missing
    """
    clerk_id = event_data.get("id")

    if not clerk_id:
        raise ValueError("Missing user ID")

    # Get updated email
    email_addresses = event_data.get("email_addresses", [])
    primary_email_id = event_data.get("primary_email_address_id")

    primary_email = None
    if primary_email_id:
        primary_email = next(
            (
                e["email_address"]
                for e in email_addresses
                if e.get("id") == primary_email_id
            ),
            None,
        )

    # Create update schema
    user_data = UserUpdate(
        email=primary_email,
        username=event_data.get("username"),
        first_name=event_data.get("first_name"),
        last_name=event_data.get("last_name"),
        profile_image_url=event_data.get("profile_image_url"),
    )

    # Update user
    user = user_service.update_user(clerk_id, user_data)

    if user:
        print(f"Updated user: {user.clerk_id}")
    else:
        print(f"User not found for update: {clerk_id}")


async def handle_user_deleted(event_data: Dict[str, Any], user_service: UserService):
    """
    Handle user.deleted event from Clerk.

    Deletes user and reassigns all their content to the deleted user placeholder.
    This preserves data for collaborators.

    Note: This handler is idempotent. If the user was already deleted via the
    self-service /users/me endpoint, this will return early without error.

    Args:
        event_data: Clerk event data
        user_service: User service instance

    Raises:
        ValueError: If user ID is missing
    """
    clerk_id = event_data.get("id")

    if not clerk_id:
        raise ValueError("Missing user ID")

    # Check if user still exists (may have been deleted via self-service endpoint)
    user = user_service.get_by_clerk_id(clerk_id)
    if not user:
        print(f"User {clerk_id} not found - likely already deleted via self-service")
        return

    # Delete user and reassign ownership
    deleted = user_service.delete_user(clerk_id)

    if deleted:
        print(f"Deleted user: {clerk_id} (ownership reassigned to placeholder)")
    else:
        print(f"User not found for deletion: {clerk_id}")
