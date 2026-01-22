"""add_indexes_to_comments_table

Revision ID: cd1ef24f341f
Revises: 20b62272cdaf
Create Date: 2025-12-02 13:10:09.121598

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cd1ef24f341f"
down_revision: Union[str, Sequence[str], None] = "20b62272cdaf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create indexes for comments table to improve query performance
    op.create_index("idx_comments_map_id", "comments", ["map_id"])
    op.create_index("idx_comments_layer_id", "comments", ["layer_id"])
    op.create_index("idx_comments_parent_id", "comments", ["parent_id"])
    op.create_index("idx_comments_author_id", "comments", ["author_id"])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes for comments table
    op.drop_index("idx_comments_author_id", table_name="comments")
    op.drop_index("idx_comments_parent_id", table_name="comments")
    op.drop_index("idx_comments_layer_id", table_name="comments")
    op.drop_index("idx_comments_map_id", table_name="comments")
