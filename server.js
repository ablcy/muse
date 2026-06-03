require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'muse_dev_secret_change_in_production';
const JWT_EXPIRES_IN = '7d';

// PostgreSQL 连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon')
    ? { rejectUnauthorized: false }
    : false,
});

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件（前端页面）
app.use(express.static(__dirname));

// ============================================================
// JWT 认证中间件
// ============================================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}

// ============================================================
// 认证 API
// ============================================================

// POST /api/auth/register - 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    if (username.length < 2 || username.length > 50) {
      return res.status(400).json({ error: '用户名长度需在 2-50 个字符之间' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度不能少于 6 个字符' });
    }

    // 检查用户名是否已存在
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '用户名已被注册' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('注册失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/auth/login - 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('登录失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/auth/me - 获取当前用户信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('获取用户信息失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 便签 CRUD API
// ============================================================

// GET /api/notes - 获取当前用户的所有便签
app.get('/api/notes', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, content, created_at FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ notes: result.rows });
  } catch (err) {
    console.error('获取便签失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// POST /api/notes - 创建便签
app.post('/api/notes', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '便签内容不能为空' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '便签内容不能超过 500 字' });
    }

    const result = await pool.query(
      'INSERT INTO notes (user_id, content) VALUES ($1, $2) RETURNING id, content, created_at',
      [req.userId, content.trim()]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (err) {
    console.error('创建便签失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// DELETE /api/notes/:id - 删除便签
app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证便签属于当前用户
    const check = await pool.query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: '便签不存在' });
    }

    await pool.query('DELETE FROM notes WHERE id = $1', [id]);
    res.json({ message: '便签已删除' });
  } catch (err) {
    console.error('删除便签失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============================================================
// 启动服务
// ============================================================
app.listen(PORT, () => {
  console.log(`Muse API 服务已启动: http://localhost:${PORT}`);
});
（内容由AI生成，仅供参考）
