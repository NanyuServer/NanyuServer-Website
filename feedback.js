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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));

      // 创建新反馈
      const newFeedback = {
        id: Date.now().toString(),
        type,
        message,
        status: 'pending', // pending, approved, rejected, transferred, replied
        reply: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      feedbacks.push(newFeedback);

      // 保存到文件
      fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

      res.status(200).json({ success: true, id: newFeedback.id });
    } catch (error) {
      console.error('Error saving feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'GET') {
    try {
      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));

      // 返回已审核、转接中或已回复的内容
      const visibleFeedbacks = feedbacks.filter(f => ['approved','replied','transferred'].includes(f.status));
      
      // 按时间倒序排列
      visibleFeedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(200).json(visibleFeedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { id, status, reply } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
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
      fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

      res.status(200).json({ success: true, feedback });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      let feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
      feedbacks = feedbacks.filter(f => f.id !== id);

      fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
