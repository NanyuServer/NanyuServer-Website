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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { type, message } = req.body;

      if (!type || !message) {
        return res.status(400).json({ error: '类型和内容不能为空' });
      }

      // 读取现有反馈
      const feedbacks = readFeedbackData();

      // 创建新反馈
      const newFeedback = {
        id: Date.now().toString(),
        type,
        message,
        status: 'pending',
        reply: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      feedbacks.push(newFeedback);

      // 保存到文件
      if (!writeFeedbackData(feedbacks)) {
        return res.status(500).json({ error: '保存失败' });
      }

      res.status(200).json({ success: true, id: newFeedback.id });
    } catch (error) {
      console.error('Error saving feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const feedbacks = readFeedbackData();

      // 返回已审核、转接中或已回复的内容
      const visibleFeedbacks = feedbacks.filter(f => ['approved','replied','transferred'].includes(f.status));
      
      // 按时间倒序排列
      visibleFeedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(200).json(visibleFeedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { id, status, reply } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      const feedbacks = readFeedbackData();
      const feedback = feedbacks.find(f => f.id === id);

      if (!feedback) {
        return res.status(404).json({ error: '反馈不存在' });
      }

      // 更新状态和回复
      if (status) {
        feedback.status = status;
      }
      if (reply !== undefined) {
        feedback.reply = reply;
      }
      feedback.updatedAt = new Date().toISOString();

      // 保存到文件
      if (!writeFeedbackData(feedbacks)) {
        return res.status(500).json({ error: '保存失败' });
      }

      res.status(200).json({ success: true, feedback });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      let feedbacks = readFeedbackData();
      feedbacks = feedbacks.filter(f => f.id !== id);

      if (!writeFeedbackData(feedbacks)) {
        return res.status(500).json({ error: '保存失败' });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
