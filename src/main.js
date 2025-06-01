const { invoke } = window.__TAURI__.core;

// 本地化资源
let currentLanguage = 'en';
let languageResources = {};

let todos = [];
// 当前排序状态
let currentSort = {
  field: 'completed',
  direction: 'asc' // asc 或 desc
};
const sortOptions = document.querySelectorAll('.sort-option');

let searchText = '';

async function buildTodoList() {
  todos = await get_todo();
  applyFilterAndSort();
  updateSortUI();
}

function renderTodos(todos, searchTerm = '') {
  const tasksContainer = document.querySelector("#tasks");
  tasksContainer.innerHTML = "";

  if (todos.length === 0) {
    tasksContainer.innerHTML = '<div class="todo-item"><p>No tasks found.</p></div>';
    return;
  }

  todos.forEach((todo) => {
    const todoElement = createTodoElement(todo, searchTerm);
    tasksContainer.appendChild(todoElement);
  });
  // 更新语言文本
  updateTextsLang(languageResources);
}

// 高亮处理函数
function highlightText(element, text, searchTerm) {
  if (!searchTerm || !text) {
    return element;
  }
  const regex = new RegExp(searchTerm, 'gi');
  const parts = text.split(regex);
  const matches = text.match(regex) || [];

  // 清空元素内容
  element.innerHTML = '';

  // 重新构建内容
  parts.forEach((part, index) => {
    // 添加普通文本部分
    if (part) {
      const textNode = document.createTextNode(part);
      element.appendChild(textNode);
    }
    // 添加高亮部分（如果有）
    if (index < matches.length) {
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'highlight';
      highlightSpan.textContent = matches[index];
      element.appendChild(highlightSpan);
    }
  });

  return element;
}

// 创建单个TODO元素
function createTodoElement(todo, searchTerm = '') {
  let div = document.createElement("div");
  div.classList.add("todo-wrapper");

  // 创建标题元素
  const titleElement = document.createElement('div');
  titleElement.className = 'todo-title';
  titleElement.textContent = todo.title;
  highlightText(titleElement, todo.title, searchTerm);

  // 创建内容元素
  const contextElement = document.createElement('div');
  contextElement.className = 'context';
  contextElement.textContent = todo.context || '';
  highlightText(contextElement, todo.context, searchTerm);

  div.innerHTML = `
<div class="todo-item" data-id="${todo.id}">
  <!-- 第一行 -->
  <div class="row header">
    <div class="title-group">
      <span class="todo-title"></span>
      <span class="deadline">${todo.deadline}</span>
    </div>
    <input type="checkbox" class="todo-check"
      data-id="${todo.id}" ${todo.completed ? 'checked' : ''}
    >
  </div>

  <!-- 第二行（默认状态） -->
  <div class="row actions default-content">
    <button class="btn delete" data-id="${todo.id}" data-i18n="delete">Delete</button>
    <button class="btn edit" data-id="${todo.id}" data-i18n="edit">Edit</button>
    <button class="btn unfold" data-i18n="unfold">▼ unfold</button>
  </div>

  <!-- 展开后的附加内容 -->
  <div class="expanded-content">
    <!-- 第二行（展开状态） -->
    <div class="row context"></div>

    <!-- 第三行 -->
    <div class="row meta">
      <span><span data-i18n="created_at_label">Created at: </span>${todo.created_at}</span>
      <span class="emergency"><span data-i18n="priority">Emergency Level: </span> ${todo.emergency_level}</span>
    </div>

    <!-- 第四行 -->
    <div class="row actions">
      <button class="btn delete" data-id="${todo.id}" data-i18n="delete">Delete</button>
      <button class="btn edit" data-id="${todo.id}" data-i18n="edit">Edit</button>
      <button class="btn fold" data-i18n="fold">▲ fold</button>
    </div>
  </div>
</div>
  `;
  // 将可能的高亮元素插入到正确位置
  div.querySelector('.todo-title').appendChild(titleElement);
  div.querySelector('.context').appendChild(contextElement);

  bindTodoEvents(div);
  return div;
}

