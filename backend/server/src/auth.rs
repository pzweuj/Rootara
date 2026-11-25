use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

type HmacSha256 = Hmac<Sha256>;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SessionClaims {
    pub email: String,
    pub name: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Deserialize)]
struct JwtHeader {
    alg: String,
}

pub fn constant_time_eq_str(a: &str, b: &str) -> bool {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();
    if a_bytes.len() != b_bytes.len() {
        return false;
    }
    a_bytes.ct_eq(b_bytes).into()
}

pub fn constant_time_eq_sha256(a: &str, b: &str) -> bool {
    let da = Sha256::digest(a.as_bytes());
    let db = Sha256::digest(b.as_bytes());
    da.as_slice().ct_eq(db.as_slice()).into()
}

pub fn encode_jwt_hs256(claims: &SessionClaims, secret: &str) -> Result<String, String> {
    let header_b64 = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let payload_json = serde_json::to_vec(claims).map_err(|e| e.to_string())?;
    let payload_b64 = URL_SAFE_NO_PAD.encode(payload_json);
    let signing_input = format!("{header_b64}.{payload_b64}");

    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| format!("hmac key: {e}"))?;
    mac.update(signing_input.as_bytes());
    let sig_b64 = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    Ok(format!("{signing_input}.{sig_b64}"))
}

pub fn decode_jwt_hs256(
    token: &str,
    secret: &str,
    now_epoch_secs: i64,
) -> Option<serde_json::Value> {
    let mut parts = token.split('.');
    let header_b64 = parts.next()?;
    let payload_b64 = parts.next()?;
    let sig_b64 = parts.next()?;
    if parts.next().is_some() {
        return None;
    }

    let header_bytes = URL_SAFE_NO_PAD.decode(header_b64).ok()?;
    let header: JwtHeader = serde_json::from_slice(&header_bytes).ok()?;
    if header.alg != "HS256" {
        return None;
    }

    let sig_bytes = URL_SAFE_NO_PAD.decode(sig_b64).ok()?;
    let signing_input = format!("{header_b64}.{payload_b64}");
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(signing_input.as_bytes());
    let expected = mac.finalize().into_bytes();
    if sig_bytes.len() != expected.len() || !bool::from(sig_bytes.ct_eq(expected.as_slice())) {
        return None;
    }

    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let claims: serde_json::Value = serde_json::from_slice(&payload_bytes).ok()?;
    let obj = claims.as_object()?;
    let exp = obj.get("exp")?.as_i64()?;
    let _iat = obj.get("iat")?.as_i64()?;
    if now_epoch_secs >= exp {
        return None;
    }
    Some(claims)
}

pub fn extract_cookie<'a>(cookie_header: &'a str, name: &str) -> Option<&'a str> {
    for part in cookie_header.split(';') {
        let trimmed = part.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
            if k.trim() == name {
                return Some(v.trim());
            }
        }
    }
    None
}
