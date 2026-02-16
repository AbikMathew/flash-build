import { IGeneratorService } from './GeneratorService';
import { GeneratorInput, GenerationEvent, GeneratedProject, ProjectFile } from '@/types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mock Generator — returns pre-built project templates with simulated delays.
 * Used for development/demo before real AI integration.
 */
export class MockGenerator implements IGeneratorService {
    readonly id = 'mock';
    readonly name = 'Mock Generator (Demo)';

    isAvailable(): boolean {
        return true;
    }

    async *generate(input: GeneratorInput): AsyncGenerator<GenerationEvent, GeneratedProject, undefined> {
        const template = this.selectTemplate(input.prompt);

        // Step 1: Planning
        yield { type: 'planning', message: 'Analyzing your requirements...', progress: 5, timestamp: new Date() };
        await delay(800);
        yield { type: 'planning', message: `Detected intent: "${template.metadata.description}"`, progress: 15, timestamp: new Date() };
        await delay(600);

        // Step 2: Analyzing inputs
        if (input.images.length > 0) {
            yield { type: 'analyzing', message: `Processing ${input.images.length} uploaded image(s)...`, progress: 20, timestamp: new Date() };
            await delay(500);
        }
        if (input.urls.length > 0) {
            yield { type: 'analyzing', message: `Analyzing reference URL: ${input.urls[0]}...`, progress: 25, timestamp: new Date() };
            await delay(500);
        }

        yield { type: 'planning', message: `Planning ${template.files.length} files for "${template.metadata.name}"...`, progress: 30, timestamp: new Date() };
        await delay(700);

        // Step 3: Code generation (stream files one by one)
        for (let i = 0; i < template.files.length; i++) {
            const file = template.files[i];
            const progress = 30 + Math.round(((i + 1) / template.files.length) * 50);
            yield { type: 'coding', message: `Creating ${file.path}...`, file, progress, timestamp: new Date() };
            await delay(400 + Math.random() * 300);
        }

        // Step 4: Review
        yield { type: 'reviewing', message: 'Running quality checks...', progress: 85, timestamp: new Date() };
        await delay(600);
        yield { type: 'reviewing', message: 'Validating component structure...', progress: 92, timestamp: new Date() };
        await delay(400);

        // Step 5: Complete
        yield { type: 'complete', message: 'Generation complete!', progress: 100, timestamp: new Date() };

        return template;
    }

