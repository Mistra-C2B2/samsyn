"""
Test webhook endpoint WITHOUT signature verification for local testing.

This endpoint allows you to test webhook event handling logic locally
without needing proper Svix signatures.

WARNING: This is for development/testing only. Remove before production!
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserUpdate

router = APIRouter(prefix="/test-webhooks", tags=["test-webhooks"])


@router.post("/clerk")
async def test_clerk_webhook(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """
    Test Clerk webhook events WITHOUT signature verification.

    For local testing only! Same logic as real webhook but skips Svix verification.

    Args:
        payload: Webhook event payload
        db: Database session

    Returns:
        JSON response with status
    """
    event_type = payload.get("type")
    data = payload.get("data", {})

    user_service = UserService(db)

    try:
        if event_type == "user.created":
            # Extract user data from Clerk payload
            clerk_id = data.get("id")
            email_addresses = data.get("email_addresses", [])
            primary_email_id = data.get("primary_email_address_id")

            # Find primary email
            primary_email = None
            for email_data in email_addresses:
                if email_data.get("id") == primary_email_id:
                    primary_email = email_data.get("email_address")
                    break

            if not primary_email and email_addresses:
                primary_email = email_addresses[0].get("email_address")

            # Create user
            user_data = UserCreate(
                clerk_id=clerk_id,
                email=primary_email or f"{clerk_id}@placeholder.com",
                username=data.get("username"),
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                profile_image_url=data.get("profile_image_url"),
            )

            user, created = user_service.get_or_create(clerk_id, user_data)
            action = "Created" if created else "Found existing"
            print(f"✅ {action} user: {user.clerk_id} ({user.email})")

            return {"status": "success", "event": event_type, "user_id": str(user.id), "created": created}

        elif event_type == "user.updated":
            clerk_id = data.get("id")
            email_addresses = data.get("email_addresses", [])
            primary_email_id = data.get("primary_email_address_id")

            # Find primary email
            primary_email = None
            for email_data in email_addresses:
                if email_data.get("id") == primary_email_id:
                    primary_email = email_data.get("email_address")
                    break

            # Update user
            user_data = UserUpdate(
                email=primary_email,
                username=data.get("username"),
                first_name=data.get("first_name"),
                last_name=data.get("last_name"),
                profile_image_url=data.get("profile_image_url"),
            )

            user = user_service.update_user(clerk_id, user_data)
            if user:
                print(f"✅ Updated user: {user.clerk_id}")
                return {"status": "success", "event": event_type, "user_id": str(user.id)}
            else:
                print(f"⚠️ User not found: {clerk_id}")
                return {"status": "error", "event": event_type, "message": "User not found"}

        elif event_type == "user.deleted":
            clerk_id = data.get("id")
            user_service.delete_user(clerk_id)
            print(f"✅ Deleted user: {clerk_id}")

            return {"status": "success", "event": event_type}

        else:
            print(f"⚠️ Unknown event type: {event_type}")
            return {"status": "ignored", "event": event_type, "message": "Unknown event type"}

    except Exception as e:
        print(f"❌ Error processing webhook: {str(e)}")
        # Return 200 to prevent Clerk retries on transient errors
        return {"status": "error", "event": event_type, "message": str(e)}
