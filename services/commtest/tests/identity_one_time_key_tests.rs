use commtest::identity::device::{
  create_device, DEVICE_TYPE, PLACEHOLDER_CODE_VERSION,
};
use commtest::service_addr;
use grpc_clients::identity::{
  get_unauthenticated_client, protos::client::UploadOneTimeKeysRequest,
};

#[tokio::test]
async fn verify_access_token() {
  let device_info = create_device(None).await;

  let mut identity_client = get_unauthenticated_client(
    &service_addr::IDENTITY_GRPC.to_string(),
    PLACEHOLDER_CODE_VERSION,
    DEVICE_TYPE.to_string(),
  )
  .await
  .expect("Couldn't connect to identity service");

  let upload_request = UploadOneTimeKeysRequest {
    user_id: device_info.user_id,
    device_id: device_info.device_id,
    access_token: device_info.access_token,
    content_one_time_pre_keys: vec![
      "content1".to_string(),
      "content2".to_string(),
    ],
    notif_one_time_pre_keys: vec!["notif1".to_string(), "notif2".to_string()],
  };

  identity_client
    .upload_one_time_keys(upload_request)
    .await
    .unwrap();
}
