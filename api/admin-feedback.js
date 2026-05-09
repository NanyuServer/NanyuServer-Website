const fs = require('fs');
const path = require('path');

const feedbackFile = path.join(__dirname, '../data/feedback.json');

// 初始化文件路径和数据
function ensureFeedbackFile() {
  try {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(feedbackFile)) {
      fs.writeFileSync(feedbackFile, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Error ensuring feedback file:', error);
  }
}

// 安全读取反馈数据
function readFeedbackData() {
  try {
    ensureFeedbackFile();
    const data = fs.readFileSync(feedbackFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading feedback data:', error);
    return [];
  }
}

// 安全写入反馈数据
function writeFeedbackData(data) {
  try {
    ensureFeedbackFile();
    fs.writeFileSync(feedbackFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing feedback data:', error);
    return false;
  }
}

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!req.headers['x-admin-secret']) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (req.method === 'GET') {
    try {
      const feedbacks = readFeedbackData();
      res.status(200).json(feedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, action, status, reply } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      const feedbacks = readFeedbackData();
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

      if (!writeFeedbackData(feedbacks)) {
        return res.status(500).json({ error: '保存失败' });
      }

      res.status(200).json({ success: true, feedback });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
