"""
Map service for database operations.

Handles all map CRUD operations including:
- Map listing and retrieval with permission checks
- Map creation, updates, and deletion
- Permission validation (private/collaborators/public)
- Collaborator management (add/remove/update)
- Layer management within maps (add/remove/update/reorder)
- User role determination (owner/editor/viewer/none)
"""

from uuid import UUID
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.map import Map
from app.models.layer import Layer, MapLayer
from app.models.collaborator import MapCollaborator
from app.schemas.map import MapCreate, MapUpdate


class MapService:
    """Service for map database operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Core CRUD Operations
    # ========================================================================

    def list_user_maps(self, user_id: Optional[UUID]) -> List[Map]:
        """
        Get all maps owned by or shared with user.

        Returns maps where user is:
        - The creator/owner
        - A collaborator (viewer or editor)
        - For unauthenticated users (user_id=None), only public maps

        Args:
            user_id: User's internal UUID, or None for unauthenticated users

        Returns:
            List of Map instances user has access to
        """
        # Unauthenticated users only see public maps
        if user_id is None:
            return self.db.query(Map).filter(Map.view_permission == "public").all()

        # Get maps owned by user
        owned_maps = self.db.query(Map).filter(Map.created_by == user_id).all()

        # Get maps where user is a collaborator
        collaborator_map_ids = (
            self.db.query(MapCollaborator.map_id)
            .filter(MapCollaborator.user_id == user_id)
            .all()
        )
        collaborator_map_ids = [row[0] for row in collaborator_map_ids]

        if collaborator_map_ids:
            collaborated_maps = (
                self.db.query(Map)
                .filter(Map.id.in_(collaborator_map_ids))
                .all()
            )
        else:
            collaborated_maps = []

        # Combine and deduplicate (though owner shouldn't be in collaborators)
        all_maps = {map.id: map for map in owned_maps + collaborated_maps}
        return list(all_maps.values())

    def get_map(self, map_id: UUID, user_id: Optional[UUID]) -> Optional[Map]:
        """
        Get map by ID with permission check.

        Args:
            map_id: Map UUID
            user_id: User UUID requesting the map, or None for unauthenticated users

        Returns:
            Map if found and user has view access, None otherwise
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return None

        # Check if user can view this map
        if not self.can_view_map(map_id, user_id):
            return None

        return map_obj

    def create_map(self, map_data: MapCreate, creator_id: UUID) -> Map:
        """
        Create new map.

        Args:
            map_data: Map creation schema
            creator_id: User UUID creating the map

        Returns:
            Created Map instance
        """
        map_obj = Map(
            name=map_data.name,
            description=map_data.description,
            created_by=creator_id,
            view_permission=map_data.view_permission.value,
            edit_permission=map_data.edit_permission.value,
            center_lat=map_data.center_lat,
            center_lng=map_data.center_lng,
            zoom=map_data.zoom,
            map_metadata=map_data.map_metadata or {},
        )

        self.db.add(map_obj)
        self.db.commit()
        self.db.refresh(map_obj)

        return map_obj

    def update_map(
        self, map_id: UUID, map_data: MapUpdate, user_id: UUID
    ) -> Optional[Map]:
        """
        Update map with permission check.

        Only updates fields that are provided (partial update).

        Args:
            map_id: Map UUID
            map_data: Partial update schema
            user_id: User UUID requesting the update

        Returns:
            Updated Map or None if not found/unauthorized
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return None

        # Check if user can edit this map
        if not self.can_edit_map(map_id, user_id):
            return None

        # Update only provided fields
        update_dict = map_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            # Handle enum conversion for permission fields
            if field in ("view_permission", "edit_permission") and value is not None:
                value = value.value
            setattr(map_obj, field, value)

        self.db.commit()
        self.db.refresh(map_obj)

        return map_obj

    def delete_map(self, map_id: UUID, user_id: UUID) -> bool:
        """
        Delete map with permission check.

        Only the map owner can delete the map. This cascades to:
        - MapCollaborator records (all collaborators removed)
        - MapLayer records (all layer associations removed)
        - Comment records (if cascade is set on model)

        Args:
            map_id: Map UUID
            user_id: User UUID requesting deletion

        Returns:
            True if deleted, False if not found/unauthorized
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return False

        # Only owner can delete map
        if map_obj.created_by != user_id:
            return False

        self.db.delete(map_obj)
        self.db.commit()

        return True

    # ========================================================================
    # Permission Checks
    # ========================================================================

    def can_view_map(self, map_id: UUID, user_id: Optional[UUID]) -> bool:
        """
        Check if user can view map.

        Permission logic:
        - private: Only creator can view
        - collaborators: Creator + collaborators can view
        - public: Anyone can view (including unauthenticated users)

        Args:
            map_id: Map UUID
            user_id: User UUID, or None for unauthenticated users

        Returns:
            True if user can view, False otherwise
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return False

        # Public maps can be viewed by anyone
        if map_obj.view_permission == "public":
            return True

        # Unauthenticated users can only view public maps
        if user_id is None:
            return False

        # Owner always has access
        if map_obj.created_by == user_id:
            return True

        # For private and collaborators, check if user is a collaborator
        if map_obj.view_permission in ["private", "collaborators"]:
            is_collaborator = (
                self.db.query(MapCollaborator)
                .filter(
                    MapCollaborator.map_id == map_id,
                    MapCollaborator.user_id == user_id,
                )
                .first()
            )

            # Private: only owner (already checked above)
            if map_obj.view_permission == "private":
                return False

            # Collaborators: owner or collaborator
            if map_obj.view_permission == "collaborators":
                return is_collaborator is not None

        return False

    def can_edit_map(self, map_id: UUID, user_id: UUID) -> bool:
        """
        Check if user can edit map.

        Permission logic based on edit_permission field:
        - private: Only owner can edit
        - collaborators: Owner + editor collaborators can edit
        - public: Anyone can edit (if they can view it)

        Args:
            map_id: Map UUID
            user_id: User UUID

        Returns:
            True if user can edit, False otherwise
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return False

        # Owner always has edit access
        if map_obj.created_by == user_id:
            return True

        # Check edit_permission field
        edit_perm = getattr(map_obj, 'edit_permission', 'private')

        if edit_perm == "public":
            # Anyone who can view can edit
            return self.can_view_map(map_id, user_id)

        if edit_perm in ["private", "collaborators"]:
            # Check if user is an editor collaborator
            collaborator = (
                self.db.query(MapCollaborator)
                .filter(
                    MapCollaborator.map_id == map_id,
                    MapCollaborator.user_id == user_id,
                )
                .first()
            )

            # For 'private', only owner can edit (already checked above)
            # For 'collaborators', editor collaborators can edit
            if edit_perm == "collaborators" and collaborator and collaborator.role == "editor":
                return True

        return False

    def get_user_role_in_map(
        self, map_id: UUID, user_id: Optional[UUID]
    ) -> Optional[str]:
        """
        Get user's role in map.

        Role determination logic:
        - "owner" if user created the map
        - "editor" if user is an editor collaborator
        - "viewer" if user is a viewer collaborator OR map has public view permission
        - None if user has no access

        Args:
            map_id: Map UUID
            user_id: User UUID, or None for unauthenticated users

        Returns:
            "owner" if user created the map
            "editor" if user is an editor collaborator
            "viewer" if user is a viewer collaborator or map is public
            None if user has no access
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return None

        # Unauthenticated users can only be viewers if map is public
        if user_id is None:
            if map_obj.view_permission == "public":
                return "viewer"
            return None

        # Check if owner
        if map_obj.created_by == user_id:
            return "owner"

        # Check if collaborator
        collaborator = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.user_id == user_id,
            )
            .first()
        )

        if collaborator:
            return collaborator.role

        # If map is public, user is a viewer (even if not a collaborator)
        if map_obj.view_permission == "public":
            return "viewer"

        return None

    # ========================================================================
    # Collaborator Management
    # ========================================================================

    def list_collaborators(
        self, map_id: UUID, user_id: Optional[UUID]
    ) -> Optional[List[MapCollaborator]]:
        """
        List map collaborators.

        Requires view access to the map.

        Args:
            map_id: Map UUID
            user_id: User UUID requesting the list (must have view access), or None for unauthenticated users

        Returns:
            List of MapCollaborator instances, or None if unauthorized
        """
        # Check if user can view this map
        if not self.can_view_map(map_id, user_id):
            return None

        collaborators = (
            self.db.query(MapCollaborator)
            .filter(MapCollaborator.map_id == map_id)
            .all()
        )

        return collaborators

    def add_collaborator(
        self,
        map_id: UUID,
        user_id_to_add: UUID,
        role: str,
        requester_id: UUID,
    ) -> Optional[MapCollaborator]:
        """
        Add collaborator to map.

        Requires owner or editor access. Only owner can add editors.

        Args:
            map_id: Map UUID
            user_id_to_add: User UUID to add as collaborator
            role: "viewer" or "editor"
            requester_id: User UUID making the request

        Returns:
            Created MapCollaborator or None if unauthorized/map not found
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return None

        requester_role = self.get_user_role_in_map(map_id, requester_id)

        # Only owner and editors can add collaborators
        if requester_role not in ["owner", "editor"]:
            return None

        # Only owner can add editors
        if role == "editor" and requester_role != "owner":
            return None

        # Can't add the owner as a collaborator
        if user_id_to_add == map_obj.created_by:
            return None

        # Check if user is already a collaborator
        existing = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.user_id == user_id_to_add,
            )
            .first()
        )

        if existing:
            # User is already a collaborator, don't create duplicate
            return None

        # Create collaborator
        collaborator = MapCollaborator(
            map_id=map_id,
            user_id=user_id_to_add,
            role=role,
        )

        try:
            self.db.add(collaborator)
            self.db.commit()
            self.db.refresh(collaborator)
            return collaborator
        except IntegrityError:
            # Race condition or foreign key violation
            self.db.rollback()
            return None

    def update_collaborator(
        self,
        map_id: UUID,
        user_id_to_update: UUID,
        role: str,
        requester_id: UUID,
    ) -> Optional[MapCollaborator]:
        """
        Update collaborator's role.

        Only the owner can update collaborator roles.

        Args:
            map_id: Map UUID
            user_id_to_update: User UUID whose role to update
            role: New role ("viewer" or "editor")
            requester_id: User UUID making the request (must be owner)

        Returns:
            Updated MapCollaborator or None if unauthorized/not found
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return None

        # Only owner can update collaborator roles
        if map_obj.created_by != requester_id:
            return None

        # Find the collaborator
        collaborator = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.user_id == user_id_to_update,
            )
            .first()
        )

        if not collaborator:
            return None

        # Update role
        collaborator.role = role
        self.db.commit()
        self.db.refresh(collaborator)

        return collaborator

    def remove_collaborator(
        self,
        map_id: UUID,
        user_id_to_remove: UUID,
        requester_id: UUID,
    ) -> bool:
        """
        Remove collaborator from map.

        Only the owner can remove collaborators.
        Cannot remove the owner (who isn't a collaborator anyway).

        Args:
            map_id: Map UUID
            user_id_to_remove: User UUID to remove
            requester_id: User UUID making the request (must be owner)

        Returns:
            True if removed, False if not found/unauthorized
        """
        map_obj = self.db.query(Map).filter(Map.id == map_id).first()

        if not map_obj:
            return False

        # Only owner can remove collaborators
        if map_obj.created_by != requester_id:
            return False

        # Can't remove the owner (shouldn't exist as collaborator anyway)
        if user_id_to_remove == map_obj.created_by:
            return False

        # Find and delete the collaborator
        collaborator = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.user_id == user_id_to_remove,
            )
            .first()
        )

        if not collaborator:
            return False

        self.db.delete(collaborator)
        self.db.commit()

        return True

    # ========================================================================
    # Layer Management
    # ========================================================================

    def add_layer_to_map(
        self,
        map_id: UUID,
        layer_id: UUID,
        user_id: UUID,
        display_order: int = 0,
        is_visible: bool = True,
        opacity: int = 100,
    ) -> Optional[MapLayer]:
        """
        Add layer to map.

        Requires edit access to the map.
        Layer must exist in the database.

        Args:
            map_id: Map UUID
            layer_id: Layer UUID to add
            user_id: User UUID making the request
            display_order: Order position (default 0)
            is_visible: Initial visibility (default True)
            opacity: Initial opacity 0-100 (default 100)

        Returns:
            Created MapLayer or None if unauthorized/not found
        """
        # Check edit permission
        if not self.can_edit_map(map_id, user_id):
            return None

        # Verify layer exists
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()
        if not layer:
            return None

        # Check if layer already exists in map
        existing = (
            self.db.query(MapLayer)
            .filter(
                MapLayer.map_id == map_id,
                MapLayer.layer_id == layer_id,
            )
            .first()
        )

        if existing:
            # Layer already in map, don't create duplicate
            return None

        # Create map-layer association
        map_layer = MapLayer(
            map_id=map_id,
            layer_id=layer_id,
            order=display_order,
            visible=is_visible,
            opacity=opacity,
        )

        try:
            self.db.add(map_layer)
            self.db.commit()
            self.db.refresh(map_layer)
            return map_layer
        except IntegrityError:
            # Foreign key violation or race condition
            self.db.rollback()
            return None

    def remove_layer_from_map(
        self, map_id: UUID, layer_id: UUID, user_id: UUID
    ) -> bool:
        """
        Remove layer from map.

        Requires edit access to the map.
        This only removes the association, not the layer itself.

        Args:
            map_id: Map UUID
            layer_id: Layer UUID to remove
            user_id: User UUID making the request

        Returns:
            True if removed, False if not found/unauthorized
        """
        # Check edit permission
        if not self.can_edit_map(map_id, user_id):
            return False

        # Find and delete the map-layer association
        map_layer = (
            self.db.query(MapLayer)
            .filter(
                MapLayer.map_id == map_id,
                MapLayer.layer_id == layer_id,
            )
            .first()
        )

        if not map_layer:
            return False

        self.db.delete(map_layer)
        self.db.commit()

        return True

    def update_map_layer(
        self,
        map_id: UUID,
        layer_id: UUID,
        updates: dict,
        user_id: UUID,
    ) -> Optional[MapLayer]:
        """
        Update layer properties in map (visibility, opacity, order).

        Requires edit access to the map.

        Args:
            map_id: Map UUID
            layer_id: Layer UUID
            updates: Dict with optional keys: visible, opacity, order
            user_id: User UUID making the request

        Returns:
            Updated MapLayer or None if not found/unauthorized
        """
        # Check edit permission
        if not self.can_edit_map(map_id, user_id):
            return None

        # Find the map-layer association
        map_layer = (
            self.db.query(MapLayer)
            .filter(
                MapLayer.map_id == map_id,
                MapLayer.layer_id == layer_id,
            )
            .first()
        )

        if not map_layer:
            return None

        # Update allowed fields
        allowed_fields = {"visible", "opacity", "order"}
        for field, value in updates.items():
            if field in allowed_fields and value is not None:
                setattr(map_layer, field, value)

        self.db.commit()
        self.db.refresh(map_layer)

        return map_layer

    def reorder_layers(
        self,
        map_id: UUID,
        layer_orders: List[dict],
        user_id: UUID,
    ) -> bool:
        """
        Reorder all layers in map.

        Requires edit access to the map.

        Args:
            map_id: Map UUID
            layer_orders: List of dicts with {layer_id: UUID, order: int}
            user_id: User UUID making the request

        Returns:
            True if successful, False if unauthorized/error
        """
        # Check edit permission
        if not self.can_edit_map(map_id, user_id):
            return False

        try:
            # Update each layer's order
            for item in layer_orders:
                layer_id = item.get("layer_id")
                order = item.get("order")

                if layer_id is None or order is None:
                    continue

                # Convert string UUID to UUID object if needed
                if isinstance(layer_id, str):
                    layer_id = UUID(layer_id)

                map_layer = (
                    self.db.query(MapLayer)
                    .filter(
                        MapLayer.map_id == map_id,
                        MapLayer.layer_id == layer_id,
                    )
                    .first()
                )

                if map_layer:
                    map_layer.order = order

            self.db.commit()
            return True

        except Exception:
            self.db.rollback()
            return False
