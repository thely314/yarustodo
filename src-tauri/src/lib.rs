use tauri::{App, Manager};
use sqlx::{
    Sqlite,
    migrate::MigrateDatabase, 
    sqlite::SqlitePoolOptions
};
mod todo;

use todo::{
    AppState,
    Db,
    add_todo,
    get_todo,
    update_todo_done,
    delete_todo,
    update_todo,
    get_lang_res
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            add_todo,
            get_todo,
            update_todo_done,
            delete_todo,
            update_todo,
            get_lang_res
        ])
        .setup(|app| {
            tauri::async_runtime::block_on(async move {
                let db = setup_db(&app).await;
                app.manage(AppState{ db });
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn setup_db(app: &App) -> Db {
    let mut path = app.path().app_data_dir().expect("failed to get data_dir");

    match std::fs::create_dir_all(path.clone()) {
        Ok(_) => {}
        Err(err) => {
            panic!("error creating directory {}", err);
        }
    };

    path.push("yarust-todos.db");

    Sqlite::create_database(
        format!(
            "sqlite:{}",
            path.to_str().expect("path should be something")
        )
        .as_str(),
    )
    .await
    .expect("failed to create database");

    let db = SqlitePoolOptions::new()
        .connect(path.to_str().unwrap())
        .await
        .unwrap();

    sqlx::migrate!().run(&db).await.unwrap();

    db
}
