const fs = require('fs');
const path = require('path');

const feedbackFile = path.join(__dirname, '../data/feedback.json');

// 确保数据目录存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化反馈数据文件
if (!fs.existsSync(feedbackFile)) {
  fs.writeFileSync(feedbackFile, JSON.stringify([], null, 2));
}

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!req.headers['x-admin-secret']) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (req.method === 'GET') {
    try {
      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
      res.status(200).json(feedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, action, status, reply } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
      const feedbackIndex = feedbacks.findIndex(f => f.id === id);

      if (feedbackIndex === -1) {
        return res.status(404).json({ error: '反馈不存在' });
      }

      const feedback = feedbacks[feedbackIndex];

      // 支持两种格式：action和status
      if (action) {
        switch (action) {
          case 'approve':
            feedback.status = 'approved';
            break;
          case 'reject':
            feedback.status = 'rejected';
            break;
          case 'transfer':
            feedback.status = 'transferred';
            break;
          case 'reply':
            feedback.status = 'replied';
            feedback.reply = reply || '';
            break;
          default:
            return res.status(400).json({ error: '无效操作' });
        }
      } else if (status) {
        const validStatuses = ['pending', 'approved', 'rejected', 'transferred', 'replied'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: '无效的状态' });
        }
        feedback.status = status;
        if (reply !== undefined) {
          feedback.reply = reply;
        }
      } else {
        return res.status(400).json({ error: '必须提供action或status' });
      }

      feedback.updatedAt = new Date().toISOString();

      fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

      res.status(200).json({ success: true, feedback });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
