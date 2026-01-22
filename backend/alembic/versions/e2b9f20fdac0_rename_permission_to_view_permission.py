"""rename_permission_to_view_permission

Revision ID: e2b9f20fdac0
Revises: 987ad2269c79
Create Date: 2025-12-03 14:19:19.817186

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e2b9f20fdac0"
down_revision: Union[str, Sequence[str], None] = "987ad2269c79"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename permission column to view_permission
    op.alter_column("maps", "permission", new_column_name="view_permission")


def downgrade() -> None:
    """Downgrade schema."""
    # Rename back to permission
    op.alter_column("maps", "view_permission", new_column_name="permission")
