const storage = require('../lib/storage.js');

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
      let bodyData;
      
      // 解析请求体
      if (typeof req.body === 'string') {
        bodyData = JSON.parse(req.body);
      } else if (typeof req.body === 'object') {
        bodyData = req.body;
      } else {
        return res.status(400).json({ error: '无效的请求体' });
      }

      const { type, message } = bodyData;

      if (!type || !message) {
        return res.status(400).json({ error: '类型和内容不能为空' });
      }

      // 读取现有反馈
      const feedbacks = await storage.read();

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

      // 保存反馈
      const writeResult = await storage.write(feedbacks);
      if (!writeResult.success) {
        return res.status(500).json({ error: '保存失败: ' + writeResult.error });
      }

      res.status(200).json({ success: true, id: newFeedback.id });
    } catch (error) {
      console.error('Error saving feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const feedbacks = await storage.read();

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
      let bodyData;
      
      if (typeof req.body === 'string') {
        bodyData = JSON.parse(req.body);
      } else if (typeof req.body === 'object') {
        bodyData = req.body;
      } else {
        return res.status(400).json({ error: '无效的请求体' });
      }

      const { id, status, reply } = bodyData;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      const feedbacks = await storage.read();
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

      // 保存反馈
      const writeResult = await storage.write(feedbacks);
      if (!writeResult.success) {
        return res.status(500).json({ error: '保存失败: ' + writeResult.error });
      }

      res.status(200).json({ success: true, feedback });
    } catch (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({ error: '服务器错误: ' + error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      let bodyData;
      
      if (typeof req.body === 'string') {
        bodyData = JSON.parse(req.body);
      } else if (typeof req.body === 'object') {
        bodyData = req.body;
      } else {
        return res.status(400).json({ error: '无效的请求体' });
      }

      const { id } = bodyData;
      
      if (!id) {
        return res.status(400).json({ error: 'ID不能为空' });
      }

      let feedbacks = await storage.read();
      feedbacks = feedbacks.filter(f => f.id !== id);

      const writeResult = await storage.write(feedbacks);
      if (!writeResult.success) {
        return res.status(500).json({ error: '保存失败: ' + writeResult.error });
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
