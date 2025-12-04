#!/usr/bin/env python3
"""
Test script for Clerk email validation.

This script tests the validate_user_email method to ensure it correctly
validates email addresses via the Clerk API.
"""
import asyncio
import sys
from app.services.auth_service import auth_service


async def test_email_validation():
    """Test email validation with Clerk API."""

    # Test with a valid email (replace with actual test email from Clerk)
    test_emails = [
        "test@example.com",  # This will likely not exist
        # Add actual test emails from your Clerk instance here
    ]

    print("Testing Clerk Email Validation")
    print("=" * 50)

    for email in test_emails:
        print(f"\nTesting email: {email}")
        try:
            exists = await auth_service.validate_user_email(email)
            print(f"Result: {'EXISTS' if exists else 'NOT FOUND'}")
        except Exception as e:
            print(f"Error: {type(e).__name__}: {str(e)}")

    print("\n" + "=" * 50)
    print("Test completed!")


if __name__ == "__main__":
    asyncio.run(test_email_validation())