    private selectTemplate(prompt: string): GeneratedProject {
        const lower = prompt.toLowerCase();
        if (lower.includes('dashboard') || lower.includes('admin')) return this.dashboardTemplate();
        if (lower.includes('landing') || lower.includes('website')) return this.landingTemplate();
        if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('store')) return this.ecommerceTemplate();
        return this.todoTemplate();
    }

    // ---- Templates ----

    private todoTemplate(): GeneratedProject {
        const files: ProjectFile[] = [
            {
                path: 'index.html',
                language: 'html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow - Smart Todo App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <h1>✦ TaskFlow</h1>
        <p class="subtitle">Organize your day, one task at a time</p>
      </div>
      <div class="stats">
        <span class="stat" id="total-count">0 tasks</span>
        <span class="stat" id="done-count">0 done</span>
      </div>
    </header>
    <main class="main">
      <div class="input-section">
        <input type="text" id="todo-input" placeholder="What needs to be done?" autocomplete="off">
        <select id="priority-select">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
        <button id="add-btn">Add Task</button>
      </div>
      <div class="filters">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="active">Active</button>
        <button class="filter-btn" data-filter="completed">Completed</button>
      </div>
      <ul id="todo-list" class="todo-list"></ul>
      <div class="empty-state" id="empty-state">
        <span class="empty-icon">📋</span>
        <p>No tasks yet. Add one above!</p>
      </div>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
            },
            {
                path: 'styles.css',
                language: 'css',
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #0a0a0f; --surface: #12121a; --surface-2: #1a1a2e;
  --border: #2a2a3e; --text: #e4e4f0; --text-muted: #8888aa;
  --accent: #7c5cfc; --accent-glow: #7c5cfc40;
  --success: #34d399; --danger: #f87171;
  --high: #f87171; --medium: #fbbf24; --low: #34d399;
}
body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; display: flex; justify-content: center; padding: 2rem 1rem; }
.app { width: 100%; max-width: 640px; }
.header { text-align: center; margin-bottom: 2rem; padding: 2rem; background: linear-gradient(135deg, var(--surface), var(--surface-2)); border-radius: 16px; border: 1px solid var(--border); }
.header h1 { font-size: 1.8rem; background: linear-gradient(135deg, var(--accent), #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem; }
.stats { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; }
.stat { background: var(--bg); padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.8rem; color: var(--text-muted); border: 1px solid var(--border); }
.input-section { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
#todo-input { flex: 1; padding: 0.8rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
#todo-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
#priority-select { padding: 0.8rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); cursor: pointer; }
#add-btn { padding: 0.8rem 1.5rem; background: var(--accent); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; transition: transform 0.15s, box-shadow 0.15s; }
#add-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 15px var(--accent-glow); }
.filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
.filter-btn { padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
.filter-btn.active, .filter-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
.todo-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.todo-item { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; transition: all 0.2s; animation: slideIn 0.3s ease; }
.todo-item:hover { border-color: var(--accent); transform: translateX(4px); }
.todo-item.completed .todo-text { text-decoration: line-through; color: var(--text-muted); }
.todo-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
.todo-check.checked { background: var(--success); border-color: var(--success); }
.todo-check.checked::after { content: '✓'; color: white; font-size: 12px; }
.todo-text { flex: 1; font-size: 0.95rem; }
.priority-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.priority-dot.high { background: var(--high); box-shadow: 0 0 6px var(--high); }
.priority-dot.medium { background: var(--medium); box-shadow: 0 0 6px var(--medium); }
.priority-dot.low { background: var(--low); box-shadow: 0 0 6px var(--low); }
.delete-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; padding: 0.2rem 0.5rem; border-radius: 6px; transition: all 0.2s; }
.delete-btn:hover { color: var(--danger); background: #f8717120; }
.empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
.empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 480px) { .input-section { flex-wrap: wrap; } #todo-input { min-width: 100%; } }`,
            },
            {
                path: 'app.js',
                language: 'javascript',
                content: `document.addEventListener('DOMContentLoaded', () => {
  let todos = [];
  let currentFilter = 'all';
  const input = document.getElementById('todo-input');
  const prioritySelect = document.getElementById('priority-select');
  const addBtn = document.getElementById('add-btn');
  const list = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const totalCount = document.getElementById('total-count');
  const doneCount = document.getElementById('done-count');
  const filterBtns = document.querySelectorAll('.filter-btn');

  function render() {
    const filtered = todos.filter(t => {
      if (currentFilter === 'active') return !t.completed;
      if (currentFilter === 'completed') return t.completed;
      return true;
    });
    list.innerHTML = filtered.map(t => \`
      <li class="todo-item \${t.completed ? 'completed' : ''}" data-id="\${t.id}">
        <div class="todo-check \${t.completed ? 'checked' : ''}" onclick="toggleTodo(\${t.id})"></div>
        <span class="priority-dot \${t.priority}"></span>
        <span class="todo-text">\${t.text}</span>
        <button class="delete-btn" onclick="deleteTodo(\${t.id})">×</button>
      </li>
    \`).join('');
    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
    totalCount.textContent = todos.length + ' task' + (todos.length !== 1 ? 's' : '');
    doneCount.textContent = todos.filter(t => t.completed).length + ' done';
  }

  window.toggleTodo = (id) => {
    todos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    render();
  };

  window.deleteTodo = (id) => {
    todos = todos.filter(t => t.id !== id);
    render();
  };

  function addTodo() {
    const text = input.value.trim();
    if (!text) return;
    todos.unshift({ id: Date.now(), text, priority: prioritySelect.value, completed: false });
    input.value = '';
    render();
  }

  addBtn.addEventListener('click', addTodo);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // Seed some demo data
  todos = [
    { id: 1, text: 'Design the user interface mockups', priority: 'high', completed: true },
    { id: 2, text: 'Set up project repository', priority: 'high', completed: true },
    { id: 3, text: 'Implement authentication flow', priority: 'medium', completed: false },
    { id: 4, text: 'Write API documentation', priority: 'low', completed: false },
    { id: 5, text: 'Configure CI/CD pipeline', priority: 'medium', completed: false },
  ];
  render();
});`,
            },
        ];

        return {
            files,
            metadata: { name: 'TaskFlow Todo', description: 'A smart todo app with priorities and filters', framework: 'Vanilla HTML/CSS/JS', createdAt: new Date() },
            previewHtml: this.bundleToHtml(files),
        };
    }

    private dashboardTemplate(): GeneratedProject {
        const files: ProjectFile[] = [
            {
                path: 'index.html',
                language: 'html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse Dashboard</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="logo">⚡ Pulse</div>
      <nav>
        <a href="#" class="nav-item active">📊 Overview</a>
        <a href="#" class="nav-item">👥 Users</a>
        <a href="#" class="nav-item">📈 Analytics</a>
        <a href="#" class="nav-item">💰 Revenue</a>
        <a href="#" class="nav-item">⚙️ Settings</a>
      </nav>
    </aside>
    <main class="content">
      <header class="topbar">
        <h2>Dashboard Overview</h2>
        <div class="topbar-actions">
          <input type="text" placeholder="Search..." class="search-input">
          <div class="avatar">AB</div>
        </div>
      </header>
      <div class="metrics">
        <div class="metric-card"><span class="metric-label">Total Users</span><span class="metric-value">12,847</span><span class="metric-change positive">+12.5%</span></div>
        <div class="metric-card"><span class="metric-label">Revenue</span><span class="metric-value">$48,295</span><span class="metric-change positive">+8.2%</span></div>
        <div class="metric-card"><span class="metric-label">Active Sessions</span><span class="metric-value">1,429</span><span class="metric-change negative">-3.1%</span></div>
        <div class="metric-card"><span class="metric-label">Conversion</span><span class="metric-value">3.24%</span><span class="metric-change positive">+0.8%</span></div>
      </div>
      <div class="grid-2">
        <div class="card chart-card">
          <h3>Revenue Trend</h3>
          <div class="chart" id="chart"></div>
        </div>
        <div class="card">
          <h3>Recent Activity</h3>
          <div class="activity-list" id="activity-list"></div>
        </div>
      </div>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
            },
            {
                path: 'styles.css',
                language: 'css',
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --bg: #06060a; --surface: #0f0f18; --surface-2: #16162a; --border: #1e1e3a; --text: #e8e8f0; --muted: #6b6b8a; --accent: #6d5cfd; --accent-glow: #6d5cfd30; --green: #34d399; --red: #f87171; }
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }
.dashboard { display: flex; min-height: 100vh; }
.sidebar { width: 220px; background: var(--surface); border-right: 1px solid var(--border); padding: 1.5rem 1rem; display: flex; flex-direction: column; gap: 2rem; }
.logo { font-size: 1.3rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding: 0 0.5rem; }
nav { display: flex; flex-direction: column; gap: 0.25rem; }
.nav-item { padding: 0.7rem 0.8rem; border-radius: 8px; color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: all 0.2s; }
.nav-item:hover, .nav-item.active { background: var(--accent-glow); color: var(--text); }
.nav-item.active { border-left: 3px solid var(--accent); }
.content { flex: 1; padding: 1.5rem 2rem; overflow-y: auto; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.topbar h2 { font-size: 1.4rem; }
.topbar-actions { display: flex; align-items: center; gap: 1rem; }
.search-input { padding: 0.5rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); outline: none; }
.search-input:focus { border-color: var(--accent); }
.avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 600; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; }
.metric-label { font-size: 0.8rem; color: var(--muted); }
.metric-value { font-size: 1.5rem; font-weight: 700; }
.metric-change { font-size: 0.8rem; font-weight: 500; }
.metric-change.positive { color: var(--green); }
.metric-change.negative { color: var(--red); }
.grid-2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 1rem; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; }
.card h3 { font-size: 1rem; margin-bottom: 1rem; }
.chart { height: 200px; display: flex; align-items: flex-end; gap: 6px; padding-top: 1rem; }
.chart-bar { flex: 1; background: linear-gradient(to top, var(--accent), #a78bfa); border-radius: 4px 4px 0 0; transition: height 0.6s ease; min-width: 8px; }
.chart-bar:hover { opacity: 0.8; }
.activity-list { display: flex; flex-direction: column; gap: 0.75rem; }
.activity-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem; border-radius: 8px; background: var(--bg); font-size: 0.85rem; }
.activity-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.activity-time { color: var(--muted); margin-left: auto; font-size: 0.75rem; }
@media (max-width: 768px) { .sidebar { display: none; } .metrics { grid-template-columns: repeat(2, 1fr); } .grid-2 { grid-template-columns: 1fr; } }`,
            },
            {
                path: 'app.js',
                language: 'javascript',
                content: `document.addEventListener('DOMContentLoaded', () => {
  // Render chart
  const chart = document.getElementById('chart');
  const data = [35, 55, 45, 70, 60, 85, 75, 90, 65, 80, 70, 95];
  data.forEach(val => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = val + '%';
    chart.appendChild(bar);
  });

  // Render activity
  const activities = [
    { text: 'New user signup: john@email.com', color: '#34d399', time: '2m ago' },
    { text: 'Payment received: $299.00', color: '#6d5cfd', time: '15m ago' },
    { text: 'Server alert: CPU 92%', color: '#f87171', time: '1h ago' },
    { text: 'Deployment completed', color: '#34d399', time: '2h ago' },
    { text: 'New feature flag enabled', color: '#fbbf24', time: '3h ago' },
  ];
  const list = document.getElementById('activity-list');
  activities.forEach(a => {
    const div = document.createElement('div');
    div.className = 'activity-item';
    div.innerHTML = \`<span class="activity-dot" style="background:\${a.color}"></span><span>\${a.text}</span><span class="activity-time">\${a.time}</span>\`;
    list.appendChild(div);
  });

  // Nav click
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
});`,
            },
        ];

        return {
            files,
            metadata: { name: 'Pulse Dashboard', description: 'Analytics dashboard with metrics, charts, and activity feed', framework: 'Vanilla HTML/CSS/JS', createdAt: new Date() },
            previewHtml: this.bundleToHtml(files),
        };
    }

    private landingTemplate(): GeneratedProject {
        const files: ProjectFile[] = [
            {
                path: 'index.html',
                language: 'html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nebula - Launch Your Ideas</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav class="navbar">
    <div class="nav-brand">🌀 Nebula</div>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#" class="btn-nav">Get Started</a>
    </div>
  </nav>
  <section class="hero">
    <div class="hero-badge">🚀 Now in Public Beta</div>
    <h1>Build Something<br><span class="gradient-text">Extraordinary</span></h1>
    <p class="hero-sub">The all-in-one platform to launch, scale, and manage your next big idea. No complexity, no compromises.</p>
    <div class="hero-actions">
      <button class="btn-primary" onclick="alert('Welcome aboard!')">Start Free Trial</button>
      <button class="btn-secondary">Watch Demo ▶</button>
    </div>
    <div class="hero-glow"></div>
  </section>
  <section class="features" id="features">
    <h2>Why teams choose <span class="gradient-text">Nebula</span></h2>
    <div class="feature-grid">
      <div class="feature-card"><span class="feature-icon">⚡</span><h3>Lightning Fast</h3><p>Sub-millisecond response times with our edge-first infrastructure.</p></div>
      <div class="feature-card"><span class="feature-icon">🔒</span><h3>Secure by Default</h3><p>Enterprise-grade security with SOC2 compliance built in.</p></div>
      <div class="feature-card"><span class="feature-icon">🔄</span><h3>Auto Scaling</h3><p>Scale from zero to millions without touching a config file.</p></div>
      <div class="feature-card"><span class="feature-icon">📊</span><h3>Real-time Analytics</h3><p>See what matters with beautiful, actionable dashboards.</p></div>
    </div>
  </section>
  <section class="pricing" id="pricing">
    <h2>Simple, Transparent <span class="gradient-text">Pricing</span></h2>
    <div class="pricing-grid">
      <div class="pricing-card"><h3>Starter</h3><div class="price">$0<span>/mo</span></div><ul><li>✓ 1,000 requests/day</li><li>✓ Basic analytics</li><li>✓ Community support</li></ul><button class="btn-outline">Start Free</button></div>
      <div class="pricing-card featured"><div class="popular-badge">Most Popular</div><h3>Pro</h3><div class="price">$29<span>/mo</span></div><ul><li>✓ Unlimited requests</li><li>✓ Advanced analytics</li><li>✓ Priority support</li><li>✓ Custom domains</li></ul><button class="btn-primary">Get Started</button></div>
      <div class="pricing-card"><h3>Enterprise</h3><div class="price">Custom</div><ul><li>✓ Everything in Pro</li><li>✓ SLA guarantee</li><li>✓ Dedicated support</li></ul><button class="btn-outline">Contact Sales</button></div>
    </div>
  </section>
  <footer class="footer"><p>© 2025 Nebula. Built with ❤</p></footer>
  <script src="app.js"></script>
</body>
</html>`,
            },
            {
                path: 'styles.css',
                language: 'css',
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --bg: #050510; --surface: #0c0c1d; --border: #1a1a35; --text: #e8e8f4; --muted: #7878a0; --accent: #7c5cfc; }
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }
.gradient-text { background: linear-gradient(135deg, #7c5cfc, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.navbar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 3rem; position: sticky; top: 0; background: rgba(5,5,16,0.8); backdrop-filter: blur(12px); z-index: 100; border-bottom: 1px solid var(--border); }
.nav-brand { font-size: 1.3rem; font-weight: 700; }
.nav-links { display: flex; align-items: center; gap: 2rem; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
.btn-nav { background: var(--accent) !important; color: white !important; padding: 0.5rem 1.2rem; border-radius: 8px; font-weight: 500; }
.hero { text-align: center; padding: 6rem 2rem 4rem; position: relative; }
.hero-badge { display: inline-block; padding: 0.4rem 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; font-size: 0.8rem; color: var(--accent); margin-bottom: 1.5rem; }
.hero h1 { font-size: 3.5rem; line-height: 1.1; margin-bottom: 1.5rem; }
.hero-sub { color: var(--muted); font-size: 1.1rem; max-width: 500px; margin: 0 auto 2rem; line-height: 1.6; }
.hero-actions { display: flex; gap: 1rem; justify-content: center; }
.btn-primary { padding: 0.8rem 2rem; background: var(--accent); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.95rem; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px #7c5cfc40; }
.btn-secondary { padding: 0.8rem 2rem; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; font-size: 0.95rem; transition: border-color 0.2s; }
.btn-secondary:hover { border-color: var(--accent); }
.hero-glow { position: absolute; top: 50%; left: 50%; width: 600px; height: 400px; background: radial-gradient(circle, #7c5cfc15, transparent); transform: translate(-50%, -50%); pointer-events: none; }
.features, .pricing { padding: 5rem 3rem; text-align: center; }
.features h2, .pricing h2 { font-size: 2rem; margin-bottom: 3rem; }
.feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; max-width: 900px; margin: 0 auto; }
.feature-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; text-align: left; transition: all 0.3s; }
.feature-card:hover { border-color: var(--accent); transform: translateY(-4px); }
.feature-icon { font-size: 1.8rem; display: block; margin-bottom: 0.8rem; }
.feature-card h3 { font-size: 1rem; margin-bottom: 0.5rem; }
.feature-card p { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }
.pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 800px; margin: 0 auto; }
.pricing-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 2rem 1.5rem; position: relative; transition: all 0.3s; }
.pricing-card.featured { border-color: var(--accent); transform: scale(1.05); }
.popular-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; padding: 0.2rem 0.8rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600; }
.price { font-size: 2.5rem; font-weight: 700; margin: 1rem 0; }
.price span { font-size: 0.9rem; color: var(--muted); }
.pricing-card ul { list-style: none; margin-bottom: 1.5rem; text-align: left; }
.pricing-card li { padding: 0.4rem 0; font-size: 0.85rem; color: var(--muted); }
.btn-outline { padding: 0.7rem 1.5rem; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 10px; cursor: pointer; width: 100%; transition: all 0.2s; }
.btn-outline:hover { border-color: var(--accent); }
.footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--border); }
@media (max-width: 768px) { .hero h1 { font-size: 2rem; } .feature-grid { grid-template-columns: repeat(2, 1fr); } .pricing-grid { grid-template-columns: 1fr; } .nav-links a:not(.btn-nav) { display: none; } }`,
            },
            {
                path: 'app.js',
                language: 'javascript',
                content: `document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      e.preventDefault();
      const el = document.querySelector(anchor.getAttribute('href'));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  });
  // Intersection observer for fade-in
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.feature-card, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'all 0.5s ease';
    observer.observe(el);
  });
});`,
            },
        ];

        return {
            files,
            metadata: { name: 'Nebula Landing', description: 'Modern SaaS landing page with features and pricing', framework: 'Vanilla HTML/CSS/JS', createdAt: new Date() },
            previewHtml: this.bundleToHtml(files),
        };
    }

    private ecommerceTemplate(): GeneratedProject {
        const files: ProjectFile[] = [
            {
                path: 'index.html',
                language: 'html',
                content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luxe Store</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <nav class="nav"><div class="nav-brand">✦ LUXE</div><div class="nav-links"><a href="#">Shop</a><a href="#">Collections</a><a href="#">About</a><button class="cart-btn" id="cart-btn">🛒 <span id="cart-count">0</span></button></div></nav>
  <section class="hero-shop"><h1>New Season<br><span class="accent">Arrivals</span></h1><p>Discover curated pieces for the modern lifestyle</p></section>
  <section class="products" id="products"><h2>Featured Products</h2><div class="product-grid" id="product-grid"></div></section>
  <div class="cart-overlay" id="cart-overlay"><div class="cart-panel"><h3>Your Cart</h3><div id="cart-items"></div><div class="cart-total">Total: $<span id="cart-total">0</span></div><button class="btn-checkout" onclick="alert('Checkout coming soon!')">Checkout</button><button class="btn-close" id="close-cart">×</button></div></div>
  <script src="app.js"></script>
</body>
</html>`,
            },
            {
                path: 'styles.css',
                language: 'css',
                content: `* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --bg: #08080e; --surface: #101018; --border: #1c1c30; --text: #eee; --muted: #888; --accent: #c084fc; }
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }
.accent { color: var(--accent); }
.nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem 3rem; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: rgba(8,8,14,0.9); backdrop-filter: blur(10px); z-index: 50; }
.nav-brand { font-size: 1.4rem; font-weight: 700; letter-spacing: 3px; }
.nav-links { display: flex; align-items: center; gap: 2rem; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 0.9rem; }
.nav-links a:hover { color: var(--text); }
.cart-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
.hero-shop { text-align: center; padding: 5rem 2rem 3rem; }
.hero-shop h1 { font-size: 3rem; margin-bottom: 0.5rem; }
.hero-shop p { color: var(--muted); }
.products { padding: 2rem 3rem 4rem; }
.products h2 { text-align: center; margin-bottom: 2rem; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
.product-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: all 0.3s; cursor: pointer; }
.product-card:hover { border-color: var(--accent); transform: translateY(-4px); }
.product-img { height: 200px; display: flex; align-items: center; justify-content: center; font-size: 4rem; background: linear-gradient(135deg, #1a1a2e, #16213e); }
.product-info { padding: 1rem; }
.product-name { font-weight: 600; margin-bottom: 0.3rem; }
.product-price { color: var(--accent); font-weight: 700; font-size: 1.1rem; }
.product-desc { color: var(--muted); font-size: 0.8rem; margin: 0.3rem 0 0.8rem; }
.add-to-cart { width: 100%; padding: 0.6rem; background: var(--accent); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
.add-to-cart:hover { opacity: 0.85; }
.cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; z-index: 100; justify-content: flex-end; }
.cart-overlay.open { display: flex; }
.cart-panel { width: 350px; background: var(--surface); padding: 1.5rem; overflow-y: auto; position: relative; border-left: 1px solid var(--border); }
.cart-panel h3 { margin-bottom: 1rem; }
.cart-item { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
.cart-total { font-size: 1.2rem; font-weight: 700; margin: 1rem 0; text-align: right; }
.btn-checkout { width: 100%; padding: 0.8rem; background: var(--accent); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }
.btn-close { position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--muted); font-size: 1.4rem; cursor: pointer; }
@media (max-width: 600px) { .hero-shop h1 { font-size: 2rem; } .nav { padding: 1rem; } .products { padding: 1rem; } }`,
            },
            {
                path: 'app.js',
                language: 'javascript',
                content: `document.addEventListener('DOMContentLoaded', () => {
  const products = [
    { id: 1, name: 'Minimal Watch', price: 189, emoji: '⌚', desc: 'Swiss-made precision' },
    { id: 2, name: 'Canvas Sneakers', price: 129, emoji: '👟', desc: 'Handcrafted comfort' },
    { id: 3, name: 'Leather Bag', price: 249, emoji: '👜', desc: 'Italian leather' },
    { id: 4, name: 'Sunglasses', price: 159, emoji: '🕶️', desc: 'UV400 polarized' },
    { id: 5, name: 'Wool Scarf', price: 79, emoji: '🧣', desc: 'Cashmere blend' },
    { id: 6, name: 'Ceramic Mug', price: 34, emoji: '☕', desc: 'Artisan crafted' },
  ];
  let cart = [];
  const grid = document.getElementById('product-grid');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const cartCount = document.getElementById('cart-count');

  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = \`<div class="product-img">\${p.emoji}</div><div class="product-info"><div class="product-name">\${p.name}</div><div class="product-desc">\${p.desc}</div><div class="product-price">$\${p.price}</div><button class="add-to-cart" data-id="\${p.id}">Add to Cart</button></div>\`;
    grid.appendChild(card);
  });

  grid.addEventListener('click', e => {
    if (e.target.classList.contains('add-to-cart')) {
      const id = parseInt(e.target.dataset.id);
      const product = products.find(p => p.id === id);
      const existing = cart.find(c => c.id === id);
      if (existing) existing.qty++;
      else cart.push({ ...product, qty: 1 });
      updateCart();
      e.target.textContent = '✓ Added';
      setTimeout(() => e.target.textContent = 'Add to Cart', 1000);
    }
  });

  function updateCart() {
    cartCount.textContent = cart.reduce((s, c) => s + c.qty, 0);
    cartItems.innerHTML = cart.map(c => \`<div class="cart-item"><span>\${c.emoji} \${c.name} x\${c.qty}</span><span>$\${c.price * c.qty}</span></div>\`).join('');
    cartTotal.textContent = cart.reduce((s, c) => s + c.price * c.qty, 0);
  }

  document.getElementById('cart-btn').addEventListener('click', () => cartOverlay.classList.add('open'));
  document.getElementById('close-cart').addEventListener('click', () => cartOverlay.classList.remove('open'));
  cartOverlay.addEventListener('click', e => { if (e.target === cartOverlay) cartOverlay.classList.remove('open'); });
});`,
            },
        ];

        return {
            files,
            metadata: { name: 'Luxe Store', description: 'E-commerce storefront with cart functionality', framework: 'Vanilla HTML/CSS/JS', createdAt: new Date() },
            previewHtml: this.bundleToHtml(files),
        };
    }

    /** Bundle multiple files into a single HTML string for iframe preview */
    private bundleToHtml(files: ProjectFile[]): string {
        const htmlFile = files.find(f => f.path.endsWith('.html'));
        const cssFile = files.find(f => f.path.endsWith('.css'));
        const jsFile = files.find(f => f.path.endsWith('.js'));

        if (!htmlFile) return '<html><body><p>No HTML file found</p></body></html>';

        let html = htmlFile.content;

        // Inline CSS
        if (cssFile) {
            html = html.replace(
                /<link[^>]*rel=["']stylesheet["'][^>]*>/i,
                `<style>${cssFile.content}</style>`
            );
        }

        // Inline JS
        if (jsFile) {
            html = html.replace(
                /<script[^>]*src=["'][^"']*["'][^>]*><\/script>/i,
                `<script>${jsFile.content}<\/script>`
            );
        }

        return html;
    }
}
