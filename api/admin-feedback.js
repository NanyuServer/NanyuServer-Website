const fs = require('fs');
const path = require('path');

const feedbackFile = path.join(__dirname, '../data/feedback.json');

module.exports = async (req, res) => {
  if (!req.headers['x-admin-secret']) {
    return res.status(401).json({ error: '未授权访问' });
  }
  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(feedbackFile)) {
        return res.status(200).json([]);
      }

      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
      res.status(200).json(feedbacks);
    } catch (error) {
      console.error('Error reading feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, action, reply } = req.body;

      if (!fs.existsSync(feedbackFile)) {
        return res.status(404).json({ error: '反馈文件不存在' });
      }

      const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
      const feedbackIndex = feedbacks.findIndex(f => f.id === id);

      if (feedbackIndex === -1) {
        return res.status(404).json({ error: '反馈不存在' });
      }

      const feedback = feedbacks[feedbackIndex];

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

      feedback.updatedAt = new Date().toISOString();

      fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误' });
    }
  } else {
    res.status(405).json({ error: '方法不允许' });
  }
};