window.addEventListener("DOMContentLoaded", () => {
  // 从 localStorage 读取主题或使用默认值
  const savedTheme = localStorage.getItem('theme') || 'light';
  toggleTheme(savedTheme);
  // 主题切换绑定
  document.getElementById('light-theme').addEventListener('click', () => {
    toggleTheme('light');
  });
  document.getElementById('dark-theme').addEventListener('click', () => {
    toggleTheme('dark');
  });

  // 初始化语言
  initLanguage();
  // 语言切换绑定
  document.getElementById('lang-zh').addEventListener('click', () => {
    changeLanguage('zh');
  });
  document.getElementById('lang-en').addEventListener('click', () => {
    changeLanguage('en');
  });

  buildTodoList();
  // sort init
  bindSortEvents();
  // search init
  initSearch();

  // 视图切换逻辑
  document.querySelectorAll('.menu-item').forEach(button => {
    button.addEventListener('click', (e) => {
      // 切换菜单激活状态
      document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');

      // 显示对应视图
      const targetId = e.target.dataset.target;
      document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
      });
      document.getElementById(targetId).classList.add('active');
    });
  });

  // 添加按钮打开添加模态框
  document.getElementById('add-btn').addEventListener('click', () => {
    document.getElementById('add-modal').style.display = 'block';
  });

  // 关闭模态框
  document.querySelectorAll('.cancel').forEach(button => {
    button.addEventListener('click', closeAllModals);
  });

  // 点击模态框外部关闭
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });

  // 添加表单提交
  document.querySelector("#add-todo-form").addEventListener("submit", (event) => {
    event.preventDefault();
    add_todo(
      document.getElementById('todo-title').value,
      document.getElementById('todo-context').value,
      document.getElementById('todo-deadline').value,
      parseInt(document.getElementById('todo-emergency').value),
    ).then(() => {
      buildTodoList();
      closeAllModals();
      document.getElementById('add-todo-form').reset();
    });
  });

  // 更新表单提交
  document.querySelector("#update-todo-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = parseInt(document.getElementById('update-id').value);
    const title = document.getElementById('update-title').value;
    const context = document.getElementById('update-context').value;
    const deadline = document.getElementById('update-deadline').value;
    const emergencyLevel = parseInt(document.getElementById('update-emergency').value);

    await update_todo(id, title, deadline, emergencyLevel, context);
    await buildTodoList();
    closeAllModals();
  });
});

// 打开更新模态框
function openUpdateModal(todo) {
  const modal = document.getElementById('update-modal');
  const form = document.getElementById('update-todo-form');

  // 填充表单数据
  let idInput = form.querySelector('#update-id');
  let titleInput = form.querySelector('#update-title');
  let contextInput = form.querySelector('#update-context');
  let deadlineInput = form.querySelector('#update-deadline');
  let emergencyInput = form.querySelector('#update-emergency');
  idInput.value = todo.id;
  titleInput.value = todo.title;
  contextInput.value = todo.context || '';
  deadlineInput.value = todo.deadline;
  emergencyInput.value = todo.emergency_level || '1';

  // 显示模态框
  modal.style.display = 'flex';
}

// 关闭所有模态框
function closeAllModals() {
  document.getElementById('add-modal').style.display = 'none';
  document.getElementById('update-modal').style.display = 'none';
}

// Rust 后端调用
async function add_todo(title, context, deadline, emergencyLevel) {
  return await invoke("add_todo", {
    title, context, deadline, emergencyLevel
  });
}

async function get_todo() {
  return await invoke("get_todo");
}

async function update_todo_done(completed, id) {
  return await invoke("update_todo_done", { completed, id });
}

async function delete_todo(id) {
  return await invoke("delete_todo", { id });
}

async function update_todo(
  id, title, deadline, emergencyLevel, context
) {
  return await invoke("update_todo", {
    id, title, deadline, emergencyLevel, context
  });
}
// 获取语言资源
async function get_lang_res(lang) {
  return await invoke("get_lang_res", { lang });
}

function bindTodoEvents(todoElement) {
  // Unfold按钮点击
  todoElement.querySelector('.unfold').addEventListener('click', () => {
    todoElement.querySelector('.default-content').classList.add('expanded');
    todoElement.querySelector('.expanded-content').classList.add('expanded');
  });

  // Fold按钮点击
  todoElement.querySelector('.fold').addEventListener('click', () => {
    todoElement.querySelector('.default-content').classList.remove('expanded');
    todoElement.querySelector('.expanded-content').classList.remove('expanded');
  });

  // 勾选框更新
  todoElement.querySelector('.todo-check').addEventListener('change', async (event) => {
    const id = parseInt(todoElement.querySelector('.todo-item').dataset.id);
    await update_todo_done(event.target.checked, parseInt(id));
    await buildTodoList();
  });

  // Delete按钮
  todoElement.querySelectorAll('.delete').forEach((el) => {
    el.addEventListener('click',async () => {
      const id = parseInt(todoElement.querySelector('.todo-item').dataset.id);
      await delete_todo(id);
      await buildTodoList();
    });
  });

  // Edit按钮
  todoElement.querySelectorAll('.edit').forEach((el) => {
    el.addEventListener('click', () => {
      const todo = {
        id: todoElement.querySelector('.todo-item').dataset.id,
        title: todoElement.querySelector('.todo-title').textContent,
        context: todoElement.querySelector('.context').textContent,
        deadline: todoElement.querySelector('.deadline').textContent,
        emergency_level: todoElement.querySelector('.emergency').textContent.split(': ')[1],
      }
      openUpdateModal(todo);
    });
  });
}

