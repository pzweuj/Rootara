use anyhow::{anyhow, Context, Result};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

pub const DEFAULT_MAX_BODY: usize = 50 * 1024 * 1024;
pub const SESSION_SECONDS: i64 = 8 * 3600;

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub version: String,
    pub backend_root: PathBuf,
    pub web_root: PathBuf,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub database_dir: PathBuf,
    pub core_database_path: PathBuf,
    pub template_path: PathBuf,
    pub default_traits_path: PathBuf,
    pub trait_evidence_path: PathBuf,
    pub trait_locus_path: PathBuf,
    pub normalized_trait_catalog_path: PathBuf,
    pub trait_catalog_state_path: PathBuf,
    pub reader_path: String,
    pub archive_tool: String,
    pub admix_tool: String,
    pub haplogrouper_tool: String,
    pub admix_data: PathBuf,
    pub haplogrouper_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub rawdata_dir: PathBuf,
    pub imports_dir: PathBuf,
    pub jwt_secret_path: PathBuf,
    pub admin_email: String,
    pub admin_password: String,
    pub jwt_secret: String,
    pub api_key: String,
    pub public_host: String,
    pub public_port: u16,
    pub backend_host: String,
    pub backend_port: u16,
    pub disable_public: bool,
    pub expected_trait_count: Option<usize>,
    pub require_curated_catalog: bool,
    pub cache_ttl_secs: f64,
    pub cache_max_entries: usize,
    pub max_body: usize,
    pub log_file: Option<PathBuf>,
}

impl RuntimeConfig {
    pub fn from_env() -> Result<Self> {
        let admin_password = env::var("ADMIN_PASSWORD").unwrap_or_default();
        let admin_email = env::var("ADMIN_EMAIL")
            .ok()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "admin@rootara.app".to_string());

