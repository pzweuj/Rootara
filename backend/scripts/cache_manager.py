"""Bounded in-memory TTL cache used by the single-container deployment."""

from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from functools import wraps
from typing import Any, Optional


class CacheManager:
    def __init__(self) -> None:
        self.is_available = True
        self.default_ttl = max(0.001, float(os.environ.get("CACHE_TTL", "3600")))
        self.max_entries = max(1, int(os.environ.get("CACHE_MAX_ENTRIES", "1024")))
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.RLock()

    def _get_key(self, category: str, identifier: str) -> str:
        return f"rootara:{category}:{identifier}"

    def _purge_expired(self, now: Optional[float] = None) -> None:
        now = now or time.monotonic()
        expired = [key for key, (expires_at, _) in self._cache.items() if expires_at <= now]
        for key in expired:
            self._cache.pop(key, None)

    def get(self, category: str, identifier: str) -> Optional[Any]:
        key = self._get_key(category, identifier)
        with self._lock:
            self._purge_expired()
            item = self._cache.get(key)
            if item is None:
                return None
            self._cache.move_to_end(key)
            return item[1]

    def set(self, category: str, identifier: str, data: Any, ttl: Optional[int] = None) -> bool:
        key = self._get_key(category, identifier)
        expires_at = time.monotonic() + max(0.001, float(ttl or self.default_ttl))
        with self._lock:
            self._purge_expired()
            self._cache[key] = (expires_at, data)
            self._cache.move_to_end(key)
            while len(self._cache) > self.max_entries:
                self._cache.popitem(last=False)
        return True

    def delete(self, category: str, identifier: str) -> bool:
        key = self._get_key(category, identifier)
        with self._lock:
            return self._cache.pop(key, None) is not None

    def delete_pattern(self, pattern: str) -> int:
        with self._lock:
            keys = [key for key in self._cache if pattern in key]
            for key in keys:
                self._cache.pop(key, None)
            return len(keys)

    def clear_all(self) -> bool:
        with self._lock:
            self._cache.clear()
        return True

    def get_stats(self) -> dict:
        with self._lock:
            self._purge_expired()
            return {
                "type": "memory",
                "cached_items": len(self._cache),
                "max_entries": self.max_entries,
                "ttl_seconds": self.default_ttl,
            }


cache_manager = CacheManager()


def cache_result(category: str, ttl: Optional[int] = None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_id = f"{func.__name__}:{hash(str(args) + str(sorted(kwargs.items())))}"
            cached_result = cache_manager.get(category, cache_id)
            if cached_result is not None:
                return cached_result
            result = func(*args, **kwargs)
            if result is not None:
                cache_manager.set(category, cache_id, result, ttl)
            return result

        return wrapper

    return decorator


class CacheCategories:
    ADMIXTURE = "admixture"
    HAPLOGROUP = "haplogroup"
    TRAITS = "traits"
    CLINVAR = "clinvar"
    REPORTS = "reports"
    USERS = "users"
    SNP_INFO = "snp_info"
