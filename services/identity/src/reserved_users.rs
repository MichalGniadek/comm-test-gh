use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use constant_time_eq::constant_time_eq;
use ed25519_dalek::{PublicKey, Signature, Verifier};
use serde::Deserialize;
use tonic::Status;

use crate::config::CONFIG;

// This type should not be changed without making equivalent changes to
// `ReservedUsernameMessage` in lib/types/crypto-types.js
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Message<T> {
  statement: String,
  payload: T,
  issued_at: String,
}

// This type should not be changed without making equivalent changes to
// `ReservedUsernameMessage` in lib/types/crypto-types.js
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsernameAndID {
  username: String,
  #[serde(rename = "userID")]
  user_id: String,
}

fn validate_and_decode_message<T: serde::de::DeserializeOwned>(
  keyserver_message: &str,
  keyserver_signature: &str,
  expected_statement: &[u8],
) -> Result<Message<T>, Status> {
  let deserialized_message: Message<T> =
    serde_json::from_str(keyserver_message)
      .map_err(|_| Status::invalid_argument("message format invalid"))?;

  if !constant_time_eq(
    deserialized_message.statement.as_bytes(),
    expected_statement,
  ) {
    return Err(Status::invalid_argument("message invalid"));
  }

  let issued_at: DateTime<Utc> = deserialized_message
    .issued_at
    .parse()
    .map_err(|_| Status::invalid_argument("message format invalid"))?;

  let now = Utc::now();
  if (now - issued_at).num_seconds() > 5 {
    return Err(Status::invalid_argument("message invalid"));
  }

  let signature_bytes = general_purpose::STANDARD_NO_PAD
    .decode(keyserver_signature)
    .map_err(|_| Status::invalid_argument("signature invalid"))?;

  let signature = Signature::from_bytes(&signature_bytes)
    .map_err(|_| Status::invalid_argument("signature invalid"))?;

  let public_key_string = CONFIG
    .keyserver_public_key
    .clone()
    .ok_or_else(|| Status::failed_precondition("missing key"))?;

  let public_key_bytes = general_purpose::STANDARD_NO_PAD
    .decode(public_key_string)
    .map_err(|_| Status::failed_precondition("malformed key"))?;

  let public_key: PublicKey = PublicKey::from_bytes(&public_key_bytes)
    .map_err(|_| Status::failed_precondition("malformed key"))?;

  public_key
    .verify(keyserver_message.as_bytes(), &signature)
    .map_err(|_| Status::permission_denied("verification failed"))?;

  Ok(deserialized_message)
}

pub fn validate_account_ownership_message_and_get_user_id(
  username: &str,
  keyserver_message: &str,
  keyserver_signature: &str,
) -> Result<String, Status> {
  const EXPECTED_STATEMENT: &[u8; 60] =
    b"This user is the owner of the following username and user ID";

  let deserialized_message = validate_and_decode_message::<UsernameAndID>(
    keyserver_message,
    keyserver_signature,
    EXPECTED_STATEMENT,
  )?;

  if deserialized_message.payload.username != username {
    return Err(Status::invalid_argument("message invalid"));
  }

  Ok(deserialized_message.payload.user_id)
}

pub fn validate_add_reserved_usernames_message(
  keyserver_message: &str,
  keyserver_signature: &str,
) -> Result<Vec<String>, Status> {
  let deserialized_message = validate_and_decode_message::<Vec<String>>(
    keyserver_message,
    keyserver_signature,
    b"Add the following usernames to reserved list",
  )?;

  Ok(deserialized_message.payload)
}

pub fn validate_remove_reserved_username_message(
  keyserver_message: &str,
  keyserver_signature: &str,
) -> Result<String, Status> {
  let deserialized_message = validate_and_decode_message::<String>(
    keyserver_message,
    keyserver_signature,
    b"Remove the following username from reserved list",
  )?;

  Ok(deserialized_message.payload)
}