        let backend_root = env::var("ROOTARA_BACKEND_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/opt/rootara/backend"));
        let web_root = env::var("ROOTARA_WEB_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/opt/rootara/web"));
        let data_dir = env::var("ROOTARA_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/data"));
        let db_path = env::var("DB_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| data_dir.join("rootara.db"));
        let database_dir = backend_root.join("database");

        let default_traits_path = env::var("ROOTARA_TRAIT_CATALOG_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| database_dir.join("default-traits.json"));
        let trait_evidence_path = env::var("ROOTARA_TRAIT_EVIDENCE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| database_dir.join("trait-evidence.json"));
        let trait_locus_path = env::var("ROOTARA_TRAIT_LOCUS_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| database_dir.join("trait-locus-registry.json"));
        let normalized_trait_catalog_path = env::var("ROOTARA_NORMALIZED_TRAIT_CATALOG_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| database_dir.join("trait-catalog.json"));
        let trait_catalog_state_path = env::var("ROOTARA_TRAIT_CATALOG_STATE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| data_dir.join("config").join("trait-catalog.json"));

        let jwt_secret_path = data_dir.join("config").join("jwt-secret");
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_default();
        let api_key = env::var("ROOTARA_API_KEY")
            .ok()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(generate_urlsafe_token);

        let public_host = env::var("HOSTNAME")
            .ok()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "0.0.0.0".to_string());
        let public_port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3000);
        let backend_host = env::var("ROOTARA_BACKEND_HOST")
            .ok()
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let backend_port = env::var("ROOTARA_BACKEND_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(8000);
        let disable_public = env::var("ROOTARA_DISABLE_PUBLIC")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        let expected_trait_count = env::var("ROOTARA_EXPECTED_TRAIT_COUNT")
            .ok()
            .filter(|v| !v.is_empty())
            .map(|v| v.parse::<usize>())
            .transpose()
            .context("invalid ROOTARA_EXPECTED_TRAIT_COUNT")?;
        let require_curated_catalog = env::var("ROOTARA_REQUIRE_CURATED_CATALOG")
            .map(|v| v == "1")
            .unwrap_or(false);

        let cache_ttl_secs = env::var("CACHE_TTL")
            .ok()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(3600.0)
            .max(0.001);
        let cache_max_entries = env::var("CACHE_MAX_ENTRIES")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(1024)
            .max(1);
        let max_body = env::var("ROOTARA_MAX_BODY")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(DEFAULT_MAX_BODY);

        let log_file = env::var("LOG_FILE")
            .ok()
            .filter(|v| !v.is_empty())
            .map(PathBuf::from);

        Ok(Self {
            version: env::var("ROOTARA_VERSION")
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "2.0.0".to_string()),
            core_database_path: database_dir.join("Rootara.core.sqlite"),
            template_path: database_dir.join("TEMPLATE01.txt"),
            admix_data: database_dir.join("admix"),
            haplogrouper_dir: backend_root.join("haploGrouper"),
            temp_dir: data_dir.join("temp"),
            rawdata_dir: data_dir.join("rawdata"),
            imports_dir: data_dir.join("imports"),
            backend_root,
            web_root,
            data_dir,
            db_path,
            database_dir,
            default_traits_path,
            trait_evidence_path,
            trait_locus_path,
            normalized_trait_catalog_path,
            trait_catalog_state_path,
            reader_path: env::var("ROOTARA_READER")
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "rootara-reader".to_string()),
            archive_tool: env::var("ROOTARA_ARCHIVE_TOOL")
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "rootara-archive".to_string()),
            admix_tool: env::var("ROOTARA_ADMIX_TOOL")
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "admixrs".to_string()),
            haplogrouper_tool: env::var("ROOTARA_HAPLOGROUPER_TOOL")
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "haplogrouper-rs".to_string()),
            jwt_secret_path,
            admin_email,
            admin_password,
            jwt_secret,
            api_key,
            public_host,
            public_port,
            backend_host,
            backend_port,
            disable_public,
            expected_trait_count,
            require_curated_catalog,
            cache_ttl_secs,
            cache_max_entries,
            max_body,
            log_file,
        })
    }

    pub fn require_admin_password(&self) -> Result<()> {
        if self.admin_password.is_empty() {
            return Err(anyhow!(
                "ADMIN_PASSWORD is required for the first Rootara startup"
            ));
        }
        Ok(())
    }

    pub fn ensure_data_directories(&self) -> Result<()> {
        let config_dir = self.data_dir.join("config");
        for dir in [
            &self.data_dir,
            &config_dir,
            &self.rawdata_dir,
            &self.temp_dir,
            &self.imports_dir,
        ] {
            fs::create_dir_all(dir)
                .with_context(|| format!("failed to create directory {}", dir.display()))?;
        }
        if let Some(parent) = self.db_path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)?;
            }
        }
        let probe = self.data_dir.join(".write-test");
        fs::write(&probe, b"ok").with_context(|| {
            format!("data directory {} is not writable", self.data_dir.display())
        })?;
        let _ = fs::remove_file(&probe);
        Ok(())
    }

    pub fn ensure_jwt_secret(&mut self) -> Result<()> {
        if self.jwt_secret.len() >= 32 {
            return Ok(());
        }
        self.jwt_secret = load_or_create_jwt_secret(&self.jwt_secret_path)?;
        Ok(())
    }
}

pub fn generate_urlsafe_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn load_or_create_jwt_secret(path: &Path) -> Result<String> {
    if path.exists() {
        let value = fs::read_to_string(path)?.trim().to_string();
        if value.len() >= 32 {
            set_mode_600(path)?;
            return Ok(value);
        }
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let value = generate_urlsafe_token();
    fs::write(path, format!("{value}\n"))?;
    set_mode_600(path)?;
    Ok(value)
}

pub fn set_mode_600(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

pub fn generate_random_upper_alnum(len: usize) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::rngs::OsRng;
    let mut out = String::with_capacity(len);
    let mut buf = [0u8; 32];
    let mut idx = buf.len();
    for _ in 0..len {
        if idx == buf.len() {
            rng.fill_bytes(&mut buf);
            idx = 0;
        }
        let b = buf[idx];
        idx += 1;
        out.push(CHARS[(b as usize) % CHARS.len()] as char);
    }
    out
}

pub fn generate_random_hex_upper(num_bytes: usize) -> String {
    let mut buf = vec![0u8; num_bytes];
    rand::rngs::OsRng.fill_bytes(&mut buf);
    let mut out = String::with_capacity(num_bytes * 2);
    for b in buf {
        use std::fmt::Write;
        let _ = write!(&mut out, "{:02X}", b);
    }
    out
}
