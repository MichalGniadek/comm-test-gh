use futures_util::SinkExt;
use tokio_tungstenite::{connect_async, tungstenite::Message};
mod proto {
  tonic::include_proto!("tunnelbroker");
}
use commtest::identity::device::create_device;
use futures_util::StreamExt;
use proto::tunnelbroker_service_client::TunnelbrokerServiceClient;
use proto::MessageToDevice;
use tunnelbroker_messages as messages;
use tunnelbroker_messages::{
  ConnectionInitializationMessage, DeviceTypes, RefreshKeyRequest,
};

#[tokio::test]
async fn send_refresh_request() {
  // Create session as a keyserver
  let (mut socket, _) = connect_async("ws://localhost:51001")
    .await
    .expect("Can't connect");

  let device_info = create_device().await;
  let session_request = ConnectionInitializationMessage {
    device_id: device_info.device_id.to_string(),
    access_token: device_info.access_token.to_string(),
    user_id: device_info.user_id.to_string(),
    notify_token: None,
    device_type: DeviceTypes::Keyserver,
    device_app_version: None,
    device_os: None,
  };

  let serialized_request = serde_json::to_string(&session_request)
    .expect("Failed to serialize connection request");

  socket
    .send(Message::Text(serialized_request))
    .await
    .expect("Failed to send message");

  // Send request for keyserver to refresh keys (identity service)
  let mut tunnelbroker_client =
    TunnelbrokerServiceClient::connect("http://localhost:50051")
      .await
      .unwrap();

  let refresh_request = messages::RefreshKeyRequest {
    device_id: device_info.device_id.clone(),
    number_of_keys: 5,
  };

  let payload = serde_json::to_string(&refresh_request).unwrap();
  let request = MessageToDevice {
    device_id: device_info.device_id.clone(),
    payload,
  };
  let grpc_message = tonic::Request::new(request);

  tunnelbroker_client
    .send_message_to_device(grpc_message)
    .await
    .unwrap();

  // Have keyserver receive any websocket messages
  let response = socket.next().await.unwrap().unwrap();

  // Check that message received by keyserver matches what identity server
  // issued
  let serialized_response: RefreshKeyRequest =
    serde_json::from_str(&response.to_text().unwrap()).unwrap();
  assert_eq!(serialized_response, refresh_request);
}

/// Test that a message to an offline device gets pushed to dynamodb
/// then recalled once a device connects
#[tokio::test]
async fn presist_messages() {
  // Send request for keyserver to refresh keys (identity service)
  let mut tunnelbroker_client =
    TunnelbrokerServiceClient::connect("http://localhost:50051")
      .await
      .unwrap();

  let refresh_request = messages::RefreshKeyRequest {
    device_id: "bar".to_string(),
    number_of_keys: 5,
  };

  let payload = serde_json::to_string(&refresh_request).unwrap();
  let request = MessageToDevice {
    device_id: "bar".to_string(),
    payload,
  };
  let grpc_message = tonic::Request::new(request);
  tunnelbroker_client
    .send_message_to_device(grpc_message)
    .await
    .unwrap();

  // Wait one second to ensure that message had time to persist
  use std::{thread, time};
  let ten_millis = time::Duration::from_millis(50);
  thread::sleep(ten_millis);

  // Create session as a keyserver
  let (mut socket, _) = connect_async("ws://localhost:51001")
    .await
    .expect("Can't connect");

  let session_request = r#"{
      "type": "sessionRequest",
      "accessToken": "xkdexfjsld",
      "deviceID": "bar",
      "deviceType": "keyserver"
    }"#;

  socket
    .send(Message::Text(session_request.to_string()))
    .await
    .expect("Failed to send message");

  // Have keyserver receive any websocket messages
  if let Some(Ok(response)) = socket.next().await {
    // Check that message received by keyserver matches what identity server
    // issued
    let serialized_response: RefreshKeyRequest =
      serde_json::from_str(&response.to_text().unwrap()).unwrap();
    assert_eq!(serialized_response, refresh_request);
  };
}
