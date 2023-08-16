use actix_web::{web, App, HttpServer};
use anyhow::Result;
use comm_services_lib::blob::client::BlobServiceClient;
use tracing::info;

use crate::{database::DatabaseClient, CONFIG};

pub async fn run_http_server(
  db_client: DatabaseClient,
  blob_client: BlobServiceClient,
) -> Result<()> {
  info!(
    "Starting HTTP server listening at port {}",
    CONFIG.http_port
  );

  let db = web::Data::new(db_client);
  let blob = web::Data::new(blob_client);

  HttpServer::new(move || {
    App::new()
      .wrap(tracing_actix_web::TracingLogger::default())
      .wrap(comm_services_lib::http::cors_config(
        CONFIG.localstack_endpoint.is_some(),
      ))
      .app_data(db.clone())
      .app_data(blob.clone())
      .service(
        web::resource("/hello").route(web::get().to(|| async { "world" })),
      )
  })
  .bind(("0.0.0.0", CONFIG.http_port))?
  .run()
  .await?;

  Ok(())
}
