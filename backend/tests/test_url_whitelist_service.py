"""
Unit tests for URL whitelist service.

Tests URL normalization, whitelist validation, caching, and template matching.
"""

import time

import pytest

from app.models.layer import Layer
from app.models.user import User
from app.services.url_whitelist_service import (
    URLWhitelistCache,
    URLWhitelistService,
    matches_template,
    normalize_url,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        clerk_id="user_test_whitelist",
        email="whitelist@example.com",
        username="whitelist",
        first_name="Test",
        last_name="User",
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


@pytest.fixture
def geotiff_layer_with_url(db_session, test_user):
    """Create a GeoTIFF layer with direct URL."""
    layer = Layer(
        name="Direct URL Layer",
        source_type="geotiff",
        description="Layer with direct URL",
        created_by=test_user.id,
        source_config={"url": "https://example.com/data.tif"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def geotiff_layer_with_cog_url(db_session, test_user):
    """Create a GeoTIFF layer with cog_url."""
    layer = Layer(
        name="COG URL Layer",
        source_type="geotiff",
        description="Layer with COG URL",
        created_by=test_user.id,
        source_config={"cog_url": "https://storage.googleapis.com/bucket/file.tif"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def geotiff_layer_with_template(db_session, test_user):
    """Create a GeoTIFF layer with template URL."""
    layer = Layer(
        name="Template URL Layer",
        source_type="geotiff",
        description="Layer with template URL",
        created_by=test_user.id,
        source_config={"cog_url_template": "https://tiles.example.com/{z}/{x}/{y}.tif"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def whitelist_service(db_session):
    """Create URL whitelist service instance."""
    return URLWhitelistService(db_session)


# ============================================================================
# URL Normalization Tests
# ============================================================================


def test_normalize_url_basic():
    """Test basic URL normalization."""
    url = "https://example.com/path/to/file.tif"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/path/to/file.tif"


def test_normalize_url_trailing_slash():
    """Test removal of trailing slash."""
    url = "https://example.com/path/"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/path"


def test_normalize_url_trailing_slash_root():
    """Test that root trailing slash is preserved."""
    url = "https://example.com/"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/"


def test_normalize_url_case_insensitive_domain():
    """Test domain is lowercased."""
    url = "https://EXAMPLE.COM/Path/File.tif"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/Path/File.tif"


def test_normalize_url_path_case_preserved():
    """Test path case is preserved (important for S3)."""
    url = "https://example.com/BucketName/FileName.TIF"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/BucketName/FileName.TIF"


def test_normalize_url_query_params_sorted():
    """Test query parameters are sorted alphabetically."""
    url = "https://example.com/file.tif?z=10&a=1&m=5"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/file.tif?a=1&m=5&z=10"


def test_normalize_url_fragment_removed():
    """Test fragment is removed."""
    url = "https://example.com/file.tif#fragment"
    normalized = normalize_url(url)
    assert normalized == "https://example.com/file.tif"


def test_normalize_url_whitespace_stripped():
    """Test whitespace is stripped."""
    url = "  https://example.com/file.tif  "
    normalized = normalize_url(url)
    assert normalized == "https://example.com/file.tif"


# ============================================================================
# Template Matching Tests
# ============================================================================


def test_matches_template_basic():
    """Test basic template matching."""
    template = "https://example.com/{z}/{x}/{y}.tif"
    url = "https://example.com/10/500/500.tif"
    assert matches_template(url, template) is True


def test_matches_template_no_match():
    """Test template non-match."""
    template = "https://example.com/{z}/{x}/{y}.tif"
    url = "https://different.com/10/500/500.tif"
    assert matches_template(url, template) is False


def test_matches_template_non_digits():
    """Test template rejects non-digits in tile coordinates."""
    template = "https://example.com/{z}/{x}/{y}.tif"
    url = "https://example.com/10/abc/500.tif"
    assert matches_template(url, template) is False


def test_matches_template_partial_match():
    """Test template requires full match (not partial)."""
    template = "https://example.com/{z}/{x}/{y}.tif"
    url = "https://example.com/10/500/500.tif/extra"
    assert matches_template(url, template) is False


def test_matches_template_with_subdomain():
    """Test template with subdomain."""
    template = "https://tiles.example.com/data/{z}/{x}/{y}.tif"
    url = "https://tiles.example.com/data/12/2048/1024.tif"
    assert matches_template(url, template) is True


def test_matches_template_special_chars_in_path():
    """Test template with special characters in path."""
    template = "https://example.com/data-v2/{z}/{x}/{y}.tif"
    url = "https://example.com/data-v2/5/16/8.tif"
    assert matches_template(url, template) is True


# ============================================================================
# Cache Tests
# ============================================================================


def test_cache_get_miss():
    """Test cache miss returns None."""
    cache = URLWhitelistCache()
    result = cache.get("https://example.com/file.tif")
    assert result is None


def test_cache_set_and_get():
    """Test cache set and get."""
    cache = URLWhitelistCache()
    url = "https://example.com/file.tif"

    cache.set(url, True)
    result = cache.get(url)
    assert result is True


def test_cache_ttl_expiration():
    """Test cache entries expire after TTL."""
    cache = URLWhitelistCache(ttl_seconds=1)
    url = "https://example.com/file.tif"

    cache.set(url, True)
    assert cache.get(url) is True

    # Wait for TTL to expire
    time.sleep(1.1)
    assert cache.get(url) is None


def test_cache_lru_eviction():
    """Test LRU eviction when cache is full."""
    cache = URLWhitelistCache(max_size=3)

    # Fill cache
    cache.set("url1", True)
    cache.set("url2", True)
    cache.set("url3", True)

    # Access url1 to make it recently used
    cache.get("url1")

    # Add url4 - should evict url2 (least recently used)
    cache.set("url4", True)

    assert cache.get("url1") is True
    assert cache.get("url2") is None  # Evicted
    assert cache.get("url3") is True
    assert cache.get("url4") is True


def test_cache_clear():
    """Test cache clear."""
    cache = URLWhitelistCache()
    cache.set("url1", True)
    cache.set("url2", False)

    cache.clear()

    assert cache.get("url1") is None
    assert cache.get("url2") is None


# ============================================================================
# Whitelist Service Tests
# ============================================================================


def test_whitelist_service_url_in_database(
    db_session, whitelist_service, geotiff_layer_with_url
):
    """Test URL in database is whitelisted."""
    url = "https://example.com/data.tif"
    assert whitelist_service.is_url_whitelisted(url) is True


def test_whitelist_service_cog_url_in_database(
    db_session, whitelist_service, geotiff_layer_with_cog_url
):
    """Test cog_url in database is whitelisted."""
    url = "https://storage.googleapis.com/bucket/file.tif"
    assert whitelist_service.is_url_whitelisted(url) is True


def test_whitelist_service_url_not_in_database(db_session, whitelist_service):
    """Test URL not in database is rejected."""
    url = "https://evil.com/malicious.tif"
    assert whitelist_service.is_url_whitelisted(url) is False


def test_whitelist_service_template_url_match(
    db_session, whitelist_service, geotiff_layer_with_template
):
    """Test template URL matching works."""
    url = "https://tiles.example.com/10/512/256.tif"
    assert whitelist_service.is_url_whitelisted(url) is True


def test_whitelist_service_template_url_no_match(
    db_session, whitelist_service, geotiff_layer_with_template
):
    """Test template URL non-match is rejected."""
    url = "https://different.example.com/10/512/256.tif"
    assert whitelist_service.is_url_whitelisted(url) is False


def test_whitelist_service_normalization(
    db_session, whitelist_service, geotiff_layer_with_url
):
    """Test URL normalization during validation."""
    # URL in DB: https://example.com/data.tif
    # Try with trailing slash - should normalize and match
    url = "https://example.com/data.tif/"
    assert whitelist_service.is_url_whitelisted(url) is True


def test_whitelist_service_case_insensitive_domain(
    db_session, whitelist_service, geotiff_layer_with_url
):
    """Test domain case insensitivity."""
    # URL in DB: https://example.com/data.tif
    # Try with uppercase domain - should normalize and match
    url = "https://EXAMPLE.COM/data.tif"
    assert whitelist_service.is_url_whitelisted(url) is True


def test_whitelist_service_caching(
    db_session, whitelist_service, geotiff_layer_with_url
):
    """Test caching reduces database queries."""
    url = "https://example.com/data.tif"

    # First call - cache miss
    result1 = whitelist_service.is_url_whitelisted(url)
    assert result1 is True

    # Second call - should hit cache
    result2 = whitelist_service.is_url_whitelisted(url)
    assert result2 is True

    # Cache should have the entry
    assert whitelist_service.cache.get(normalize_url(url)) is True


def test_whitelist_service_non_geotiff_layer_ignored(
    db_session, whitelist_service, test_user
):
    """Test non-geotiff layers are ignored."""
    # Create WMS layer with URL
    wms_layer = Layer(
        name="WMS Layer",
        source_type="wms",
        description="WMS layer",
        created_by=test_user.id,
        source_config={"url": "https://wms.example.com/service"},
    )
    db_session.add(wms_layer)
    db_session.flush()

    # WMS URL should not be whitelisted for TiTiler
    url = "https://wms.example.com/service"
    assert whitelist_service.is_url_whitelisted(url) is False


def test_whitelist_service_multiple_layers_same_url(
    db_session, whitelist_service, test_user
):
    """Test same URL in multiple layers is still whitelisted."""
    url = "https://shared.example.com/shared.tif"

    # Create two layers with same URL
    layer1 = Layer(
        name="Layer 1",
        source_type="geotiff",
        created_by=test_user.id,
        source_config={"url": url},
    )
    layer2 = Layer(
        name="Layer 2",
        source_type="geotiff",
        created_by=test_user.id,
        source_config={"cog_url": url},
    )
    db_session.add_all([layer1, layer2])
    db_session.flush()

    assert whitelist_service.is_url_whitelisted(url) is True
