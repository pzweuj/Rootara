import time

from scripts.cache_manager import CacheManager


def test_cache_expires_entries():
    cache = CacheManager()
    cache.set("test", "key", {"value": 1}, ttl=0.02)
    assert cache.get("test", "key") == {"value": 1}
    time.sleep(0.04)
    assert cache.get("test", "key") is None


def test_cache_evicts_oldest_entry():
    cache = CacheManager()
    cache.max_entries = 2
    cache.set("test", "one", 1)
    cache.set("test", "two", 2)
    cache.set("test", "three", 3)
    assert cache.get("test", "one") is None
    assert cache.get("test", "two") == 2
    assert cache.get("test", "three") == 3


def test_cache_clear_and_stats():
    cache = CacheManager()
    cache.set("test", "key", True)
    assert cache.get_stats()["cached_items"] == 1
    assert cache.clear_all() is True
    assert cache.get_stats()["cached_items"] == 0