// 排序功能绑定
function bindSortEvents() {
  sortOptions.forEach(option => {
    option.addEventListener('click', () => {
      const field = option.dataset.field;
      // 如果点击的是当前激活的排序字段，则切换方向
      if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
      // 否则设置新字段，默认升序
        currentSort.field = field;
        currentSort.direction = 'asc';
      }
      // 更新过滤、排序并及排序字段渲染
      applyFilterAndSort();
      updateSortUI();
    });
  });
}

// 更新排序UI状态
function updateSortUI() {
  // 移除所有激活状态
  sortOptions.forEach(option => {
    option.classList.remove('active');
    const icon = option.querySelector('.icon');
    icon.textContent = icon.textContent.replace('↑', '').replace('↓', '');
  });

  // 激活当前排序字段
  if (currentSort.field) {
    const activeOption = document.querySelector(`.sort-option[data-field="${currentSort.field}"]`);
    activeOption.classList.add('active');
    // 添加方向指示器
    const icon = activeOption.querySelector('.icon');
    icon.textContent += currentSort.direction === 'asc' ? ' ↑' : ' ↓';
  }
}

// 初始化搜索功能
function initSearch() {
  const searchInput = document.getElementById('todo-search');
  const searchBtn = document.querySelector('.search-btn');

  // 输入事件
  searchInput.addEventListener('input', (e) => {
    searchText = e.target.value.trim().toLowerCase();
    applyFilterAndSort();
  });

  // 按钮点击事件
  searchBtn.addEventListener('click', () => {
    searchText = searchInput.value.trim().toLowerCase();
    applyFilterAndSort();
  });
}

// 应用过滤和排序
function applyFilterAndSort() {
  let filteredTodos = [...todos];

  // 应用搜索过滤
  if (searchText) {
    filteredTodos = filteredTodos.filter(todo => {
      const titleMatch = todo.title.toLowerCase().includes(searchText);
      const contextMatch = todo.context.toLowerCase().includes(searchText);
      return titleMatch || contextMatch;
    });
  }

  // 应用排序
  if (currentSort.field) {
    filteredTodos.sort((a, b) => {
      let valueA, valueB;
      switch (currentSort.field) {
        case 'completed':
          valueA = a.completed ? 1 : 0;
          valueB = b.completed ? 1 : 0;
          break;
        case 'created_at':
        case 'deadline':
          valueA = new Date(a[currentSort.field]);
          valueB = new Date(b[currentSort.field]);
          break;
        case 'emergency_level':
          valueA = a.emergency_level;
          valueB = b.emergency_level;
          break;
        default:
          return 0;
      }
      if (valueA < valueB) {
        return currentSort.direction === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return currentSort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  renderTodos(filteredTodos, searchText);
}

// 切换主题函数
function toggleTheme(themeName) {
  // 设置 data-theme 属性
  document.documentElement.setAttribute('data-theme', themeName);

  // 保存到 localStorage
  localStorage.setItem('theme', themeName);
}

// 更新页面文本
function updateTextsLang(langData) {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (langData[key]) {
      if (key.toLowerCase().includes('placeholder')) {
        element.setAttribute('placeholder', langData[key]);
      } else {
        element.textContent = langData[key];
      }
    }
  });
}

// 切换语言
async function changeLanguage(lang) {
  currentLanguage = lang;
  document.documentElement.setAttribute('lang', lang);
  const langData = await get_lang_res(lang);
  languageResources = langData;
  updateTextsLang(langData);
  localStorage.setItem('language', lang);
}

// 初始化语言
async function initLanguage() {
  const initLanguage = localStorage.getItem('language') || 'en';
  await changeLanguage(initLanguage);
}
