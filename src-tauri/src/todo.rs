/*
The table stores todos is named "todos"
*/
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Pool, Sqlite};
use futures::TryStreamExt;
use chrono::NaiveDateTime;
use tauri::{Manager, path::BaseDirectory};

pub type Db = Pool<Sqlite>;
pub struct AppState {
    pub db: Db,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Todo {
    id: u16,
    title: String,
    completed: bool,
    created_at: String,
    deadline: String,
    emergency_level: u8,
    context: String,
}

#[tauri::command(async)]
pub async fn add_todo(
    state: tauri::State<'_, AppState>, title: &str, context: &str,
    deadline: &str, emergency_level: u8
) -> Result<(), String> {
    let db = &state.db;
    let format_deadline = parse_datetime(deadline);

    sqlx::query("INSERT INTO todos (\
        title, deadline, emergency_level, context) VALUES (?1, ?2, ?3, ?4);")
        .bind(title)
        .bind(format_deadline.as_str())
        .bind(emergency_level)
        .bind(context)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to save todo: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_todo(
    state: tauri::State<'_, AppState>
) -> Result<Vec<Todo>, String> {
    let db = &state.db;

    let todos: Vec<Todo> = sqlx::query_as::<_, Todo>(
        "SELECT id, title, completed, datetime(created_at, 'localtime') AS created_at, deadline, emergency_level, context FROM todos;")
        .fetch(db)
        .try_collect()
        .await
        .map_err(|e| format!("Failed to get todos {}", e))?;

    Ok(todos)
}

#[tauri::command]
pub async fn update_todo_done(
    state: tauri::State<'_, AppState>, completed: bool, id: u16
) -> Result<(), String> {
    let db = &state.db;

    sqlx::query("UPDATE todos SET completed = ?1 WHERE id = ?2;")
        .bind(completed)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to update todo {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_todo(
    state: tauri::State<'_, AppState>, id: u16
) -> Result<(), String> {
    let db = &state.db;

    sqlx::query("DELETE FROM todos WHERE id = ?1;")
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to delete todo {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_todo(
    state: tauri::State<'_, AppState>, id: u16, title: &str,
    deadline: &str, emergency_level: u8, context: &str
) -> Result<(), String> {
    let db = &state.db;
    let format_deadline = parse_datetime(deadline);

    sqlx::query("UPDATE todos \
        SET title = ?1, deadline = ?2, \
        emergency_level = ?3, context = ?4 WHERE id = ?5;")
        .bind(title)
        .bind(format_deadline)
        .bind(emergency_level)
        .bind(context)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to update todo {}", e))?;

    Ok(())
}

// 时间解析函数
fn parse_datetime(datetime_str: &str) -> String {
    // 解析本地时间
    let naive = NaiveDateTime::parse_from_str(datetime_str, "%Y-%m-%dT%H:%M")
        .map_err(|e| format!("Time parse error: {}", e)).unwrap();
    naive.format("%Y-%m-%d %H:%M").to_string()
}

#[tauri::command]
pub async fn get_lang_res(handle: tauri::AppHandle, lang: &str) -> Result<serde_json::Value, String> {
    let resource_path = handle.path().resolve(
        format!("lang/{}.json", lang), BaseDirectory::Resource
    ).map_err(|e| e.to_string())?;

    let content = tokio::fs::read_to_string(&resource_path)
        .await
        .map_err(|e| format!("Failed to read language file: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse language JSON: {}", e))
}