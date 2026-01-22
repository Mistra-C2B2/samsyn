import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Import app configuration and models
from app.config import settings
from app.database import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Override sqlalchemy.url with our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """
    Should you include this table or not?
    Return False to exclude PostGIS/TIGER tables from autogeneration.
    """
    # Exclude PostGIS system tables
    if type_ == "table":
        # PostGIS extension tables
        if name in ("spatial_ref_sys", "topology", "layer"):
            return False
        # TIGER geocoder tables (comprehensive list)
        tiger_tables = {
            "featnames",
            "geocode_settings",
            "geocode_settings_default",
            "direction_lookup",
            "secondary_unit_lookup",
            "state_lookup",
            "street_type_lookup",
            "place_lookup",
            "county_lookup",
            "countysub_lookup",
            "zip_lookup_all",
            "zip_lookup_base",
            "zip_lookup",
            "county",
            "state",
            "place",
            "zip_state",
            "zip_state_loc",
            "cousub",
            "edges",
            "addrfeat",
            "addr",
            "zcta5",
            "tabblock20",
            "tabblock",
            "faces",
            "loader_platform",
            "loader_variables",
            "loader_lookuptables",
            "tract",
            "bg",
            "pagc_gaz",
            "pagc_lex",
            "pagc_rules",
        }
        if name in tiger_tables:
            return False
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
