from fastapi import APIRouter

api_router = APIRouter()

# Phase 2: Authentication endpoints
from app.api.v1 import webhooks, test_auth, test_webhooks

api_router.include_router(webhooks.router)
api_router.include_router(test_auth.router)
api_router.include_router(test_webhooks.router)  # For local testing without signatures  # TODO: Remove after Phase 2 testing

# Future routers will be added in later phases
# from app.api.v1 import users, maps, layers, features, comments
# api_router.include_router(users.router)
# api_router.include_router(maps.router)
# api_router.include_router(layers.router)
# api_router.include_router(features.router)
# api_router.include_router(comments.router)
