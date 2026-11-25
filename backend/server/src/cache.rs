use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};

struct CacheEntry {
    expires_at: Instant,
    value: Value,
}

struct Inner {
    entries: HashMap<String, CacheEntry>,
    order: VecDeque<String>,
}

pub struct CacheManager {
    default_ttl: Duration,
    max_entries: usize,
    inner: Mutex<Inner>,
}

impl CacheManager {
    pub fn new(default_ttl_secs: f64, max_entries: usize) -> Self {
        Self {
            default_ttl: Duration::from_secs_f64(default_ttl_secs.max(0.001)),
            max_entries: max_entries.max(1),
            inner: Mutex::new(Inner {
                entries: HashMap::new(),
                order: VecDeque::new(),
            }),
        }
    }

    fn key(category: &str, id: &str) -> String {
        format!("rootara:{category}:{id}")
    }

    fn purge_expired(inner: &mut Inner, now: Instant) {
        let expired: Vec<String> = inner
            .entries
            .iter()
            .filter_map(|(k, v)| (v.expires_at <= now).then(|| k.clone()))
            .collect();
        for k in expired {
            inner.entries.remove(&k);
            inner.order.retain(|item| item != &k);
        }
    }

    pub fn get(&self, category: &str, id: &str) -> Option<Value> {
        let key = Self::key(category, id);
        let mut inner = self.inner.lock().unwrap();
        let now = Instant::now();
        Self::purge_expired(&mut inner, now);
        let value = inner.entries.get(&key)?.value.clone();
        inner.order.retain(|item| item != &key);
        inner.order.push_back(key);
        Some(value)
    }

    pub fn set(&self, category: &str, id: &str, value: Value, ttl_secs: Option<f64>) {
        let key = Self::key(category, id);
        let ttl = ttl_secs
            .map(|s| Duration::from_secs_f64(s.max(0.001)))
            .unwrap_or(self.default_ttl);
        let mut inner = self.inner.lock().unwrap();
        let now = Instant::now();
        Self::purge_expired(&mut inner, now);
        inner.entries.insert(
            key.clone(),
            CacheEntry {
                expires_at: now + ttl,
                value,
            },
        );
        inner.order.retain(|item| item != &key);
        inner.order.push_back(key);
        while inner.entries.len() > self.max_entries {
            if let Some(oldest) = inner.order.pop_front() {
                inner.entries.remove(&oldest);
            } else {
                break;
            }
        }
    }

    pub fn delete(&self, category: &str, id: &str) -> bool {
        let key = Self::key(category, id);
        let mut inner = self.inner.lock().unwrap();
        inner.order.retain(|item| item != &key);
        inner.entries.remove(&key).is_some()
    }

    pub fn clear_all(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.entries.clear();
        inner.order.clear();
    }

    pub fn get_stats(&self) -> Value {
        let mut inner = self.inner.lock().unwrap();
        Self::purge_expired(&mut inner, Instant::now());
        json!({
            "type": "memory",
            "cached_items": inner.entries.len(),
            "max_entries": self.max_entries,
            "ttl_seconds": self.default_ttl.as_secs_f64(),
        })
    }
}
