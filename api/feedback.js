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

      res.status(200).json(visibleFeedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
