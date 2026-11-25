use crate::cache::CacheManager;
use crate::config::RuntimeConfig;
use crate::db::DbPool;
use crate::health::HealthMonitor;
use crate::import_jobs::ImportQueue;
use anyhow::Result;
use serde_json::Value;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use tokio::sync::Semaphore;

pub struct BoundedLru {
    max_entries: usize,
    map: HashMap<String, Value>,
    order: VecDeque<String>,
}

impl BoundedLru {
    pub fn new(max_entries: usize) -> Self {
        Self {
            max_entries: max_entries.max(1),
            map: HashMap::new(),
            order: VecDeque::new(),
        }
    }

    pub fn get(&mut self, key: &str) -> Option<Value> {
        let val = self.map.get(key)?.clone();
        self.order.retain(|k| k != key);
        self.order.push_back(key.to_string());
        Some(val)
    }

    pub fn put(&mut self, key: String, val: Value) {
        self.map.insert(key.clone(), val);
        self.order.retain(|k| k != &key);
        self.order.push_back(key);
        while self.map.len() > self.max_entries {
            if let Some(oldest) = self.order.pop_front() {
                self.map.remove(&oldest);
            } else {
                break;
            }
        }
    }

    pub fn clear(&mut self) {
        self.map.clear();
        self.order.clear();
    }
}

pub struct AppState {
    pub cfg: Arc<RuntimeConfig>,
    pub db_pool: Arc<DbPool>,
    pub cache: Arc<CacheManager>,
    pub import_queue: Arc<ImportQueue>,
    pub health: Arc<HealthMonitor>,
    pub download_slot: Arc<Semaphore>,
    pub dashboard_cache: Mutex<BoundedLru>,
    pub results_cache: Mutex<BoundedLru>,
    pub catalog_cache: Mutex<BoundedLru>,
}

impl AppState {
    pub fn new(cfg: RuntimeConfig) -> Result<Arc<Self>> {
        let cfg = Arc::new(cfg);
        let max_conns = std::env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);
        let db_pool = Arc::new(DbPool::new(cfg.db_path.clone(), max_conns));
        let cache = Arc::new(CacheManager::new(cfg.cache_ttl_secs, cfg.cache_max_entries));
        let import_queue = ImportQueue::start(cfg.clone())?;
        let health = Arc::new(HealthMonitor::new());
        Ok(Arc::new(Self {
            cfg,
            db_pool,
            cache,
            import_queue,
            health,
            download_slot: Arc::new(Semaphore::new(1)),
            dashboard_cache: Mutex::new(BoundedLru::new(32)),
            results_cache: Mutex::new(BoundedLru::new(64)),
            catalog_cache: Mutex::new(BoundedLru::new(16)),
        }))
    }

    pub fn clear_all_caches(&self) {
        self.cache.clear_all();
        self.dashboard_cache.lock().unwrap().clear();
        self.results_cache.lock().unwrap().clear();
        self.catalog_cache.lock().unwrap().clear();
    }
}
