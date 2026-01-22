"""
WMS Server service for database operations.

Handles all WMS server CRUD operations including:
- Server listing (all servers are shared/public)
- Server creation with automatic capabilities fetch
- Server updates and deletion
- Capabilities refresh
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.api.v1.wms import parse_wms_capabilities
from app.models.wms_server import WmsServer
from app.schemas.wms_server import WmsServerCreate, WmsServerUpdate


class WmsServerService:
    """Service for WMS server database operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Core CRUD Operations
    # ========================================================================

    def list_servers(self) -> List[WmsServer]:
        """
        Get all WMS servers.

        All servers are shared/public, so no user filtering is needed.

        Returns:
            List of WmsServer instances ordered by creation date (newest first)
        """
        return self.db.query(WmsServer).order_by(WmsServer.created_at.desc()).all()

    def get_server(self, server_id: UUID) -> Optional[WmsServer]:
        """
        Get WMS server by ID.

        Args:
            server_id: Server UUID

        Returns:
            WmsServer if found, None otherwise
        """
        return self.db.query(WmsServer).filter(WmsServer.id == server_id).first()

    def get_server_by_url(self, base_url: str) -> Optional[WmsServer]:
        """
        Get WMS server by base URL.

        Args:
            base_url: WMS service base URL

        Returns:
            WmsServer if found, None otherwise
        """
        return self.db.query(WmsServer).filter(WmsServer.base_url == base_url).first()

    async def create_server(
        self, server_data: WmsServerCreate, creator_id: UUID
    ) -> WmsServer:
        """
        Create new WMS server and fetch capabilities.

        Args:
            server_data: Server creation schema
            creator_id: User UUID creating the server

        Returns:
            Created WmsServer instance

        Raises:
            ValueError: If capabilities cannot be fetched
        """
        # Fetch capabilities to validate the URL and populate metadata
        capabilities = await self._fetch_capabilities(server_data.base_url)

        server = WmsServer(
            name=server_data.name,
            base_url=server_data.base_url,
            description=server_data.description,
            version=capabilities.get("version"),
            service_title=capabilities.get("service_title"),
            service_provider=capabilities.get("service_provider"),
            layer_count=len(capabilities.get("layers", [])),
            capabilities_cache=capabilities,
            cached_at=datetime.utcnow(),
            created_by=creator_id,
        )

        self.db.add(server)
        self.db.commit()
        self.db.refresh(server)

        return server

    def update_server(
        self, server_id: UUID, server_data: WmsServerUpdate, user_id: UUID
    ) -> Optional[WmsServer]:
        """
        Update WMS server metadata.

        Only the creator can update a server.

        Args:
            server_id: Server UUID
            server_data: Partial update schema
            user_id: User UUID requesting the update

        Returns:
            Updated WmsServer or None if not found/unauthorized
        """
        server = self.db.query(WmsServer).filter(WmsServer.id == server_id).first()

        if not server:
            return None

        # Only creator can update
        if server.created_by != user_id:
            return None

        # Update only provided fields
        update_dict = server_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(server, field, value)

        self.db.commit()
        self.db.refresh(server)

        return server

    def delete_server(self, server_id: UUID, user_id: UUID) -> bool:
        """
        Delete WMS server.

        Only the creator can delete a server.

        Args:
            server_id: Server UUID
            user_id: User UUID requesting deletion

        Returns:
            True if deleted, False if not found/unauthorized
        """
        server = self.db.query(WmsServer).filter(WmsServer.id == server_id).first()

        if not server:
            return False

        # Only creator can delete
        if server.created_by != user_id:
            return False

        self.db.delete(server)
        self.db.commit()

        return True

    # ========================================================================
    # Capabilities Management
    # ========================================================================

    async def refresh_capabilities(self, server_id: UUID) -> Optional[WmsServer]:
        """
        Refresh the capabilities cache for a WMS server.

        Args:
            server_id: Server UUID

        Returns:
            Updated WmsServer or None if not found

        Raises:
            ValueError: If capabilities cannot be fetched
        """
        server = self.db.query(WmsServer).filter(WmsServer.id == server_id).first()

        if not server:
            return None

        # Fetch fresh capabilities
        capabilities = await self._fetch_capabilities(server.base_url)

        # Update server with new capabilities
        server.version = capabilities.get("version")
        server.service_title = capabilities.get("service_title")
        server.service_provider = capabilities.get("service_provider")
        server.layer_count = len(capabilities.get("layers", []))
        server.capabilities_cache = capabilities
        server.cached_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(server)

        return server

    def get_layers(self, server_id: UUID) -> Optional[dict]:
        """
        Get available layers from a WMS server's cached capabilities.

        Args:
            server_id: Server UUID

        Returns:
            Dict with server info and layers list, or None if server not found
        """
        server = self.db.query(WmsServer).filter(WmsServer.id == server_id).first()

        if not server:
            return None

        return {
            "server_id": str(server.id),
            "server_name": server.name,
            "base_url": server.base_url,
            "version": server.version,
            "layers": server.capabilities_cache.get("layers", []),
            "cached_at": server.cached_at.isoformat() if server.cached_at else None,
        }

    # ========================================================================
    # Private Helper Methods
    # ========================================================================

    async def _fetch_capabilities(self, base_url: str) -> dict:
        """
        Fetch and parse WMS GetCapabilities.

        Tries WMS 1.3.0 first, falls back to 1.1.1.

        Args:
            base_url: WMS service base URL

        Returns:
            Parsed capabilities dict

        Raises:
            ValueError: If capabilities cannot be fetched or parsed
        """
        # Clean up the URL
        clean_url = base_url.split("?")[0]

        params = {
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetCapabilities",
        }

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(clean_url, params=params)
                response.raise_for_status()
            except httpx.TimeoutException:
                raise ValueError("WMS server request timed out")
            except httpx.HTTPStatusError as e:
                raise ValueError(f"WMS server returned error: {e.response.status_code}")
            except httpx.RequestError as e:
                raise ValueError(f"Failed to connect to WMS server: {str(e)}")

        # Try to parse as WMS 1.3.0
        try:
            return parse_wms_capabilities(response.text)
        except ValueError:
            pass

        # Fallback to WMS 1.1.1
        params["VERSION"] = "1.1.1"
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(clean_url, params=params)
                response.raise_for_status()
                return parse_wms_capabilities(response.text)
            except Exception as e:
                raise ValueError(f"Failed to parse WMS capabilities: {str(e)}")
