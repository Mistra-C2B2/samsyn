"""add_edit_permission_to_maps

Revision ID: 987ad2269c79
Revises: cd1ef24f341f
Create Date: 2025-12-03 12:34:00.874788

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "987ad2269c79"
down_revision: Union[str, Sequence[str], None] = "cd1ef24f341f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add edit_permission column with default value 'private'
    op.add_column(
        "maps",
        sa.Column(
            "edit_permission", sa.String(), nullable=False, server_default="private"
        ),
    )

    # Set edit_permission to match permission for backward compatibility
    op.execute("UPDATE maps SET edit_permission = permission")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("maps", "edit_permission")
