"""
URL Whitelist Service for TiTiler Proxy Security.

Validates that requested GeoTIFF URLs exist in the database to prevent
proxy abuse and SSRF attacks. Uses LRU cache with TTL for performance.
"""

import logging
import re
import time
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.layer import Layer

logger = logging.getLogger(__name__)


class URLWhitelistCache:
    """LRU cache with TTL for URL whitelist lookups."""

    def __init__(self, max_size: int = 1000, ttl_seconds: int = 300):
        """
        Initialize the cache.

        Args:
            max_size: Maximum number of URLs to cache
            ttl_seconds: Time-to-live in seconds (default: 5 minutes)
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: dict[
            str, tuple[bool, float]
        ] = {}  # url -> (is_whitelisted, timestamp)
        self._access_order: list[str] = []  # For LRU eviction

    def get(self, url: str) -> Optional[bool]:
        """
        Get cached whitelist status for a URL.

        Args:
            url: Normalized URL to check

        Returns:
            True if whitelisted, False if not, None if not in cache or expired
        """
        if url not in self._cache:
            return None

        is_whitelisted, timestamp = self._cache[url]

        # Check if expired
        if time.time() - timestamp > self.ttl_seconds:
            del self._cache[url]
            self._access_order.remove(url)
            return None

        # Update access order (LRU)
        if url in self._access_order:
            self._access_order.remove(url)
        self._access_order.append(url)

        return is_whitelisted

    def set(self, url: str, is_whitelisted: bool):
        """
        Cache whitelist status for a URL.

        Args:
            url: Normalized URL
            is_whitelisted: Whether the URL is whitelisted
        """
        # Evict oldest entry if cache is full
        if len(self._cache) >= self.max_size and url not in self._cache:
            oldest_url = self._access_order.pop(0)
            del self._cache[oldest_url]

        # Add/update entry
        self._cache[url] = (is_whitelisted, time.time())

        # Update access order
        if url in self._access_order:
            self._access_order.remove(url)
        self._access_order.append(url)

    def clear(self):
        """Clear all cached entries."""
        self._cache.clear()
        self._access_order.clear()


def normalize_url(url: str) -> str:
    """
    Normalize URL for consistent comparison.

    Steps:
    1. Strip whitespace
    2. Parse URL components
    3. Lowercase scheme and domain (preserve path case)
    4. Remove trailing slash (except root domain)
    5. Sort query parameters alphabetically
    6. Remove fragment (#)

    Args:
        url: URL to normalize

    Returns:
        Normalized URL string
    """
    url = url.strip()

    # Parse URL
    parsed = urlparse(url)

    # Normalize scheme and netloc (lowercase)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Keep path case-sensitive (important for S3/cloud storage)
    path = parsed.path

    # Remove trailing slash (except for root)
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")

    # Sort query parameters
    query_params = parse_qs(parsed.query, keep_blank_values=True)
    sorted_query = urlencode(sorted(query_params.items()), doseq=True)

    # Ignore fragment
    fragment = ""

    # Reconstruct URL
    normalized = urlunparse(
        (scheme, netloc, path, parsed.params, sorted_query, fragment)
    )

    return normalized


def matches_template(url: str, template: str) -> bool:
    """
    Check if a URL matches a template pattern with {z}/{x}/{y} placeholders.

    Args:
        url: Actual URL to check (e.g., "https://example.com/10/500/500.tif")
        template: Template pattern (e.g., "https://example.com/{z}/{x}/{y}.tif")

    Returns:
        True if URL matches the template pattern
    """
    # Escape special regex characters in template, except for our placeholders
    template_escaped = re.escape(template)

    # Replace placeholders with digit patterns
    template_regex = template_escaped.replace(r"\{z\}", r"(\d+)")
    template_regex = template_regex.replace(r"\{x\}", r"(\d+)")
    template_regex = template_regex.replace(r"\{y\}", r"(\d+)")

    # Anchor to start and end to prevent partial matches
    template_regex = f"^{template_regex}$"

    return bool(re.match(template_regex, url))


class URLWhitelistService:
    """Service for validating URLs against database whitelist."""

    def __init__(self, db: Session, cache: Optional[URLWhitelistCache] = None):
        """
        Initialize the service.

        Args:
            db: Database session
            cache: Optional cache instance (creates new one if not provided)
        """
        self.db = db
        self.cache = cache or URLWhitelistCache()

    def is_url_whitelisted(self, url: str) -> bool:
        """
        Check if a URL is whitelisted in the database.

        Args:
            url: URL to validate

        Returns:
            True if URL exists in layers.source_config, False otherwise
        """
        # Normalize URL for consistent comparison
        normalized_url = normalize_url(url)

        # Check cache first
        cached_result = self.cache.get(normalized_url)
        if cached_result is not None:
            logger.debug(f"Cache hit for URL: {normalized_url}")
            return cached_result

        logger.debug(f"Cache miss for URL: {normalized_url}, checking database")

        # Check database for direct URL matches
        is_whitelisted = self._check_database(normalized_url)

        # Cache the result
        self.cache.set(normalized_url, is_whitelisted)

        if is_whitelisted:
            logger.info(f"URL whitelisted: {normalized_url}")
        else:
            logger.warning(f"URL rejected (not in whitelist): {normalized_url}")

        return is_whitelisted

    def _check_database(self, normalized_url: str) -> bool:
        """
        Query database for URL existence.

        Checks three patterns:
        1. source_config->>'url' (direct GeoTIFF URL)
        2. source_config->>'cog_url' (COG URL)
        3. source_config->>'cog_url_template' (template pattern match)

        Args:
            normalized_url: Normalized URL to check

        Returns:
            True if URL found in database
        """
        # Check for direct URL matches
        direct_match = (
            self.db.query(Layer)
            .filter(
                Layer.source_type == "geotiff",
                or_(
                    Layer.source_config["url"].astext == normalized_url,
                    Layer.source_config["cog_url"].astext == normalized_url,
                ),
            )
            .first()
        )

        if direct_match:
            return True

        # Check for template URL matches
        # Fetch all templates and check pattern matching in Python
        template_layers = (
            self.db.query(Layer)
            .filter(
                Layer.source_type == "geotiff",
                Layer.source_config["cog_url_template"].astext.isnot(None),
            )
            .all()
        )

        for layer in template_layers:
            template = layer.source_config.get(
                "cog_url_template"
            ) or layer.source_config.get("cogUrlTemplate")
            if template:
                normalized_template = normalize_url(template)
                if matches_template(normalized_url, normalized_template):
                    logger.debug(
                        f"URL matches template: {normalized_url} ~ "
                        f"{normalized_template}"
                    )
                    return True

        return False
