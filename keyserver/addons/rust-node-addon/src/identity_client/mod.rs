pub mod add_reserved_usernames;
pub mod get_inbound_keys_for_user;
pub mod login;
pub mod prekey;
pub mod register_user;
pub mod remove_reserved_usernames;
pub mod upload_one_time_keys;

use client_proto::identity_client_service_client::IdentityClientServiceClient;
use client_proto::{
  AddReservedUsernamesRequest, DeviceKeyUpload, DeviceType, IdentityKeyInfo,
  InboundKeyInfo, PreKey, RegistrationFinishRequest, RegistrationStartRequest,
  RemoveReservedUsernameRequest, UploadOneTimeKeysRequest,
};
use grpc_clients::identity::authenticated::ChainedInterceptedAuthClient;
use grpc_clients::identity::protos::unauthenticated as client_proto;
use grpc_clients::identity::shared::CodeVersionLayer;
use lazy_static::lazy_static;
use napi::bindgen_prelude::*;
use serde::{Deserialize, Serialize};
use std::env::var;
use tonic::codegen::InterceptedService;
use tonic::{transport::Channel, Request};
use tracing::{self, info, instrument, warn, Level};
use tracing_subscriber::EnvFilter;

mod generated {
  // We get the CODE_VERSION from this generated file
  include!(concat!(env!("OUT_DIR"), "/version.rs"));
}

pub use generated::CODE_VERSION;
pub const DEVICE_TYPE: &str = "keyserver";

lazy_static! {
  static ref IDENTITY_SERVICE_CONFIG: IdentityServiceConfig = {
    let filter = EnvFilter::builder()
      .with_default_directive(Level::INFO.into())
      .with_env_var(EnvFilter::DEFAULT_ENV)
      .from_env_lossy();

    let subscriber = tracing_subscriber::fmt().with_env_filter(filter).finish();
    tracing::subscriber::set_global_default(subscriber)
      .expect("Unable to configure tracing");

    let config_json_string =
      var("COMM_JSONCONFIG_secrets_identity_service_config");
    match config_json_string {
      Ok(json) => serde_json::from_str(&json).unwrap(),
      Err(_) => IdentityServiceConfig::default(),
    }
  };
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdentityServiceConfig {
  identity_socket_addr: String,
}

impl Default for IdentityServiceConfig {
  fn default() -> Self {
    info!("Using default identity configuration");
    Self {
      identity_socket_addr: "http://[::1]:50054".to_string(),
    }
  }
}

async fn get_identity_client() -> Result<
  IdentityClientServiceClient<InterceptedService<Channel, CodeVersionLayer>>,
> {
  info!("Connecting to identity service");

  grpc_clients::identity::get_unauthenticated_client(
    &IDENTITY_SERVICE_CONFIG.identity_socket_addr,
    CODE_VERSION,
    DEVICE_TYPE.to_string(),
  )
  .await
  .map_err(|_| {
    Error::new(
      Status::GenericFailure,
      "Unable to connect to identity service".to_string(),
    )
  })
}

async fn get_authenticated_identity_client(
  user_id: String,
  device_id: String,
  access_token: String,
) -> Result<ChainedInterceptedAuthClient> {
  info!("Connecting to identity service");

  grpc_clients::identity::get_auth_client(
    &IDENTITY_SERVICE_CONFIG.identity_socket_addr,
    user_id,
    device_id,
    access_token,
    CODE_VERSION,
    DEVICE_TYPE.to_string(),
  )
  .await
  .map_err(|_| {
    Error::new(
      Status::GenericFailure,
      "Unable to connect to identity service".to_string(),
    )
  })
}

#[napi(object)]
pub struct SignedIdentityKeysBlob {
  pub payload: String,
  pub signature: String,
}

#[napi(object)]
pub struct UserLoginInfo {
  pub user_id: String,
  pub access_token: String,
}

#[napi(object)]
pub struct InboundKeyInfoResponse {
  pub payload: String,
  pub payload_signature: String,
  pub social_proof: Option<String>,
  pub content_prekey: String,
  pub content_prekey_signature: String,
  pub notif_prekey: String,
  pub notif_prekey_signature: String,
}

impl TryFrom<InboundKeyInfo> for InboundKeyInfoResponse {
  type Error = Error;

  fn try_from(key_info: InboundKeyInfo) -> Result<Self> {
    let identity_info = key_info
      .identity_info
      .ok_or(Error::from_status(Status::GenericFailure))?;

    let IdentityKeyInfo {
      payload,
      payload_signature,
      social_proof,
    } = identity_info;

    let content_prekey = key_info
      .content_prekey
      .ok_or(Error::from_status(Status::GenericFailure))?;

    let PreKey {
      pre_key: content_prekey_value,
      pre_key_signature: content_prekey_signature,
    } = content_prekey;

    let notif_prekey = key_info
      .notif_prekey
      .ok_or(Error::from_status(Status::GenericFailure))?;

    let PreKey {
      pre_key: notif_prekey_value,
      pre_key_signature: notif_prekey_signature,
    } = notif_prekey;

    Ok(Self {
      payload,
      payload_signature,
      social_proof,
      content_prekey: content_prekey_value,
      content_prekey_signature,
      notif_prekey: notif_prekey_value,
      notif_prekey_signature,
    })
  }
}

pub fn handle_grpc_error(error: tonic::Status) -> napi::Error {
  warn!("Received error: {}", error.message());
  Error::new(Status::GenericFailure, error.message())
}

#[cfg(test)]
mod tests {
  use super::CODE_VERSION;

  #[test]
  fn test_code_version_exists() {
    assert!(CODE_VERSION > 0);
  }
}
