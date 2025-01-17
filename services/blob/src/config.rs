use anyhow::Result;
use clap::{ArgAction, Parser};
use once_cell::sync::Lazy;
use tracing::info;

use crate::constants::{
  DEFAULT_HTTP_PORT, DEFAULT_S3_BUCKET_NAME, S3_BUCKET_ENV_VAR,
};

#[derive(Parser)]
#[command(version, about, long_about = None)]
pub struct AppConfig {
  /// HTTP server listening port
  #[arg(long, default_value_t = DEFAULT_HTTP_PORT, global = true)]
  pub http_port: u16,
  /// AWS Localstack service URL
  #[arg(env = "LOCALSTACK_ENDPOINT")]
  #[arg(long)]
  pub localstack_endpoint: Option<String>,
  #[arg(env = S3_BUCKET_ENV_VAR)]
  #[arg(long, default_value_t = DEFAULT_S3_BUCKET_NAME.to_string())]
  pub s3_bucket_name: String,
  /// Identity service endpoint
  #[arg(env = "IDENTITY_SERVICE_ENDPOINT")]
  #[arg(long, default_value = "http://localhost:50054")]
  pub identity_endpoint: String,

  /// If set, blobs will be deleted instantly after revoking last holder
  #[arg(long, global = true, action = ArgAction::SetTrue)]
  pub instant_delete: bool,

  #[clap(subcommand)]
  pub command: Option<Command>,
}

#[derive(clap::Subcommand)]
pub enum Command {
  Server,
  Cleanup,
}

/// Stores configuration parsed from command-line arguments
/// and environment variables
pub static CONFIG: Lazy<AppConfig> = Lazy::new(AppConfig::parse);

/// Processes the command-line arguments and environment variables.
/// Should be called at the beginning of the `main()` function.
pub(super) fn parse_cmdline_args() -> Result<&'static AppConfig> {
  // force evaluation of the lazy initialized config
  let cfg = Lazy::force(&CONFIG);

  if cfg.s3_bucket_name != DEFAULT_S3_BUCKET_NAME {
    info!("Using custom S3 bucket: {}", &cfg.s3_bucket_name);
  }
  Ok(cfg)
}

/// Provides region/credentials configuration for AWS SDKs
pub async fn load_aws_config() -> aws_config::SdkConfig {
  let mut config_builder = aws_config::from_env();

  if let Some(endpoint) = &CONFIG.localstack_endpoint {
    info!("Using Localstack. AWS endpoint URL: {}", endpoint);
    config_builder = config_builder.endpoint_url(endpoint);
  }

  config_builder.load().await
}
