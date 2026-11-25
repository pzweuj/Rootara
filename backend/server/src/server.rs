use crate::config::RuntimeConfig;
use crate::http_private::build_private_router;
use crate::http_public::build_public_router;
use crate::init::initialize_database;
use crate::state::AppState;
use anyhow::{Context, Result};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::sync::watch;
use tracing::info;

pub async fn run_server(mut cfg: RuntimeConfig, skip_init: bool) -> Result<()> {
    if !skip_init {
        cfg.require_admin_password()?;
        cfg.ensure_data_directories()?;
        cfg.ensure_jwt_secret()?;
        let init_cfg = cfg.clone();
        tokio::task::spawn_blocking(move || initialize_database(&init_cfg)).await??;
    } else {
        cfg.ensure_data_directories()?;
        cfg.ensure_jwt_secret()?;
    }

    let state = AppState::new(cfg.clone())?;
    let private_router = build_private_router(state.clone());
    let public_router = build_public_router(state.clone());

    let backend_addr: SocketAddr = format!("{}:{}", cfg.backend_host, cfg.backend_port)
        .parse()
        .context("invalid backend listen address")?;
    let private_listener = TcpListener::bind(backend_addr)
        .await
        .with_context(|| format!("failed to bind private listener on {backend_addr}"))?;
    info!("Rootara private API listening on http://{backend_addr}");

    let public_listener = if cfg.disable_public {
        None
    } else {
        let public_addr: SocketAddr = format!("{}:{}", cfg.public_host, cfg.public_port)
            .parse()
            .context("invalid public listen address")?;
        let listener = TcpListener::bind(public_addr)
            .await
            .with_context(|| format!("failed to bind public listener on {public_addr}"))?;
        info!("Rootara public web server listening on http://{public_addr}");
        Some(listener)
    };

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    tokio::spawn(async move {
        wait_for_shutdown_signal().await;
        info!("Shutdown signal received");
        let _ = shutdown_tx.send(true);
    });

    let mut rx_priv = shutdown_rx.clone();
    let priv_server =
        axum::serve(private_listener, private_router).with_graceful_shutdown(async move {
            let _ = rx_priv.wait_for(|&v| v).await;
        });

    if let Some(pub_listener) = public_listener {
        let mut rx_pub = shutdown_rx.clone();
        let pub_server =
            axum::serve(pub_listener, public_router).with_graceful_shutdown(async move {
                let _ = rx_pub.wait_for(|&v| v).await;
            });
        let (r1, r2) = tokio::join!(priv_server, pub_server);
        r1?;
        r2?;
    } else {
        priv_server.await?;
    }

    state.import_queue.shutdown().await;
    info!("Rootara server stopped");
    Ok(())
}

async fn wait_for_shutdown_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut sigterm = signal(SignalKind::terminate()).expect("SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = sigterm.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
